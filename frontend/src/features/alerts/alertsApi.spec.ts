import { afterEach, describe, expect, it, vi } from 'vitest';

import { ar } from '../../core/i18n/ar';
import { ApiError, getUserFacingAlertError } from '../../shared/api/errors';
import { authStore } from '../auth/authStore';

import { fetchAlerts, markAlertRead } from './alertsApi';
import { formatTimeLeft, mapAlert, type BackendAlert } from './mapAlert';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const backendAlert = (overrides: Partial<BackendAlert> = {}): BackendAlert => ({
  id: 'alert_1',
  type: 'DEADLINE',
  severity: 'URGENT',
  title: 'قرب انتهاء مهلة',
  body: 'تذكير بمهلة',
  isRead: false,
  triggeredAt: '2030-01-01T10:00:00.000Z',
  createdAt: '2030-01-01T10:00:00.000Z',
  dueAt: '2030-01-03T10:00:00.000Z',
  ...overrides,
});

describe('alertsApi (mock mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
  });

  it('returns mock alerts without calling fetch', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const alerts = await fetchAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].titleAr).toBe(ar.alerts.items.deadline.title);

    await markAlertRead(alerts[0].id);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('alertsApi (real mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
  });

  it('lists and marks read with JWT and without client userId', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('alerts-jwt');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: [backendAlert()], meta: {} }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: backendAlert({ isRead: true }), meta: {} }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const alerts = await fetchAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].titleAr).toBe('قرب انتهاء مهلة');
    expect(alerts[0].isRead).toBe(false);
    expect(alerts[0]).not.toHaveProperty('userId');

    await markAlertRead('alert_1');

    expect(fetchMock.mock.calls[0][0]).toBe(`${REAL_BASE_URL}/alerts`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${REAL_BASE_URL}/alerts/alert_1/read`);
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('PATCH');
    expect(
      (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>,
    ).toMatchObject({ Authorization: 'Bearer alerts-jwt' });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('userId');
  });
});

describe('mapAlert', () => {
  it('maps backend DTO into UI model with i18n chrome', () => {
    const mapped = mapAlert(
      backendAlert({
        dueAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      }),
    );

    expect(mapped.id).toBe('alert_1');
    expect(mapped.titleAr).toBe('قرب انتهاء مهلة');
    expect(mapped.bodyAr).toBe('تذكير بمهلة');
    expect(mapped.icon).toBe('error');
    expect(mapped.severityLabelAr).toBe(ar.alerts.severity.urgent);
    expect(mapped.action?.label).toBe(ar.alerts.actions.correctNow);
    expect(mapped.timeLeft).toMatch(/^\d+:\d{2}:\d{2}$/);
    expect(mapped.countdownLabel).toBe(ar.alerts.countdownRemaining);
    expect(mapped).not.toHaveProperty('userId');
    expect(mapped).not.toHaveProperty('dueAt');
  });

  it('omits countdown when dueAt is null or past', () => {
    expect(mapAlert(backendAlert({ dueAt: null })).timeLeft).toBeUndefined();
    expect(
      mapAlert(backendAlert({ dueAt: '2000-01-01T00:00:00.000Z' })).timeLeft,
    ).toBeUndefined();
  });

  it('formats remaining time', () => {
    const now = Date.parse('2030-01-01T00:00:00.000Z');
    expect(formatTimeLeft('2030-01-01T01:02:03.000Z', now)).toBe('01:02:03');
  });
});

describe('alert error mapping', () => {
  it('maps alert backend codes to Arabic messages', () => {
    expect(
      getUserFacingAlertError(new ApiError('ALERT_NOT_FOUND', 'x', 404)),
    ).toBe(ar.alerts.errors.notFound);
    expect(
      getUserFacingAlertError(new ApiError('ALERT_FAILED', 'x', 502)),
    ).toBe(ar.alerts.errors.failed);
    expect(
      getUserFacingAlertError(new ApiError('AUTH_UNAUTHORIZED', 'x', 401)),
    ).toBe(ar.alerts.errors.unauthorized);
    expect(getUserFacingAlertError(new Error('boom'))).toBe(
      ar.alerts.errors.generic,
    );
  });
});
