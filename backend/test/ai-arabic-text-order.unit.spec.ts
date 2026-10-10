import { createPdfTextExtractor } from './helpers/pdf-extractor-test';
import {
  PDF_TEXT_VISUAL_ORDER,
  pageContainsArabicScript,
} from '../src/modules/ai/providers/pdf/arabic-text-order';
import {
  isExtractedTextPage,
  type DocumentSource,
  type ExtractedTextPage,
} from '../src/modules/ai/providers/text-extractor.interface';

import {
  ARABIC_ORDER_FIXTURES,
  STRATEGIES,
  fixtureBytes,
  observePdf,
  strategyNaiveRtlReverse,
  strategyRaw,
  type StrategyName,
} from './fixtures/arabic-order-investigation';
import { buildPdf, englishPdf } from './fixtures/pdf-fixtures';

const createExtractor = () => createPdfTextExtractor();

const source = (bytes: Buffer): DocumentSource => ({
  documentId: 'doc-ar',
  bytes,
  mimeType: 'application/pdf',
  languageHints: ['ar', 'en'],
});

const extractText = async (bytes: Buffer): Promise<ExtractedTextPage[]> => {
  const result = await createExtractor().extract(source(bytes));
  return result.pages.filter(isExtractedTextPage);
};

describe('Arabic text-order investigation (Option B)', () => {
  it('records that no reconstruction strategy is safe across the fixture matrix', async () => {
    const names = Object.keys(STRATEGIES) as StrategyName[];
    const scores = Object.fromEntries(names.map((name) => [name, 0])) as Record<
      StrategyName,
      number
    >;

    for (const fixture of ARABIC_ORDER_FIXTURES) {
      const pages = await observePdf(fixtureBytes(fixture));
      for (const name of names) {
        if (STRATEGIES[name](pages) === fixture.expected) {
          scores[name] += 1;
        }
      }
    }

    // A perfect score would unlock Option A. Anything short of that forbids
    // shipping a reconstruction into production.
    for (const name of names) {
      expect(scores[name]).toBeLessThan(ARABIC_ORDER_FIXTURES.length);
    }
  });

  it('demonstrates why naive RTL reversal is unsafe on dates', async () => {
    const fixture = ARABIC_ORDER_FIXTURES.find(
      (entry) => entry.id === 'C-arabic-indic-date',
    )!;
    const pages = await observePdf(fixtureBytes(fixture));
    const reversed = strategyNaiveRtlReverse(pages);

    expect(reversed).not.toBe(fixture.expected);
    expect(reversed).toContain('٥١/٣٠/٦٤٤١');
    expect(reversed).not.toContain('١٤٤٦/٠٣/١٥');
  });

  it('demonstrates why naive RTL reversal is unsafe on Latin case numbers', async () => {
    const fixture = ARABIC_ORDER_FIXTURES.find(
      (entry) => entry.id === 'D-english-numbers',
    )!;
    const pages = await observePdf(fixtureBytes(fixture));
    const reversed = strategyNaiveRtlReverse(pages);

    expect(reversed).not.toBe(fixture.expected);
    expect(reversed).toContain('54321');
    expect(reversed).not.toContain('12345');
  });

  it('shows mixed Arabic/English can arrive as a single ltr item', async () => {
    const fixture = ARABIC_ORDER_FIXTURES.find(
      (entry) => entry.id === 'B-arabic-english',
    )!;
    const pages = await observePdf(fixtureBytes(fixture));

    expect(pages[0].items).toHaveLength(1);
    expect(pages[0].items[0].dir).toBe('ltr');
    expect(strategyRaw(pages)).not.toBe(fixture.expected);
    expect(strategyNaiveRtlReverse(pages)).not.toBe(fixture.expected);
  });
});

