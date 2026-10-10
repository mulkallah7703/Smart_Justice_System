import type { AiJobStatus, AiJobType } from '@prisma/client';

/**
 * Everything the worker receives through Redis.
 *
 * Deliberately nothing but an identifier: the worker re-reads the job and its
 * documents from PostgreSQL, so no token, header, national id, or provider
 * credential can ever be persisted in a queue payload.
 */
export interface AiJobPayload {
  aiJobId: string;
}

export interface CreateAiJobInput {
  userId: string;
  type: AiJobType;
  /** Verified as owned by `userId` before this is called. */
  documentIds: readonly string[];
}

/** Document metadata the worker may use. Never includes bytes. */
export interface AiJobDocumentRef {
  id: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}

export interface AiJobProcessingContext {
  userId: string;
  documents: AiJobDocumentRef[];
}

export interface AiJobRecord {
  id: string;
  type: AiJobType;
  status: AiJobStatus;
  progress: number;
  stageIndex: number;
  attempts: number;
  maxAttempts: number;
  pipelineVersion: number;
  errorCode: string | null;
  resultJson: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}
