import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { AiGuideService } from '../src/modules/ai/guide/ai-guide.service';
import {
  GUIDE_WELCOME_REPLY_AR,
  LEGAL_GUIDE_SYSTEM_PROMPT,
} from '../src/modules/ai/guide/prompts/legal-guide.prompt';
import { aiLlmTimeout, aiProviderError } from '../src/modules/ai/ai.errors';
import type {
  LlmGenerateAnswerInput,
  LlmProvider,
} from '../src/modules/ai/providers/llm-provider.interface';
import type { PrismaService } from '../src/shared/database/prisma.service';

const UNRELATED_RENTAL = /إيجار|Ejar|المؤجر|المستأجر/;

interface StoredRow {
  sessionId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  analysis: unknown;
  createdAt: Date;
}

const turn = (fields: Record<string, unknown>): string =>
  JSON.stringify({
    knownFacts: [],
    missingFacts: [],
    suggestedReplies: [],
    guidance: null,
    clarificationQuestion: null,
    nextSteps: [],
    suggestedDocuments: [],
    likelyAuthority: null,
    uncertainty: null,
    urgent: false,
    ...fields,
  });

/** Pulls the fenced ORIGINAL QUESTION out of the prompt the service built. */
const originalQuestionOf = (prompt: string): string =>
  /<<<UNTRUSTED_ORIGINAL_QUESTION>>>\n([\s\S]*?)\n<<<END_UNTRUSTED_ORIGINAL_QUESTION>>>/.exec(
    prompt,
  )?.[1] ?? '';

/**
 * Deterministic stand-in for the model: it reacts to the question the service actually
 * delivered. Production uses the real OpenAI adapter; this is a unit-test fixture only.
 */
const fixtureModel = (input: LlmGenerateAnswerInput): string => {
  const question = originalQuestionOf(input.userPrompt);
  const afterClarification = input.userPrompt.includes(
    '[ASSISTANT (clarification question)]',
  );

  if (question.includes('فصل') && question.includes('إصابة')) {
    return turn({
      domains: ['EMPLOYMENT', 'WORKPLACE_INJURY', 'DEBT_FINANCIAL'],
      understanding: 'فُصل المستخدم بعد إصابة عمل ولم تُصرف مستحقاته.',
      knownFacts: ['فصل من العمل', 'إصابة أثناء العمل', 'عدم صرف المستحقات'],
      missingFacts: ['هل وُثقت الإصابة رسمياً'],
      needsClarification: true,
      clarificationQuestion: 'هل وُثّقت الإصابة بتقرير طبي أو بلاغ رسمي؟',
    });
  }
  if (question.includes('فصلي')) {
    if (afterClarification) {
      const corrected = input.userPrompt.includes('بل عقدي محدد المدة');
      return turn({
        domains: ['EMPLOYMENT'],
        understanding: 'إنهاء عقد عمل دون سبب معلن.',
        knownFacts: [
          'أُنهي عقد العمل دون سبب',
          corrected ? 'العقد محدد المدة' : 'العقد غير محدد المدة',
        ],
        needsClarification: false,
        guidance: 'يمكنك المطالبة بحقوقك العمالية لدى الجهة المختصة بعد محاولة التسوية الودية.',
      });
    }
    return turn({
      domains: ['EMPLOYMENT'],
      understanding: 'إنهاء عقد عمل دون سبب معلن.',
      knownFacts: ['أُنهي عقد العمل دون سبب'],
      missingFacts: ['نوع العقد', 'وجود إشعار رسمي'],
      needsClarification: true,
      clarificationQuestion: 'هل وصلك إشعار رسمي بإنهاء العقد، وما نوع عقدك؟',
      suggestedReplies: ['محدد المدة', 'غير محدد المدة'],
    });
  }
  if (question.includes('التأمين')) {
    return turn({
      domains: ['RENTAL_REAL_ESTATE'],
      understanding: 'المؤجر يرفض إعادة مبلغ التأمين.',
      knownFacts: ['دفع المستخدم مبلغ تأمين'],
      needsClarification: true,
      clarificationQuestion: 'هل يوجد عقد إيجار موثق، وهل لديك ما يثبت دفع مبلغ التأمين؟',
    });
  }
  if (question.includes('استدان')) {
    return turn({
      domains: ['DEBT_FINANCIAL'],
      understanding: 'شخص اقترض مالاً ويرفض السداد.',
      knownFacts: ['أقرض المستخدم مبلغاً'],
      needsClarification: true,
      clarificationQuestion: 'هل لديك إثبات للمبلغ، مثل تحويل بنكي أو إقرار مكتوب؟',
    });
  }
  if (question.includes('الشرط الجزائي')) {
    return turn({
      domains: ['CONTRACTS'],
      understanding: 'سؤال عن معنى الشرط الجزائي.',
      needsClarification: false,
      guidance: 'الشرط الجزائي اتفاق مسبق في العقد على تعويض محدد عند الإخلال بالالتزام.',
    });
  }
  return turn({
    domains: ['GENERAL'],
    understanding: 'يرغب المستخدم في رفع قضية دون تحديد موضوعها.',
    missingFacts: ['موضوع النزاع'],
    needsClarification: true,
    clarificationQuestion: 'ما موضوع القضية، وما الذي حدث معك؟',
  });
};

