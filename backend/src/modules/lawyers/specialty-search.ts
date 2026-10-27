import type { CaseType } from '@prisma/client';

const fold = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ً-ْ]/g, '');

const SPECIALTIES: ReadonlyArray<readonly [RegExp, CaseType]> = [
  [/تجار/, 'COMMERCIAL'],
  [/جزا|جنا/, 'CRIMINAL'],
  [/عمال|عمالي|(?:^|\s)عمل(?:\s|$)/, 'LABOR'],
  [/ايجار|عقار/, 'RENTAL'],
  [/احوال|اسره|شخصي/, 'PERSONAL'],
];

/** Maps an Arabic search term such as تجاري onto the CaseType stored on lawyers. */
export const specialtyFromArabicQuery = (query: string): CaseType | null => {
  const folded = fold(query);
  if (!folded) {
    return null;
  }
  for (const [pattern, specialty] of SPECIALTIES) {
    if (pattern.test(folded)) {
      return specialty;
    }
  }
  return null;
};
