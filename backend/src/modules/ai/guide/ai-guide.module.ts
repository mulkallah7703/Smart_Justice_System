import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { AiModule } from '../ai.module';

import { AiGuideController } from './ai-guide.controller';
import { AiGuideService } from './ai-guide.service';
import { GuideRateLimitGuard } from './guards/guide-rate-limit.guard';

/**
 * Conversational Legal Guide API (informational only).
 * Reuses ANSWER_LLM_PROVIDER; no Advisor retrieval/Qdrant path.
 */
@Module({
  imports: [AuthModule, AiModule],
  controllers: [AiGuideController],
  providers: [AiGuideService, GuideRateLimitGuard],
})
export class AiGuideModule {}
