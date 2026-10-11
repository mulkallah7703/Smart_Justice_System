import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiGuideSession, Prisma } from '@prisma/client';

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
  aiGuideSummaryNotReady,
} from './errors/guide.errors';
import {
  GUIDE_MAX_CLARIFICATIONS,
  parseGuideTurn,
  readStoredGuideTurn,
  renderGuideReply,
  type GuideTurn,
} from './guide-turn';
import {
  mapGuideAnswer,
  mapGuideSummary,
  mapGuideWelcome,
} from './mappers/guide.mapper';
import {
  GUIDE_TURN_RETRY_SUFFIX,
  GUIDE_WELCOME_REPLY_AR,
  LEGAL_GUIDE_SYSTEM_PROMPT,
  buildGuideTurnUserPrompt,
  type GuidePromptTurn,
} from './prompts/legal-guide.prompt';

/** Most recent turns sent verbatim; the original question and established facts are always sent. */
const GUIDE_CONTEXT_TURNS = 12;

interface StoredMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
  analysis: Prisma.JsonValue | null;
}

interface ConversationState {
  originalQuestion: string;
  turns: GuidePromptTurn[];
  omittedTurns: number;
  establishedFacts: string[];
  clarificationsSinceGuidance: number;
  previousQuestions: string[];
}

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
      return this.runTurn(session, [], initial);
    }

    await this.prisma.aiGuideMessage.create({
      data: {
        sessionId: session.id,
        role: 'ASSISTANT',
        content: GUIDE_WELCOME_REPLY_AR,
      },
    });

    return mapGuideWelcome(session.id, GUIDE_WELCOME_REPLY_AR);
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

    const history = await this.prisma.aiGuideMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true, analysis: true },
    });

    return this.runTurn(session, history, answer);
  }

  async summary(
    userId: string,
    sessionId: string,
  ): Promise<GuideSummaryResponseDto> {
    const session = await this.findOwnedSession(userId, sessionId);
    if (session.expiresAt.getTime() < Date.now()) {
      throw aiGuideSessionNotFound();
    }

    const latest = await this.prisma.aiGuideMessage.findMany({
      where: { sessionId: session.id, role: 'ASSISTANT' },
      orderBy: { createdAt: 'desc' },
      select: { analysis: true },
      take: 20,
    });
    const guidance = latest
      .map((m) => readStoredGuideTurn(m.analysis))
      .find((turn) => turn !== null && !turn.needsClarification);
    if (!guidance) {
      throw aiGuideSummaryNotReady();
    }

    return mapGuideSummary(session.id, guidance);
  }

  /**
   * One validated model turn. Messages are persisted only after the turn is valid, so a
   * failed request leaves no orphan user message and a retry does not duplicate it.
   */
  private async runTurn(
    session: AiGuideSession,
    history: readonly StoredMessage[],
    userMessage: string,
  ): Promise<GuideAnswerResponseDto> {
    const state = buildConversationState(history, userMessage);
    const mustAnswer =
      state.clarificationsSinceGuidance >= GUIDE_MAX_CLARIFICATIONS;

    let turn: GuideTurn;
    try {
      turn = await this.generateTurn(state, mustAnswer);
    } catch (error) {
      this.logger.warn(
        `Guide turn failed sessionId=${session.id} errorCode=${
          error instanceof AppError ? error.code : 'AI_GUIDE_FAILED'
        }`,
      );
      throw this.mapProviderError(error);
    }

    const clarificationCount =
      state.clarificationsSinceGuidance + (turn.needsClarification ? 1 : 0);
    const userAt = new Date();
    const assistantAt = new Date(userAt.getTime() + 1);

    await this.prisma.$transaction([
      this.prisma.aiGuideMessage.create({
        data: {
          sessionId: session.id,
          role: 'USER',
          content: userMessage,
          createdAt: userAt,
        },
      }),
      this.prisma.aiGuideMessage.create({
        data: {
          sessionId: session.id,
          role: 'ASSISTANT',
          content: renderGuideReply(turn),
          analysis: turn as unknown as Prisma.InputJsonValue,
          createdAt: assistantAt,
        },
      }),
      ...(!turn.needsClarification && session.status === 'ACTIVE'
        ? [
            this.prisma.aiGuideSession.update({
              where: { id: session.id },
              data: { status: 'COMPLETED' },
            }),
          ]
        : []),
    ]);

    this.logger.log(
      `Guide turn sessionId=${session.id} stage=${
        turn.needsClarification ? 'QUESTION' : 'ANSWER'
      } clarifications=${clarificationCount} domains=${turn.domains.join(',')}`,
    );

    return mapGuideAnswer(session.id, turn, clarificationCount);
  }

  /** One model call; a single constrained retry only when the output fails validation. */
  private async generateTurn(
    state: ConversationState,
    mustAnswer: boolean,
  ): Promise<GuideTurn> {
    const userPrompt = buildGuideTurnUserPrompt({
      originalQuestion: state.originalQuestion,
      turns: state.turns,
      omittedTurns: state.omittedTurns,
      establishedFacts: state.establishedFacts,
      clarificationsAsked: state.clarificationsSinceGuidance,
      maxClarifications: GUIDE_MAX_CLARIFICATIONS,
      mustAnswerNow: mustAnswer,
    });
    const parseContext = {
      mustAnswer,
      previousQuestions: state.previousQuestions,
    };

    const first = await this.llm.generateAnswer({
      systemPrompt: LEGAL_GUIDE_SYSTEM_PROMPT,
      userPrompt,
    });
    const parsed = parseGuideTurn(first.text, parseContext);
    if (parsed.ok) {
      return parsed.value;
    }
    this.logger.warn(`Guide turn rejected reason=${parsed.reason}; retrying once`);

    const second = await this.llm.generateAnswer({
      systemPrompt: LEGAL_GUIDE_SYSTEM_PROMPT,
      userPrompt: `${userPrompt}\n${GUIDE_TURN_RETRY_SUFFIX}`,
    });
    const retried = parseGuideTurn(second.text, parseContext);
    if (retried.ok) {
      return retried.value;
    }
    this.logger.warn(`Guide turn rejected after retry reason=${retried.reason}`);
    throw aiGuideFailed();
  }

  private mapProviderError(error: unknown): AppError {
    if (error instanceof AppError) {
      if (error.code === AI_PROVIDER_ERROR) {
        return aiGuideFailed();
      }
      if (error.code === 'AI_LLM_TIMEOUT') {
        return aiLlmTimeout();
      }
      return error;
    }
    return aiGuideFailed();
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
}

