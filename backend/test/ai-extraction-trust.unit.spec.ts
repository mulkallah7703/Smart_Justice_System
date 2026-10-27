import { PDF_TEXT_VISUAL_ORDER } from '../src/modules/ai/providers/pdf/arabic-text-order';
import {
  assignExtractionTrust,
  isTrustedForDownstream,
} from '../src/modules/ai/providers/extraction-trust';

describe('assignExtractionTrust', () => {
  it('marks English TEXT_LAYER with usable text as TRUSTED', () => {
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text: 'Article 12 of the lease',
        warnings: [],
        confidence: null,
      }),
    ).toBe('TRUSTED');
  });

  it('trusts readable Arabic TEXT_LAYER, including the visual-order warning', () => {
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text: 'هذه قضية إيجارية',
        warnings: [],
        confidence: null,
      }),
    ).toBe('TRUSTED');
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text: 'هذه قضية إيجارية',
        warnings: [PDF_TEXT_VISUAL_ORDER],
        confidence: null,
      }),
    ).toBe('TRUSTED');
  });

  it('trusts mixed Arabic/English TEXT_LAYER', () => {
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text: 'العقد رقم Contract No. 12/A',
        warnings: [PDF_TEXT_VISUAL_ORDER],
        confidence: null,
      }),
    ).toBe('TRUSTED');
  });

  it('trusts Arabic presentation forms after scoring normalisation', () => {
    const presentation =
      '\uFE8D\uFEDF\uFECC\uFED8\uFEAA \uFEAD\uFED7\uFEE2 \uFE8D\uFEDF\uFED8\uFEC0\uFEF4\uFE94';
    const text = presentation;
    expect(text.normalize('NFKC')).toBe('العقد رقم القضية');
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text,
        warnings: [PDF_TEXT_VISUAL_ORDER],
        confidence: null,
      }),
    ).toBe('TRUSTED');
    expect(text).toBe(presentation);
  });

  it('keeps bidi controls from blocking readable Arabic', () => {
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text: '\u202Bعقد إيجار المادة الرابعة\u202C',
        warnings: [PDF_TEXT_VISUAL_ORDER],
        confidence: null,
      }),
    ).toBe('TRUSTED');
  });

  it('holds garbled TEXT_LAYER for review', () => {
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text: `${'\uFFFD'.repeat(12)} ??? ###`,
        warnings: [],
        confidence: null,
      }),
    ).toBe('REVIEW_REQUIRED');
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text: '§§§§§§§§',
        warnings: [],
        confidence: null,
      }),
    ).toBe('REVIEW_REQUIRED');
  });

  it('trusts readable high-confidence OCR, including Tesseract 0–100 scores', () => {
    expect(
      assignExtractionTrust({
        method: 'OCR',
        text: 'عقد إيجار المادة الرابعة',
        warnings: [],
        confidence: 0.92,
      }),
    ).toBe('TRUSTED');
    expect(
      assignExtractionTrust({
        method: 'OCR',
        text: 'عقد إيجار المادة الرابعة',
        warnings: [],
        confidence: 92,
      }),
    ).toBe('TRUSTED');
  });

  it('marks empty OCR as UNUSABLE', () => {
    expect(
      assignExtractionTrust({
        method: 'OCR',
        text: '',
        warnings: ['OCR_EMPTY_RESULT'],
        confidence: 0.1,
      }),
    ).toBe('UNUSABLE');
  });

  it('never promotes low-confidence OCR to TRUSTED', () => {
    expect(
      assignExtractionTrust({
        method: 'OCR',
        text: 'low confidence text',
        warnings: [],
        confidence: 0.01,
      }),
    ).toBe('REVIEW_REQUIRED');
  });

  it('does not trust OCR when confidence was not measured', () => {
    expect(
      assignExtractionTrust({
        method: 'OCR',
        text: 'MOCK_OCR_TEXT:recognised clause',
        warnings: ['MOCK_OCR_NO_RECOGNITION_PERFORMED'],
        confidence: null,
      }),
    ).toBe('REVIEW_REQUIRED');
  });

  it('does not trust high-confidence OCR when the text is garbled', () => {
    expect(
      assignExtractionTrust({
        method: 'OCR',
        text: `${'\uFFFD'.repeat(20)} ####`,
        warnings: [],
        confidence: 0.99,
      }),
    ).toBe('REVIEW_REQUIRED');
  });

  it('marks empty TEXT_LAYER as UNUSABLE', () => {
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text: '',
        warnings: [],
        confidence: null,
      }),
    ).toBe('UNUSABLE');
  });

  it('does not reverse or rewrite the input text', () => {
    const text = 'هذه قضية ١٤٤٦/٠٣/١٥';
    assignExtractionTrust({
      method: 'TEXT_LAYER',
      text,
      warnings: [PDF_TEXT_VISUAL_ORDER],
      confidence: null,
    });
    expect(text).toBe('هذه قضية ١٤٤٦/٠٣/١٥');
  });
});

describe('isTrustedForDownstream', () => {
  it('allows only TRUSTED non-empty pages', () => {
    expect(
      isTrustedForDownstream({ trust: 'TRUSTED', text: 'ok' }),
    ).toBe(true);
    expect(
      isTrustedForDownstream({ trust: 'TRUSTED', text: '' }),
    ).toBe(false);
    expect(
      isTrustedForDownstream({
        trust: 'REVIEW_REQUIRED',
        text: 'arabic',
      }),
    ).toBe(false);
    expect(
      isTrustedForDownstream({ trust: 'UNUSABLE', text: '' }),
    ).toBe(false);
  });
});
