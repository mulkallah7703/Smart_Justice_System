import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AiGuideService } from '../src/modules/ai/guide/ai-guide.service';
import { GUIDE_WELCOME_REPLY_AR } from '../src/modules/ai/guide/prompts/legal-guide.prompt';
import type { LlmProvider } from '../src/modules/ai/providers/llm-provider.interface';
import type { PrismaService } from '../src/shared/database/prisma.service';

describe('AiGuideService', () => {
  let prisma: {
    aiGuideSession: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    aiGuideMessage: {
      create: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let llm: LlmProvider;
  let service: AiGuideService;
  let logSpy: jest.SpyInstance;

  const configService = {
    get: (key: string) => {
      if (key === 'ai') {
        return {
          llmMode: 'mock',
          guideSessionTtlHours: 48,
          guideMaxMessages: 40,
          guideMaxMessageChars: 2000,
        };
      }
      return undefined;
    },
  } as unknown as ConfigService;

  beforeEach(() => {
    prisma = {
      aiGuideSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      aiGuideMessage: {
        create: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn(),
      },
    };
    llm = {
      name: 'mock',
      complete: jest.fn(),
      generateAnswer: jest.fn(),
    };
    service = new AiGuideService(
      prisma as unknown as PrismaService,
      configService as never,
      llm,
    );
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts a session with a welcome assistant message and no userId in the DTO', async () => {
    prisma.aiGuideSession.create.mockResolvedValue({
      id: 'sess_1',
      userId: 'user_1',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const result = await service.start('user_1', {});

    expect(result).toEqual({
      sessionId: 'sess_1',
      reply: GUIDE_WELCOME_REPLY_AR,
    });
    expect(result).not.toHaveProperty('userId');
    expect(prisma.aiGuideMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'ASSISTANT',
          content: GUIDE_WELCOME_REPLY_AR,
        }),
      }),
    );
    expect(llm.complete).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.join(' ')).not.toMatch(GUIDE_WELCOME_REPLY_AR);
  });

  it('answers with QUESTION then SUMMARY stages and marks completed', async () => {
    const session = {
      id: 'sess_1',
      userId: 'user_1',
      status: 'ACTIVE' as const,
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.aiGuideSession.findFirst.mockResolvedValue(session);
    prisma.aiGuideMessage.findMany
      .mockResolvedValueOnce([
        { role: 'ASSISTANT', content: 'welcome' },
        { role: 'USER', content: 'مشكلة إيجار' },
      ])
      .mockResolvedValueOnce([
        { role: 'ASSISTANT', content: 'welcome' },
        { role: 'USER', content: 'مشكلة إيجار' },
        { role: 'ASSISTANT', content: 'clarify' },
        { role: 'USER', content: 'عقد موثق' },
      ]);

    const first = await service.answer('user_1', {
      sessionId: 'sess_1',
      answer: 'مشكلة إيجار',
    });
    expect(first.stage).toBe('QUESTION');
    expect(first).not.toHaveProperty('userId');

    const second = await service.answer('user_1', {
      sessionId: 'sess_1',
      answer: 'عقد موثق',
    });
    expect(second.stage).toBe('SUMMARY');
    expect(prisma.aiGuideSession.update).toHaveBeenCalledWith({
      where: { id: 'sess_1' },
      data: { status: 'COMPLETED' },
    });
  });

  it('hides foreign sessions as not found', async () => {
    prisma.aiGuideSession.findFirst.mockResolvedValue(null);
    await expect(
      service.answer('user_1', { sessionId: 'other', answer: 'hi' }),
    ).rejects.toMatchObject({ code: 'AI_GUIDE_SESSION_NOT_FOUND' });
  });

  it('builds summary for an owned session', async () => {
    prisma.aiGuideSession.findFirst.mockResolvedValue({
      id: 'sess_1',
      userId: 'user_1',
      status: 'COMPLETED',
      expiresAt: new Date(Date.now() + 3600_000),
    });
    prisma.aiGuideMessage.findMany.mockResolvedValue([
      { role: 'USER', content: 'تأخر المستأجر عن الإيجار' },
    ]);

    const summary = await service.summary('user_1', 'sess_1');
    expect(summary.sessionId).toBe('sess_1');
    expect(summary.caseTypeValue).toMatch(/إيجار/);
    expect(summary).not.toHaveProperty('userId');
  });
});
