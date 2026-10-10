import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../shared/database/prisma.service';
import { AlertsService } from './alerts.service';
import type { AlertResponseDto } from './dto/alert-response.dto';

/**
 * Future integration point for scheduled deadline reminders.
 * Phase M persists alerts via AlertsService; no cron/websocket is registered.
 */
@Injectable()
export class DeadlineWatcherService {
  private readonly logger = new Logger(DeadlineWatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  /**
   * Ensures a DEADLINE alert exists for the given deadline (idempotent).
   * Call from a future scheduler when deadline watching is enabled.
   */
  async ensureDeadlineAlert(deadlineId: string): Promise<AlertResponseDto | null> {
    const deadline = await this.prisma.deadline.findUnique({
      where: { id: deadlineId },
      select: {
        id: true,
        label: true,
        dueAt: true,
        case: { select: { id: true, userId: true, caseNumber: true } },
      },
    });

    if (!deadline) {
      this.logger.warn({ deadlineId, operation: 'ensureDeadlineAlert', status: 'missing' });
      return null;
    }

    return this.alertsService.create({
      userId: deadline.case.userId,
      caseId: deadline.case.id,
      deadlineId: deadline.id,
      type: 'DEADLINE',
      severity: 'WARNING',
      title: 'قرب انتهاء مهلة',
      body: `تذكير بمهلة «${deadline.label}» المرتبطة بملفك العدلي.`,
    });
  }
}
