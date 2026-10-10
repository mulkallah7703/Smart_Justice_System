import { ar } from '../../core/i18n/ar';
import { toArabicNumerals } from '../../shared/utils/arabicNumerals';
import { formatDateAr } from '../../shared/utils/dateFormatter';
import type { StatusBadgeVariant } from '../../shared/components/StatusBadge';

import type {
  BackendDocument,
  BackendDocumentStatus,
  DocumentKind,
  FrontendDocument,
} from './documents.types';

const STATUS_VARIANT: Record<BackendDocumentStatus, StatusBadgeVariant> = {
  UPLOADED: 'pending',
  READY: 'active',
  REJECTED: 'closed',
};

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;

export const mapDocumentStatus = (
  status: BackendDocumentStatus,
): { label: string; statusVariant: StatusBadgeVariant } => ({
  label: ar.documents.status[status],
  statusVariant: STATUS_VARIANT[status],
});

export const mapDocumentKind = (mimeType: string): DocumentKind => {
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  return 'doc';
};

export const formatFileSizeAr = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '';
  }
  if (bytes < KILOBYTE) {
    return `${toArabicNumerals(bytes)} بايت`;
  }
  if (bytes < MEGABYTE) {
    return `${toArabicNumerals((bytes / KILOBYTE).toFixed(1))} ك.ب`;
  }
  return `${toArabicNumerals((bytes / MEGABYTE).toFixed(1))} م.ب`;
};

export const mapBackendDocument = (
  record: BackendDocument,
): FrontendDocument => {
  const status = mapDocumentStatus(record.status);

  return {
    id: record.id,
    caseId: record.caseId,
    name: record.originalName,
    kind: mapDocumentKind(record.mimeType),
    sizeLabel: formatFileSizeAr(record.size),
    statusLabel: status.label,
    statusVariant: status.statusVariant,
    isAnalyzed: record.isAnalyzed,
    createdAtLabel: formatDateAr(record.createdAt),
  };
};
