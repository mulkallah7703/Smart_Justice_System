import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AvailabilityService } from './availability.service';
import { LawyersController } from './lawyers.controller';
import { LawyersService } from './lawyers.service';

@Module({
  imports: [AuthModule],
  controllers: [LawyersController],
  providers: [LawyersService, AvailabilityService],
  exports: [AvailabilityService],
})
export class LawyersModule {}
