import { MockOcrProvider } from '../src/modules/ai/providers/mock/mock-ocr.provider';
import { MockTextExtractor } from '../src/modules/ai/providers/mock/mock-text-extractor.provider';
import { resetMockDirectives } from '../src/modules/ai/providers/mock/mock-directives';
import {
  EXTRACTION_METHODS,
  isExtractedTextPage,
} from '../src/modules/ai/providers/text-extractor.interface';
import type {
  DocumentSource,
  ExtractedDocument,
  ExtractedTextPage,
} from '../src/modules/ai/providers/text-extractor.interface';
import type {
  OcrPageInput,
  OcrPageResult,
  OcrProvider,
} from '../src/modules/ai/providers/ocr-provider.interface';

const pdf = (documentId = 'doc-1'): DocumentSource => ({
  documentId,
  bytes: Buffer.from('%PDF-1.4\ntrailer\n%%EOF\n'),
  mimeType: 'application/pdf',
  languageHints: ['ar', 'en'],
});

const image = (documentId = 'doc-1'): DocumentSource => ({
  documentId,
  bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  mimeType: 'image/png',
  languageHints: ['ar', 'en'],
});

/**
 * The mock extractor recognises inline, so every page it returns already
 * carries text. Narrowing here keeps the assertions readable.
 */
const textPages = (result: ExtractedDocument): ExtractedTextPage[] =>
  result.pages.filter(isExtractedTextPage);

/** Records exactly what the extractor hands the recognition boundary. */
const createRecordingOcr = (): {
  provider: OcrProvider;
  calls: OcrPageInput[];
} => {
  const calls: OcrPageInput[] = [];
  const provider: OcrProvider = {
    name: 'recording',
    recognise: (input: OcrPageInput): Promise<OcrPageResult> => {
      calls.push(input);
      return Promise.resolve({
        text: `RECOGNISED:${input.pageNumber}`,
        confidence: 0.5,
        language: 'ar',
        warnings: [],
        engine: 'recording-v1',
      });
    },
  };
  return { provider, calls };
};

describe('text extractor contract', () => {
  beforeEach(() => {
    resetMockDirectives();
  });

  it('exposes exactly two extraction methods', () => {
    expect([...EXTRACTION_METHODS]).toEqual(['TEXT_LAYER', 'OCR']);
  });

  it('takes retrieved bytes, never a storage key', () => {
    expect(Object.keys(pdf()).sort()).toEqual([
      'bytes',
      'documentId',
      'languageHints',
      'mimeType',
    ]);
  });
});

describe('MockTextExtractor', () => {
  let extractor: MockTextExtractor;

  beforeEach(() => {
    resetMockDirectives();
    extractor = new MockTextExtractor(new MockOcrProvider());
  });

  it('preserves page boundaries instead of concatenating pages', async () => {
    const result = await extractor.extract(pdf());

    expect(result.pages).toHaveLength(2);
    expect(new Set(textPages(result).map((page) => page.text)).size).toBe(2);
  });

  it('numbers pages from one, contiguously', async () => {
    const result = await extractor.extract(pdf());

    expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    expect(result.pages.some((page) => page.pageNumber === 0)).toBe(false);
  });

  it('keeps every page attributed to the document it came from', async () => {
    const result = await extractor.extract(pdf('doc-42'));

    expect(result.documentId).toBe('doc-42');
    result.pages.forEach((page) => {
      expect(page.documentId).toBe('doc-42');
    });
  });

  it('exercises both routes for a mixed document', async () => {
    const result = await extractor.extract(pdf());

    expect(textPages(result).map((page) => page.method)).toEqual([
      'TEXT_LAYER',
      'OCR',
    ]);
  });

  it('routes an image entirely to OCR, since a raster page has no text layer', async () => {
    const result = await extractor.extract(image());

    expect(result.pages).toHaveLength(1);
    expect(textPages(result)[0].method).toBe('OCR');
    expect(textPages(result)[0].pageNumber).toBe(1);
  });

  it('produces identical output for identical input', async () => {
    const first = await extractor.extract(pdf('doc-stable'));
    resetMockDirectives();
    const second = await new MockTextExtractor(new MockOcrProvider()).extract(
      pdf('doc-stable'),
    );

    expect(first).toEqual<ExtractedDocument>(second);
  });

  it('marks its output so it cannot be mistaken for real extraction', async () => {
    const result = await extractor.extract(pdf());

    expect(result.engine).toBe('mock-text-extractor-v1');
    expect(textPages(result)[0].text).toMatch(/^MOCK_TEXT_LAYER:/);
    expect(textPages(result)[0].warnings).toContain(
      'MOCK_EXTRACTION_NO_PARSING_PERFORMED',
    );
    expect(textPages(result)[1].text).toMatch(/^MOCK_OCR_TEXT:/);
  });

  it('reports the OCR engine only when a page actually needed OCR', async () => {
    const withOcr = await extractor.extract(pdf());

    expect(withOcr.ocrEngine).toBe('mock-ocr-v1');
  });

  it('reports no confidence for a text layer, which has no such notion', async () => {
    const result = await extractor.extract(pdf());

    expect(textPages(result)[0].confidence).toBeNull();
  });

  it('assigns TRUSTED to mock TEXT_LAYER and REVIEW_REQUIRED to mock OCR', async () => {
    const result = await extractor.extract(pdf());
    const pages = textPages(result);

    expect(pages[0].method).toBe('TEXT_LAYER');
    expect(pages[0].trust).toBe('TRUSTED');
    expect(pages[1].method).toBe('OCR');
    expect(pages[1].trust).toBe('REVIEW_REQUIRED');
  });

  it('assigns REVIEW_REQUIRED to image OCR even when confidence is present', async () => {
    const { provider } = createRecordingOcr();
    const result = await new MockTextExtractor(provider).extract(image());

    expect(textPages(result)[0].trust).toBe('REVIEW_REQUIRED');
    expect(textPages(result)[0].confidence).toBe(0.5);
  });

  it('assigns UNUSABLE when OCR returns empty text', async () => {
    const emptyOcr: OcrProvider = {
      name: 'empty',
      recognise: () =>
        Promise.resolve({
          text: '',
          confidence: 0.2,
          language: 'ar',
          warnings: ['OCR_EMPTY_RESULT'],
          engine: 'empty-v1',
        }),
    };

    const result = await new MockTextExtractor(emptyOcr).extract(image());

    expect(textPages(result)[0].trust).toBe('UNUSABLE');
  });
});

