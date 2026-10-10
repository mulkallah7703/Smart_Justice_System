import type { StatusBadgeVariant } from '../../shared/components/StatusBadge';

export type LegalFileTabId =
  | 'cases'
  | 'appointments'
  | 'documents'
  | 'notifications';

export type CaseAccent = 'warning' | 'success';

export type CaseFooterTone = 'danger' | 'success';

export interface LegalCaseFooter {
  tone: CaseFooterTone;
  icon: string;
  text: string;
}

export interface LegalCase {
  id: string;
  title: string;
  subtitle: string;
  caseNumber: string;
  status: string;
  statusVariant: StatusBadgeVariant;
  accent: CaseAccent;
  footer: LegalCaseFooter | null;
}
