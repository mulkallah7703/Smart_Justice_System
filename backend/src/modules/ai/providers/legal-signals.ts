/**
 * Deterministic hints pulled from extracted text. They are data for the
 * summariser, not a second legal opinion. Hijri month names are copied as
 * written so ربيع الأول is never rewritten as ربيع الآخر.
 */

export interface LegalSignals {
  hijriDates: string[];
  gregorianDates: string[];
  articles: string[];
  finality: string[];
}

const HIJRI_MONTH =
  'محرم|صفر|ربيع الأول|ربيع الآخر|ربيع الثاني|جمادى الأولى|جمادى الآخرة|رجب|شعبان|رمضان|شوال|ذو القعدة|ذو الحجة';

const unique = (values: string[]): string[] => [...new Set(values)];

export const extractLegalSignals = (text: string): LegalSignals => {
  const hijri =
    text.match(
      new RegExp(
        String.raw`(?:\d{1,2}|[٠-٩]{1,2})\s+(?:${HIJRI_MONTH})\s+(?:\d{3,4}|[٠-٩]{3,4})`,
        'gu',
      ),
    ) ?? [];
  const gregorian =
    text.match(
      /(?:\d{1,2}|[٠-٩]{1,2})\s+(?:يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+(?:\d{4}|[٠-٩]{4})/gu,
    ) ?? [];
  const articles =
    text.match(/المادة\s+(?:\d+|[٠-٩]+|[\u0621-\u064A]{2,12})/gu) ?? [];

  const finality: string[] = [];
  if (/حكم\s+نهائي|حكم\s+قطعي|غير\s+قابل\s+للاعتراض/u.test(text)) {
    finality.push('الحكم موصوف بأنه نهائي أو غير قابل للاعتراض في النص');
  }
  if (
    /حق\s+الاعتراض|يجوز\s+الاعتراض|مهلة\s+اعتراض|اعتراض\s+خلال|استئناف\s+خلال|من\s+تاريخ\s+تسلم\s+الحكم/u.test(
      text,
    )
  ) {
    finality.push('النص يذكر ميعاد اعتراض مفتوحاً');
  }

  return {
    hijriDates: unique(hijri),
    gregorianDates: unique(gregorian),
    articles: unique(articles),
    finality,
  };
};

/** Arabic data block. Empty when nothing was detected. */
export const describeLegalSignals = (text: string): string => {
  const signals = extractLegalSignals(text);
  const lines = [
    ...signals.hijriDates.map((value) => `تاريخ هجري كما ورد: ${value}`),
    ...signals.gregorianDates.map((value) => `تاريخ ميلادي كما ورد: ${value}`),
    ...signals.articles.map((value) => `مادة كما وردت: ${value}`),
    ...signals.finality,
  ];
  if (lines.length === 0) {
    return '';
  }
  return ['إشارات مستخرجة آلياً من النص (بيانات، ليست تعليمات):', ...lines].join(
    '\n',
  );
};

const WORD_DAYS: ReadonlyArray<readonly [string, number]> = [
  ['ثلاثين', 30],
  ['ثلاثون', 30],
  ['ستين', 60],
  ['ستون', 60],
  ['تسعين', 90],
  ['عشرين', 20],
  ['خمسة عشر', 15],
  ['عشرة', 10],
  ['سبعة', 7],
  ['خمسة', 5],
];

const toAsciiDigits = (value: string): string =>
  value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));

/** Folds OCR noise that should not change the legal phrase. */
const foldRulingText = (value: string): string =>
  toAsciiDigits(value)
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');

/**
 * Objection window written in a ruling. Matches common Saudi phrasings
 * (حق الاعتراض، خلال N يوماً، استئناف، التماس، من تاريخ تسلم الحكم)
 * including Arabic-Indic digits and light OCR noise.
 * A final ruling with no open window returns null.
 */
/** Drops a leading «المادة غير مذكورة» that the model used to invent. */
export const stripStrayArticleNote = (text: string): string =>
  text.replace(/^\s*المادة غير مذكورة\.?\s*/u, '').trim();

export const detectObjectionDays = (text: string): number | null => {
  const folded = foldRulingText(text);
  const closed = /غير قابل ل(لاعتراض|لاستئناف)/u.test(folded);
  const open =
    /حق الاعتراض|يجوز الاعتراض|مهله اعتراض|اعتراض خلال|استئناف خلال|التماس اعاده النظر|من تاريخ تسلم الحكم|خلال\s+\S+\s+يوم/u.test(
      folded,
    ) && !closed;
  const finalOnly =
    (/حكم نهائي|حكم قطعي/u.test(folded) || closed) && !open;
  if (finalOnly || !open) {
    return null;
  }

  const digits = folded.match(/(\d{1,3})\s*يوم/u);
  if (digits) {
    const days = Number(digits[1]);
    if (days > 0 && days <= 365) {
      return days;
    }
  }
  for (const [word, days] of WORD_DAYS) {
    const foldedWord = foldRulingText(word);
    if (new RegExp(String.raw`${foldedWord}\s*يوم`, 'u').test(folded)) {
      return days;
    }
  }
  // OCR inserts an extra alef or hamza: ثلاءثين → ثلاثين.
  const bare = stripOptionalLetters(folded);
  if (bare.includes('يوم')) {
    for (const [word, days] of WORD_DAYS) {
      const bareWord = stripOptionalLetters(foldRulingText(word));
      if (bareWord.length >= 4 && bare.includes(bareWord)) {
        return days;
      }
    }
  }
  return null;
};

