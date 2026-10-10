import type {
  KioskScanResult,
  KioskSession,
} from './kiosk.types';

/** Backend POST /kiosk/session/start response. */
export interface BackendKioskSession {
  sessionId: string;
  deviceId: string;
}

/** Backend POST /kiosk/scan response. */
export interface BackendKioskScan {
  success: boolean;
  fileId?: string;
}

/** Backend POST /kiosk/print response. */
export interface BackendKioskPrint {
  success: boolean;
}

export const mapKioskSession = (dto: BackendKioskSession): KioskSession => ({
  sessionId: dto.sessionId,
  deviceId: dto.deviceId,
});

export const mapKioskScan = (dto: BackendKioskScan): KioskScanResult => ({
  success: dto.success,
  ...(dto.fileId ? { fileId: dto.fileId } : {}),
});

export const mapKioskPrint = (dto: BackendKioskPrint): { success: boolean } => ({
  success: dto.success,
});
