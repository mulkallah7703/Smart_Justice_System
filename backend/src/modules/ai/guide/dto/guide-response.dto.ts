import type { GuideStage } from '../guide-stage';

export interface GuideStartResponseDto {
  sessionId: string;
  reply: string;
}

export interface GuideAnswerResponseDto {
  sessionId: string;
  reply: string;
  stage: GuideStage;
}
