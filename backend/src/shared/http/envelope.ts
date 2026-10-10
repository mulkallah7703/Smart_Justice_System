import { API_VERSION } from '../config/constants';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SuccessMeta {
  timestamp: string;
  version: typeof API_VERSION;
  pagination?: PaginationMeta;
}

export interface SuccessEnvelope<T> {
  data: T;
  meta: SuccessMeta;
}

export interface ErrorBody {
  code: string;
  message: string;
  messageAr: string;
  statusCode: number;
}

export interface ErrorEnvelope {
  error: ErrorBody;
  meta: SuccessMeta;
}

export const buildMeta = (): SuccessMeta => ({
  timestamp: new Date().toISOString(),
  version: API_VERSION,
});

export const wrapSuccess = <T>(
  data: T,
  pagination?: PaginationMeta,
): SuccessEnvelope<T> => ({
  data,
  meta: pagination ? { ...buildMeta(), pagination } : buildMeta(),
});

export const wrapError = (
  code: string,
  message: string,
  messageAr: string,
  statusCode: number,
): ErrorEnvelope => ({
  error: {
    code,
    message,
    messageAr,
    statusCode,
  },
  meta: buildMeta(),
});

export const isSuccessEnvelope = (value: unknown): value is SuccessEnvelope<unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'data' in value && 'meta' in value;
};
