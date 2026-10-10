import { ar } from '../../core/i18n/ar';
import { toArabicNumerals } from '../../shared/utils/arabicNumerals';
import { formatDateAr, formatDateTimeAr } from '../../shared/utils/dateFormatter';
import type { StatusBadgeVariant } from '../../shared/components/StatusBadge';
import type { HomeCase } from '../home/home.types';

import type {
  BackendCase,
  BackendCaseDetail,
  BackendCaseStatus,
  BackendCaseType,
  BackendDeadline,
  BackendHearing,
  BackendHearingSummary,
  FrontendCase,
  FrontendCaseDetail,
  FrontendDeadline,
  FrontendHearing,
} from './cases.types';
import type { CaseAccent, LegalCaseFooter } from './legalFile.types';

const STATUS_VARIANT: Record<BackendCaseStatus, StatusBadgeVariant> = {
  PENDING: 'pending',
  ACTIVE: 'active',
  CLOSED: 'closed',
  APPEALING: 'appeal',
};

const STATUS_ACCENT: Record<BackendCaseStatus, CaseAccent> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  CLOSED: 'success',
  APPEALING: 'warning',
};

export const mapCaseStatus = (
  status: BackendCaseStatus,
): { label: string; statusVariant: StatusBadgeVariant } => ({
  label: ar.legalFile.caseStatus[status],
  statusVariant: STATUS_VARIANT[status],
});

export const mapCaseType = (type: BackendCaseType): string =>
  ar.legalFile.caseTypes[type];

export const formatCaseNumberLabel = (caseNumber: string): string =>
  `رقم ${toArabicNumerals(caseNumber)}`;

export const formatCaseSubtitle = (
  caseNumber: string,
  authority: string | null,
): string => {
  const number = `رقم القضية ${toArabicNumerals(caseNumber)}`;
  return authority ? `${number} • ${authority}` : number;
};

const mapHearingSummaryFooter = (
  hearing: BackendHearingSummary,
): LegalCaseFooter => ({
  tone: 'danger',
  icon: 'event',
  text: hearing.location
    ? `${formatDateTimeAr(hearing.scheduledAt)} • ${hearing.location}`
    : formatDateTimeAr(hearing.scheduledAt),
});

const mapDeadlineFooter = (deadline: BackendDeadline): LegalCaseFooter => ({
  tone: 'danger',
  icon: 'schedule',
  text: `${deadline.label} • ${formatDateAr(deadline.dueAt)}`,
});

export const mapCaseFooter = (
  nextHearing: BackendHearingSummary | null,
  nextDeadline: BackendDeadline | null,
): LegalCaseFooter | null => {
  if (nextDeadline) {
    return mapDeadlineFooter(nextDeadline);
  }
  if (nextHearing) {
    return mapHearingSummaryFooter(nextHearing);
  }
  return null;
};

export const mapHearing = (hearing: BackendHearing): FrontendHearing => ({
  id: hearing.id,
  scheduledAtLabel: formatDateTimeAr(hearing.scheduledAt),
  location: hearing.location,
});

export const mapDeadline = (deadline: BackendDeadline): FrontendDeadline => ({
  id: deadline.id,
  type: deadline.type,
  dueAtLabel: formatDateAr(deadline.dueAt),
  label: deadline.label,
});

export const mapBackendCase = (record: BackendCase): FrontendCase => {
  const mappedStatus = mapCaseStatus(record.status);

  return {
    id: record.id,
    title: mapCaseType(record.type),
    subtitle: formatCaseSubtitle(record.caseNumber, record.authority),
    caseNumber: formatCaseNumberLabel(record.caseNumber),
    status: mappedStatus.label,
    statusVariant: mappedStatus.statusVariant,
    accent: STATUS_ACCENT[record.status],
    footer: mapCaseFooter(record.nextHearing, record.nextDeadline),
  };
};

export const mapBackendCaseDetail = (
  record: BackendCaseDetail,
): FrontendCaseDetail => {
  const list = mapBackendCase({
    id: record.id,
    caseNumber: record.caseNumber,
    type: record.type,
    status: record.status,
    authority: record.authority,
    createdAt: record.createdAt,
    nextHearing: record.hearings[0]
      ? {
          id: record.hearings[0].id,
          scheduledAt: record.hearings[0].scheduledAt,
          location: record.hearings[0].location,
        }
      : null,
    nextDeadline: record.deadlines[0] ?? null,
  });

  return {
    ...list,
    notes: record.notes,
    hearings: record.hearings.map(mapHearing),
    deadlines: record.deadlines.map(mapDeadline),
  };
};

export const mapFrontendCaseToHome = (item: FrontendCase): HomeCase => ({
  id: item.id,
  title: item.title,
  caseNumber: item.caseNumber,
  status: item.status,
  statusVariant: item.statusVariant,
  icon: 'domain',
});
