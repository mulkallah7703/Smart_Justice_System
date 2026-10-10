import { DocumentStatus } from '@prisma/client';

import type { DocumentResponseDto } from '../types/documents.types';

export interface DocumentRecord {
  id: string;
  caseId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  isAnalyzed: boolean;
  createdAt: Date;
}

export const mapDocument = (record: DocumentRecord): DocumentResponseDto => ({
  id: record.id,
  caseId: record.caseId,
  originalName: record.originalName,
  mimeType: record.mimeType,
  size: record.sizeBytes,
  status: record.status,
  isAnalyzed: record.isAnalyzed,
  createdAt: record.createdAt.toISOString(),
});
