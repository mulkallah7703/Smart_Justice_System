export type KioskAuthMode = 'qr' | 'card' | null;

export type KioskQuickServiceId = 'retrieve' | 'print' | 'upload';

export interface KioskQuickService {
  id: KioskQuickServiceId;
  label: string;
  icon: string;
}

export interface KioskSession {
  sessionId: string;
  deviceId: string;
}

export interface KioskScanPayload {
  sessionId: string;
  mode: 'qr' | 'card';
}

export interface KioskScanResult {
  success: boolean;
  fileId?: string;
}
