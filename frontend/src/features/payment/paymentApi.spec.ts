import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../shared/api/errors';
import { authStore } from '../auth/authStore';

import { getPaymentById, getPaymentSummary, initiatePayment } from './paymentApi';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const summaryPayload = () => ({
  data: {
    consultationId: 'consult-1',
    lawyerName: 'DEV Lawyer',
    consultationType: 'INSTANT',
    scheduledAt: '2030-03-01T10:30:00.000Z',
    original: { amountMinor: 20000, amount: '200.00', currency: 'SAR' },
    discountPct: 25,
    discount: { amountMinor: 5000, amount: '50.00', currency: 'SAR' },
    payable: { amountMinor: 15000, amount: '150.00', currency: 'SAR' },
  },
  meta: {},
});

const initiatedPayload = (status = 'PENDING') => ({
  data: {
    id: 'pay-1',
    status,
    method: 'MADA',
    purpose: 'CONSULTATION',
    consultationId: 'consult-1',
    original: { amountMinor: 20000, amount: '200.00', currency: 'SAR' },
    discountPct: 25,
    payable: { amountMinor: 15000, amount: '150.00', currency: 'SAR' },
    createdAt: '2030-01-01T00:00:00.000Z',
    checkoutRef: 'mock_checkout_pay-1',
  },
  meta: {},
});

const lastRequest = (fetchSpy: ReturnType<typeof vi.fn>) =>
  fetchSpy.mock.calls[0] as [string, RequestInit];

describe('paymentApi (mock mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns the mock summary without any network call', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const summary = await getPaymentSummary('consult-1');

    expect(summary.totalAmount).toBe('112.50');
    expect(summary.discountPct).toBe(25);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps the existing immediate mock payment behaviour', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const payment = await initiatePayment({
      consultationId: 'consult-1',
      method: 'MADA',
    });

    expect(payment.status).toBe('COMPLETED');
    expect(fetchSpy).not.toHaveBeenCalled();

    const detail = await getPaymentById(payment.id);
    expect(detail.status).toBe('COMPLETED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('paymentApi (real mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
  });

  it('reads the authoritative summary from the backend', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(summaryPayload()));
    vi.stubGlobal('fetch', fetchSpy);

    const summary = await getPaymentSummary('consult-1');

    expect(lastRequest(fetchSpy)[0]).toBe(
      `${REAL_BASE_URL}/payments/summary/consult-1`,
    );
    expect(summary.consultationAmount).toBe('200.00');
    expect(summary.discountAmount).toBe('50.00');
    expect(summary.totalAmount).toBe('150.00');
    expect(summary.currency).toBe('SAR');
  });

  it('sends only the consultation and method, plus the idempotency key', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('token-abc');
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse(initiatedPayload(), 201));
    vi.stubGlobal('fetch', fetchSpy);

    await initiatePayment({
      consultationId: 'consult-1',
      method: 'MADA',
      idempotencyKey: 'key-1',
    });

    const [url, init] = lastRequest(fetchSpy);
    const headers = init.headers as Record<string, string>;

    expect(url).toBe(`${REAL_BASE_URL}/payments/initiate`);
    expect(init.method).toBe('POST');
    expect(headers['Idempotency-Key']).toBe('key-1');
    expect(headers.Authorization).toBe('Bearer token-abc');
    expect(JSON.parse(init.body as string)).toEqual({
      consultationId: 'consult-1',
      method: 'MADA',
    });
  });

  it('reports initiation as PENDING rather than paid', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse(initiatedPayload(), 201));
    vi.stubGlobal('fetch', fetchSpy);

    const payment = await initiatePayment({
      consultationId: 'consult-1',
      method: 'MADA',
    });

    expect(payment.status).toBe('PENDING');
    expect(payment.checkoutRef).toBe('mock_checkout_pay-1');
    expect(payment.totalAmount).toBe('150.00');
  });

  it('surfaces the backend error code from the shared envelope', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'PAYMENT_ALREADY_EXISTS',
            message: 'Payment already exists',
            statusCode: 409,
          },
          meta: {},
        },
        409,
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      initiatePayment({ consultationId: 'consult-1', method: 'MADA' }),
    ).rejects.toMatchObject({ code: 'PAYMENT_ALREADY_EXISTS' });
  });

  it('never lets a cache serve a stale amount or status', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(summaryPayload()));
    vi.stubGlobal('fetch', fetchSpy);

    await getPaymentSummary('consult-1');
    expect(
      (lastRequest(fetchSpy)[1].headers as Record<string, string>)[
        'Cache-Control'
      ],
    ).toBe('no-cache');

    fetchSpy.mockClear();
    fetchSpy.mockResolvedValue(jsonResponse(initiatedPayload('COMPLETED')));
    await getPaymentById('pay-1');
    expect(
      (lastRequest(fetchSpy)[1].headers as Record<string, string>)[
        'Cache-Control'
      ],
    ).toBe('no-cache');
  });

  it('reads payment detail by payment id', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse(initiatedPayload('COMPLETED')));
    vi.stubGlobal('fetch', fetchSpy);

    const payment = await getPaymentById('pay-1');

    expect(lastRequest(fetchSpy)[0]).toBe(`${REAL_BASE_URL}/payments/pay-1`);
    expect(payment.status).toBe('COMPLETED');
  });

  it('never calls the webhook endpoint', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse(initiatedPayload(), 201));
    vi.stubGlobal('fetch', fetchSpy);

    await initiatePayment({ consultationId: 'consult-1', method: 'MADA' });
    await getPaymentById('pay-1').catch(() => undefined);

    const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('webhook'))).toBe(false);
  });

  it('rejects an unknown mock payment id with a typed error', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    await expect(getPaymentById('missing')).rejects.toBeInstanceOf(ApiError);
  });
});
