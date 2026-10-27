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
  if (/يجوز\s+الاعتراض|مهلة\s+اعتراض|اعتراض\s+خلال/u.test(text)) {
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

const WORD_DAYS: Readonly<Record<string, number>> = {
  ثلاثين: 30,
  ثلاثون: 30,
  ستين: 60,
  ستون: 60,
};

/** Objection window explicitly written in a ruling. Final rulings without an open window return null. */
export const detectObjectionDays = (text: string): number | null => {
  const open = /يجوز\s+الاعتراض|مهلة\s+اعتراض|اعتراض\s+خلال/u.test(text);
  const finalOnly =
    /حكم\s+نهائي|حكم\s+قطعي|غير\s+قابل\s+للاعتراض/u.test(text) && !open;
  if (finalOnly || !open) {
    return null;
  }
  const digits = text.match(/اعتراض[\s\S]{0,80}?(\d+)\s*يوم/u);
  if (digits) {
    const days = Number(digits[1]);
    return days > 0 && days <= 365 ? days : null;
  }
  for (const [word, days] of Object.entries(WORD_DAYS)) {
    if (new RegExp(String.raw`اعتراض[\s\S]{0,80}?${word}\s*يوم`, 'u').test(text)) {
      return days;
    }
  }
  return null;
};
