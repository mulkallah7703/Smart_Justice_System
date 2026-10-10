import { afterEach, describe, expect, it, vi } from 'vitest';

import { ar } from '../../core/i18n/ar';
import {
  ApiError,
  getUserFacingJudicialCardError,
} from '../../shared/api/errors';
import { authStore } from '../auth/authStore';

import {
  getCardQr,
  getJudicialCard,
  upgradeJudicialCard,
} from './cardApi';
import { mapJudicialCard, mapJudicialCardQr } from './mapJudicialCard';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('cardApi (mock mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
  });

  it('loads card and qr without calling fetch', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const card = await getJudicialCard();
    const qr = await getCardQr();
    const upgraded = await upgradeJudicialCard({ tier: 'GOLD' });

    expect(card.cardNumber).toBe(ar.judicialCard.mock.cardNumber);
    expect(qr.payload).toBe(ar.judicialCard.mock.qrPayload);
    expect(upgraded.success).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('cardApi (real mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
  });

  it('fetches card and qr with JWT and without client userId', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('card-jwt');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            cardNumber: 'JC-1',
            holderName: 'Citizen',
            tier: 'SILVER',
            discountPct: 25,
            validUntil: '2030-01-01T00:00:00.000Z',
            issuedAt: '2026-01-01T00:00:00.000Z',
          },
          meta: {},
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            payload: 'sjc:v1:JC-1:SILVER:1:abc',
            expiresAt: '2030-01-01T00:05:00.000Z',
          },
          meta: {},
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const card = await getJudicialCard();
    const qr = await getCardQr();

    expect(card.cardNumber).toBe('JC-1');
    expect(card.holderName).toBe('Citizen');
    expect(card.nationalId).toBe('');
    expect(qr.payload.startsWith('sjc:v1:')).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(`${REAL_BASE_URL}/judicial-card`);
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${REAL_BASE_URL}/judicial-card/qr`,
    );
    expect(
      (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
        string,
        string
      >,
    ).toMatchObject({ Authorization: 'Bearer card-jwt' });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('userId');
  });
});

describe('mapJudicialCard', () => {
  it('maps backend DTO into UI model without leaking ownership fields', () => {
    const mapped = mapJudicialCard({
      cardNumber: 'JC-1',
      holderName: 'Citizen',
      tier: 'GOLD',
      discountPct: 40,
      validUntil: '2030-01-01T00:00:00.000Z',
      issuedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(mapped.tierLabel).toBe('ذهبية');
    expect(mapped.brandName).toBe(ar.judicialCard.brandName);
    expect(mapped.nationalId).toBe('');
    expect(mapped).not.toHaveProperty('userId');
  });

  it('maps qr DTO', () => {
    expect(
      mapJudicialCardQr({
        payload: 'sjc:v1:x',
        expiresAt: '2030-01-01T00:00:00.000Z',
      }).payload,
    ).toBe('sjc:v1:x');
  });
});

describe('judicial card error mapping', () => {
  it('maps backend codes to Arabic messages', () => {
    expect(
      getUserFacingJudicialCardError(
        new ApiError('JUDICIAL_CARD_NOT_FOUND', 'x', 404),
      ),
    ).toBe(ar.judicialCard.errors.notFound);
    expect(
      getUserFacingJudicialCardError(
        new ApiError('JUDICIAL_CARD_UPGRADE_UNAVAILABLE', 'x', 503),
      ),
    ).toBe(ar.judicialCard.errors.upgradeUnavailable);
    expect(
      getUserFacingJudicialCardError(
        new ApiError('AUTH_UNAUTHORIZED', 'x', 401),
      ),
    ).toBe(ar.judicialCard.errors.unauthorized);
  });
});
