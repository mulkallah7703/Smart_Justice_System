import { useEffect } from 'react';

import { authStore } from '../auth/authStore';
import { getApiBaseUrl, isMockApiMode } from '../../shared/api/mode';

export interface AlertSocketMessage {
  alertId: string;
  caseId: string | null;
}

/**
 * Subscribes to `/api/v1/alerts/ws`. The browser WebSocket API cannot set
 * an Authorization header, so the access token travels as a query parameter.
 */
export const useWebSocket = (
  onAlert: (message: AlertSocketMessage) => void,
): void => {
  useEffect(() => {
    if (isMockApiMode() || typeof WebSocket === 'undefined') {
      return undefined;
    }
    const base = getApiBaseUrl();
    const token = authStore.getState().accessToken;
    if (!base || !token) {
      return undefined;
    }

    const wsBase = base.replace(/^http/i, 'ws');
    const url = `${wsBase}/alerts/ws?access_token=${encodeURIComponent(token)}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      return undefined;
    }

    socket.onmessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(event.data)) as Partial<AlertSocketMessage>;
        if (typeof parsed.alertId !== 'string') {
          return;
        }
        onAlert({
          alertId: parsed.alertId,
          caseId: typeof parsed.caseId === 'string' ? parsed.caseId : null,
        });
      } catch {
        /* ignore malformed frames */
      }
    };

    return () => {
      socket.close();
    };
  }, [onAlert]);
};
