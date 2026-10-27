import { answerAppearsToLeakSecrets } from '../prompts/legal-answer.prompt';

/** Guidance categories — they inform understanding, they never restrict the user to a menu. */
export const GUIDE_DOMAINS = [
  'EMPLOYMENT',
  'WORKPLACE_INJURY',
  'RENTAL_REAL_ESTATE',
  'COMMERCIAL',
  'CONTRACTS',
  'DEBT_FINANCIAL',
  'FAMILY',
  'INHERITANCE',
  'CRIMINAL',
  'ADMINISTRATIVE',
  'CIVIL',
  'ELECTRONIC_TRANSACTIONS',
  'CONSUMER',
  'CORPORATE',
  'GENERAL',
  'OTHER',
] as const;

export type GuideDomain = (typeof GUIDE_DOMAINS)[number];

export const GUIDE_DOMAIN_LABELS_AR: Record<GuideDomain, string> = {
  EMPLOYMENT: 'العمل والعلاقة العمالية',
  WORKPLACE_INJURY: 'إصابات العمل',
  RENTAL_REAL_ESTATE: 'الإيجار والعقار',
  COMMERCIAL: 'المنازعات التجارية',
  CONTRACTS: 'العقود',
  DEBT_FINANCIAL: 'الديون والمطالبات المالية',
  FAMILY: 'الأحوال الشخصية والأسرة',
  INHERITANCE: 'المواريث',
  CRIMINAL: 'المسائل الجزائية',
  ADMINISTRATIVE: 'المنازعات الإدارية',
  CIVIL: 'المطالبات المدنية',
  ELECTRONIC_TRANSACTIONS: 'التعاملات الإلكترونية',
  CONSUMER: 'حماية المستهلك',
  CORPORATE: 'الشركات',
  GENERAL: 'سؤال قانوني عام',
  OTHER: 'مسألة أخرى',
};

/** Hard bound on clarification turns before the model must answer with what it knows. */
export const GUIDE_MAX_CLARIFICATIONS = 3;

/** Validated assistant turn; persisted in AiGuideMessage.analysis. */
export interface GuideTurn {
  domains: GuideDomain[];
  understanding: string;
  knownFacts: string[];
  missingFacts: string[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
  suggestedReplies: string[];
  guidance: string | null;
  nextSteps: string[];
  suggestedDocuments: string[];
  likelyAuthority: string | null;
  uncertainty: string | null;
  urgent: boolean;
  /** Days stated in the conversation, when the user asked about a duration. */
  durationDays: number | null;
}

export type GuideTurnParseResult =
  | { ok: true; value: GuideTurn }
  | { ok: false; reason: string };

/**
 * Article / decree / regulation-number references. The guide has no trusted legal-source
 * corpus, so such references would be unverified model memory presented as authority.
 */
const UNVERIFIED_CITATION_PATTERN =
  /(?:ال)?(?:مادة|ماده)\s*(?:رقم\s*)?[([«"]?\s*[0-9٠-٩]+|مرسوم\s+ملكي\s+رقم|(?:^|[^\p{L}])م\s*\/\s*[0-9٠-٩]+|قرار\s+(?:وزاري|مجلس\s+الوزراء)\s+رقم|\b(?:article|art\.)\s*[0-9]+|royal\s+decree\s+(?:no\.?|number)/iu;

export const containsUnverifiedCitation = (text: string): boolean =>
  UNVERIFIED_CITATION_PATTERN.test(text);

const LIMITS = {
  understanding: 600,
  question: 400,
  guidance: 3000,
  uncertainty: 600,
  authority: 200,
  listItem: 300,
  listItems: 8,
  reply: 60,
  replies: 4,
} as const;

const optionalText = (
  value: unknown,
  max: number,
): { ok: true; value: string | null } | { ok: false } => {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false };
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    return { ok: false };
  }
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
};

const textList = (
  value: unknown,
  maxItems: number,
  maxChars: number,
): string[] | null => {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      return null;
    }
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (trimmed.length > maxChars) {
      return null;
    }
    items.push(trimmed);
  }
  return items.slice(0, maxItems);
};

const normalizeQuestion = (text: string): string =>
  text.replace(/[\s\p{P}]+/gu, '').toLowerCase();

export interface GuideTurnParseContext {
  /** True when the clarification budget is spent; the turn must carry guidance. */
  mustAnswer: boolean;
  /** Clarification questions already asked in this session. */
  previousQuestions: readonly string[];
}

