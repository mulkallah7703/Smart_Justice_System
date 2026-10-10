import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { login, register, verifyNafath } from './authApi';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('authApi', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns a mock token when the API base URL is empty (login)', async () => {
    const result = await login({
      email: 'dev@example.com',
      password: 'password12',
    });
    expect(result.accessToken).toBe('dev-token-dev@example.com');
  });

  it('registers locally in mock mode without network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await register({
      name: 'Sara',
      email: 'Sara@Example.com',
      password: 'password12',
    });

    expect(result).toEqual({
      id: 'dev-Sara@Example.com',
      name: 'Sara',
      email: 'sara@example.com',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps future Nafath helper available in mock mode', async () => {
    const result = await verifyNafath({
      nationalId: '1999999991',
      nafathCode: 72,
    });
    expect(result.accessToken).toBe('dev-token-1999999991');
  });

  it('reads accessToken from the backend envelope in real login mode', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: { accessToken: 'jwt-from-backend' },
          meta: { version: 'v1' },
        }),
      ),
    );

    const result = await login({
      email: 'dev@example.com',
      password: 'password12',
    });

    expect(result.accessToken).toBe('jwt-from-backend');
  });

  it('surfaces invalid credentials from login', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'AUTH_INVALID_CREDENTIALS',
              message: 'Invalid email or password',
              messageAr: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
              statusCode: 401,
            },
          },
          401,
        ),
      ),
    );

    await expect(
      login({ email: 'dev@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });
});
