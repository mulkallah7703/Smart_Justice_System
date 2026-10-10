import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import { wrapSuccess } from '../../shared/http/envelope';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AlertsService } from './alerts.service';
import { AlertListQueryDto } from './dto/alert-list-query.dto';
import type { AlertResponseDto } from './dto/alert-response.dto';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AlertListQueryDto,
  ) {
    const result = await this.alertsService.list(user.sub, query);
    return wrapSuccess(result.items, result.pagination);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') alertId: string,
  ): Promise<AlertResponseDto> {
    return this.alertsService.getById(user.sub, alertId);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') alertId: string,
  ): Promise<AlertResponseDto> {
    return this.alertsService.markRead(user.sub, alertId);
  }
}
