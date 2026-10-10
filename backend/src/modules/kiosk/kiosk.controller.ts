import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { PrintKioskDto } from './dto/print-kiosk.dto';
import { ScanKioskDto } from './dto/scan-kiosk.dto';
import { StartKioskSessionDto } from './dto/start-kiosk-session.dto';
import type {
  KioskPrintResponseDto,
  KioskScanResponseDto,
  KioskSessionResponseDto,
} from './dto/kiosk-response.dto';
import { KioskRateLimitGuard } from './guards/kiosk-rate-limit.guard';
import { KioskService } from './kiosk.service';

@Controller('kiosk')
@UseGuards(JwtAuthGuard, KioskRateLimitGuard)
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  @Post('session/start')
  startSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartKioskSessionDto,
  ): Promise<KioskSessionResponseDto> {
    return this.kioskService.startSession(user.sub, dto);
  }

  @Post('scan')
  scan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ScanKioskDto,
  ): Promise<KioskScanResponseDto> {
    return this.kioskService.scan(user.sub, dto);
  }

  @Post('print')
  print(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PrintKioskDto,
  ): Promise<KioskPrintResponseDto> {
    return this.kioskService.print(user.sub, dto);
  }
}
