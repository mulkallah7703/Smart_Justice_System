import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LawyersModule } from '../lawyers/lawyers.module';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsService } from './consultations.service';
import { ConsultationBookingRateLimitGuard } from './guards/consultation-booking-rate-limit.guard';

@Module({
  imports: [AuthModule, LawyersModule],
  controllers: [ConsultationsController],
  providers: [ConsultationsService, ConsultationBookingRateLimitGuard],
})
export class ConsultationsModule {}
