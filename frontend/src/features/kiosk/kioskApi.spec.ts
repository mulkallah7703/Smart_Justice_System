import { afterEach, describe, expect, it, vi } from 'vitest';

import { ar } from '../../core/i18n/ar';
import { ApiError, getUserFacingKioskError } from '../../shared/api/errors';
import { authStore } from '../auth/authStore';

import {
  printKioskDocument,
  scanKioskIdentity,
  startKioskSession,
} from './kioskApi';
import { mapKioskPrint, mapKioskScan, mapKioskSession } from './mapKiosk';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('kioskApi (mock mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
  });

  it('starts, scans, and prints without calling fetch', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const session = await startKioskSession();
    expect(session.deviceId).toBe('kiosk-lobby-01');
    expect(session.sessionId).toMatch(/^ks-/);

    const scanned = await scanKioskIdentity({
      sessionId: session.sessionId,
      mode: 'qr',
    });
    expect(scanned.success).toBe(true);

    const printed = await printKioskDocument(session.sessionId, 'doc-1');
    expect(printed.success).toBe(true);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('kioskApi (real mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
  });

  it('posts session/scan/print with JWT and without client userId', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('kiosk-jwt');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: { sessionId: 'sess_1', deviceId: 'kiosk-lobby-01' },
          meta: {},
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: { success: true, fileId: 'file_1' },
          meta: {},
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { success: true }, meta: {} }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const session = await startKioskSession();
    expect(session).toEqual({
      sessionId: 'sess_1',
      deviceId: 'kiosk-lobby-01',
    });

    const scanned = await scanKioskIdentity({
      sessionId: 'sess_1',
      mode: 'card',
    });
    expect(scanned.fileId).toBe('file_1');

    await printKioskDocument('sess_1', 'doc_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${REAL_BASE_URL}/kiosk/session/start`,
    );
    expect(fetchMock.mock.calls[1][0]).toBe(`${REAL_BASE_URL}/kiosk/scan`);
    expect(fetchMock.mock.calls[2][0]).toBe(`${REAL_BASE_URL}/kiosk/print`);

    const startBody = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    ) as Record<string, unknown>;
    const scanBody = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body),
    ) as Record<string, unknown>;

    expect(startBody).toEqual({ deviceId: 'kiosk-lobby-01' });
    expect(startBody).not.toHaveProperty('userId');
    expect(scanBody).toEqual({ sessionId: 'sess_1', mode: 'card' });
    expect(scanBody).not.toHaveProperty('userId');
    expect(
      (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
        string,
        string
      >,
    ).toMatchObject({ Authorization: 'Bearer kiosk-jwt' });
  });
});

describe('mapKiosk', () => {
  it('maps backend DTOs into UI models', () => {
    expect(
      mapKioskSession({ sessionId: 's', deviceId: 'd' }),
    ).toEqual({ sessionId: 's', deviceId: 'd' });
    expect(mapKioskScan({ success: true, fileId: 'f' }).fileId).toBe('f');
    expect(mapKioskPrint({ success: true })).toEqual({ success: true });
    expect(mapKioskSession({ sessionId: 's', deviceId: 'd' })).not.toHaveProperty(
      'userId',
    );
  });
});

describe('kiosk error mapping', () => {
  it('maps kiosk backend codes to Arabic messages', () => {
    expect(
      getUserFacingKioskError(new ApiError('KIOSK_SESSION_NOT_FOUND', 'x', 404)),
    ).toBe(ar.kiosk.errors.sessionNotFound);
    expect(
      getUserFacingKioskError(new ApiError('KIOSK_RATE_LIMITED', 'x', 429)),
    ).toBe(ar.kiosk.errors.rateLimited);
    expect(
      getUserFacingKioskError(new ApiError('AUTH_UNAUTHORIZED', 'x', 401)),
    ).toBe(ar.kiosk.errors.unauthorized);
  });
});
