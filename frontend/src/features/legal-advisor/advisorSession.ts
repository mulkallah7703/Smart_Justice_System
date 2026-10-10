import type { AdvisorAnswerView } from './advisor.types';

const storageKey = (jobId: string): string => `advisor:answer:${jobId}`;

/** Persist the last answer for the report screen (no legal text in URLs). */
export const saveAdvisorAnswer = (
  jobId: string,
  answer: AdvisorAnswerView,
): void => {
  try {
    sessionStorage.setItem(storageKey(jobId), JSON.stringify(answer));
  } catch {
    /* storage may be unavailable */
  }
};

export const loadAdvisorAnswer = (
  jobId: string,
): AdvisorAnswerView | null => {
  try {
    const raw = sessionStorage.getItem(storageKey(jobId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AdvisorAnswerView;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.answer !== 'string' ||
      typeof parsed.insufficientEvidence !== 'boolean' ||
      !Array.isArray(parsed.claims)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};
