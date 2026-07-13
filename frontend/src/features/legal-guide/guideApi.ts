import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';

import type {
  GuideAnswerResponse,
  GuideStartResponse,
  GuideSummary,
} from './guide.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

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
      label: ar.guide.summary.docs.lease,
      done: true,
    },
    {
      id: 'doc-2',
      label: ar.guide.summary.docs.demand,
      done: false,
    },
    {
      id: 'doc-3',
      label: ar.guide.summary.docs.receipts,
      done: false,
    },
  ],
  stepsTitle: ar.guide.summary.stepsTitle,
  steps: [
    { number: 1, label: ar.guide.summary.steps.prepare },
    { number: 2, label: ar.guide.summary.steps.submit },
  ],
});

export const startGuideSession = async (
  initialMessage?: string,
): Promise<GuideStartResponse> => {
  if (!API_BASE_URL) {
    await wait(400);
    return {
      sessionId: `guide-${Date.now()}`,
      reply: initialMessage
        ? ar.guide.replies.afterUser
        : ar.guide.messages.welcome,
    };
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.guide.start}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initialMessage }),
  });

  if (!response.ok) {
    throw new Error('GUIDE_START_FAILED');
  }

  const json = (await response.json()) as { data: GuideStartResponse };
  return json.data;
};

export const sendGuideAnswer = async (
  sessionId: string,
  answer: string,
): Promise<GuideAnswerResponse> => {
  if (!API_BASE_URL) {
    await wait(900);
    return {
      sessionId,
      reply: ar.guide.replies.afterUser,
      stage: 'CHAT',
    };
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.guide.answer}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, answer }),
  });

  if (!response.ok) {
    throw new Error('GUIDE_ANSWER_FAILED');
  }

  const json = (await response.json()) as { data: GuideAnswerResponse };
  return json.data;
};

export const fetchGuideSummary = async (
  sessionId: string,
): Promise<GuideSummary> => {
  if (!API_BASE_URL) {
    await wait(300);
    return mockSummary(sessionId || 'demo');
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoints.guide.summary(sessionId)}`,
  );

  if (!response.ok) {
    throw new Error('GUIDE_SUMMARY_FAILED');
  }

  const json = (await response.json()) as { data: GuideSummary };
  return json.data;
};
