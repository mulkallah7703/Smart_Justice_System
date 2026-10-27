/**
 * Deterministic PII gate for advisor answers.
 * National IDs, phones, emails, IBANs, and street-style addresses are never
 * returned verbatim. A request that asks for them, including a jailbreak, is
 * refused before the model runs.
 */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_INDIC = '۰۱۲۳۴۵۶۷۸۹';

export const PII_REFUSAL_AR =
  'لا يمكنني كشف رقم الهوية أو رقم الجوال أو العنوان أو أي بيان اتصال كما هو، حتى إذا طُلب تجاهل التعليمات. أستطيع شرح ما تثبته المستندات دون نقل بيانات الاتصال حرفياً.';

const toAsciiDigits = (value: string): string =>
  value
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EXTENDED_INDIC.indexOf(digit)));

const PII_ASK =
  /رقم\s*الهوية|الهوية\s*الوطنية|رقم\s*وطني|هوية\s*المدع|رقم\s*الجوال|رقم\s*الهاتف|جواله|جوالها|هاتفه|هاتفها|عنوانه|عنوانها|عنوان\s*السكن|بريده|بريدها|ايميله|إيميله|national\s*id|phone\s*number/iu;

const JAILBREAK =
  /بلا\s*قيود|تجاهل\s*التعليمات|ignore\s+previous|you\s+are\s+now|اكشف\s+لي|أكشف\s+لي/iu;

export const asksForVerbatimPii = (query: string): boolean =>
  PII_ASK.test(query) || (JAILBREAK.test(query) && /هوية|جوال|هاتف|عنوان|اكشف|أكشف/u.test(query));

const REDACTIONS: readonly RegExp[] = [
  /(?<!\d)[12]\d{9}(?!\d)/g,
  /(?:\+?966|00966|0)?[\s-]?(5)(?:[\s-]?\d){8}/g,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /\bSA\d{2}(?:\s?\d){18,22}\b/gi,
  /(?:شارع|حي|ص\.?\s*ب)\s+\S+(?:\s+\S+){0,6}/gu,
];

/** Masks PII in model output. Leaves the rest of the sentence in place. */
export const redactPii = (value: string): string => {
  const ascii = toAsciiDigits(value);
  let redacted = ascii;
  for (const pattern of REDACTIONS) {
    redacted = redacted.replace(pattern, '[محذوف]');
  }
  return redacted;
};