describe('production extractor preserves pdf.js output (Option B)', () => {
  it.each(ARABIC_ORDER_FIXTURES.map((fixture) => [fixture.id, fixture]))(
    '%s keeps raw visual-order text and never invents a correction',
    async (_id, fixture) => {
      const pages = await observePdf(fixtureBytes(fixture));
      const extracted = await extractText(fixtureBytes(fixture));
      const produced = extracted.map((page) => page.text).join('\n');

      expect(produced).toBe(strategyRaw(pages));
      expect(produced).not.toBe(fixture.expected);
    },
  );

  it('attaches PDF_TEXT_VISUAL_ORDER whenever Arabic script is present', async () => {
    for (const fixture of ARABIC_ORDER_FIXTURES) {
      const pages = await extractText(fixtureBytes(fixture));
      for (const page of pages) {
        expect(page.warnings).toContain(PDF_TEXT_VISUAL_ORDER);
      }
    }
  });

  it('warns even when pdf.js labels a mixed item as ltr', async () => {
    const fixture = ARABIC_ORDER_FIXTURES.find(
      (entry) => entry.id === 'B-arabic-english',
    )!;
    const [page] = await extractText(fixtureBytes(fixture));

    expect(pageContainsArabicScript(page.text)).toBe(true);
    expect(page.warnings).toContain(PDF_TEXT_VISUAL_ORDER);
  });

  it('does not warn on a pure English page', async () => {
    const [page] = await extractText(englishPdf());

    expect(page.warnings).not.toContain(PDF_TEXT_VISUAL_ORDER);
    expect(pageContainsArabicScript(page.text)).toBe(false);
  });

  it('preserves Arabic-Indic digits without converting them', async () => {
    const fixture = ARABIC_ORDER_FIXTURES.find(
      (entry) => entry.id === 'C-arabic-indic-date',
    )!;
    const [page] = await extractText(fixtureBytes(fixture));

    expect(page.text).toMatch(/[٠-٩]/);
    expect(page.text).not.toMatch(/1446|03|15/);
  });

  it('preserves diacritics without stripping them', async () => {
    const fixture = ARABIC_ORDER_FIXTURES.find(
      (entry) => entry.id === 'J-diacritics',
    )!;
    const [page] = await extractText(fixtureBytes(fixture));

    expect(page.text).toMatch(/[\u064B-\u0652\u0670]/);
  });

  it('keeps page boundaries on a multi-page Arabic document', async () => {
    const fixture = ARABIC_ORDER_FIXTURES.find(
      (entry) => entry.id === 'H-multipage',
    )!;
    const pages = await extractText(fixtureBytes(fixture));

    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    expect(pages[0].text).not.toContain(pages[1].text);
  });

  it('keeps distinct lines on a multi-line Arabic page', async () => {
    const fixture = ARABIC_ORDER_FIXTURES.find(
      (entry) => entry.id === 'G-multiline',
    )!;
    const [page] = await extractText(fixtureBytes(fixture));
    const lineCount = page.text.split('\n').filter((line) => line.length > 0)
      .length;

    expect(lineCount).toBe(2);
  });

  it('OCRs a blank page rather than leaving it unresolved', async () => {
    const result = await createExtractor().extract(
      source(buildPdf({ pages: [{}] })),
    );

    expect(result.pages[0]).toMatchObject({
      status: 'EXTRACTED',
      method: 'OCR',
    });
  });

  it('never logs or embeds the expected logical string in an error path', async () => {
    // Sanity: the extractor returns text only on ExtractedTextPage; the public
    // job result path is covered elsewhere. Here we assert the page object
    // itself does not claim to be corrected.
    const fixture = ARABIC_ORDER_FIXTURES.find(
      (entry) => entry.id === 'A-pure-arabic',
    )!;
    const [page] = await extractText(fixtureBytes(fixture));

    expect(page.method).toBe('TEXT_LAYER');
    expect(page.warnings).toEqual([PDF_TEXT_VISUAL_ORDER]);
    expect(page.trust).toBe('REVIEW_REQUIRED');
    expect(page.text).not.toBe(fixture.expected);
  });

  it('marks Arabic TEXT_LAYER REVIEW_REQUIRED and English TRUSTED', async () => {
    const [arabic] = await extractText(fixtureBytes(ARABIC_ORDER_FIXTURES[0]!));
    const [english] = await extractText(englishPdf());

    expect(arabic.trust).toBe('REVIEW_REQUIRED');
    expect(english.trust).toBe('TRUSTED');
  });
});
