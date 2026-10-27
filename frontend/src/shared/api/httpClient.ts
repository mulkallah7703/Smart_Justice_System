import { authStore } from '../../features/auth/authStore';

import { ApiError, toApiError } from './errors';
import { handleUnauthorized } from './interceptors';
import { getApiBaseUrl } from './mode';
import type { SuccessEnvelope } from './types';

const DEFAULT_TIMEOUT_MS = 15_000;

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  timeoutMs?: number;
}

const isSuccessEnvelope = <T>(value: unknown): value is SuccessEnvelope<T> => {
  return typeof value === 'object' && value !== null && 'data' in value;
};

// FormData must reach fetch untouched so the browser can generate the multipart boundary.
const buildRequestBody = (body: unknown): BodyInit | undefined => {
  if (body === undefined) {
    return undefined;
  }
  if (body instanceof FormData) {
    return body;
  }
  return JSON.stringify(body);
};

const parseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const parseErrorPayload = async (response: Response): Promise<unknown> => {
  try {
    return await parseJson(response);
  } catch {
    return null;
  }
};

const performRequest = async <T>(
  path: string,
  options: HttpRequestOptions,
  accept: string,
  readBody: (response: Response) => Promise<T>,
): Promise<T> => {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError('API_UNAVAILABLE', 'API base URL is not configured', 0);
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: accept,
    ...options.headers,
  };

  const isFormData = options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const sendAuth = options.auth !== false;
  const accessToken = authStore.getState().accessToken;
  if (sendAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: buildRequestBody(options.body),
      credentials: 'include',
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 && sendAuth) {
        handleUnauthorized();
      }
      throw toApiError(response.status, await parseErrorPayload(response));
    }

    return await readBody(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'Request timed out', 408);
    }

    throw new ApiError('NETWORK_ERROR', 'Network request failed', 0);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const apiRequest = async <T>(
  path: string,
  options: HttpRequestOptions = {},
): Promise<T> =>
  performRequest<T>(path, options, 'application/json', async (response) => {
    const payload = await parseJson(response);

    if (isSuccessEnvelope<T>(payload)) {
      return payload.data;
    }

    return payload as T;
  });

/**
 * Binary sibling of `apiRequest`. Shares the base URL, JWT, timeout, 401
 * handling, and error envelope parsing; only the success body differs.
 */
export const apiRequestBlob = async (
  path: string,
  options: HttpRequestOptions = {},
): Promise<Blob> =>
  performRequest<Blob>(path, options, '*/*', (response) => response.blob());
