/** Bounded analysis-job polling — no infinite loops. */
export const ADVISOR_POLL_INTERVAL_MS = 2_000;
export const ADVISOR_MAX_POLL_ATTEMPTS = 90;

export type PollTerminalStatus = 'DONE' | 'FAILED' | 'TIMEOUT' | 'ERROR';

export interface PollDecision {
  continue: boolean;
  terminal?: PollTerminalStatus;
}

export const decideAdvisorPoll = (input: {
  status: string;
  attempt: number;
  maxAttempts: number;
}): PollDecision => {
  if (input.status === 'DONE') {
    return { continue: false, terminal: 'DONE' };
  }
  if (input.status === 'FAILED') {
    return { continue: false, terminal: 'FAILED' };
  }
  if (input.attempt >= input.maxAttempts) {
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
