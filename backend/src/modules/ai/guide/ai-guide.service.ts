import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiGuideSession } from '@prisma/client';

import type { AppConfig } from '../../../config/env.validation';
import { AppError } from '../../../shared/exceptions/app-error';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  ANSWER_LLM_PROVIDER,
  type LlmProvider,
} from '../providers/llm-provider.interface';
import { aiLlmTimeout, AI_PROVIDER_ERROR } from '../ai.errors';

import type { AnswerGuideDto } from './dto/answer-guide.dto';
import type {
  GuideAnswerResponseDto,
  GuideStartResponseDto,
} from './dto/guide-response.dto';
import type { GuideSummaryResponseDto } from './dto/guide-summary-response.dto';
import type { StartGuideDto } from './dto/start-guide.dto';
import {
  aiGuideFailed,
  aiGuideInvalidMessage,
  aiGuideMessageLimit,
  aiGuideSessionExpired,
  aiGuideSessionNotFound,
} from './errors/guide.errors';
import {
  buildDeterministicGuideReply,
  buildGuideSummary,
} from './guide-dialogue';
import { resolveGuideStage, type GuideStage } from './guide-stage';
import { mapGuideAnswer, mapGuideStart } from './mappers/guide.mapper';
import { LEGAL_GUIDE_SYSTEM_PROMPT } from './prompts/legal-guide.prompt';

@Injectable()
export class AiGuideService {
  private readonly logger = new Logger(AiGuideService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(ANSWER_LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async start(
    userId: string,
    body: StartGuideDto,
  ): Promise<GuideStartResponseDto> {
    const ai = this.configService.get('ai', { infer: true });
    const expiresAt = new Date(
      Date.now() + ai.guideSessionTtlHours * 60 * 60 * 1000,
    );

    const initial = body.initialMessage?.trim();
    if (body.initialMessage !== undefined && !initial) {
      throw aiGuideInvalidMessage();
    }

    const session = await this.prisma.aiGuideSession.create({
      data: {
        userId,
        status: 'ACTIVE',
        expiresAt,
      },
    });

    this.logger.log(
      `Guide session started sessionId=${session.id} userId=${userId}`,
    );

    if (initial) {
      await this.prisma.aiGuideMessage.create({
        data: {
          sessionId: session.id,
          role: 'USER',
          content: initial,
        },
      });

      const stage = resolveGuideStage(1);
      const reply = await this.composeReply({
        stage,
        isWelcome: false,
        history: [{ role: 'USER', content: initial }],
      });

      await this.prisma.aiGuideMessage.create({
        data: {
          sessionId: session.id,
          role: 'ASSISTANT',
          content: reply,
        },
      });

      return mapGuideStart(session.id, reply);
    }

    const reply = await this.composeReply({
      stage: 'CHAT',
      isWelcome: true,
      history: [],
    });

    await this.prisma.aiGuideMessage.create({
      data: {
        sessionId: session.id,
        role: 'ASSISTANT',
        content: reply,
      },
    });

    return mapGuideStart(session.id, reply);
  }

  async answer(
    userId: string,
    body: AnswerGuideDto,
  ): Promise<GuideAnswerResponseDto> {
    const answer = body.answer.trim();
    if (!answer) {
      throw aiGuideInvalidMessage();
    }

    const session = await this.findOwnedSession(userId, body.sessionId);
    this.assertSessionUsable(session);

    const ai = this.configService.get('ai', { infer: true });
    const existingCount = await this.prisma.aiGuideMessage.count({
      where: { sessionId: session.id },
    });
    if (existingCount + 2 > ai.guideMaxMessages) {
      throw aiGuideMessageLimit();
    }

    await this.prisma.aiGuideMessage.create({
      data: {
        sessionId: session.id,
        role: 'USER',
        content: answer,
      },
    });

    const messages = await this.prisma.aiGuideMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    const userCount = messages.filter((m) => m.role === 'USER').length;
    const stage = resolveGuideStage(userCount);

    let reply: string;
    try {
      reply = await this.composeReply({
        stage,
        isWelcome: false,
        history: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
    } catch (error) {
      this.logger.warn(
        `Guide reply failed sessionId=${session.id} errorCode=${
          error instanceof AppError ? error.code : 'AI_GUIDE_FAILED'
        }`,
      );
      throw error instanceof AppError ? error : aiGuideFailed();
    }

    await this.prisma.aiGuideMessage.create({
      data: {
        sessionId: session.id,
        role: 'ASSISTANT',
        content: reply,
      },
    });

    if (stage === 'SUMMARY' && session.status === 'ACTIVE') {
      await this.prisma.aiGuideSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED' },
      });
    }

    this.logger.log(
      `Guide answer sessionId=${session.id} stage=${stage} userId=${userId}`,
    );

    return mapGuideAnswer(session.id, reply, stage);
  }

  async summary(
    userId: string,
    sessionId: string,
  ): Promise<GuideSummaryResponseDto> {
    const session = await this.findOwnedSession(userId, sessionId);
    if (session.expiresAt.getTime() < Date.now()) {
      throw aiGuideSessionNotFound();
    }

    const messages = await this.prisma.aiGuideMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    return buildGuideSummary(
      session.id,
      messages.map((m) => ({ role: m.role, content: m.content })),
    );
  }

  private async findOwnedSession(
    userId: string,
    sessionId: string,
  ): Promise<AiGuideSession> {
    const session = await this.prisma.aiGuideSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw aiGuideSessionNotFound();
    }
    return session;
  }

  private assertSessionUsable(session: AiGuideSession): void {
    if (session.expiresAt.getTime() < Date.now()) {
      throw aiGuideSessionExpired();
    }
    if (session.status === 'EXPIRED') {
      throw aiGuideSessionExpired();
    }
  }

  private async composeReply(input: {
    stage: GuideStage;
    isWelcome: boolean;
    history: Array<{ role: 'USER' | 'ASSISTANT'; content: string }>;
  }): Promise<string> {
    const { llmMode } = this.configService.get('ai', { infer: true });

    if (llmMode === 'mock') {
      return buildDeterministicGuideReply(input.stage, input.isWelcome);
    }

    const untrustedContext = input.history.map(
      (m) => `${m.role}: ${m.content}`,
    );
    if (input.isWelcome && untrustedContext.length === 0) {
      untrustedContext.push('SYSTEM_EVENT: session_start_welcome');
    }

    try {
      const completion = await this.llm.complete({
        instruction: LEGAL_GUIDE_SYSTEM_PROMPT,
        untrustedContext,
      });
      const text = completion.text?.trim();
      if (!text) {
        throw aiGuideFailed();
      }
      return text.slice(0, 4000);
    } catch (error) {
      if (error instanceof AppError) {
        if (error.code === AI_PROVIDER_ERROR) {
          throw aiGuideFailed();
        }
        if (error.code === 'AI_LLM_TIMEOUT') {
          throw aiLlmTimeout();
        }
        throw error;
      }
      throw aiGuideFailed();
    }
  }
}
