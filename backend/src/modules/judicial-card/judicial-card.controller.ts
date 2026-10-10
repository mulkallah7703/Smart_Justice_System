import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { UpgradeJudicialCardDto } from './dto/upgrade-judicial-card.dto';
import type {
  JudicialCardQrResponseDto,
  JudicialCardResponseDto,
} from './dto/judicial-card-response.dto';
import { JudicialCardService } from './judicial-card.service';

@Controller('judicial-card')
@UseGuards(JwtAuthGuard)
export class JudicialCardController {
  constructor(private readonly judicialCardService: JudicialCardService) {}

  @Get()
  getMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JudicialCardResponseDto> {
    return this.judicialCardService.getMine(user.sub);
  }

  @Get('qr')
  getQr(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JudicialCardQrResponseDto> {
    return this.judicialCardService.getQr(user.sub);
  }

  @Post('upgrade')
  upgrade(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpgradeJudicialCardDto,
  ): Promise<never> {
    return this.judicialCardService.upgrade(user.sub, dto);
  }
}
