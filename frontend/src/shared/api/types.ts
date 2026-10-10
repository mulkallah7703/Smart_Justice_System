export interface AuthResponse {
  accessToken: string;
}

export interface BackendJudicialCard {
  cardNumber: string;
  tier: 'NORMAL' | 'SILVER' | 'GOLD';
  discountPct: number;
}

export interface BackendUser {
  id: string;
  name: string;
  role: 'CITIZEN' | 'LAWYER' | 'COURT_STAFF' | 'ADMIN';
  card: BackendJudicialCard | null;
}

export interface FrontendUser {
  name: string;
  cardLabel: string;
  cardNumber: string;
  tier: BackendJudicialCard['tier'] | null;
  discountPct: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  messageAr: string;
  statusCode: number;
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
  meta?: {
    timestamp: string;
    version: string;
  };
}

export interface SuccessEnvelope<T> {
  data: T;
  meta?: {
    timestamp: string;
    version: string;
  };
}
