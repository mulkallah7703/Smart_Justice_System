import { Module } from '@nestjs/common';

import { StorageModule } from '../modules/documents/storage/storage.module';

import { HealthController, ReadyzController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [StorageModule],
  controllers: [HealthController, ReadyzController],
  providers: [HealthService],
})
export class HealthModule {}