describe('AiGuideService', () => {
  let rows: StoredRow[];
  let sessions: Array<{ id: string; userId: string; status: string; expiresAt: Date }>;
  let prisma: Record<string, unknown>;
  let llm: LlmProvider & { generateAnswer: jest.Mock; complete: jest.Mock };
  let service: AiGuideService;
  let sessionSeq: number;

  const configService = {
    get: (key: string) =>
      key === 'ai'
        ? {
            llmMode: 'openai',
            guideSessionTtlHours: 48,
            guideMaxMessages: 40,
            guideMaxMessageChars: 2000,
          }
        : undefined,
  } as unknown as ConfigService;

  const promptAt = (call: number): string =>
    (llm.generateAnswer.mock.calls[call]![0] as LlmGenerateAnswerInput).userPrompt;

  beforeEach(() => {
    rows = [];
    sessions = [];
    sessionSeq = 0;
    const select = (row: StoredRow) => ({
      role: row.role,
      content: row.content,
      analysis: row.analysis ?? null,
    });
    prisma = {
      aiGuideSession: {
        create: jest.fn(async ({ data }: { data: { userId: string; expiresAt: Date } }) => {
          sessionSeq += 1;
          const session = { id: `sess_${sessionSeq}`, status: 'ACTIVE', ...data };
          sessions.push(session);
          return session;
        }),
        findFirst: jest.fn(async ({ where }: { where: { id: string; userId: string } }) =>
          sessions.find((s) => s.id === where.id && s.userId === where.userId) ?? null,
        ),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
          const session = sessions.find((s) => s.id === where.id)!;
          session.status = data.status;
          return session;
        }),
      },
      aiGuideMessage: {
        create: jest.fn(async ({ data }: { data: Partial<StoredRow> }) => {
          const row = {
            analysis: null,
            createdAt: new Date(Date.now() + rows.length),
            ...data,
          } as StoredRow;
          rows.push(row);
          return row;
        }),
        count: jest.fn(async ({ where }: { where: { sessionId: string } }) =>
          rows.filter((r) => r.sessionId === where.sessionId).length,
        ),
        findMany: jest.fn(
          async ({ where, orderBy }: { where: { sessionId: string; role?: string }; orderBy: { createdAt: 'asc' | 'desc' } }) => {
            const list = rows
              .filter((r) => r.sessionId === where.sessionId)
              .filter((r) => !where.role || r.role === where.role)
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            if (orderBy.createdAt === 'desc') list.reverse();
            return list.map(select);
          },
        ),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    llm = {
      name: 'fixture',
      complete: jest.fn(),
      generateAnswer: jest.fn(async (input: LlmGenerateAnswerInput) => ({
        text: fixtureModel(input),
        model: 'fixture',
        promptTokens: 0,
        completionTokens: 0,
      })),
    };
    service = new AiGuideService(
      prisma as unknown as PrismaService,
      configService as never,
      llm,
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const ask = async (userId: string, question: string) => {
    const started = await service.start(userId, {});
    const response = await service.answer(userId, {
      sessionId: started.sessionId,
      answer: question,
    });
    return { sessionId: started.sessionId, response };
  };

  it('starts with a static welcome, no model call, and no identity fields', async () => {
    const result = await service.start('user_1', {});
    expect(result).toEqual({ sessionId: 'sess_1', reply: GUIDE_WELCOME_REPLY_AR });
    expect(llm.generateAnswer).not.toHaveBeenCalled();
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('A. employment: asks a relevant question, never an Ejar/rental one', async () => {
    const { response } = await ask('user_1', 'تم فصلي من العمل بدون سبب.');

    expect(originalQuestionOf(promptAt(0))).toBe('تم فصلي من العمل بدون سبب.');
    expect((llm.generateAnswer.mock.calls[0]![0] as LlmGenerateAnswerInput).systemPrompt).toBe(
      LEGAL_GUIDE_SYSTEM_PROMPT,
    );
    expect(response.stage).toBe('QUESTION');
    expect(response.reply).toBe('هل وصلك إشعار رسمي بإنهاء العقد، وما نوع عقدك؟');
    expect(response.reply).not.toMatch(UNRELATED_RENTAL);
    expect(response.turn.domains).toEqual(['EMPLOYMENT']);
    expect(response.turn.suggestedReplies).toEqual(['محدد المدة', 'غير محدد المدة']);
    expect(promptAt(0)).not.toMatch(UNRELATED_RENTAL);
  });

  it('B. rental deposit: the follow-up concerns the rental/deposit situation', async () => {
    const { response } = await ask('user_1', 'المؤجر يرفض إعادة مبلغ التأمين.');
    expect(response.stage).toBe('QUESTION');
    expect(response.turn.domains).toEqual(['RENTAL_REAL_ESTATE']);
    expect(response.reply).toMatch(/التأمين/);
    expect(response.reply).not.toMatch(/فصل|إنهاء العقد|صاحب العمل/);
  });

  it('C. debt: no employment or rental question', async () => {
    const { response } = await ask('user_1', 'شخص استدان مني مبلغًا ويرفض السداد.');
    expect(response.turn.domains).toEqual(['DEBT_FINANCIAL']);
    expect(response.reply).toMatch(/إثبات للمبلغ/);
    expect(response.reply).not.toMatch(UNRELATED_RENTAL);
    expect(response.reply).not.toMatch(/فصل|عمل/);
  });

  it('D. direct definition: answers immediately with zero clarifications', async () => {
    const { sessionId, response } = await ask('user_1', 'ما المقصود بالشرط الجزائي في العقود؟');
    expect(response.stage).toBe('ANSWER');
    expect(response.turn.needsClarification).toBe(false);
    expect(response.turn.clarificationCount).toBe(0);
    expect(response.reply).toMatch(/الشرط الجزائي/);
    expect(llm.generateAnswer).toHaveBeenCalledTimes(1);

    const summary = await service.summary('user_1', sessionId);
    expect(summary.caseTypeValue).toBe('العقود');
    expect(summary.resultBody).toMatch(/الشرط الجزائي/);
    expect(summary.durationDays).toBe(0);
  });

  it('E. ambiguous: asks for context instead of assuming a scenario', async () => {
    const { response } = await ask('user_1', 'أريد أرفع قضية.');
    expect(response.stage).toBe('QUESTION');
    expect(response.turn.domains).toEqual(['GENERAL']);
    expect(response.reply).toBe('ما موضوع القضية، وما الذي حدث معك؟');
  });

  it('F. complex: keeps employment, injury, and entitlement aspects', async () => {
    const { response } = await ask(
      'user_1',
      'شركتي فصلتني بعد إصابة أثناء العمل ولم تصرف مستحقاتي.',
    );
    expect(response.turn.domains).toEqual([
      'EMPLOYMENT',
      'WORKPLACE_INJURY',
      'DEBT_FINANCIAL',
    ]);
    expect(response.turn.knownFacts).toEqual([
      'فصل من العمل',
      'إصابة أثناء العمل',
      'عدم صرف المستحقات',
    ]);
    expect(response.turn.clarificationCount).toBe(1);
  });

  it('G. follow-up keeps the original question, the asked question, and the answer', async () => {
    const { sessionId } = await ask('user_1', 'تم فصلي من العمل بدون سبب.');
    const second = await service.answer('user_1', { sessionId, answer: 'غير محدد المدة' });

    const prompt = promptAt(1);
    expect(originalQuestionOf(prompt)).toBe('تم فصلي من العمل بدون سبب.');
    expect(prompt).toContain(
      '[ASSISTANT (clarification question)]: هل وصلك إشعار رسمي بإنهاء العقد، وما نوع عقدك؟',
    );
    expect(prompt).toContain('[USER]: غير محدد المدة');
    expect(prompt).toContain('- أُنهي عقد العمل دون سبب');
    expect(prompt).not.toContain(GUIDE_WELCOME_REPLY_AR);
    expect(second.stage).toBe('ANSWER');
    expect(second.turn.clarificationCount).toBe(1);
  });

  it('H. a correction reaches the model and replaces the earlier fact', async () => {
    const { sessionId } = await ask('user_1', 'تم فصلي من العمل بدون سبب.');
    await service.answer('user_1', { sessionId, answer: 'غير محدد المدة' });
    const corrected = await service.answer('user_1', {
      sessionId,
      answer: 'تصحيح: بل عقدي محدد المدة',
    });

    const prompt = promptAt(2);
    expect(prompt).toContain('- العقد غير محدد المدة');
    expect(prompt.indexOf('[USER]: تصحيح: بل عقدي محدد المدة')).toBeGreaterThan(
      prompt.indexOf('[USER]: غير محدد المدة'),
    );
    expect(corrected.turn.knownFacts).toContain('العقد محدد المدة');
    expect(corrected.turn.knownFacts).not.toContain('العقد غير محدد المدة');
  });

  it('I. a new inquiry does not inherit facts or questions from a previous session', async () => {
    await ask('user_1', 'تم فصلي من العمل بدون سبب.');
    const { response } = await ask('user_1', 'شخص استدان مني مبلغًا ويرفض السداد.');

    const prompt = promptAt(1);
    expect(originalQuestionOf(prompt)).toBe('شخص استدان مني مبلغًا ويرفض السداد.');
    expect(prompt).not.toMatch(/فصلي|إشعار رسمي|أُنهي/);
    expect(prompt).toContain('(none yet)');
    expect(response.turn.clarificationCount).toBe(1);
  });

  it('J. another user cannot answer or read a foreign session', async () => {
    const { sessionId } = await ask('user_1', 'تم فصلي من العمل بدون سبب.');
    const calls = llm.generateAnswer.mock.calls.length;

    await expect(
      service.answer('user_2', { sessionId, answer: 'probe' }),
    ).rejects.toMatchObject({ code: 'AI_GUIDE_SESSION_NOT_FOUND' });
    await expect(service.summary('user_2', sessionId)).rejects.toMatchObject({
      code: 'AI_GUIDE_SESSION_NOT_FOUND',
    });
    expect(llm.generateAnswer.mock.calls.length).toBe(calls);
    expect(rows.some((r) => r.content === 'probe')).toBe(false);
  });

  it('K. timeout: error surfaces, nothing persisted, no fallback question', async () => {
    const started = await service.start('user_1', {});
    llm.generateAnswer.mockRejectedValueOnce(aiLlmTimeout());

    await expect(
      service.answer('user_1', { sessionId: started.sessionId, answer: 'تم فصلي من العمل بدون سبب.' }),
    ).rejects.toMatchObject({ code: 'AI_LLM_TIMEOUT' });
    expect(rows.map((r) => r.content)).toEqual([GUIDE_WELCOME_REPLY_AR]);

    // Retrying the same message does not duplicate it in the stored history.
    await service.answer('user_1', { sessionId: started.sessionId, answer: 'تم فصلي من العمل بدون سبب.' });
    expect(rows.filter((r) => r.role === 'USER')).toHaveLength(1);
  });

  it('K. provider error maps to AI_GUIDE_FAILED without a fallback question', async () => {
    const started = await service.start('user_1', {});
    llm.generateAnswer.mockRejectedValueOnce(aiProviderError());
    await expect(
      service.answer('user_1', { sessionId: started.sessionId, answer: 'سؤال' }),
    ).rejects.toMatchObject({ code: 'AI_GUIDE_FAILED' });
    expect(rows).toHaveLength(1);
  });

  it('K. malformed output twice → AI_GUIDE_FAILED after one constrained retry', async () => {
    const started = await service.start('user_1', {});
    llm.generateAnswer.mockResolvedValue({
      text: 'not-json{{{',
      model: 'fixture',
      promptTokens: 0,
      completionTokens: 0,
    });
    await expect(
      service.answer('user_1', { sessionId: started.sessionId, answer: 'أريد أرفع قضية.' }),
    ).rejects.toMatchObject({ code: 'AI_GUIDE_FAILED' });
    expect(llm.generateAnswer).toHaveBeenCalledTimes(2);
    expect(promptAt(1)).toContain('IMPORTANT RETRY');
    expect(rows).toHaveLength(1);
  });

  it('L. an unverified article citation is retried, never shown', async () => {
    const started = await service.start('user_1', {});
    llm.generateAnswer.mockResolvedValueOnce({
      text: turn({
        domains: ['EMPLOYMENT'],
        understanding: 'فصل تعسفي.',
        needsClarification: false,
        guidance: 'وفق المادة 77 من نظام العمل تستحق تعويضاً.',
      }),
      model: 'fixture',
      promptTokens: 0,
      completionTokens: 0,
    });
    const response = await service.answer('user_1', {
      sessionId: started.sessionId,
      answer: 'تم فصلي من العمل بدون سبب.',
    });
    expect(llm.generateAnswer).toHaveBeenCalledTimes(2);
    expect(response.reply).not.toMatch(/المادة/);
    expect(response.turn.sourcesAvailable).toBe(false);
    expect(response.turn.sources).toEqual([]);
  });

  it('caps clarifications: after 3 questions the model is told to answer now', async () => {
    const started = await service.start('user_1', {});
    llm.generateAnswer.mockImplementation(async (input: LlmGenerateAnswerInput) => {
      const mustAnswer = input.userPrompt.includes('MUST_ANSWER_NOW: true');
      const n = (input.userPrompt.match(/\[USER\]/g) ?? []).length;
      return {
        text: turn({
          domains: ['GENERAL'],
          understanding: 'مسألة عامة.',
          needsClarification: !mustAnswer,
          clarificationQuestion: mustAnswer ? null : `سؤال رقم ${'أ'.repeat(n)}؟`,
          guidance: mustAnswer ? 'إرشاد بما هو معروف.' : null,
        }),
        model: 'fixture',
        promptTokens: 0,
        completionTokens: 0,
      };
    });

    const stages: string[] = [];
    for (const text of ['أريد أرفع قضية.', 'تفصيل', 'تفصيل آخر', 'تفصيل ثالث']) {
      const r = await service.answer('user_1', { sessionId: started.sessionId, answer: text });
      stages.push(r.stage);
    }
    expect(stages).toEqual(['QUESTION', 'QUESTION', 'QUESTION', 'ANSWER']);
    expect(promptAt(3)).toContain('MUST_ANSWER_NOW: true');
  });

  it('summary is not available before any guidance exists', async () => {
    const { sessionId } = await ask('user_1', 'أريد أرفع قضية.');
    await expect(service.summary('user_1', sessionId)).rejects.toMatchObject({
      code: 'AI_GUIDE_SUMMARY_NOT_READY',
    });
  });

  it('M. Arabic input and output are preserved verbatim', async () => {
    const started = await service.start('user_1', {
      initialMessage: 'ما المقصود بالشرط الجزائي في العقود؟',
    });
    expect(started.stage).toBe('ANSWER');
    expect(started.reply).toBe(
      'الشرط الجزائي اتفاق مسبق في العقد على تعويض محدد عند الإخلال بالالتزام.',
    );
    expect(rows.map((r) => r.content)).toEqual([
      'ما المقصود بالشرط الجزائي في العقود؟',
      started.reply,
    ]);
  });
});
