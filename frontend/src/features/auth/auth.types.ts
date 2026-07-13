export interface NafathVerifyPayload {
  nationalId: string;
  nafathCode: number;
}

export interface NafathVerifyResponse {
  accessToken: string;
}

export interface AuthState {
  accessToken: string | null;
  setTokens: (accessToken: string) => void;
  clearAuth: () => void;
}
