export interface KioskSessionResponseDto {
  sessionId: string;
  deviceId: string;
}

export interface KioskScanResponseDto {
  success: boolean;
  fileId?: string;
}

export interface KioskPrintResponseDto {
  success: boolean;
}
