/**
 * CHAT: no legal turn yet · QUESTION: the reply is one clarification the model needs ·
 * ANSWER: the reply is guidance (the user may continue or correct facts).
 */
export type GuideStage = 'CHAT' | 'QUESTION' | 'ANSWER';

export type BubbleRole = 'ai' | 'user';

export interface GuideMessage {
  id: string;
  role: BubbleRole;
  text: string;
}

export interface GuideStartResponse {
  sessionId: string;
  reply: string;
}

export interface GuideAnswerResponse {
  sessionId: string;
  reply: string;
  stage: GuideStage;
  /** Answer options proposed by the model for its own question; may be empty. */
  suggestedReplies: string[];
  urgent: boolean;
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
