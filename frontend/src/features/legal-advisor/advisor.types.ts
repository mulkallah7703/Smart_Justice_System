export type UploadStatus = 'uploading' | 'done' | 'error';

export type FileKind = 'pdf' | 'image' | 'doc';

export type AnalysisStepStatus = 'done' | 'active' | 'pending';

export type ReportJobStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export type FindingTone = 'success' | 'warning' | 'info';

export type StrengthLevel = 'strong' | 'medium' | 'weak';

export type AdvisorQuestionPhase =
  | 'ready'
  | 'retrieving'
  | 'answering'
  | 'done'
  | 'error';

export interface UploadedFileItem {
  id: string;
  name: string;
  sizeMB: number;
  progress: number;
  status: UploadStatus;
  kind: FileKind;
  documentId?: string;
  caseId?: string | null;
  /** library rows are not sent to analyze unless nothing new was uploaded. */
  origin?: 'library' | 'session';
}

export interface AnalyzeResponse {
  jobId: string;
}

export interface AnalysisStep {
  id: string;
  label: string;
  status: AnalysisStepStatus;
}

/** Mapped job poll values for the analyzing screen (backend-authored). */
export interface AdvisorJobPoll {
  jobId: string;
  status: ReportJobStatus;
  progress: number;
  stageIndex: number;
  errorCode: string | null;
}

export interface BackendAiJobStatus {
  jobId: string;
  type: string;
  status: ReportJobStatus;
  progress: number;
  stageIndex: number;
  errorCode: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  result: unknown;
}

export interface BackendRetrieveProvenance {
  documentId: string;
  documentName: string;
  documentPageId: string;
  documentChunkId: string;
  pageNumber: number;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  pipelineVersion: number;
  embeddingModel: string;
  extractionMethod: 'TEXT_LAYER' | 'OCR';
  trust: 'TRUSTED';
}

export interface BackendRetrieveResultItem {
  score: number;
  text: string;
  provenance: BackendRetrieveProvenance;
}

export interface BackendRetrieveMeta {
  collection: string;
  embeddingModel: string;
  embeddingDimensions: number;
  limit: number;
  returned: number;
  droppedCount: number;
}

export interface BackendRetrieveResponse {
  query: string;
  results: BackendRetrieveResultItem[];
  retrieval: BackendRetrieveMeta;
}

export interface BackendAnswerCitation {
  evidenceId: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkId: string;
  startOffset: number;
  endOffset: number;
}

export interface BackendAnswerClaim {
  text: string;
  citations: BackendAnswerCitation[];
}

export interface BackendAnswerResponse {
  answer: string;
  claims: BackendAnswerClaim[];
  insufficientEvidence: boolean;
  model: string;
}

export interface AdvisorCitationView {
  evidenceId: string;
  documentName: string;
  pageNumber: number;
}

export interface AdvisorClaimView {
  id: string;
  text: string;
  citations: AdvisorCitationView[];
}

/** View model for a backend RAG answer — citations are backend-authored only. */
export interface AdvisorAnswerView {
  answer: string;
  claims: AdvisorClaimView[];
  insufficientEvidence: boolean;
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
