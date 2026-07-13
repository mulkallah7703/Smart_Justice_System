export type AlertSeverity = 'URGENT' | 'WARNING' | 'INFO';

export type AlertType =
  | 'DEADLINE'
  | 'MISSING_DOC'
  | 'LAW_UPDATE'
  | 'HEARING_REMINDER';

export type AlertFilterId = 'all' | 'urgent' | 'warning' | 'info';

export type AlertActionVariant = 'danger-solid' | 'warning-outline';

export interface AlertAction {
  label: string;
  variant: AlertActionVariant;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  titleAr: string;
  bodyAr: string;
  severityLabelAr?: string;
  icon: string;
  isRead: boolean;
  triggeredAt: string;
  timeLeft?: string;
  countdownLabel?: string;
  action?: AlertAction;
}
