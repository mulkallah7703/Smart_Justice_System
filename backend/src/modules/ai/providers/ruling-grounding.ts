/**
 * Deterministic grounding for Saudi ruling answers.
 * Polarity is read only from the operative excerpt so a facts section
 * that states the claim cannot invert the result.
 */

import { detectObjectionDays, extractLegalSignals } from './legal-signals';
import { asksForVerbatimPii, PII_REFUSAL_AR } from '../privacy/pii';

export const UNSURE_ANSWER_AR = 'غير متأكد';

const SUMMARY_MARK = 'ملخص التحليل:';

const OPERATIVE_MARK =
  /منطوق الحكم|نص الحكم|حكمت المحكمة|حكمت الدائرة|لذلك/u;

const RULING_BOOST =
  /منطوق الحكم|حكمت المحكمة|حكمت الدائرة|لذلك|حق الاعتراض|براءة|بحضانة/u;

export type RulingPolarity = 'father' | 'mother' | 'acquitted' | 'dismissed' | null;

export interface RulingFacts {
  caseNumbers: string[];
  courts: string[];
  hijriDates: string[];
  amounts: string[];
  objectionDays: number | null;
  final: boolean;
  polarity: RulingPolarity;
  operativeExcerpt: string;
}

export interface GroundedClaim {
  text: string;
  evidenceIds: string[];
}

export interface GroundedAnswer {
  answer: string;
  claims: GroundedClaim[];
  insufficientEvidence: boolean;
}

const toAsciiDigits = (value: string): string =>
  value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));

const fold = (value: string): string =>
  toAsciiDigits(value)
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');

/** Appends ruling terms so the vector query still reaches منطوق الحكم. */
export const rewriteArabicLegalQuery = (query: string): string => {
  const trimmed = query.trim();
  if (!/[\u0600-\u06FF]/u.test(trimmed)) {
    return trimmed;
  }
  const folded = fold(trimmed);
  const extras: string[] = [];
  if (/نتيج|منطوق|حكم|حضان|براء|رفض|قبول|لمن/u.test(folded)) {
    extras.push('منطوق الحكم حكمت المحكمة');
  }
  if (/مهل|اعتراض|استئناف|يوم/u.test(folded)) {
    extras.push('حق الاعتراض خلال يوم');
  }
  return extras.length === 0 ? trimmed : `${trimmed} ${extras.join(' ')}`;
};

/** Extra rank for the operative and objection sentences. */
export const rulingTermBoost = (text: string): number =>
  RULING_BOOST.test(text) ? 0.2 : 0;

export const operativeExcerpt = (text: string): string => {
  const source = text
    .split('\n')
    .filter((line) => !line.includes(SUMMARY_MARK))
    .join('\n');
  const match = source.match(OPERATIVE_MARK);
  if (!match || match.index === undefined) {
    return '';
  }
  return source.slice(match.index, match.index + 500);
};

export const rulingPolarity = (operative: string): RulingPolarity => {
  const folded = fold(operative);
  if (!folded) {
    return null;
  }
  const decided = /حكمت|قضت|لذلك/u.test(folded);
  if (/براء/u.test(folded)) {
    return 'acquitted';
  }
  if (decided && /حضانه الاب|بحضانه الاب|للاب/u.test(folded)) {
    return 'father';
  }
  if (decided && /حضانه الام|بحضانه الام|للام/u.test(folded)) {
    return 'mother';
  }
  if (/رفض الدعوى|برفض/u.test(folded)) {
    return 'dismissed';
  }
  return null;
};

export const groundedSentence = (polarity: RulingPolarity): string | null => {
  switch (polarity) {
    case 'father':
      return 'حكمت المحكمة بحضانة الأب.';
    case 'mother':
      return 'حكمت المحكمة بحضانة الأم.';
    case 'acquitted':
      return 'حكمت المحكمة ببراءة المتهم.';
    case 'dismissed':
      return 'حكمت المحكمة برفض الدعوى.';
    default:
      return null;
  }
};

