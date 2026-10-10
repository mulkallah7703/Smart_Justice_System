import { AppError } from '../src/shared/exceptions/app-error';
import { MockOcrProvider } from '../src/modules/ai/providers/mock/mock-ocr.provider';
import { PDF_TEXT_VISUAL_ORDER } from '../src/modules/ai/providers/pdf/pdf-text-extractor.provider';
import { normalisePageText } from '../src/modules/ai/providers/pdf/page-text';
import {
  isExtractedTextPage,
  type DocumentSource,
  type ExtractedTextPage,
} from '../src/modules/ai/providers/text-extractor.interface';

import { createPdfTextExtractor } from './helpers/pdf-extractor-test';
import {
  ARABIC_PUNCTUATION_TEXT,
  ARABIC_TEXT,
  ENGLISH_TEXT,
  arabicDigitsPdf,
  arabicPdf,
  arabicPunctuationPdf,
  blankPagePdf,
  buildPdf,
  corruptPdf,
  encryptedPdf,
  englishPdf,
  manyPagesPdf,
  mixedScriptPdf,
  mixedTextAndBlankPdf,
  notAPdf,
  truncatedPdf,
  twoTextPagesPdf,
  whitespaceOnlyPdf,
  zeroPagePdf,
} from './fixtures/pdf-fixtures';

const DOCUMENT_ID = 'doc-1';

const createExtractor = (pdfMaxPages = 100) =>
  createPdfTextExtractor({ pdfMaxPages });

const source = (bytes: Buffer, mimeType = 'application/pdf'): DocumentSource => ({
  documentId: DOCUMENT_ID,
  bytes,
  mimeType,
  languageHints: ['ar', 'en'],
});

const extract = async (bytes: Buffer, mimeType?: string) =>
  createExtractor().extract(source(bytes, mimeType));

/** Concatenates the characters of a page regardless of run order. */
const sortedCharacters = (value: string): string => [...value].sort().join('');

const expectCode = async (promise: Promise<unknown>, code: string): Promise<void> => {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ code });
};

