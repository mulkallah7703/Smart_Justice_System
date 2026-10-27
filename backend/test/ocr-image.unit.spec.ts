import { mergeHeaderReading, normalizeOcrDigits } from '../src/modules/ai/providers/ocr/ocr-image';

describe('OCR digit merge', () => {
  it('normalises Arabic-Indic digits and keeps a header date the page dropped', () => {
    expect(normalizeOcrDigits('١٥/٤/١٤٤٦')).toBe('15/4/1446');
    expect(
      mergeHeaderReading('رقم القضية غير واضح', '4521\n15/4/1446'),
    ).toContain('4521');
    expect(mergeHeaderReading('القضية 4521', '4521')).toBe('القضية 4521');
  });
});
