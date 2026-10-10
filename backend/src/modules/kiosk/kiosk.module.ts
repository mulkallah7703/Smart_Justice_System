import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { KioskRateLimitGuard } from './guards/kiosk-rate-limit.guard';
import { KioskController } from './kiosk.controller';
import { KioskSessionService } from './kiosk-session.service';
import { KioskService } from './kiosk.service';

@Module({
  imports: [AuthModule],
  controllers: [KioskController],
  providers: [KioskService, KioskSessionService, KioskRateLimitGuard],
})
export class KioskModule {}
