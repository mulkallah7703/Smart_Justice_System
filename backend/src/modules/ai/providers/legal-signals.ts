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
  return null;
};