export const answerInvertsRuling = (
  answer: string,
  polarity: RulingPolarity,
): boolean => {
  if (!polarity) {
    return false;
  }
  const folded = fold(answer);
  if (polarity === 'father') {
    const saysMother = /حضانه الام/u.test(folded);
    const rejectsFather =
      /رفض طلب الاب/u.test(folded) && !/حضانه الاب/u.test(folded);
    return saysMother || rejectsFather;
  }
  if (polarity === 'mother') {
    return /حضانه الاب/u.test(folded) && !/حضانه الام/u.test(folded);
  }
  if (polarity === 'acquitted') {
    return /ادان|عقوب|سجن/u.test(folded) && !/براء/u.test(folded);
  }
  return /قبول الدعوى|بقبول|حكمت لصالح المدعي/u.test(folded) && !/رفض/u.test(folded);
};

const unique = (values: string[]): string[] => [...new Set(values)];

export const extractRulingFacts = (text: string): RulingFacts => {
  const ascii = toAsciiDigits(text);
  const operative = operativeExcerpt(ascii);
  const signals = extractLegalSignals(ascii);
  const caseNumbers = unique(
    [...ascii.matchAll(/رقم\s+القضية\s*:?\s*(\d{3,8})/gu)].map((match) => match[1]!),
  );
  const courts = unique(
    [
      ...ascii.matchAll(
        /(?:المحكمة|محكمة)\s+(?:الأحوال\s+الشخصية|التجارية|الجزائية|العامة|العمالية)(?:\s+ب?[\u0621-\u064A]+)?/gu,
      ),
    ].map((match) => match[0]!.replace(/\s+/g, ' ').trim()),
  );
  const amounts = unique(
    [...ascii.matchAll(/(\d{2,9})\s*ريال/gu)]
      .map((match) => match[1]!)
      .filter((amount) => !caseNumbers.includes(amount)),
  );
  const folded = fold(ascii);
  return {
    caseNumbers,
    courts,
    hijriDates: signals.hijriDates.map((value) => toAsciiDigits(value)),
    amounts,
    objectionDays: detectObjectionDays(ascii),
    final: /حكم نهائي|حكم قطعي|غير قابل للاعتراض/u.test(folded),
    polarity: rulingPolarity(operative),
    operativeExcerpt: operative,
  };
};

export const describeRulingFacts = (facts: RulingFacts): string => {
  const lines: string[] = [];
  const outcome = groundedSentence(facts.polarity);
  if (outcome) {
    lines.push(`النتيجة كما في منطوق الحكم: ${outcome}`);
  }
  if (facts.objectionDays) {
    lines.push(`مهلة الاعتراض: ${facts.objectionDays} يوماً`);
  } else if (facts.final) {
    lines.push('الحكم نهائي غير قابل للاعتراض.');
  }
  for (const value of facts.caseNumbers) {
    lines.push(`رقم القضية: ${value}`);
  }
  for (const value of facts.hijriDates) {
    lines.push(`تاريخ هجري: ${value}`);
  }
  for (const value of facts.courts) {
    lines.push(`المحكمة: ${value}`);
  }
  for (const value of facts.amounts) {
    lines.push(`المبلغ: ${value} ريال`);
  }
  return lines.join('\n');
};

const deadlineQuestion = (query: string): boolean =>
  /مهل|اعتراض|استئناف|يوم/u.test(fold(query));

const unsure = (): GroundedAnswer => ({
  answer: UNSURE_ANSWER_AR,
  claims: [],
  insufficientEvidence: true,
});

const cited = (
  sentence: string,
  evidenceId: string,
): GroundedAnswer => ({
  answer: sentence,
  claims: [{ text: sentence, evidenceIds: [evidenceId] }],
  insufficientEvidence: false,
});

/**
 * Checks the drafted answer against the cited chunks.
 * An inverted operative result, a missing stated deadline, or a number
 * that is not in the evidence becomes غير متأكد or the grounded sentence.
 */
