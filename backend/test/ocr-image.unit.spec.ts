import {
  mergeHeaderReading,
  normalizeOcrDigits,
  reconcileHeaderDigits,
} from '../src/modules/ai/providers/ocr/ocr-image';

describe('OCR digit merge', () => {
  it('normalises Arabic-Indic digits and keeps numbers the body already has', () => {
    expect(normalizeOcrDigits('١٥/٤/١٤٤٦')).toBe('15/4/1446');
    expect(mergeHeaderReading('القضية 4521', '4521')).toBe('القضية 4521');
  });

  it('does not trust a header-only case number until a second pass agrees', () => {
    const once = reconcileHeaderDigits('رقم القضية غير واضح', '4521\n15/4/1446');
    expect(once.text).not.toContain('4521');
    expect(once.digitsUnverified).toBe(true);

    const agreed = reconcileHeaderDigits(
      'رقم القضية غير واضح',
      '4521\n15/4/1446',
      '4521 15/4/1446',
    );
    expect(agreed.text).toContain('4521');
    expect(agreed.text).toContain('15/4/1446');
    expect(agreed.digitsUnverified).toBe(false);
  });

  it('drops a header number that conflicts with the body', () => {
    const merged = reconcileHeaderDigits('رقم القضية 4521', '33337');
    expect(merged.text).not.toContain('33337');
    expect(merged.text).toContain('4521');
    expect(merged.digitsUnverified).toBe(true);
  });
});
