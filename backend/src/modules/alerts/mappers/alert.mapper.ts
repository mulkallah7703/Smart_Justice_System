import type { AlertSeverity, AlertType } from '@prisma/client';

import type { AlertResponseDto } from '../dto/alert-response.dto';

export interface AlertRecord {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  isRead: boolean;
  triggeredAt: Date;
  createdAt: Date;
  caseId: string | null;
  deadline: { dueAt: Date } | null;
}

const toIso = (value: Date): string => value.toISOString();

export const mapAlert = (record: AlertRecord): AlertResponseDto => ({
  id: record.id,
  type: record.type,
  severity: record.severity,
  title: record.title,
  body: record.body,
  isRead: record.isRead,
  triggeredAt: toIso(record.triggeredAt),
  createdAt: toIso(record.createdAt),
  dueAt: record.deadline ? toIso(record.deadline.dueAt) : null,
  caseId: record.caseId,
});
