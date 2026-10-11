import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';
import { apiRequest } from '../../shared/api/httpClient';
import { isMockApiMode } from '../../shared/api/mode';

import {
  mapGuideAnswer,
  mapGuideStart,
  mapGuideSummary,
  type BackendGuideAnswer,
  type BackendGuideStart,
  type BackendGuideSummary,
} from './mapGuide';
import { saveGuideSessionId } from './guideSession';

import type {
  GuideAnswerResponse,
  GuideStartResponse,
  GuideSummary,
} from './guide.types';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/** Mock answer count per session: the first answer gets one neutral question, later ones guidance. */
const mockAnswerCount = new Map<string, number>();

export const resetGuideMock = (sessionId?: string): void => {
  if (sessionId) {
    mockAnswerCount.delete(sessionId);
    return;
  }
  mockAnswerCount.clear();
};

const mockSummary = (sessionId: string): GuideSummary => ({
  sessionId,
  resultTitle: ar.guide.summary.resultTitle,
  resultBody: ar.guide.summary.resultBody,
  caseTypeLabel: ar.guide.summary.caseTypeLabel,
  caseTypeValue: ar.guide.summary.caseTypeValue,
  authorityLabel: ar.guide.summary.authorityLabel,
  authorityValue: ar.guide.summary.authorityValue,
  durationLabel: ar.guide.summary.durationLabel,
  durationValue: ar.guide.summary.durationValue,
  durationDays: ar.guide.summary.durationDays,
  durationUnit: ar.guide.summary.durationUnit,
  docsTitle: ar.guide.summary.docsTitle,
  docs: [
    {
      id: 'doc-1',
      label: ar.guide.summary.docs.identity,
      done: false,
    },
    {
      id: 'doc-2',
      label: ar.guide.summary.docs.correspondence,
      done: false,
    },
  ],
  stepsTitle: ar.guide.summary.stepsTitle,
  steps: [
    { number: 1, label: ar.guide.summary.steps.prepare },
    { number: 2, label: ar.guide.summary.steps.consult },
  ],
});

export const startGuideSession = async (): Promise<GuideStartResponse> => {
  if (isMockApiMode()) {
    await wait(400);
    const sessionId = `guide-${Date.now()}`;
    resetGuideMock(sessionId);
    const result = {
      sessionId,
      reply: ar.guide.messages.welcome,
    };
    saveGuideSessionId(result.sessionId);
    return result;
  }

  const record = await apiRequest<BackendGuideStart>(endpoints.guide.start, {
    method: 'POST',
    body: {},
  });
  const mapped = mapGuideStart(record);
  saveGuideSessionId(mapped.sessionId);
  return mapped;
};

export const sendGuideAnswer = async (
  sessionId: string,
  answer: string,
): Promise<GuideAnswerResponse> => {
  if (isMockApiMode()) {
    await wait(900);
    const next = (mockAnswerCount.get(sessionId) ?? 0) + 1;
    mockAnswerCount.set(sessionId, next);
    const isQuestion = next === 1;
    return {
      sessionId,
      reply: isQuestion ? ar.guide.mock.question : ar.guide.mock.answer,
      stage: isQuestion ? 'QUESTION' : 'ANSWER',
      suggestedReplies: [],
      urgent: false,
    };
  }

  const record = await apiRequest<BackendGuideAnswer>(endpoints.guide.answer, {
    method: 'POST',
    body: { sessionId, answer },
  });
  return mapGuideAnswer(record);
};

export const fetchGuideSummary = async (
  sessionId: string,
): Promise<GuideSummary> => {
  if (isMockApiMode()) {
    await wait(300);
    return mockSummary(sessionId || 'demo');
  }

  const record = await apiRequest<BackendGuideSummary>(
    endpoints.guide.summary(sessionId),
  );
  return mapGuideSummary(record);
};
