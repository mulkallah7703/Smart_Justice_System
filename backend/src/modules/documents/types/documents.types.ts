import { DocumentStatus } from '@prisma/client';

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_LIST_MAX = 50;
export const DOCUMENT_NAME_MAX_LENGTH = 255;

export const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_DOCUMENT_TYPES;

export interface DocumentResponseDto {
  id: string;
  caseId: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  isAnalyzed: boolean;
  createdAt: string;
}
