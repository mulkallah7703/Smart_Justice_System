export type ApiDomain =
  | 'auth'
  | 'users'
  | 'alerts'
  | 'lawyers'
  | 'booking'
  | 'payments'
  | 'judicial-card'
  | 'legal-file'
  | 'documents'
  | 'kiosk'
  | 'advisor'
  | 'guide';

export type ApiMode = 'real' | 'mock';

const LIVE_DOMAINS = new Set<ApiDomain>([
  'auth',
  'users',
  'legal-file',
  'documents',
  'lawyers',
  'booking',
  'payments',
  'advisor',
  'guide',
  'alerts',
  'kiosk',
  'judicial-card',
]);

export const getApiBaseUrl = (): string =>
  (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');

/**
 * Explicit API mode.
 * - Production builds (`import.meta.env.PROD`): always `real`; `mock` is rejected.
 * - Development/test: `mock` only when `VITE_API_MODE=mock` is set explicitly.
 * - Empty URL never silently enables mocks in production.
 */
export const getApiMode = (): ApiMode => {
  const explicit = (import.meta.env.VITE_API_MODE ?? '')
    .trim()
    .toLowerCase();
  const isProdBuild = import.meta.env.PROD === true;

  if (isProdBuild) {
    if (explicit === 'mock') {
      throw new Error(
        'VITE_API_MODE=mock is forbidden in production builds. Use the NestJS API.',
      );
    }
    return 'real';
  }

  if (explicit === 'mock') {
    return 'mock';
  }
  if (explicit === 'real' || explicit === '') {
    return 'real';
  }
  throw new Error(
    `Unsupported VITE_API_MODE="${explicit}". Use "real" or "mock" (development only).`,
  );
};

/** In-browser domain mocks — development/test only when explicitly enabled. */
export const isMockApiMode = (): boolean => getApiMode() === 'mock';

/**
 * Real Nest API mode. Requires a configured base URL.
 * Production builds fail fast at startup if the URL is missing.
 */
export const isRealApiMode = (): boolean => {
  if (isMockApiMode()) {
    return false;
  }
  return getApiBaseUrl().length > 0;
};

export const assertProductionApiConfig = (): void => {
  if (import.meta.env.PROD !== true) {
    return;
  }
  // Triggers mock rejection when VITE_API_MODE=mock.
  getApiMode();
  if (!getApiBaseUrl()) {
    throw new Error(
      'VITE_API_BASE_URL is required in production. Frontend must call the NestJS API — no mock fallback.',
    );
  }
};

export const isDomainLive = (domain: ApiDomain): boolean =>
  isRealApiMode() && LIVE_DOMAINS.has(domain);
