import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { wrapSuccess } from '../../shared/http/envelope';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ConsultationsService } from './consultations.service';
import { ConsultationListQueryDto } from './dto/consultation-list-query.dto';
import type { ConsultationDto } from './dto/consultation-response.dto';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { ConsultationBookingRateLimitGuard } from './guards/consultation-booking-rate-limit.guard';

@Controller('consultations')
@UseGuards(JwtAuthGuard)
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ConsultationBookingRateLimitGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateConsultationDto,
  ): Promise<ConsultationDto> {
    return this.consultationsService.create(user.sub, body);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ConsultationListQueryDto,
  ) {
    const result = await this.consultationsService.list(user.sub, query);
    return wrapSuccess(result.items, result.pagination);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') consultationId: string,
  ): Promise<ConsultationDto> {
    return this.consultationsService.getById(user.sub, consultationId);
  }
}
