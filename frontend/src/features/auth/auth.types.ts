export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  name: string;
  email: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}

/** FUTURE — not used by active Login/Register UI. */
export interface NafathVerifyPayload {
  nationalId: string;
  nafathCode: number;
}

export interface NafathVerifyResponse {
  accessToken: string;
}

export type AuthResponse = LoginResponse;

export interface AuthState {
  accessToken: string | null;
  setTokens: (accessToken: string) => void;
  clearAuth: () => void;
}
