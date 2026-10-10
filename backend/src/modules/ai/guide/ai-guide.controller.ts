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

import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/auth.types';

import { AiGuideService } from './ai-guide.service';
import { AnswerGuideDto } from './dto/answer-guide.dto';
import { StartGuideDto } from './dto/start-guide.dto';
import { GuideRateLimitGuard } from './guards/guide-rate-limit.guard';

@Controller('ai/guide')
@UseGuards(JwtAuthGuard, GuideRateLimitGuard)
export class AiGuideController {
  constructor(private readonly guide: AiGuideService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StartGuideDto,
  ) {
    return this.guide.start(user.sub, body);
  }

  @Post('answer')
  @HttpCode(HttpStatus.OK)
  answer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AnswerGuideDto,
  ) {
    return this.guide.answer(user.sub, body);
  }

  @Get('summary/:sessionId')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.guide.summary(user.sub, sessionId);
  }
}
