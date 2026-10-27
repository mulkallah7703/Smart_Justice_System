import type { AdvisorAnswerView } from './advisor.types';

const storageKey = (jobId: string): string => `advisor:answer:${jobId}`;
const scopeKey = (jobId: string): string => `advisor:scope:${jobId}`;

export interface AdvisorScope {
  documentIds: string[];
  caseId?: string;
}

/** Remembers which documents this analysis job may answer from. */
export const saveAdvisorScope = (jobId: string, scope: AdvisorScope): void => {
  try {
    sessionStorage.setItem(scopeKey(jobId), JSON.stringify(scope));
  } catch {
    /* storage may be unavailable */
  }
};

export const loadAdvisorScope = (jobId: string): AdvisorScope | null => {
  try {
    const raw = sessionStorage.getItem(scopeKey(jobId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AdvisorScope;
    if (!parsed || !Array.isArray(parsed.documentIds)) {
      return null;
    }
    return {
      documentIds: parsed.documentIds.filter((id) => typeof id === 'string'),
      caseId: typeof parsed.caseId === 'string' ? parsed.caseId : undefined,
    };
  } catch {
    return null;
  }
};

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
