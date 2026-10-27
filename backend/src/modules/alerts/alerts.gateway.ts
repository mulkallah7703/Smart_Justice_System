import { Injectable, Logger } from '@nestjs/common';

/**
 * Push hook for a newly stored alert.
 * This process does not ship a Socket.io server. The method is the single
 * place a realtime transport would emit, and it records that none is bound.
 */
@Injectable()
export class AlertsGateway {
  private readonly logger = new Logger(AlertsGateway.name);

  notify(userId: string, alertId: string): void {
    this.logger.log(
      `alert.notify userId=${userId} alertId=${alertId} socket=absent`,
    );
  }
}
