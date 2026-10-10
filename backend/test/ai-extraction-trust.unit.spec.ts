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

  it('marks Arabic TEXT_LAYER as REVIEW_REQUIRED', () => {
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text: 'هذه قضية إيجارية',
        warnings: [],
        confidence: null,
      }),
    ).toBe('REVIEW_REQUIRED');
  });

  it('marks TEXT_LAYER with PDF_TEXT_VISUAL_ORDER as REVIEW_REQUIRED', () => {
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text: 'هذه قضية',
        warnings: [PDF_TEXT_VISUAL_ORDER],
        confidence: null,
      }),
    ).toBe('REVIEW_REQUIRED');
  });

  it('marks mixed Arabic/English TEXT_LAYER as REVIEW_REQUIRED', () => {
    expect(
      assignExtractionTrust({
        method: 'TEXT_LAYER',
        text: 'العقد رقم Contract No. 12/A',
        warnings: [],
        confidence: null,
      }),
    ).toBe('REVIEW_REQUIRED');
  });

  it('marks non-empty OCR as REVIEW_REQUIRED', () => {
    expect(
      assignExtractionTrust({
        method: 'OCR',
        text: 'recognised clause',
        warnings: [],
        confidence: 0.99,
      }),
    ).toBe('REVIEW_REQUIRED');
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

  it('never promotes high-confidence OCR to TRUSTED', () => {
    expect(
      assignExtractionTrust({
        method: 'OCR',
        text: 'high confidence text',
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
