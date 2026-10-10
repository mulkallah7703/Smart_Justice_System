import { AppError } from '../src/shared/exceptions/app-error';
import { MockEmbeddingProvider } from '../src/modules/ai/providers/mock/mock-embedding.provider';
import { MockLlmProvider } from '../src/modules/ai/providers/mock/mock-llm.provider';
import { MockOcrProvider } from '../src/modules/ai/providers/mock/mock-ocr.provider';
import type { OcrPageInput } from '../src/modules/ai/providers/ocr-provider.interface';
import {
  MOCK_FAIL_ALWAYS,
  MOCK_FAIL_ONCE,
  resetMockDirectives,
} from '../src/modules/ai/providers/mock/mock-directives';

/** Mirrors what the extractor hands the adapter: bytes, never a storage key. */
const pageInput = (label: string, pageNumber = 1): OcrPageInput => ({
  image: Buffer.from(`MOCK_PAGE_IMAGE:${label}:${pageNumber}`, 'utf8'),
  mimeType: 'image/png',
  languageHints: ['ar', 'en'],
  pageNumber,
});

describe('mock AI providers', () => {
  const llm = new MockLlmProvider();
  const embeddings = new MockEmbeddingProvider(8);
  const ocr = new MockOcrProvider();

  beforeEach(() => {
    resetMockDirectives();
  });

  it('never performs network access', async () => {
    const spy = jest.spyOn(globalThis, 'fetch');

    await Promise.all([
      llm.complete({ instruction: 'i', untrustedContext: ['a'] }),
      embeddings.embed({ texts: ['a'] }),
      ocr.recognise(pageInput('a')),
    ]);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  describe('LLM', () => {
    it('returns the same output for the same input', async () => {
      const input = {
        instruction: 'summarise',
        untrustedContext: ['alpha', 'beta'],
      };

      const first = await llm.complete(input);
      const second = await llm.complete(input);

      expect(first.text).toBe(second.text);
      expect(first.model).toBe('mock-llm-v1');
      expect(first.text).toMatch(/^MOCK_LLM_OUTPUT:/);
    });

    it('returns different output for different input', async () => {
      const first = await llm.complete({
        instruction: 'summarise',
        untrustedContext: ['alpha'],
      });
      const second = await llm.complete({
        instruction: 'summarise',
        untrustedContext: ['beta'],
      });

      expect(first.text).not.toBe(second.text);
    });
  });

  describe('embeddings', () => {
    it('returns a stable vector of the declared dimensions', async () => {
      const first = await embeddings.embed({ texts: ['alpha'] });
      const second = await embeddings.embed({ texts: ['alpha'] });

      expect(first.vectors).toEqual(second.vectors);
      expect(first.dimensions).toBe(embeddings.dimensions);
      expect(first.vectors[0]).toHaveLength(embeddings.dimensions);
      first.vectors[0].forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it('returns one vector per input text, in order', async () => {
      const result = await embeddings.embed({ texts: ['alpha', 'beta'] });
      const alphaOnly = await embeddings.embed({ texts: ['alpha'] });

      expect(result.vectors).toHaveLength(2);
      expect(result.vectors[0]).toEqual(alphaOnly.vectors[0]);
    });
  });

  describe('OCR', () => {
    it('accepts page bytes and returns deterministic marked text', async () => {
      const first = await ocr.recognise(pageInput('abc'));
      const second = await ocr.recognise(pageInput('abc'));

      expect(first.engine).toBe('mock-ocr-v1');
      expect(first.text).toMatch(/^MOCK_OCR_TEXT:/);
      expect(first.text).toBe(second.text);
      expect(first.warnings).toContain('MOCK_OCR_NO_RECOGNITION_PERFORMED');
    });

    it('returns different text for different pages of the same document', async () => {
      const page1 = await ocr.recognise(pageInput('abc', 1));
      const page2 = await ocr.recognise(pageInput('abc', 2));

      expect(page1.text).not.toBe(page2.text);
    });

    it('reports a null confidence rather than inventing a measurement', async () => {
      const result = await ocr.recognise(pageInput('abc'));

      expect(result.confidence).toBeNull();
    });

    it('takes no storage key and exposes no storage or database surface', () => {
      // The contract is bytes in, text out. A storage key would let an adapter
      // read objects it was never granted access to.
      const input = pageInput('abc');

      expect(Object.keys(input).sort()).toEqual([
        'image',
        'languageHints',
        'mimeType',
        'pageNumber',
      ]);
      expect(JSON.stringify(input)).not.toContain('users/');
      expect(Reflect.ownKeys(MockOcrProvider.prototype)).toEqual([
        'constructor',
        'recognise',
      ]);
    });
  });

  describe('reproducible failures', () => {
    it('fails every call for the always-fail marker', async () => {
      const input = pageInput(MOCK_FAIL_ALWAYS);

      await expect(ocr.recognise(input)).rejects.toBeInstanceOf(AppError);
      await expect(ocr.recognise(input)).rejects.toBeInstanceOf(AppError);
    });

    it('fails only the first call for the fail-once marker', async () => {
      const input = pageInput(MOCK_FAIL_ONCE);

      await expect(ocr.recognise(input)).rejects.toMatchObject({
        code: 'AI_PROVIDER_ERROR',
      });
      await expect(ocr.recognise(input)).resolves.toBeDefined();
    });

    it('resets between tests so failures stay reproducible', async () => {
      const input = pageInput(MOCK_FAIL_ONCE);

      await expect(ocr.recognise(input)).rejects.toBeDefined();
      resetMockDirectives();
      await expect(ocr.recognise(input)).rejects.toBeDefined();
    });
  });
});
