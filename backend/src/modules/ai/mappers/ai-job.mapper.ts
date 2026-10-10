import type { AiJobRecord } from '../ai-job.types';
import type { AiJobStatusDto } from '../dto/ai-job-response.dto';

export const mapAiJobStatus = (record: AiJobRecord): AiJobStatusDto => ({
  jobId: record.id,
  type: record.type,
  status: record.status,
  progress: record.progress,
  stageIndex: record.stageIndex,
  errorCode: record.errorCode,
  createdAt: record.createdAt.toISOString(),
  startedAt: record.startedAt ? record.startedAt.toISOString() : null,
  completedAt: record.completedAt ? record.completedAt.toISOString() : null,
  // Withheld until the job succeeds, so a partially written result is never read.
  result: record.status === 'DONE' ? (record.resultJson ?? null) : null,
});
