import type { AlertSeverity, AlertType } from '@prisma/client';

import type { PaginationMeta } from '../../../shared/http/envelope';

export interface AlertResponseDto {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  isRead: boolean;
  triggeredAt: string;
  createdAt: string;
  /** Present when the alert is linked to a deadline; used for countdown UI. */
  dueAt: string | null;
}

export interface AlertListResult {
  items: AlertResponseDto[];
  pagination: PaginationMeta;
}
