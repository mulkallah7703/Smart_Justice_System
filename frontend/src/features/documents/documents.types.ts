import type { StatusBadgeVariant } from '../../shared/components/StatusBadge';

export type BackendDocumentStatus = 'UPLOADED' | 'READY' | 'REJECTED';

export interface BackendDocument {
  id: string;
  caseId: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  status: BackendDocumentStatus;
  isAnalyzed: boolean;
  createdAt: string;
}

export type BackendDocumentList = BackendDocument[];

export type DocumentKind = 'pdf' | 'image' | 'doc';

export interface FrontendDocument {
  id: string;
  caseId: string | null;
  name: string;
  kind: DocumentKind;
  sizeLabel: string;
  statusLabel: string;
  statusVariant: StatusBadgeVariant;
  isAnalyzed: boolean;
  createdAtLabel: string;
}

export interface DocumentUploadInput {
  file: File;
  caseId: string;
}

export interface DocumentDownload {
  blob: Blob;
  fileName: string;
}
