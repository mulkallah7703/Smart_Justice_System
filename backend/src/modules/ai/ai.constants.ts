/**
 * Revision of the processing pipeline. Bumping it invalidates the derived
 * idempotency key, which is how a pipeline change is allowed to reprocess
 * documents that were already handled by an older revision.
 *
 * v2 — Phase D: DocumentPage persistence after extraction (trust-gated ingest).
 * Phase E adds DocumentChunk under the same pipeline version (additive).
 */
export const AI_PIPELINE_VERSION = 2;

export const AI_JOB_QUEUE = 'ai-jobs';

/**
 * The three stages the Advisor UI already renders. The worker reports
 * `stageIndex` against this list so progress means the same thing everywhere.
 */
export const AI_JOB_STAGES = ['EXTRACT', 'RETRIEVE', 'GENERATE'] as const;

export type AiJobStage = (typeof AI_JOB_STAGES)[number];

export const AI_JOB_STAGE_COUNT = AI_JOB_STAGES.length;

/**
 * Progress reported on entering each stage. Completion sets 100 separately, so
 * a job never shows 100 before its result is durable.
 */
export const AI_STAGE_PROGRESS: readonly number[] = [10, 40, 70];
