import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';

import type {
  KioskQuickService,
  KioskScanPayload,
  KioskScanResult,
  KioskSession,
} from './kiosk.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
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
  if (!API_BASE_URL) {
    await wait(200);
    return {
      sessionId: `ks-${Date.now()}`,
      deviceId: DEVICE_ID,
    };
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.kiosk.sessionStart}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: DEVICE_ID }),
  });

  if (!response.ok) {
    throw new Error('KIOSK_SESSION_FAILED');
  }

  const json = (await response.json()) as { data: KioskSession };
  return json.data;
};

export const scanKioskIdentity = async (
  payload: KioskScanPayload,
): Promise<KioskScanResult> => {
  if (!API_BASE_URL) {
    await wait(400);
    return {
      success: true,
      fileId: `file-${payload.mode}-${Date.now()}`,
    };
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.kiosk.scan}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('KIOSK_SCAN_FAILED');
  }

  const json = (await response.json()) as { data: KioskScanResult };
  return json.data;
};
