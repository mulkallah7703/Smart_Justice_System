import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AiAdvisorController } from './ai-advisor.controller';
import { AiAdvisorService } from './ai-advisor.service';
import { AiAnswerService } from './ai-answer.service';
import { AiRetrievalService } from './ai-retrieval.service';
import { AiModule } from './ai.module';
import { AiAnalysisRateLimitGuard } from './guards/ai-analysis-rate-limit.guard';
import { AiAnswerRateLimitGuard } from './guards/ai-answer-rate-limit.guard';
import { AiRetrievalRateLimitGuard } from './guards/ai-retrieval-rate-limit.guard';

/**
 * API-side AI: analysis jobs, evidence retrieval, and RAG answers.
 * No queue processor is registered here.
 */
@Module({
  imports: [AuthModule, AiModule],
  controllers: [AiAdvisorController],
  providers: [
    AiAdvisorService,
    AiRetrievalService,
    AiAnswerService,
    AiAnalysisRateLimitGuard,
    AiRetrievalRateLimitGuard,
    AiAnswerRateLimitGuard,
  ],
})
export class AiAdvisorModule {}
