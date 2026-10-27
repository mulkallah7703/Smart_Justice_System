/**
 * City names are stored in Latin in seeded profiles (`Riyadh`) while citizens
 * search in Arabic (`الرياض`). Each group is searched together.
 */
const CITY_GROUPS: readonly (readonly string[])[] = [
  ['Riyadh', 'الرياض', 'riyadh'],
  ['Jeddah', 'جدة', 'جده', 'jeddah'],
  ['Dammam', 'الدمام', 'dammam'],
  ['Makkah', 'مكة', 'مكه', 'Mecca', 'makkah'],
  ['Madinah', 'المدينة', 'المدينه', 'Medina', 'madinah'],
];

const fold = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ً-ْ]/g, '');

export const citySearchTerms = (query: string): string[] => {
  const needle = fold(query);
  if (!needle) {
    return [];
  }
  const group = CITY_GROUPS.find((cities) =>
    cities.some((city) => fold(city) === needle),
  );
  if (!group) {
    return [query.trim()];
  }
  return [...new Set(group)];
};
