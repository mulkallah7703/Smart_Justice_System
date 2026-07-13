export type GuideStage = 'CHAT' | 'QUESTION' | 'SUMMARY';

export type BubbleRole = 'ai' | 'user';

export interface GuideMessage {
  id: string;
  role: BubbleRole;
  text: string;
}

export interface GuideSession {
  sessionId: string;
  messages: GuideMessage[];
  stage: GuideStage;
}

export interface GuideStartResponse {
  sessionId: string;
  reply: string;
}

export interface GuideAnswerResponse {
  sessionId: string;
  reply: string;
  stage: GuideStage;
}

export interface GuideSummaryDoc {
  id: string;
  label: string;
  done: boolean;
}

export interface GuideSummaryStep {
  number: number;
  label: string;
}

export interface GuideSummary {
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