/** Model output is untrusted: validate every field before it reaches the user or the DB. */
export const parseGuideTurn = (
  rawText: string,
  context: GuideTurnParseContext,
): GuideTurnParseResult => {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    return { ok: false, reason: 'malformed_json' };
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { ok: false, reason: 'not_object' };
  }
  const record = json as Record<string, unknown>;

  if (typeof record.needsClarification !== 'boolean') {
    return { ok: false, reason: 'bad_needs_clarification' };
  }
  if (record.urgent !== undefined && typeof record.urgent !== 'boolean') {
    return { ok: false, reason: 'bad_urgent' };
  }

  const understanding = optionalText(record.understanding, LIMITS.understanding);
  const question = optionalText(record.clarificationQuestion, LIMITS.question);
  const guidance = optionalText(record.guidance, LIMITS.guidance);
  const uncertainty = optionalText(record.uncertainty, LIMITS.uncertainty);
  const authority = optionalText(record.likelyAuthority, LIMITS.authority);
  if (
    !understanding.ok ||
    !question.ok ||
    !guidance.ok ||
    !uncertainty.ok ||
    !authority.ok
  ) {
    return { ok: false, reason: 'bad_text_field' };
  }
  if (!understanding.value) {
    return { ok: false, reason: 'missing_understanding' };
  }

  const knownFacts = textList(record.knownFacts, LIMITS.listItems, LIMITS.listItem);
  const missingFacts = textList(record.missingFacts, LIMITS.listItems, LIMITS.listItem);
  const nextSteps = textList(record.nextSteps, LIMITS.listItems, LIMITS.listItem);
  const documents = textList(
    record.suggestedDocuments,
    LIMITS.listItems,
    LIMITS.listItem,
  );
  const replies = textList(record.suggestedReplies, LIMITS.replies, LIMITS.reply);
  if (!knownFacts || !missingFacts || !nextSteps || !documents || !replies) {
    return { ok: false, reason: 'bad_list_field' };
  }

  if (!Array.isArray(record.domains)) {
    return { ok: false, reason: 'bad_domains' };
  }
  const domains = [
    ...new Set(
      record.domains
        .filter((d): d is string => typeof d === 'string')
        .map((d) => d.trim().toUpperCase())
        .map((d) =>
          (GUIDE_DOMAINS as readonly string[]).includes(d)
            ? (d as GuideDomain)
            : 'OTHER',
        ),
    ),
  ].slice(0, 4);
  if (domains.length === 0) {
    return { ok: false, reason: 'missing_domains' };
  }

  let needsClarification = record.needsClarification;
  if (needsClarification) {
    if (!question.value) {
      return { ok: false, reason: 'missing_question' };
    }
    const asked = new Set(context.previousQuestions.map(normalizeQuestion));
    const repeated = asked.has(normalizeQuestion(question.value));
    if (context.mustAnswer || repeated) {
      if (!guidance.value) {
        return {
          ok: false,
          reason: repeated ? 'repeated_question' : 'clarification_budget_exceeded',
        };
      }
      needsClarification = false;
    }
  }
  if (!needsClarification && !guidance.value) {
    return { ok: false, reason: 'missing_guidance' };
  }

  const userVisible = [
    understanding.value,
    question.value ?? '',
    guidance.value ?? '',
    uncertainty.value ?? '',
    authority.value ?? '',
    ...nextSteps,
    ...documents,
    ...replies,
  ].join('\n');
  if (answerAppearsToLeakSecrets(userVisible)) {
    return { ok: false, reason: 'secret_leak' };
  }
  if (containsUnverifiedCitation(userVisible)) {
    return { ok: false, reason: 'unverified_citation' };
  }

  return {
    ok: true,
    value: {
      domains,
      understanding: understanding.value,
      knownFacts,
      missingFacts,
      needsClarification,
      clarificationQuestion: needsClarification ? question.value : null,
      suggestedReplies: needsClarification ? replies : [],
      guidance: guidance.value,
      nextSteps,
      suggestedDocuments: documents,
      likelyAuthority: authority.value,
      uncertainty: uncertainty.value,
      urgent: record.urgent === true,
      durationDays: readDurationDays(record.durationDays),
    },
  };
};

/** Narrow a persisted analysis JSON back to a GuideTurn; null when absent/foreign shape. */
export const readStoredGuideTurn = (value: unknown): GuideTurn | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Partial<GuideTurn>;
  if (
    typeof record.needsClarification !== 'boolean' ||
    typeof record.understanding !== 'string' ||
    !Array.isArray(record.domains) ||
    !Array.isArray(record.knownFacts)
  ) {
    return null;
  }
  return record as GuideTurn;
};

const readDurationDays = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }
  if (value < 1 || value > 3650) {
    return null;
  }
  return value;
};

const DIRECT_QUESTION =
  /كم\s+(?:المدة|تستغرق|يوم)|هل\s+أحتاج\s+(?:إلى\s+)?محام|هل\s+احتاج\s+محام|مدة\s+الاعتراض|do i need a lawyer|how long/iu;

