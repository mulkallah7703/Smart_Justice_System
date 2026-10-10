const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

export const toArabicNumerals = (value: number | string): string =>
  String(value).replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);

/**
 * A string amount is already a server-formatted fixed-decimal value and is
 * converted as-is, so no monetary figure is ever re-derived here.
 */
export const formatMoneyAr = (
  amount: number | string,
  fractionDigits = 2,
): string =>
  toArabicNumerals(
    typeof amount === 'number' ? amount.toFixed(fractionDigits) : amount,
  );

export const formatCountdownAr = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');

  return `${toArabicNumerals(minutes)}:${toArabicNumerals(paddedSeconds)}`;
};
