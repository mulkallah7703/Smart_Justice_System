export type UploadStatus = 'uploading' | 'done' | 'error';

export type FileKind = 'pdf' | 'image' | 'doc';

export type AnalysisStepStatus = 'done' | 'active' | 'pending';

export type ReportJobStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export type FindingTone = 'success' | 'warning' | 'info';

export type StrengthLevel = 'strong' | 'medium' | 'weak';

export interface UploadedFileItem {
  id: string;
  name: string;
  sizeMB: number;
  progress: number;
  status: UploadStatus;
  kind: FileKind;
  documentId?: string;
}

export interface AnalyzeResponse {
  jobId: string;
}

export interface AnalysisStep {
  id: string;
  label: string;
  status: AnalysisStepStatus;
}

export interface AdvisorReportPoll {
  status: ReportJobStatus;
  progress: number;
  stageIndex: number;
}

export interface OpinionFinding {
  id: string;
  tone: FindingTone;
  title: string;
  subtitle: string;
  icon: string;
}

export interface InitialOpinionData {
  jobId: string;
  summaryTitle: string;
  summaryBody: string;
  strengthLabel: string;
  strengthValue: string;
  strengthScore: number;
  strengthLevel: StrengthLevel;
  findingsTitle: string;
  findings: OpinionFinding[];
  disclaimer: string;
  cta: string;
}

export interface AdvisoryReportSection {
  id: string;
  title: string;
  body: string;
}

export interface AdvisoryReportData {
  jobId: string;
  brandTitle: string;
  brandSubtitle: string;
  reference: string;
  dateHijri: string;
  watermark: string;
  sections: AdvisoryReportSection[];
  disclaimer: string;
}