describe('MockTextExtractor OCR delegation', () => {
  beforeEach(() => {
    resetMockDirectives();
  });

  it('does not call OCR for a page served from a text layer', async () => {
    const { provider, calls } = createRecordingOcr();

    await new MockTextExtractor(provider).extract(pdf());

    // Two pages, one text layer: recognition ran exactly once.
    expect(calls).toHaveLength(1);
    expect(calls[0].pageNumber).toBe(2);
  });

  it('calls OCR for every page that needs it', async () => {
    const { provider, calls } = createRecordingOcr();

    await new MockTextExtractor(provider).extract(image());

    expect(calls).toHaveLength(1);
    expect(calls[0].pageNumber).toBe(1);
  });

  it('hands the recognition boundary bytes only, with no storage key or ids', async () => {
    const { provider, calls } = createRecordingOcr();

    await new MockTextExtractor(provider).extract(pdf('doc-secret'));

    const [input] = calls;
    expect(Buffer.isBuffer(input.image)).toBe(true);
    expect(Object.keys(input).sort()).toEqual([
      'image',
      'languageHints',
      'mimeType',
      'pageNumber',
    ]);
    expect(input).not.toHaveProperty('storageKey');
    expect(input).not.toHaveProperty('userId');
    expect(input).not.toHaveProperty('aiJobId');
  });

  it('keeps recognised text on the page and document it belongs to', async () => {
    const { provider } = createRecordingOcr();

    const result = await new MockTextExtractor(provider).extract(pdf('doc-7'));
    const ocrPage = textPages(result).find((page) => page.method === 'OCR');

    expect(ocrPage).toBeDefined();
    expect(ocrPage?.documentId).toBe('doc-7');
    expect(ocrPage?.pageNumber).toBe(2);
    expect(ocrPage?.text).toBe('RECOGNISED:2');
  });

  it('carries the engine-reported confidence and language through unchanged', async () => {
    const { provider } = createRecordingOcr();

    const result = await new MockTextExtractor(provider).extract(image());

    expect(textPages(result)[0].confidence).toBe(0.5);
    expect(textPages(result)[0].language).toBe('ar');
    expect(result.ocrEngine).toBe('recording-v1');
  });

  it('propagates a recognition failure rather than silently emitting empty text', async () => {
    const failing: OcrProvider = {
      name: 'failing',
      recognise: () => Promise.reject(new Error('AI_PROVIDER_ERROR')),
    };

    await expect(
      new MockTextExtractor(failing).extract(image()),
    ).rejects.toThrow('AI_PROVIDER_ERROR');
  });
});