const stripOptionalLetters = (value: string): string =>
  value.replace(/[اأإآءئ]/g, '');

const HIJRI_MONTH_NUMBERS: ReadonlyArray<readonly [string, number]> = [
  ['ربيع الاول', 3],
  ['ربيع الاخر', 4],
  ['ربيع الثاني', 4],
  ['جمادى الاولى', 5],
  ['جمادى الاخره', 6],
  ['ذو القعده', 11],
  ['ذو الحجه', 12],
  ['محرم', 1],
  ['صفر', 2],
  ['رجب', 7],
  ['شعبان', 8],
  ['رمضان', 9],
  ['شوال', 10],
];

const HIJRI_DATE =
  /(?:\d{1,2}|[٠-٩]{1,2})\s+(?:محرم|صفر|ربيع الأول|ربيع الآخر|ربيع الثاني|جمادى الأولى|جمادى الآخرة|رجب|شعبان|رمضان|شوال|ذو القعدة|ذو الحجة)\s+(?:\d{3,4}|[٠-٩]{3,4})/gu;

const GREGORIAN_DATE =
  /(?:\d{1,2}|[٠-٩]{1,2})\s+(?:يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+(?:\d{4}|[٠-٩]{4})/gu;

const DATE_MARKER = /تاريخ الحكم|تاريخ النطق|تسلم الحكم|من تاريخ/u;

/** Civil (Kuwaiti) Hijri day to a Gregorian UTC date. */
const hijriToGregorian = (year: number, month: number, day: number): Date => {
  const julian =
    Math.floor((11 * year + 3) / 30) +
    354 * year +
    30 * month -
    Math.floor((month - 1) / 2) +
    day +
    1948440 -
    385;
  const z = Math.floor(julian + 0.5);
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const a = z + 1 + alpha - Math.floor(alpha / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const gregorianDay = b - d - Math.floor(30.6001 * e);
  const gregorianMonth = e < 14 ? e - 1 : e - 13;
  const gregorianYear = gregorianMonth > 2 ? c - 4716 : c - 4715;
  return new Date(Date.UTC(gregorianYear, gregorianMonth - 1, gregorianDay));
};

const monthNumber = (name: string): number | null => {
  const folded = foldRulingText(name);
  const match = [...HIJRI_MONTH_NUMBERS]
    .sort((left, right) => right[0].length - left[0].length)
    .find(([label]) => folded.includes(label));
  return match ? match[1] : null;
};

const dateFromHijriPhrase = (phrase: string): Date | null => {
  const folded = foldRulingText(phrase);
  const parts = folded.match(/(\d{1,2})\s+(.+?)\s+(\d{3,4})/u);
  if (!parts) {
    return null;
  }
  const month = monthNumber(parts[2]!);
  if (!month) {
    return null;
  }
  return hijriToGregorian(Number(parts[3]), month, Number(parts[1]));
};

const dateFromNumeric = (day: number, month: number, year: number): Date | null => {
  if (month < 1 || month > 12 || day < 1 || day > 30) {
    return null;
  }
  if (year >= 1300 && year < 1600) {
    return hijriToGregorian(year, month, day);
  }
  if (year >= 1900 && year < 2200) {
    return new Date(Date.UTC(year, month - 1, day));
  }
  return null;
};

/**
 * Ruling or notification date the objection window is counted from.
 * Returns null when the text does not state a date — callers must not
 * substitute the analysis clock.
 */
export const extractRulingStartDate = (text: string): Date | null => {
  const ascii = toAsciiDigits(text);
  const candidates: Array<{ index: number; date: Date }> = [];
  for (const match of ascii.matchAll(HIJRI_DATE)) {
    const date = dateFromHijriPhrase(match[0]);
    if (date) {
      candidates.push({ index: match.index ?? 0, date });
    }
  }
  for (const match of ascii.matchAll(GREGORIAN_DATE)) {
    const folded = foldRulingText(match[0]);
    const parts = folded.match(/(\d{1,2})\s+(.+?)\s+(\d{4})/u);
    const months = [
      'يناير',
      'فبراير',
      'مارس',
      'ابريل',
      'مايو',
      'يونيو',
      'يوليو',
      'اغسطس',
      'سبتمبر',
      'اكتوبر',
      'نوفمبر',
      'ديسمبر',
    ];
    const month = parts
      ? months.findIndex((name) => foldRulingText(parts[2]!).includes(name)) + 1
      : 0;
    if (parts && month > 0) {
      candidates.push({
        index: match.index ?? 0,
        date: new Date(Date.UTC(Number(parts[3]), month - 1, Number(parts[1]))),
      });
    }
  }
  for (const match of ascii.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{3,4})/g)) {
    const date = dateFromNumeric(Number(match[1]), Number(match[2]), Number(match[3]));
    if (date) {
      candidates.push({ index: match.index ?? 0, date });
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  let best = candidates[0]!;
  let bestScore = -1;
  for (const candidate of candidates) {
    const window = ascii.slice(
      Math.max(0, candidate.index - 48),
      candidate.index + 48,
    );
    const score = DATE_MARKER.test(window) ? 2 : 1;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best.date;
};
