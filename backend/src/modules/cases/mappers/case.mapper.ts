import type { CaseStatus, CaseType, DeadlineType } from '@prisma/client';

import type {
  CaseDetailDto,
  CaseListItemDto,
  DeadlineSummaryDto,
  HearingDto,
  HearingSummaryDto,
} from '../dto/case-response.dto';

export interface CaseListRecord {
  id: string;
  caseNumber: string;
  type: CaseType;
  status: CaseStatus;
  authority: string | null;
  createdAt: Date;
  hearings: Array<{
    id: string;
    scheduledAt: Date;
    location: string | null;
  }>;
  deadlines: Array<{
    id: string;
    type: DeadlineType;
    dueAt: Date;
    label: string;
  }>;
}

export interface CaseDetailRecord {
  id: string;
  caseNumber: string;
  type: CaseType;
  status: CaseStatus;
  authority: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  hearings: Array<{
    id: string;
    scheduledAt: Date;
    location: string | null;
    notes: string | null;
  }>;
  deadlines: Array<{
    id: string;
    type: DeadlineType;
    dueAt: Date;
    label: string;
  }>;
}

const toIso = (value: Date): string => value.toISOString();

export const mapHearingSummary = (hearing: {
  id: string;
  scheduledAt: Date;
  location: string | null;
}): HearingSummaryDto => ({
  id: hearing.id,
  scheduledAt: toIso(hearing.scheduledAt),
  location: hearing.location,
});

export const mapHearing = (hearing: {
  id: string;
  scheduledAt: Date;
  location: string | null;
  notes: string | null;
}): HearingDto => ({
  ...mapHearingSummary(hearing),
  notes: hearing.notes,
});

export const mapDeadline = (deadline: {
  id: string;
  type: DeadlineType;
  dueAt: Date;
  label: string;
}): DeadlineSummaryDto => ({
  id: deadline.id,
  type: deadline.type,
  dueAt: toIso(deadline.dueAt),
  label: deadline.label,
});

export const mapCaseListItem = (record: CaseListRecord): CaseListItemDto => ({
  id: record.id,
  caseNumber: record.caseNumber,
  type: record.type,
  status: record.status,
  authority: record.authority,
  createdAt: toIso(record.createdAt),
  nextHearing: record.hearings[0] ? mapHearingSummary(record.hearings[0]) : null,
  nextDeadline: record.deadlines[0] ? mapDeadline(record.deadlines[0]) : null,
});

export const mapCaseDetail = (record: CaseDetailRecord): CaseDetailDto => ({
  id: record.id,
  caseNumber: record.caseNumber,
  type: record.type,
  status: record.status,
  authority: record.authority,
  notes: record.notes,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
  hearings: record.hearings.map(mapHearing),
  deadlines: record.deadlines.map(mapDeadline),
});
