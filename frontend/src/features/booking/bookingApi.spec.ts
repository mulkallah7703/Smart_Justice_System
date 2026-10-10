import { afterEach, describe, expect, it, vi } from 'vitest';

import { authStore } from '../auth/authStore';

import { bookConsultation, getLawyerAvailability } from './bookingApi';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const availabilityPayload = () => ({
  data: [
    {
      slotId: 'slot_1',
      startAt: '2030-03-01T06:00:00.000Z',
      endAt: '2030-03-01T06:20:00.000Z',
      durationMin: 20,
    },
    {
      slotId: 'slot_1',
      startAt: '2030-03-01T06:20:00.000Z',
      endAt: '2030-03-01T06:40:00.000Z',
      durationMin: 20,
    },
  ],
  meta: {},
});

describe('bookingApi (mock mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('builds mock availability without any network call', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const days = await getLawyerAvailability(
      'lawyer-1',
      new Date('2030-03-01T09:00:00.000Z'),
    );

    expect(days).toHaveLength(4);
    expect(days[0].slots).toHaveLength(3);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns a mock consultation id without any network call', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await bookConsultation({
      lawyerId: 'lawyer-1',
      type: 'INSTANT',
      scheduledAt: '2030-03-01T06:00:00.000Z',
    });

    expect(result.consultationId).toContain('lawyer-1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('bookingApi (real mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
  });

  it('requests availability with an explicit ISO range', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(availabilityPayload()));
    vi.stubGlobal('fetch', fetchSpy);

    const days = await getLawyerAvailability(
      'lawyer_1',
      new Date('2030-02-25T09:00:00.000Z'),
    );

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/lawyers/lawyer_1/availability');
    expect(url.searchParams.get('from')).toBe('2030-02-25T09:00:00.000Z');
    expect(url.searchParams.get('to')).toBe('2030-03-11T09:00:00.000Z');
    expect(days[0].slots.map((slot) => slot.id)).toEqual([
      '2030-03-01T06:00:00.000Z',
      '2030-03-01T06:20:00.000Z',
    ]);
  });

  it('posts the ISO scheduledAt and never a slot or user id', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('jwt-token');
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 'consult_1',
          type: 'INSTANT',
          status: 'PENDING',
          scheduledAt: '2030-03-01T06:00:00.000Z',
          durationMin: 20,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          lawyer: {
            id: 'lawyer_1',
            name: 'DEV Lawyer',
            city: 'Riyadh',
            specialties: ['RENTAL'],
          },
        },
        meta: {},
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await bookConsultation({
      lawyerId: 'lawyer_1',
      type: 'INSTANT',
      scheduledAt: '2030-03-01T06:00:00.000Z',
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${REAL_BASE_URL}/consultations`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-token');
    expect(JSON.parse(init.body as string)).toEqual({
      lawyerId: 'lawyer_1',
      scheduledAt: '2030-03-01T06:00:00.000Z',
      type: 'INSTANT',
    });
    expect(result.consultationId).toBe('consult_1');
  });

  it('propagates a booking conflict as a typed error', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'CONSULTATION_SLOT_UNAVAILABLE',
              message: 'unavailable',
              messageAr: 'غير متاح',
              statusCode: 409,
            },
          },
          409,
        ),
      ),
    );

    await expect(
      bookConsultation({
        lawyerId: 'lawyer_1',
        type: 'INSTANT',
        scheduledAt: '2030-03-01T06:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'CONSULTATION_SLOT_UNAVAILABLE' });
  });
});
