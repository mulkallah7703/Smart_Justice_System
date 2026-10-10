import { ar } from '../../core/i18n/ar';

import type {
  Alert,
  AlertAction,
  AlertSeverity,
  AlertType,
} from './alerts.types';

/** Backend AlertResponseDto shape (public fields only). */
export interface BackendAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  isRead: boolean;
  triggeredAt: string;
  createdAt: string;
  dueAt: string | null;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** Formats remaining time as HH:MM:SS for the countdown UI. */
export const formatTimeLeft = (dueAtIso: string, now = Date.now()): string | undefined => {
  const dueMs = Date.parse(dueAtIso);
  if (Number.isNaN(dueMs)) {
    return undefined;
  }
  const remaining = dueMs - now;
  if (remaining <= 0) {
    return undefined;
  }
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const iconFor = (type: AlertType, severity: AlertSeverity): string => {
  if (type === 'HEARING_REMINDER') {
    return 'gavel';
  }
  if (type === 'LAW_UPDATE') {
    return 'campaign';
  }
  if (type === 'MISSING_DOC') {
    return 'warning';
  }
  if (type === 'DEADLINE' && severity === 'URGENT') {
    return 'error';
  }
  if (type === 'DEADLINE') {
    return 'schedule';
  }
  return 'notifications';
};

const severityLabelFor = (severity: AlertSeverity): string | undefined => {
  if (severity === 'URGENT') {
    return ar.alerts.severity.urgent;
  }
  if (severity === 'WARNING') {
    return ar.alerts.severity.important;
  }
  return undefined;
};

const actionFor = (type: AlertType, severity: AlertSeverity): AlertAction | undefined => {
  if (type === 'DEADLINE' && severity === 'URGENT') {
    return { label: ar.alerts.actions.correctNow, variant: 'danger-solid' };
  }
  if (type === 'HEARING_REMINDER') {
    return { label: ar.alerts.actions.viewDetails, variant: 'danger-solid' };
  }
  if (type === 'MISSING_DOC' || type === 'DEADLINE') {
    return { label: ar.alerts.actions.attachDocument, variant: 'warning-outline' };
  }
  return undefined;
};

export const mapAlert = (dto: BackendAlert): Alert => {
  const timeLeft = dto.dueAt ? formatTimeLeft(dto.dueAt) : undefined;

  return {
    id: dto.id,
    type: dto.type,
    severity: dto.severity,
    titleAr: dto.title,
    bodyAr: dto.body,
    severityLabelAr: severityLabelFor(dto.severity),
    icon: iconFor(dto.type, dto.severity),
    isRead: dto.isRead,
    triggeredAt: dto.triggeredAt,
    ...(timeLeft
      ? {
          timeLeft,
          countdownLabel: ar.alerts.countdownRemaining,
        }
      : {}),
    action: actionFor(dto.type, dto.severity),
  };
};
