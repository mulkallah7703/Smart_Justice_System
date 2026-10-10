import type {
  GuideAnswerResponseDto,
  GuideStartResponseDto,
} from '../dto/guide-response.dto';
import type { GuideStage } from '../guide-stage';

export const mapGuideStart = (
  sessionId: string,
  reply: string,
): GuideStartResponseDto => ({
  sessionId,
  reply,
});

export const mapGuideAnswer = (
  sessionId: string,
  reply: string,
  stage: GuideStage,
): GuideAnswerResponseDto => ({
  sessionId,
  reply,
  stage,
});
