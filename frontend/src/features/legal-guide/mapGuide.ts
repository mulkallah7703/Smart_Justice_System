import { ApiError } from '../../shared/api/errors';

import type {
  GuideAnswerResponse,
  GuideStage,
  GuideStartResponse,
  GuideSummary,
  GuideSummaryDoc,
  GuideSummaryStep,
} from './guide.types';

/** Backend start/answer envelope payloads. */
export interface BackendGuideStart {
  sessionId: string;
  reply: string;
}

export interface BackendGuideTurn {
  needsClarification: boolean;
  clarificationQuestion: string | null;
  suggestedReplies: string[];
  urgent: boolean;
}

export interface BackendGuideAnswer {
  sessionId: string;
  reply: string;
  stage: GuideStage;
  turn: BackendGuideTurn;
}

export interface BackendGuideSummary {
  sessionId: string;
  resultTitle: string;
  resultBody: string;
  caseTypeLabel: string;
  caseTypeValue: string;
  authorityLabel: string;
  authorityValue: string;
  durationLabel: string;
  durationValue: string;
  durationDays: number;
  durationUnit: string;
  docsTitle: string;
  docs: GuideSummaryDoc[];
  stepsTitle: string;
  steps: GuideSummaryStep[];
}

const ANSWER_STAGES: readonly GuideStage[] = ['QUESTION', 'ANSWER'];
const MAX_SUGGESTED_REPLIES = 4;

const invalidResponse = (): ApiError =>
  new ApiError('AI_GUIDE_INVALID_RESPONSE', 'Invalid guide response', 502);

const nonEmptyText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const mapGuideStart = (
  record: BackendGuideStart,
): GuideStartResponse => {
  if (!nonEmptyText(record?.sessionId) || !nonEmptyText(record.reply)) {
    throw invalidResponse();
  }
  return {
    sessionId: record.sessionId,
    reply: record.reply,
  };
};

/** Rendered text must come from a well-formed turn; anything else is an error, never a fallback. */
export const mapGuideAnswer = (
  record: BackendGuideAnswer,
): GuideAnswerResponse => {
  if (
    !nonEmptyText(record?.sessionId) ||
    !nonEmptyText(record.reply) ||
    !ANSWER_STAGES.includes(record.stage)
  ) {
    throw invalidResponse();
  }
  const turn = record.turn;
  if (
    typeof turn !== 'object' ||
    turn === null ||
    turn.needsClarification !== (record.stage === 'QUESTION')
  ) {
    throw invalidResponse();
  }
  const suggestedReplies =
    record.stage === 'QUESTION' && Array.isArray(turn.suggestedReplies)
      ? turn.suggestedReplies
          .filter(nonEmptyText)
          .map((reply) => reply.trim())
          .slice(0, MAX_SUGGESTED_REPLIES)
      : [];

  return {
    sessionId: record.sessionId,
    reply: record.reply,
    stage: record.stage,
    suggestedReplies,
    urgent: turn.urgent === true,
  };
};

export const mapGuideSummary = (
  record: BackendGuideSummary,
): GuideSummary => ({
  sessionId: record.sessionId,
  resultTitle: record.resultTitle,
  resultBody: record.resultBody,
  caseTypeLabel: record.caseTypeLabel,
  caseTypeValue: record.caseTypeValue,
  authorityLabel: record.authorityLabel,
  authorityValue: record.authorityValue,
  durationLabel: record.durationLabel,
  durationValue: record.durationValue,
  durationDays: record.durationDays,
  durationUnit: record.durationUnit,
  docsTitle: record.docsTitle,
  docs: (record.docs ?? []).map((doc) => ({
    id: doc.id,
    label: doc.label,
    done: Boolean(doc.done),
  })),
  stepsTitle: record.stepsTitle,
  steps: (record.steps ?? []).map((step) => ({
    number: step.number,
    label: step.label,
  })),
});
