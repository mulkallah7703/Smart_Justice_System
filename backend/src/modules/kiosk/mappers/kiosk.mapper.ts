import type {
  KioskPrintResponseDto,
  KioskScanResponseDto,
  KioskSessionResponseDto,
} from '../dto/kiosk-response.dto';

export const mapKioskSession = (input: {
  sessionId: string;
  deviceId: string;
}): KioskSessionResponseDto => ({
  sessionId: input.sessionId,
  deviceId: input.deviceId,
});

export const mapKioskScan = (input: {
  success: boolean;
  fileId?: string;
}): KioskScanResponseDto => ({
  success: input.success,
  ...(input.fileId ? { fileId: input.fileId } : {}),
});

export const mapKioskPrint = (success: boolean): KioskPrintResponseDto => ({
  success,
});
