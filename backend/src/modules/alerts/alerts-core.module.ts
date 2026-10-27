import { Module } from '@nestjs/common';

import { AlertsGateway } from './alerts.gateway';
import { AlertsService } from './alerts.service';

/**
 * Alert persistence without the HTTP auth stack.
 * The worker imports this so analysis deadlines can be stored
 * without booting controllers or the auth rate limiter.
 */
@Module({
  providers: [AlertsGateway, AlertsService],
  exports: [AlertsService],
})
export class AlertsCoreModule {}
