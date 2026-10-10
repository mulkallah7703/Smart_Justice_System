import { afterEach, describe, expect, it, vi } from 'vitest';

import { getUserProfile } from './profileApi';

describe('profileApi', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns mock profile data when the API is unset', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const profile = await getUserProfile();
    expect(profile.name).toEqual(expect.any(String));
    expect(profile.cardNumber).toEqual(expect.any(String));
    expect(profile).not.toHaveProperty('nationalId');
  });

  it('maps GET /users/me in real mode', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              id: 'user_1',
              name: 'Citizen',
              role: 'CITIZEN',
              card: {
                cardNumber: 'JC-2026-ABC123',
                tier: 'NORMAL',
                discountPct: 0,
              },
            },
            meta: { version: 'v1' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const profile = await getUserProfile();
    expect(profile).toEqual({
      name: 'Citizen',
      cardLabel: 'بطاقة عدلية',
      cardNumber: 'JC-2026-ABC123',
    });
  });
});
