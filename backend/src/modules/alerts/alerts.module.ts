import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AlertsController } from './alerts.controller';
import { AlertsCoreModule } from './alerts-core.module';
import { DeadlineWatcherService } from './deadline-watcher.service';

@Module({
  imports: [AuthModule, AlertsCoreModule],
  controllers: [AlertsController],
  providers: [DeadlineWatcherService],
  exports: [AlertsCoreModule],
})
export class AlertsModule {}
