import { useCallback, useEffect, useMemo, useState } from 'react';

import { getUserFacingAlertError } from '../../shared/api/errors';

import { fetchAlerts, markAlertRead } from './alertsApi';
import { alertsStore } from './alertsStore';
import { useWebSocket } from './useWebSocket';

import type { Alert, AlertFilterId } from './alerts.types';

interface UseAlertsResult {
  alerts: Alert[];
  totalCount: number;
  isLoading: boolean;
  errorMessage: string | null;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const setUnreadCount = alertsStore((state) => state.setUnreadCount);

  const loadAlerts = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchAlerts();
      setAllAlerts(data);
      setUnreadCount(data.filter((alert) => !alert.isRead).length);
    } catch (error) {
      setErrorMessage(getUserFacingAlertError(error));
      setAllAlerts([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [setUnreadCount]);

  useEffect(() => {
    let cancelled = false;
    void loadAlerts().then(() => {
      if (cancelled) {
        return;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadAlerts]);

  useWebSocket(
    useCallback(() => {
      void loadAlerts();
    }, [loadAlerts]),
  );

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
    errorMessage,
    handleRead,
  };
};
