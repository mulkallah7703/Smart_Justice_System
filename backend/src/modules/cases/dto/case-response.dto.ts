import { CaseStatus, CaseType, DeadlineType } from '@prisma/client';

export interface HearingSummaryDto {
  id: string;
  scheduledAt: string;
  location: string | null;
}

export interface HearingDto extends HearingSummaryDto {
  notes: string | null;
}

export interface DeadlineSummaryDto {
  id: string;
  type: DeadlineType;
  dueAt: string;
  label: string;
}

export interface CaseListItemDto {
  id: string;
  caseNumber: string;
  type: CaseType;
  status: CaseStatus;
  authority: string | null;
  createdAt: string;
  nextHearing: HearingSummaryDto | null;
  nextDeadline: DeadlineSummaryDto | null;
}

export interface CaseDetailDto {
  id: string;
  caseNumber: string;
  type: CaseType;
  status: CaseStatus;
  authority: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  hearings: HearingDto[];
  deadlines: DeadlineSummaryDto[];
}

export interface CaseListResult {
  items: CaseListItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
