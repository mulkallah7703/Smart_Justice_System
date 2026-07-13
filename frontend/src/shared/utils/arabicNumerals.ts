const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

export const toArabicNumerals = (value: number | string): string =>
  String(value).replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);

export const formatMoneyAr = (amount: number, fractionDigits = 2): string =>
  toArabicNumerals(amount.toFixed(fractionDigits));

export const formatCountdownAr = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');

  return `${toArabicNumerals(minutes)}:${toArabicNumerals(paddedSeconds)}`;
};
