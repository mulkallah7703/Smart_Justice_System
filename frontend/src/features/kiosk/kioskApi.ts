import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';
import { apiRequest } from '../../shared/api/httpClient';
import { isMockApiMode } from '../../shared/api/mode';

import {
  mapKioskPrint,
  mapKioskScan,
  mapKioskSession,
  type BackendKioskPrint,
  type BackendKioskScan,
  type BackendKioskSession,
} from './mapKiosk';

import type {
  KioskQuickService,
  KioskScanPayload,
  KioskScanResult,
  KioskSession,
} from './kiosk.types';

const DEVICE_ID = 'kiosk-lobby-01';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const getQuickServices = (): KioskQuickService[] => [
  {
    id: 'retrieve',
    label: ar.kiosk.services.retrieve,
    icon: 'folder_shared',
  },
  {
    id: 'print',
    label: ar.kiosk.services.print,
    icon: 'print',
  },
  {
    id: 'upload',
    label: ar.kiosk.services.upload,
    icon: 'upload_file',
  },
];

export const startKioskSession = async (): Promise<KioskSession> => {
  if (isMockApiMode()) {
    await wait(200);
    return {
      sessionId: `ks-${Date.now()}`,
      deviceId: DEVICE_ID,
    };
  }

  const data = await apiRequest<BackendKioskSession>(
    endpoints.kiosk.sessionStart,
    {
      method: 'POST',
      body: { deviceId: DEVICE_ID },
    },
  );
  return mapKioskSession(data);
};

export const scanKioskIdentity = async (
  payload: KioskScanPayload,
): Promise<KioskScanResult> => {
  if (isMockApiMode()) {
    await wait(400);
    return {
      success: true,
      fileId: `file-${payload.mode}-${Date.now()}`,
    };
  }

  const data = await apiRequest<BackendKioskScan>(endpoints.kiosk.scan, {
    method: 'POST',
    body: {
      sessionId: payload.sessionId,
      mode: payload.mode,
    },
  });
  return mapKioskScan(data);
};

/**
 * Documented print contract. The current Kiosk UI does not collect a
 * documentId yet, so this is available for integration without redesigning
 * the quick-services panel.
 */
export const printKioskDocument = async (
  sessionId: string,
  documentId: string,
): Promise<{ success: boolean }> => {
  if (isMockApiMode()) {
    await wait(300);
    return { success: true };
  }

  const data = await apiRequest<BackendKioskPrint>(endpoints.kiosk.print, {
    method: 'POST',
    body: { sessionId, documentId },
  });
  return mapKioskPrint(data);
};
