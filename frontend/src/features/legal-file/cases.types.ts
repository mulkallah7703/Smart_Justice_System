import type { LegalCase } from './legalFile.types';

export type BackendCaseStatus = 'PENDING' | 'ACTIVE' | 'CLOSED' | 'APPEALING';
export type BackendCaseType =
  | 'RENTAL'
  | 'COMMERCIAL'
  | 'PERSONAL'
  | 'LABOR'
  | 'CRIMINAL';
export type BackendDeadlineType =
  | 'APPEAL'
  | 'DOCUMENT_SUBMIT'
  | 'HEARING'
  | 'PAYMENT';

export interface BackendHearingSummary {
  id: string;
  scheduledAt: string;
  location: string | null;
}

export interface BackendHearing extends BackendHearingSummary {
  notes: string | null;
}

export interface BackendDeadline {
  id: string;
  type: BackendDeadlineType;
  dueAt: string;
  label: string;
}

export interface BackendCase {
  id: string;
  caseNumber: string;
  type: BackendCaseType;
  status: BackendCaseStatus;
  authority: string | null;
  createdAt: string;
  nextHearing: BackendHearingSummary | null;
  nextDeadline: BackendDeadline | null;
}

export interface BackendCaseDetail {
  id: string;
  caseNumber: string;
  type: BackendCaseType;
  status: BackendCaseStatus;
  authority: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  hearings: BackendHearing[];
  deadlines: BackendDeadline[];
}

export interface CasesPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FrontendHearing {
  id: string;
  scheduledAtLabel: string;
  location: string | null;
}

export interface FrontendDeadline {
  id: string;
  type: BackendDeadlineType;
  dueAtLabel: string;
  label: string;
}

export type FrontendCase = LegalCase;

export interface FrontendCaseDetail extends FrontendCase {
  notes: string | null;
  hearings: FrontendHearing[];
  deadlines: FrontendDeadline[];
}
