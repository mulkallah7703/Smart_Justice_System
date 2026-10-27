import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ConfigService } from '@nestjs/config';

import { chunkPageText } from '../src/modules/ai/chunking/text-chunker';
import { LocalOcrProvider } from '../src/modules/ai/providers/ocr/local-ocr.provider';
import { MockLlmProvider } from '../src/modules/ai/providers/mock/mock-llm.provider';
import { MockOcrProvider } from '../src/modules/ai/providers/mock/mock-ocr.provider';
import { PdfJsPageRenderer } from '../src/modules/ai/providers/pdf/pdfjs-page-renderer';
import { PdfTextExtractor } from '../src/modules/ai/providers/pdf/pdf-text-extractor.provider';
import {
  LEGAL_ANSWER_SYSTEM_PROMPT,
  buildLegalAnswerUserPrompt,
} from '../src/modules/ai/prompts/legal-answer.prompt';
import {
  isExtractedTextPage,
  type ExtractedTextPage,
} from '../src/modules/ai/providers/text-extractor.interface';

import { createPdfExtractorConfig, createPdfTextExtractor } from './helpers/pdf-extractor-test';
import { arabicPdf } from './fixtures/pdf-fixtures';
import { arabicScannedPdf, markedImagePdf } from './fixtures/scanned-pdf';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** File-sized uploads own their ArrayBuffer. Pooled fixture buffers hide the detach bug. */
const ownBuffer = (bytes: Buffer): Buffer => {
  const owned = Buffer.allocUnsafeSlow(bytes.byteLength);
  bytes.copy(owned);
  return owned;
};

const citedAnswer = async (chunks: readonly string[]) => {
  const evidence = chunks.map((text, index) => ({
    evidenceId: `E${index + 1}`,
    text,
  }));
  const userPrompt = buildLegalAnswerUserPrompt({
    query: 'ما موضوع هذه الوثيقة؟',
    evidence,
  });
  const completion = await new MockLlmProvider().generateAnswer({
    systemPrompt: LEGAL_ANSWER_SYSTEM_PROMPT,
    userPrompt,
  });
  const parsed = JSON.parse(completion.text) as {
    insufficientEvidence: boolean;
    claims: Array<{ evidenceIds: string[] }>;
  };
  return { userPrompt, parsed };
};

describe('Arabic document pipeline', () => {
  it('trusts a text-layer Arabic PDF, chunks it, and can cite that chunk', async () => {
    const bytes = ownBuffer(arabicPdf());
    const snapshot = Buffer.from(bytes);
    const result = await createPdfTextExtractor().extract({
      documentId: 'doc-ar-text',
      bytes,
      mimeType: 'application/pdf',
      languageHints: ['ar', 'en'],
    });

    expect(bytes.equals(snapshot)).toBe(true);
    const page = result.pages[0] as ExtractedTextPage;
    expect(page.method).toBe('TEXT_LAYER');
    expect(page.trust).toBe('TRUSTED');
    expect(page.text).toMatch(/\p{Script=Arabic}/u);

    const spans = chunkPageText(page.text, { maxChars: 2000, overlap: 0 });
    expect(spans.length).toBeGreaterThan(0);
    expect(spans.every((span) => page.text.slice(span.startOffset, span.endOffset) === span.text)).toBe(true);

    const { userPrompt, parsed } = await citedAnswer(spans.map((span) => span.text));
    expect(userPrompt).toContain(spans[0]!.text);
    expect(parsed.insufficientEvidence).toBe(false);
    expect(parsed.claims[0]?.evidenceIds).toEqual(['E1']);
  });

  it('does not detach an owned buffer when a scanned page is rendered for OCR', async () => {
    const bytes = ownBuffer(markedImagePdf());
    const snapshot = Buffer.from(bytes);
    const ocr = new MockOcrProvider();
    const spy = jest.spyOn(ocr, 'recognise');

    const result = await createPdfTextExtractor({ ocr }).extract({
      documentId: 'doc-scan',
      bytes,
      mimeType: 'application/pdf',
      languageHints: ['ar', 'en'],
    });

    expect(bytes.equals(snapshot)).toBe(true);
    expect(result.pages[0]).toMatchObject({ method: 'OCR', status: 'EXTRACTED' });
    expect(spy).toHaveBeenCalledTimes(1);
    const image = spy.mock.calls[0]?.[0].image;
    expect(image?.subarray(0, 8).equals(PNG)).toBe(true);
  });

  it('keeps ara and eng in the Linux tessdata fetch used by the worker image', () => {
    const script = readFileSync(
      resolve(__dirname, '../scripts/fetch-ocr-lang-data.sh'),
      'utf8',
    );
    const dockerfile = readFileSync(
      resolve(__dirname, '../../infra/docker/worker.Dockerfile'),
      'utf8',
    );

    expect(script).toMatch(/for lang in eng ara/);
    expect(dockerfile).toContain('fetch-ocr-lang-data.sh');
    expect(dockerfile).toContain('ara.traineddata');
    expect(dockerfile).toContain('eng.traineddata');
    expect(dockerfile).toContain('AI_OCR_LANGUAGES=ara+eng');
  });
});

const langReady = (() => {
  try {
    readFileSync(resolve('.ocr-data/ara.traineddata'));
    readFileSync(resolve('.ocr-data/eng.traineddata'));
    return arabicScannedPdf() !== null;
  } catch {
    return false;
  }
})();

const describeIfReady = langReady ? describe : describe.skip;

describeIfReady('scanned Arabic PDF — real local OCR', () => {
  jest.setTimeout(120_000);

  let provider: LocalOcrProvider;

  beforeAll(() => {
    provider = new LocalOcrProvider({
      get: () => ({
        ocrLangPath: resolve('.ocr-data'),
        ocrLanguages: 'ara+eng',
        ocrTimeoutMs: 60_000,
      }),
    } as unknown as ConfigService<never, true>);
  });

  afterAll(async () => {
    await provider.onModuleDestroy();
  });

  it('OCRs the page into a trusted chunk that an analysis can cite', async () => {
    const scanned = arabicScannedPdf();
    expect(scanned).not.toBeNull();
    const bytes = ownBuffer(scanned!);
    const snapshot = Buffer.from(bytes);

    const extractor = new PdfTextExtractor(
      createPdfExtractorConfig({ ocrDpi: 200, pdfMaxPages: 5 }),
      new PdfJsPageRenderer(),
      provider,
    );
    const result = await extractor.extract({
      documentId: 'doc-scan-ar',
      bytes,
      mimeType: 'application/pdf',
      languageHints: ['ar', 'en'],
    });

    expect(bytes.equals(snapshot)).toBe(true);
    const pages = result.pages.filter(isExtractedTextPage);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ method: 'OCR', trust: 'TRUSTED' });
    expect(pages[0]?.text).toMatch(/عقد/);
    expect(pages[0]?.text).toMatch(/إيجار|ايجار/);

    const spans = chunkPageText(pages[0]!.text, { maxChars: 2000, overlap: 0 });
    expect(spans.length).toBeGreaterThan(0);
    expect(spans[0]!.text.length).toBeGreaterThan(0);

    const { userPrompt, parsed } = await citedAnswer(spans.map((span) => span.text));
    expect(userPrompt).toContain(spans[0]!.text);
    expect(parsed.insufficientEvidence).toBe(false);
    expect(parsed.claims[0]?.evidenceIds).toEqual(['E1']);
  });
});
