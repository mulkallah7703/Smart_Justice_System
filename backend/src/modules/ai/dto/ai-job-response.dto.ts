import type { AiJobStatus, AiJobType } from '@prisma/client';

/** Returned by POST /ai/advisor/analyze. Only the handle the client needs. */
export interface AnalyzeAcceptedDto {
  jobId: string;
}

/**
 * Returned by GET /ai/advisor/jobs/:jobId.
 *
 * Deliberately omits `userId`, `idempotencyKey`, `attempts`, `maxAttempts`,
 * storage keys, and the queue job id. `errorCode` is a stable domain code, so
 * no provider message or stack trace can travel through it.
 */
export interface AiJobStatusDto {
  jobId: string;
  type: AiJobType;
  status: AiJobStatus;
  progress: number;
  stageIndex: number;
  errorCode: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  /** Present only once the job is DONE. */
  result: unknown;
}
