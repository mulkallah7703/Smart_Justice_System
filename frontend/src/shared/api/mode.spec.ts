import { describe, expect, it, vi } from 'vitest';

import {
  apiBaseToWebSocketUrl,
  getApiBaseUrl,
  getApiMode,
  isDomainLive,
  isMockApiMode,
  isRealApiMode,
} from './mode';

describe('api mode', () => {
  it('uses explicit mock mode only when VITE_API_MODE=mock', () => {
    vi.stubEnv('VITE_API_MODE', 'mock');
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(getApiMode()).toBe('mock');
    expect(isMockApiMode()).toBe(true);
    expect(isRealApiMode()).toBe(false);
    expect(isDomainLive('auth')).toBe(false);
  });

  it('does not treat empty URL as mock when mode is real', () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(isMockApiMode()).toBe(false);
    expect(isRealApiMode()).toBe(false);
    expect(isDomainLive('auth')).toBe(false);
  });

  it('enables live domains when real mode and base URL are set', () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    expect(isRealApiMode()).toBe(true);
    expect(isMockApiMode()).toBe(false);
    expect(isDomainLive('auth')).toBe(true);
    expect(isDomainLive('users')).toBe(true);
    expect(isDomainLive('legal-file')).toBe(true);
    expect(isDomainLive('documents')).toBe(true);
    expect(isDomainLive('lawyers')).toBe(true);
    expect(isDomainLive('booking')).toBe(true);
    expect(isDomainLive('payments')).toBe(true);
    expect(isDomainLive('guide')).toBe(true);
    expect(isDomainLive('advisor')).toBe(true);
    expect(isDomainLive('alerts')).toBe(true);
    expect(isDomainLive('kiosk')).toBe(true);
    expect(isDomainLive('judicial-card')).toBe(true);
  });

  it('uses VITE_API_URL when VITE_API_BASE_URL is empty', () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_API_URL', 'https://sjs.onrender.com/api/v1/');
    expect(getApiBaseUrl()).toBe('https://sjs.onrender.com/api/v1');
    expect(isRealApiMode()).toBe(true);
  });

  it('derives a secure websocket URL from the Render API base', () => {
    expect(apiBaseToWebSocketUrl('https://sjs.onrender.com/api/v1')).toBe(
      'wss://sjs.onrender.com/api/v1/alerts/ws',
    );
  });
});
