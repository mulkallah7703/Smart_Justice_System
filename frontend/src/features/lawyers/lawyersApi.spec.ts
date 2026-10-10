import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../shared/api/errors';
import { authStore } from '../auth/authStore';

import { fetchLawyerById, fetchLawyers } from './lawyersApi';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const backendLawyer = (overrides: Record<string, unknown> = {}) => ({
  id: 'lawyer_1',
  name: 'DEV Lawyer',
  specialties: ['RENTAL'],
  city: 'Riyadh',
  rating: 4.8,
  reviewCount: 12,
  experienceYrs: 10,
  priceFrom: 150,
  isAvailable: true,
  isVerified: true,
  ...overrides,
});

describe('lawyersApi (mock mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns mock lawyers without any network call', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const lawyers = await fetchLawyers();

    expect(lawyers).toHaveLength(3);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('filters mock lawyers by specialty and query', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    const commercial = await fetchLawyers({ specialty: 'COMMERCIAL' });
    expect(commercial).toHaveLength(1);

    const searched = await fetchLawyers({ q: 'نورة' });
    expect(searched).toHaveLength(1);
  });

  it('serves the mock profile offline', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const profile = await fetchLawyerById('lawyer-1');

    expect(profile.id).toBe('lawyer-1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('lawyersApi (real mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
  });

  it('sends the JWT and only the supported filters', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('jwt-token');

    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({ data: [backendLawyer()], meta: {} }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const lawyers = await fetchLawyers({ q: '  سارة  ', specialty: 'RENTAL' });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      `${REAL_BASE_URL}/lawyers?q=${encodeURIComponent('سارة')}&specialty=RENTAL`,
    );
    expect(init.headers.Authorization).toBe('Bearer jwt-token');
    expect(url).not.toContain('orderBy');
    expect(url).not.toContain('page');
    expect(lawyers[0].name).toBe('DEV Lawyer');
    expect(lawyers[0]).not.toHaveProperty('city');
  });

  it('omits empty filters from the query string', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: [], meta: {} }));
    vi.stubGlobal('fetch', fetchSpy);

    await fetchLawyers({ q: '   ', specialty: 'all' });

    expect(fetchSpy.mock.calls[0][0]).toBe(`${REAL_BASE_URL}/lawyers`);
  });

  it('maps the detail response and surfaces backend errors', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: backendLawyer({ licenseNumber: 'DEV-LIC-0001', bio: 'نبذة' }),
          meta: {},
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'LAWYER_NOT_FOUND',
              message: 'not found',
              messageAr: 'غير موجود',
              statusCode: 404,
            },
          },
          404,
        ),
      );
    vi.stubGlobal('fetch', fetchSpy);

    const profile = await fetchLawyerById('lawyer_1');
    expect(profile.bio).toBe('نبذة');
    expect(profile).not.toHaveProperty('licenseNumber');

    await expect(fetchLawyerById('missing')).rejects.toBeInstanceOf(ApiError);
  });
});
