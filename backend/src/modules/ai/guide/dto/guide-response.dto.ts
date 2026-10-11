import type { GuideDomain } from '../guide-turn';
import type { GuideStage } from '../guide-stage';

export interface GuideStartResponseDto {
  sessionId: string;
  reply: string;
  /** Present only when the session was started with an initial message. */
  stage?: GuideStage;
  turn?: GuideTurnDto;
}

/** Public, validated view of one assistant turn. */
export interface GuideTurnDto {
  domains: GuideDomain[];
  understanding: string;
  knownFacts: string[];
  missingFacts: string[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
  suggestedReplies: string[];
  guidance: string | null;
  nextSteps: string[];
  uncertainty: string | null;
  urgent: boolean;
  clarificationCount: number;
  /** No trusted legal-source corpus backs the guide; never claims verification. */
  sourcesAvailable: false;
  sources: [];
}

export interface GuideAnswerResponseDto {
  sessionId: string;
  reply: string;
  stage: GuideStage;
  turn: GuideTurnDto;
}