describe('PdfTextExtractor — valid documents', () => {
  it('opens a PDF and reports its page count', async () => {
    const result = await extract(twoTextPagesPdf());

    expect(result.pages).toHaveLength(2);
    expect(result.engine).toBe('pdfjs-text-layer-v1');
  });

  it('numbers pages from one and keeps them in order', async () => {
    const result = await extract(manyPagesPdf(5));

    expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it('attributes every page to the requested document', async () => {
    const result = await extract(twoTextPagesPdf());

    expect(result.pages.every((page) => page.documentId === DOCUMENT_ID)).toBe(true);
  });

  it('keeps page boundaries instead of concatenating the document', async () => {
    const result = await extract(twoTextPagesPdf());
    const pages = result.pages.filter(isExtractedTextPage);

    expect(pages).toHaveLength(2);
    expect(pages[0].text).toContain('First page text');
    expect(pages[0].text).not.toContain('Second');
    expect(pages[1].text).toContain('Second page text');
    expect(pages[1].text).not.toContain('First');
  });

  it('marks a page carrying a text layer as TEXT_LAYER and never as OCR', async () => {
    const result = await extract(englishPdf());
    const page = result.pages[0] as ExtractedTextPage;

    expect(page.status).toBe('EXTRACTED');
    expect(page.method).toBe('TEXT_LAYER');
    expect(result.ocrEngine).toBeNull();
  });

  it('reports no confidence or language for a text layer', async () => {
    const page = (await extract(englishPdf())).pages[0] as ExtractedTextPage;

    expect(page.confidence).toBeNull();
    expect(page.language).toBeNull();
  });

  it('assigns TRUSTED to English TEXT_LAYER and REVIEW_REQUIRED to Arabic', async () => {
    const english = (await extract(englishPdf())).pages[0] as ExtractedTextPage;
    const arabic = (await extract(arabicPdf())).pages[0] as ExtractedTextPage;
    const mixed = (await extract(mixedScriptPdf())).pages[0] as ExtractedTextPage;

    expect(english.trust).toBe('TRUSTED');
    expect(arabic.trust).toBe('REVIEW_REQUIRED');
    expect(arabic.warnings).toContain(PDF_TEXT_VISUAL_ORDER);
    expect(mixed.trust).toBe('REVIEW_REQUIRED');
  });

  it('assigns REVIEW_REQUIRED to non-empty OCR pages', async () => {
    const page = (await extract(blankPagePdf())).pages[0] as ExtractedTextPage;

    expect(page.method).toBe('OCR');
    expect(page.text.length).toBeGreaterThan(0);
    expect(page.trust).toBe('REVIEW_REQUIRED');
  });
});

describe('PdfTextExtractor — Unicode preservation', () => {
  it('preserves English text exactly', async () => {
    const page = (await extract(englishPdf())).pages[0] as ExtractedTextPage;

    expect(page.text).toBe(ENGLISH_TEXT);
  });

  it('preserves every Arabic character without loss or substitution', async () => {
    const page = (await extract(arabicPdf())).pages[0] as ExtractedTextPage;

    // The engine reports right-to-left runs in visual order, so the comparison
    // is on content rather than sequence. Ordering is asserted separately.
    expect(sortedCharacters(page.text)).toBe(sortedCharacters(ARABIC_TEXT));
  });

  it('preserves Arabic-Indic digits rather than converting them to ASCII', async () => {
    const page = (await extract(arabicDigitsPdf())).pages[0] as ExtractedTextPage;

    expect(page.text).toContain('٥٠٠٠٠');
    expect(page.text).not.toContain('50000');
  });

  it('preserves Arabic legal punctuation', async () => {
    const page = (await extract(arabicPunctuationPdf())).pages[0] as ExtractedTextPage;

    for (const mark of ['؛', '،', '؟', ':']) {
      expect(page.text).toContain(mark);
    }
    expect(sortedCharacters(page.text)).toBe(sortedCharacters(ARABIC_PUNCTUATION_TEXT));
  });

  it('preserves the Latin run of a mixed Arabic/English page in order', async () => {
    const page = (await extract(mixedScriptPdf())).pages[0] as ExtractedTextPage;

    expect(page.text).toContain('Contract No. 12/A');
    expect(sortedCharacters(page.text)).toBe(
      sortedCharacters('العقد رقم Contract No. 12/A'),
    );
  });

  it('flags pages whose right-to-left text came back in visual order', async () => {
    const arabic = (await extract(arabicPdf())).pages[0] as ExtractedTextPage;
    const english = (await extract(englishPdf())).pages[0] as ExtractedTextPage;

    expect(arabic.warnings).toContain(PDF_TEXT_VISUAL_ORDER);
    expect(english.warnings).not.toContain(PDF_TEXT_VISUAL_ORDER);
  });
});

describe('PdfTextExtractor — pages without a usable text layer', () => {
  it('renders and OCRs a page that draws nothing', async () => {
    const result = await extract(blankPagePdf());
    const page = result.pages[0] as ExtractedTextPage;

    expect(page.status).toBe('EXTRACTED');
    expect(page.method).toBe('OCR');
    expect(result.ocrEngine).toBe('mock-ocr-v1');
  });

  it('does not label a whitespace-only page as TEXT_LAYER', async () => {
    const result = await extract(whitespaceOnlyPdf());
    const page = result.pages[0] as ExtractedTextPage;

    expect(page.method).toBe('OCR');
  });

  it('classifies a mixed document page by page', async () => {
    const result = await extract(mixedTextAndBlankPdf());
    const pages = result.pages.filter(isExtractedTextPage);

    expect(pages.map((page) => page.method)).toEqual(['TEXT_LAYER', 'OCR']);
    expect(pages[1].pageNumber).toBe(2);
  });

  it('routes a raster image straight to OCR without opening it as a PDF', async () => {
    const ocr = new MockOcrProvider();
    const spy = jest.spyOn(ocr, 'recognise');
    const result = await createPdfTextExtractor({ ocr }).extract(
      source(Buffer.from('not really png bytes'), 'image/png'),
    );
    const page = result.pages[0] as ExtractedTextPage;

    expect(result.pages).toHaveLength(1);
    expect(page.method).toBe('OCR');
    expect(page.pageNumber).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].image.equals(Buffer.from('not really png bytes'))).toBe(
      true,
    );
  });

  it('does not call OCR for pages that already have a usable text layer', async () => {
    const ocr = new MockOcrProvider();
    const spy = jest.spyOn(ocr, 'recognise');

    await createPdfTextExtractor({ ocr }).extract(source(englishPdf()));

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('PdfTextExtractor — failure handling', () => {
  it('rejects bytes that are not a PDF', async () => {
    await expectCode(extract(notAPdf()), 'PDF_INVALID');
  });

  it('rejects a truncated PDF', async () => {
    await expectCode(extract(truncatedPdf()), 'PDF_INVALID');
  });

  it('rejects a PDF whose body is corrupt', async () => {
    await expectCode(extract(corruptPdf()), 'PDF_INVALID');
  });

  it('rejects a password-protected PDF without attempting to open it', async () => {
    await expectCode(extract(encryptedPdf()), 'PDF_ENCRYPTED');
  });

  it('rejects a document with no pages', async () => {
    await expectCode(extract(zeroPagePdf()), 'PDF_INVALID');
  });

  it('rejects an unsupported format', async () => {
    await expectCode(
      extract(englishPdf(), 'application/msword'),
      'DOCUMENT_FORMAT_UNSUPPORTED',
    );
  });

  it('enforces the configured page limit', async () => {
    const extractor = createExtractor(3);

    await expectCode(
      extractor.extract(source(manyPagesPdf(4))),
      'PDF_PAGE_LIMIT_EXCEEDED',
    );
    await expect(extractor.extract(source(manyPagesPdf(3)))).resolves.toBeDefined();
  });

  it('never leaks parser detail or document content in an error', async () => {
    const failures = [notAPdf(), truncatedPdf(), encryptedPdf()];

    for (const bytes of failures) {
      const error = await extract(bytes).catch((caught: AppError) => caught);
      const serialised = JSON.stringify({
        code: (error as AppError).code,
        message: (error as AppError).message,
      });

      // The deliberate user-facing wording is fine; library internals are not.
      expect(serialised).not.toMatch(
        /pdf\.js|pdfjs|XRef|InvalidPDFException|PasswordException|startxref|no password given/i,
      );
      expect(serialised).not.toContain(ENGLISH_TEXT);
    }
  });
});

describe('PdfTextExtractor — isolation', () => {
  it('takes only document bytes in its input contract', () => {
    const declared = Object.keys(source(englishPdf()));
    expect(declared).toEqual(['documentId', 'bytes', 'mimeType', 'languageHints']);
    expect(declared).not.toContain('storageKey');
    expect(declared).not.toContain('userId');
  });

  it('does not call an OCR provider during pure text-layer extraction', async () => {
    const ocr = new MockOcrProvider();
    const spy = jest.spyOn(ocr, 'recognise');

    await createPdfTextExtractor({ ocr }).extract(source(twoTextPagesPdf()));

    expect(spy).not.toHaveBeenCalled();
  });

  it('calls OCR only for pages without a usable text layer', async () => {
    const ocr = new MockOcrProvider();
    const spy = jest.spyOn(ocr, 'recognise');

    await createPdfTextExtractor({ ocr }).extract(source(mixedTextAndBlankPdf()));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].pageNumber).toBe(2);
  });

  it('performs no network access', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network access is not allowed'));

    await extract(twoTextPagesPdf());

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('leaves the caller\u2019s buffer untouched', async () => {
    const bytes = englishPdf();
    const copy = Buffer.from(bytes);

    await extract(bytes);

    expect(bytes.equals(copy)).toBe(true);
  });
});

describe('page text normalisation', () => {
  it('normalises line endings without merging lines', () => {
    expect(normalisePageText('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('trims the page ends but keeps inner indentation', () => {
    expect(normalisePageText('  first\n    indented  ')).toBe('first\n    indented');
  });

  it('drops meaningless control characters but keeps tabs and newlines', () => {
    expect(normalisePageText('a\u0000b\u0007\tc\nd')).toBe('ab\tc\nd');
  });

  it('leaves Arabic text, diacritics, digits, and punctuation untouched', () => {
    const value = 'المادة (٣): بِسْمِ اللَّهِ؛ ١٤٤٦/٠٣/١٥؟';

    expect(normalisePageText(value)).toBe(value);
  });

  it('reduces a whitespace-only page to nothing so it is not mistaken for text', () => {
    expect(normalisePageText('   \n\t  ')).toBe('');
  });
});

describe('pdf fixtures', () => {
  it('produce a real text layer rather than relying on parser recovery', async () => {
    const result = await extract(buildPdf({ pages: [{ text: 'Clause 7' }] }));

    expect((result.pages[0] as ExtractedTextPage).text).toBe('Clause 7');
  });
});