export const isDirectGuideQuestion = (text: string): boolean =>
  DIRECT_QUESTION.test(text);

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
];

const toAsciiDigits = (value: string): string =>
  value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));

export const inferDurationDays = (text: string): number | null => {
  const folded = toAsciiDigits(text).replace(/[\u064B-\u0652]/g, '');
  const digits = folded.match(/(\d{1,4})\s*يوم/u);
  if (digits) {
    const days = Number(digits[1]);
    return days > 0 && days <= 3650 ? days : null;
  }
  for (const [word, days] of WORD_DAYS) {
    if (new RegExp(String.raw`${word}\s*يوم`, 'u').test(folded)) {
      return days;
    }
  }
  return null;
};

const GREETING =
  /^(?:مرحبا|مرحباً|مرحبًا|السلام عليكم|أهلا|اهلا|أهلاً|hello|hi)(?:$|[\s!؟.،])/iu;

/** A short greeting continues the conversation instead of an off-topic refusal. */
export const greetingGuideTurn = (text: string): GuideTurn | null => {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 80) {
    return null;
  }
  if (/يوم|محام|قض|عقد|حكم|مهل|اعتراض|استئناف/u.test(trimmed)) {
    return null;
  }
  if (!GREETING.test(trimmed)) {
    return null;
  }
  return {
    domains: ['GENERAL'],
    understanding: 'تحية من المستخدم.',
    knownFacts: [],
    missingFacts: [],
    needsClarification: true,
    clarificationQuestion:
      'مرحباً بك. صف الواقعة القانونية التي تريد فهمها في جملة واحدة وسأكمل معك.',
    suggestedReplies: ['لدي عقد', 'لدي حكم', 'لدي مهلة اعتراض'],
    guidance: null,
    nextSteps: [],
    suggestedDocuments: [],
    likelyAuthority: null,
    uncertainty: null,
    urgent: false,
    durationDays: null,
  };
};

/** A direct duration or lawyer question must not come back as another question. */
export const forceDirectGuideAnswer = (
  turn: GuideTurn,
  userMessage: string,
): GuideTurn => {
  if (!isDirectGuideQuestion(userMessage) || !turn.needsClarification) {
    return {
      ...turn,
      durationDays: turn.durationDays ?? inferDurationDays(turn.guidance ?? ''),
    };
  }
  const guidance =
    turn.guidance ??
    'يمكنك الاستعانة بمحامٍ مرخص عندما تؤثر المسألة على حق أو ميعاد. المدة تعتمد على نوع الإجراء وتاريخ التبليغ المذكور في مستنداتك، ولا تُفترض مهلة لم ترد في نص.';
  return {
    ...turn,
    needsClarification: false,
    clarificationQuestion: null,
    suggestedReplies: [],
    guidance,
    durationDays: turn.durationDays ?? inferDurationDays(`${userMessage}\n${guidance}`),
  };
};

/** Safe Arabic turn when the model output is rejected after the single retry. */
export const fallbackGuideTurn = (reason: string): GuideTurn => ({
  domains: ['GENERAL'],
  understanding: 'تعذر اعتماد مخرجات التحليل لهذه الرسالة، وهذا رد احتياطي عام.',
  knownFacts: [],
  missingFacts: [],
  needsClarification: false,
  clarificationQuestion: null,
  suggestedReplies: [],
  guidance:
    reason === 'missing_domains'
      ? 'هذا الطلب خارج ما أستطيع توجيهه كإرشاد قانوني داخل المملكة. صف الواقعة القانونية التي تريد فهمها في جملة واحدة.'
      : 'لن أكرر السؤال السابق. لخص ما حدث والنتيجة التي تريدها في جملة واحدة، أو راجع الجهة المختصة أو محامياً مرخصاً إذا كان هناك ميعاد أو أثر على حق.',
  nextSteps: ['صِغ سؤالك في جملة واحدة تحدد الواقعة والنتيجة المطلوبة.'],
  suggestedDocuments: [],
  likelyAuthority: null,
  uncertainty: 'هذا رد احتياطي لأن التحليل لم يكتمل، وليس حكماً قضائياً.',
  urgent: false,
  durationDays: null,
});

/** User-visible chat text for a validated turn. */
export const renderGuideReply = (turn: GuideTurn): string => {
  if (turn.needsClarification && turn.clarificationQuestion) {
    return turn.clarificationQuestion;
  }
  const parts = [turn.guidance ?? ''];
  if (turn.uncertainty) {
    parts.push(turn.uncertainty);
  }
  return parts.filter((p) => p.length > 0).join('\n\n');
};
