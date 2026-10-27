/** Analysis-job polling. Delay backs off; the wall-clock budget is about ten minutes. */
export const ADVISOR_POLL_INTERVAL_MS = 2_000;
export const ADVISOR_POLL_MAX_INTERVAL_MS = 10_000;
export const ADVISOR_POLL_BUDGET_MS = 10 * 60 * 1000;
/** Kept so older call sites still compile. The live poll uses the time budget. */
export const ADVISOR_MAX_POLL_ATTEMPTS = 90;

export const advisorPollDelayMs = (attempt: number): number => {
  const growth = ADVISOR_POLL_INTERVAL_MS * 1.35 ** Math.max(0, attempt - 1);
  return Math.min(ADVISOR_POLL_MAX_INTERVAL_MS, Math.round(growth));
};

export type PollTerminalStatus = 'DONE' | 'FAILED' | 'TIMEOUT' | 'ERROR';

export interface PollDecision {
  continue: boolean;
  terminal?: PollTerminalStatus;
}

export const decideAdvisorPoll = (input: {
  status: string;
  attempt: number;
  maxAttempts?: number;
  elapsedMs?: number;
  budgetMs?: number;
}): PollDecision => {
  if (input.status === 'DONE') {
    return { continue: false, terminal: 'DONE' };
  }
  if (input.status === 'FAILED') {
    return { continue: false, terminal: 'FAILED' };
  }
  const budget =
    input.budgetMs ??
    (input.maxAttempts ?? ADVISOR_MAX_POLL_ATTEMPTS) * ADVISOR_POLL_INTERVAL_MS;
  const elapsed = input.elapsedMs ?? input.attempt * ADVISOR_POLL_INTERVAL_MS;
  if (elapsed >= budget) {
    return { continue: false, terminal: 'TIMEOUT' };
  }
  return { continue: true };
};

/** Clamp backend stageIndex into the three UI stage slots. */
export const clampAdvisorStageIndex = (
  stageIndex: number,
  stageCount: number,
): number => {
  if (!Number.isFinite(stageIndex) || stageCount <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(Math.floor(stageIndex), stageCount - 1));
};
