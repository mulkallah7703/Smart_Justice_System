export interface GuideSummaryDocDto {
  id: string;
  label: string;
  done: boolean;
}

export interface GuideSummaryStepDto {
  number: number;
  label: string;
}

/** Matches the existing frontend GuideSummary view contract. */
export interface GuideSummaryResponseDto {
  sessionId: string;
  resultTitle: string;
  resultBody: string;
  caseTypeLabel: string;
  caseTypeValue: string;
  authorityLabel: string;
  authorityValue: string;
  durationLabel: string;
  durationValue: string;
  durationDays: number;
  durationUnit: string;
  docsTitle: string;
  docs: GuideSummaryDocDto[];
  stepsTitle: string;
  steps: GuideSummaryStepDto[];
}
