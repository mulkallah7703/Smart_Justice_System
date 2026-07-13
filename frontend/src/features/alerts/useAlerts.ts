import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchAlerts, markAlertRead } from './alertsApi';
import { alertsStore } from './alertsStore';

import type { Alert, AlertFilterId } from './alerts.types';

interface UseAlertsResult {
  alerts: Alert[];
  totalCount: number;
  isLoading: boolean;
  handleRead: (id: string) => void;
}

const filterAlerts = (alerts: Alert[], filter: AlertFilterId): Alert[] => {
  switch (filter) {
    case 'urgent':
      return alerts.filter((alert) => alert.severity === 'URGENT');
    case 'warning':
      return alerts.filter((alert) => alert.severity === 'WARNING');
    case 'info':
      return alerts.filter((alert) => alert.type === 'LAW_UPDATE');
    default:
      return alerts;
  }
};

export const useAlerts = (filter: AlertFilterId): UseAlertsResult => {
  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const setUnreadCount = alertsStore((state) => state.setUnreadCount);

  useEffect(() => {
    let cancelled = false;

    const loadAlerts = async (): Promise<void> => {
      try {
        const data = await fetchAlerts();
        if (cancelled) {
          return;
        }

        setAllAlerts(data);
        setUnreadCount(data.filter((alert) => !alert.isRead).length);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadAlerts();

    return () => {
      cancelled = true;
    };
  }, [setUnreadCount]);

  const handleRead = useCallback(
    (id: string) => {
      setAllAlerts((current) => {
        const next = current.map((alert) =>
          alert.id === id ? { ...alert, isRead: true } : alert,
        );
        setUnreadCount(next.filter((alert) => !alert.isRead).length);
        return next;
      });

      void markAlertRead(id);
    },
    [setUnreadCount],
  );

  const alerts = useMemo(
    () => filterAlerts(allAlerts, filter),
    [allAlerts, filter],
  );

  return {
    alerts,
    totalCount: allAlerts.length,
    isLoading,
    handleRead,
  };
};
