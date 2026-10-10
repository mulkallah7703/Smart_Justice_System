import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';

import { AiAdvisorService } from './ai-advisor.service';
import { AiAnswerService } from './ai-answer.service';
import { AiRetrievalService } from './ai-retrieval.service';
import { AnalyzeDocumentsDto } from './dto/analyze-documents.dto';
import { AnswerQueryDto } from './dto/answer-query.dto';
import { RetrieveQueryDto } from './dto/retrieve-query.dto';
import { AiAnalysisRateLimitGuard } from './guards/ai-analysis-rate-limit.guard';
import { AiAnswerRateLimitGuard } from './guards/ai-answer-rate-limit.guard';
import { AiRetrievalRateLimitGuard } from './guards/ai-retrieval-rate-limit.guard';

@Controller('ai/advisor')
@UseGuards(JwtAuthGuard)
export class AiAdvisorController {
  constructor(
    private readonly advisor: AiAdvisorService,
    private readonly retrieval: AiRetrievalService,
    private readonly answers: AiAnswerService,
  ) {}

  /**
   * Accepted, not completed: processing happens in the worker, so the client
   * receives a job handle and polls for the outcome.
   */
  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AiAnalysisRateLimitGuard)
  analyze(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AnalyzeDocumentsDto,
  ) {
    return this.advisor.analyze(user.sub, body.documentIds);
  }

  /**
   * Synchronous evidence retrieval. Returns ranked DocumentChunk text from
   * PostgreSQL with provenance — never an LLM answer.
   */
  @Post('retrieve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiRetrievalRateLimitGuard)
  retrieve(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RetrieveQueryDto,
  ) {
    return this.retrieval.retrieve(user.sub, body);
  }

  /**
   * Synchronous RAG answer: retrieve evidence → LLM → validated citations.
   * Informational only — not an official legal opinion.
   */
  @Post('answer')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiAnswerRateLimitGuard)
  answer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AnswerQueryDto,
  ) {
    return this.answers.answer(user.sub, body);
  }

  @Get('jobs/:jobId')
  getJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.advisor.getJob(user.sub, jobId);
  }
}
