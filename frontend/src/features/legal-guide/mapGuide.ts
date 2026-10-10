import type {
  GuideAnswerResponse,
  GuideStage,
  GuideStartResponse,
  GuideSummary,
  GuideSummaryDoc,
  GuideSummaryStep,
} from './guide.types';

/** Backend start/answer envelope payloads (Phase K). */
export interface BackendGuideStart {
  sessionId: string;
  reply: string;
}

export interface BackendGuideAnswer {
  sessionId: string;
  reply: string;
  stage: GuideStage;
}

export interface BackendGuideSummary {
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
  docs: GuideSummaryDoc[];
  stepsTitle: string;
  steps: GuideSummaryStep[];
}

export const mapGuideStart = (
  record: BackendGuideStart,
): GuideStartResponse => ({
  sessionId: record.sessionId,
  reply: record.reply,
});

export const mapGuideAnswer = (
  record: BackendGuideAnswer,
): GuideAnswerResponse => ({
  sessionId: record.sessionId,
  reply: record.reply,
  stage: record.stage,
});

export const mapGuideSummary = (
  record: BackendGuideSummary,
): GuideSummary => ({
  sessionId: record.sessionId,
  resultTitle: record.resultTitle,
  resultBody: record.resultBody,
  caseTypeLabel: record.caseTypeLabel,
  caseTypeValue: record.caseTypeValue,
  authorityLabel: record.authorityLabel,
  authorityValue: record.authorityValue,
  durationLabel: record.durationLabel,
  durationValue: record.durationValue,
  durationDays: record.durationDays,
  durationUnit: record.durationUnit,
  docsTitle: record.docsTitle,
  docs: (record.docs ?? []).map((doc) => ({
    id: doc.id,
    label: doc.label,
    done: Boolean(doc.done),
  })),
  stepsTitle: record.stepsTitle,
  steps: (record.steps ?? []).map((step) => ({
    number: step.number,
    label: step.label,
  })),
});