/**
 * Context for the next turn, built only from this session's messages: the original question,
 * the last GUIDE_CONTEXT_TURNS turns, the latest established facts, and the clarification
 * budget used since the last guidance.
 */
export const buildConversationState = (
  history: readonly StoredMessage[],
  userMessage: string,
): ConversationState => {
  const turns: GuidePromptTurn[] = [];
  let establishedFacts: string[] = [];
  let clarificationsSinceGuidance = 0;
  const previousQuestions: string[] = [];

  for (const message of history) {
    if (message.role === 'USER') {
      turns.push({ role: 'USER', content: message.content });
      continue;
    }
    const analysis = readStoredGuideTurn(message.analysis);
    if (!analysis) {
      // Welcome greeting — not part of the legal conversation.
      continue;
    }
    establishedFacts = analysis.knownFacts;
    if (analysis.needsClarification) {
      clarificationsSinceGuidance += 1;
      if (analysis.clarificationQuestion) {
        previousQuestions.push(analysis.clarificationQuestion);
      }
    } else {
      clarificationsSinceGuidance = 0;
    }
    turns.push({
      role: 'ASSISTANT',
      content: message.content,
      kind: analysis.needsClarification ? 'clarification' : 'guidance',
    });
  }
  turns.push({ role: 'USER', content: userMessage });

  const originalQuestion =
    turns.find((t) => t.role === 'USER')?.content ?? userMessage;
  const omittedTurns = Math.max(0, turns.length - GUIDE_CONTEXT_TURNS);

  return {
    originalQuestion,
    turns: turns.slice(omittedTurns),
    omittedTurns,
    establishedFacts,
    clarificationsSinceGuidance,
    previousQuestions,
  };
};
