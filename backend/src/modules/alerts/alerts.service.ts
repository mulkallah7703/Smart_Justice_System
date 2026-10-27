import { Injectable, Logger } from '@nestjs/common';
import type { AlertSeverity, AlertType, Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/database/prisma.service';
import type { AlertListQueryDto } from './dto/alert-list-query.dto';
import type {
  AlertListResult,
  AlertResponseDto,
} from './dto/alert-response.dto';
import { AlertsGateway } from './alerts.gateway';
import { alertFailed, alertNotFound } from './alerts.errors';
import { mapAlert } from './mappers/alert.mapper';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const ALERT_SELECT = {
  id: true,
  type: true,
  severity: true,
  title: true,
  body: true,
  isRead: true,
  triggeredAt: true,
  createdAt: true,
  caseId: true,
  deadline: { select: { dueAt: true } },
} satisfies Prisma.AlertSelect;

export interface CreateAlertInput {
  userId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  caseId?: string | null;
  deadlineId?: string | null;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AlertsGateway = new AlertsGateway(),
  ) {}

  async list(userId: string, query: AlertListQueryDto): Promise<AlertListResult> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: Prisma.AlertWhereInput = {
      userId,
      ...(query.unreadOnly === true ? { isRead: false } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: ALERT_SELECT,
      }),
      this.prisma.alert.count({ where }),
    ]);

    return {
      items: rows.map(mapAlert),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async getById(userId: string, alertId: string): Promise<AlertResponseDto> {
    const record = await this.prisma.alert.findFirst({
      where: { id: alertId, userId },
      select: ALERT_SELECT,
    });

    if (!record) {
      throw alertNotFound();
    }

    return mapAlert(record);
  }

  async markRead(userId: string, alertId: string): Promise<AlertResponseDto> {
    const existing = await this.prisma.alert.findFirst({
      where: { id: alertId, userId },
      select: ALERT_SELECT,
    });

    if (!existing) {
      throw alertNotFound();
    }

    if (existing.isRead) {
      return mapAlert(existing);
    }

    try {
      const updated = await this.prisma.alert.update({
        where: { id: alertId },
        data: { isRead: true },
        select: ALERT_SELECT,
      });
      this.logger.log({ alertId, operation: 'markRead', status: 'ok' });
      return mapAlert(updated);
    } catch {
      throw alertFailed();
    }
  }

  /**
   * Central create path for domain events. When `deadlineId` is set, creation
   * is idempotent: a second call returns the existing row instead of duplicating.
   */
  async create(input: CreateAlertInput): Promise<AlertResponseDto> {
    if (input.deadlineId) {
      const existing = await this.prisma.alert.findFirst({
        where: { userId: input.userId, deadlineId: input.deadlineId },
        select: ALERT_SELECT,
      });
      if (existing) {
        return mapAlert(existing);
      }
    }

    if (input.type === 'DEADLINE' && input.caseId) {
      const duplicate = await this.prisma.alert.findFirst({
        where: {
          userId: input.userId,
          caseId: input.caseId,
          type: 'DEADLINE',
          body: input.body,
        },
        select: ALERT_SELECT,
      });
      if (duplicate) {
        return mapAlert(duplicate);
      }
    }

    try {
      const created = await this.prisma.alert.create({
        data: {
          userId: input.userId,
          type: input.type,
          severity: input.severity,
          title: input.title,
          body: input.body,
          caseId: input.caseId ?? undefined,
          deadlineId: input.deadlineId ?? undefined,
        },
        select: ALERT_SELECT,
      });
      this.logger.log({
        alertId: created.id,
        operation: 'create',
        status: 'ok',
        type: input.type,
      });
      const mapped = mapAlert(created);
      this.gateway.notify(input.userId, mapped.id, mapped.caseId);
      return mapped;
    } catch {
      throw alertFailed();
    }
  }
}
