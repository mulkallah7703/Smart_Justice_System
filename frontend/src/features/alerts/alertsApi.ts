import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';

import type { Alert } from './alerts.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const mockAlerts = (): Alert[] => [
  {
    id: 'alert-1',
    type: 'DEADLINE',
    severity: 'URGENT',
    titleAr: ar.alerts.items.deadline.title,
    bodyAr: ar.alerts.items.deadline.body,
    severityLabelAr: ar.alerts.severity.urgent,
    icon: 'error',
    isRead: false,
    triggeredAt: new Date().toISOString(),
    timeLeft: '47:52:10',
    countdownLabel: ar.alerts.countdownRemaining,
    action: {
      label: ar.alerts.actions.correctNow,
      variant: 'danger-solid',
    },
  },
  {
    id: 'alert-2',
    type: 'MISSING_DOC',
    severity: 'WARNING',
    titleAr: ar.alerts.items.missingDoc.title,
    bodyAr: ar.alerts.items.missingDoc.body,
    severityLabelAr: ar.alerts.severity.important,
    icon: 'warning',
    isRead: false,
    triggeredAt: new Date().toISOString(),
    action: {
      label: ar.alerts.actions.attachDocument,
      variant: 'warning-outline',
    },
  },
  {
    id: 'alert-3',
    type: 'LAW_UPDATE',
    severity: 'INFO',
    titleAr: ar.alerts.items.lawUpdate.title,
    bodyAr: ar.alerts.items.lawUpdate.body,
    icon: 'campaign',
    isRead: true,
    triggeredAt: new Date().toISOString(),
  },
  {
    id: 'alert-4',
    type: 'HEARING_REMINDER',
    severity: 'URGENT',
    titleAr: ar.alerts.items.hearing.title,
    bodyAr: ar.alerts.items.hearing.body,
    severityLabelAr: ar.alerts.severity.urgent,
    icon: 'gavel',
    isRead: false,
    triggeredAt: new Date().toISOString(),
    timeLeft: '12:30:00',
    countdownLabel: ar.alerts.countdownRemaining,
    action: {
      label: ar.alerts.actions.viewDetails,
      variant: 'danger-solid',
    },
  },
  {
    id: 'alert-5',
    type: 'DEADLINE',
    severity: 'WARNING',
    titleAr: ar.alerts.items.payment.title,
    bodyAr: ar.alerts.items.payment.body,
    severityLabelAr: ar.alerts.severity.important,
    icon: 'schedule',
    isRead: false,
    triggeredAt: new Date().toISOString(),
    action: {
      label: ar.alerts.actions.attachDocument,
      variant: 'warning-outline',
    },
  },
];

export const fetchAlerts = async (): Promise<Alert[]> => {
  if (!API_BASE_URL) {
    await wait(300);
    return mockAlerts();
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.alerts.list}`);

  if (!response.ok) {
    throw new Error('ALERTS_FETCH_FAILED');
  }

  const json = (await response.json()) as { data: Alert[] };
  return json.data;
};

export const markAlertRead = async (id: string): Promise<void> => {
  if (!API_BASE_URL) {
    await wait(200);
    return;
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.alerts.markRead(id)}`, {
    method: 'PATCH',
  });

  if (!response.ok) {
    throw new Error('ALERT_MARK_READ_FAILED');
  }
};
