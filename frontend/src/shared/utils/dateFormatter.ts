import { toArabicNumerals } from './arabicNumerals';

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const formatWithArabicDigits = (
  iso: string,
  options: Intl.DateTimeFormatOptions,
): string => {
  const date = new Date(iso);
  if (!isValidDate(date)) {
    return '';
  }

  const formatted = new Intl.DateTimeFormat('ar-SA', {
    calendar: 'gregory',
    numberingSystem: 'arab',
    ...options,
  }).format(date);

  return toArabicNumerals(formatted);
};

export const formatDateAr = (iso: string): string =>
  formatWithArabicDigits(iso, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export const formatDateTimeAr = (iso: string): string =>
  formatWithArabicDigits(iso, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