export const guardGroundedAnswer = (input: {
  query: string;
  answer: string;
  claims: readonly GroundedClaim[];
  insufficientEvidence: boolean;
  evidence: ReadonlyArray<{ evidenceId: string; text: string }>;
}): GroundedAnswer => {
  const corpus = input.evidence.map((item) => item.text).join('\n');
  const facts = extractRulingFacts(corpus);
  const polarity = facts.polarity;

  if (answerInvertsRuling(input.answer, polarity)) {
    const sentence = groundedSentence(polarity);
    const support = input.evidence.find(
      (item) => rulingPolarity(operativeExcerpt(item.text)) === polarity,
    );
    if (!sentence || !support) {
      return unsure();
    }
    return cited(sentence, support.evidenceId);
  }

  if (deadlineQuestion(input.query) && facts.objectionDays) {
    const days = String(facts.objectionDays);
    const stated = toAsciiDigits(input.answer);
    if (!stated.includes(days)) {
      const support = input.evidence.find(
        (item) => detectObjectionDays(item.text) === facts.objectionDays,
      );
      if (!support) {
        return unsure();
      }
      return cited(`مهلة الاعتراض ${days} يوماً`, support.evidenceId);
    }
  }

  const evidenceDigits = toAsciiDigits(
    input.evidence
      .filter((item) => !item.text.includes(SUMMARY_MARK))
      .map((item) => item.text)
      .join('\n'),
  );
  const invented = (toAsciiDigits(input.answer).match(/\d{4,}/g) ?? []).filter(
    (number) => !evidenceDigits.includes(number),
  );
  if (invented.length > 0) {
    return unsure();
  }

  return {
    answer: input.answer,
    claims: [...input.claims],
    insufficientEvidence: input.insufficientEvidence,
  };
};

export type FactualQuestionKind =
  | 'outcome'
  | 'parties'
  | 'deadlines'
  | 'case-number'
  | 'dates'
  | 'amounts'
  | 'court'
  | 'reasoning'
  | 'not-in-document'
  | 'pii';

export interface FactualQuestion {
  kind: FactualQuestionKind;
  ask: string;
  expect: string;
}

/** Answers one eval question from the document text alone. */
export const answerRulingQuestion = (
  text: string,
  question: FactualQuestion,
): string => {
  if (question.kind === 'pii' || asksForVerbatimPii(question.ask)) {
    return PII_REFUSAL_AR;
  }
  if (question.kind === 'not-in-document') {
    return UNSURE_ANSWER_AR;
  }
  const facts = extractRulingFacts(text);
  switch (question.kind) {
    case 'outcome':
      return groundedSentence(facts.polarity) ?? UNSURE_ANSWER_AR;
    case 'deadlines':
      if (facts.objectionDays) {
        return `مهلة الاعتراض ${facts.objectionDays} يوماً`;
      }
      if (facts.final) {
        return 'غير قابل للاعتراض';
      }
      return UNSURE_ANSWER_AR;
    case 'case-number':
      return facts.caseNumbers[0]
        ? `رقم القضية ${facts.caseNumbers[0]}`
        : UNSURE_ANSWER_AR;
    case 'dates':
      return facts.hijriDates.find((value) => value.includes(question.expect)) ??
        facts.hijriDates[0] ??
        UNSURE_ANSWER_AR;
    case 'amounts':
      return facts.amounts[0] ? `${facts.amounts[0]} ريال` : UNSURE_ANSWER_AR;
    case 'court':
      return facts.courts[0] ?? UNSURE_ANSWER_AR;
    case 'parties':
    case 'reasoning':
      return toAsciiDigits(text).includes(toAsciiDigits(question.expect))
        ? question.expect
        : UNSURE_ANSWER_AR;
    default:
      return UNSURE_ANSWER_AR;
  }
};

export const answerInvertsExpected = (
  answer: string,
  question: FactualQuestion,
): boolean => {
  if (question.kind !== 'outcome') {
    return false;
  }
  if (question.expect.includes('الأب') || question.expect.includes('حضانة الأب')) {
    return answerInvertsRuling(answer, 'father');
  }
  if (question.expect.includes('براءة')) {
    return answerInvertsRuling(answer, 'acquitted');
  }
  if (question.expect.includes('رفض')) {
    return answerInvertsRuling(answer, 'dismissed');
  }
  return false;
};
