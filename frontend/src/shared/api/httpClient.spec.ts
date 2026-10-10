import { afterEach, describe, expect, it, vi } from 'vitest';

import { authStore } from '../../features/auth/authStore';
import { ApiError } from './errors';
import { apiRequest, apiRequestBlob } from './httpClient';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('httpClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
  });

  it('throws when the base URL is missing in real mode', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', '');
    await expect(apiRequest('/users/me')).rejects.toMatchObject({
      code: 'API_UNAVAILABLE',
    });
  });

  it('parses the success envelope data', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ data: { ok: true }, meta: { version: 'v1' } }),
      ),
    );

    await expect(apiRequest<{ ok: boolean }>('/health')).resolves.toEqual({
      ok: true,
    });
  });

  it('attaches the Bearer token for authenticated requests', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    authStore.getState().setTokens('test-access-token');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { id: '1' }, meta: { version: 'v1' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/users/me');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/users/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      }),
    );
  });

  it('does not attach Authorization on public requests', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    authStore.getState().setTokens('test-access-token');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { accessToken: 'x' }, meta: { version: 'v1' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/auth/nafath/verify', {
      method: 'POST',
      body: { nationalId: '1999999991', nafathCode: 72 },
      auth: false,
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('parses backend error envelopes', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'AUTH_NAFATH_VERIFICATION_FAILED',
              message: 'Identity verification failed',
              messageAr: 'فشل التحقق من الهوية',
              statusCode: 401,
            },
          },
          401,
        ),
      ),
    );

    await expect(
      apiRequest('/auth/nafath/verify', { auth: false }),
    ).rejects.toMatchObject({
      code: 'AUTH_NAFATH_VERIFICATION_FAILED',
      statusCode: 401,
    });
  });

  it('clears auth on authenticated 401 responses', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    authStore.getState().setTokens('expired-token');
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/profile', assign });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'AUTH_INVALID_TOKEN',
              message: 'invalid',
              messageAr: 'غير صالح',
              statusCode: 401,
            },
          },
          401,
        ),
      ),
    );

    await expect(apiRequest('/users/me')).rejects.toBeInstanceOf(ApiError);
    expect(authStore.getState().accessToken).toBeNull();
  });

  it('sends FormData without a Content-Type header', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    authStore.getState().setTokens('test-access-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: 'doc_1' } }));
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.append('caseId', 'case_1');

    await apiRequest('/documents', { method: 'POST', body: formData });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(init.body).toBe(formData);
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer test-access-token');
  });

  it('returns a Blob for binary requests and attaches the token', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    authStore.getState().setTokens('test-access-token');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const blob = await apiRequestBlob('/documents/doc_1/download');

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toBe('%PDF-1.4');
    expect(headers.Authorization).toBe('Bearer test-access-token');
  });

  it('uses the normal error system for failed binary requests', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    authStore.getState().setTokens('test-access-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'DOCUMENT_NOT_FOUND',
              message: 'The document was not found',
              messageAr: 'المستند غير موجود',
              statusCode: 404,
            },
          },
          404,
        ),
      ),
    );

    await expect(
      apiRequestBlob('/documents/other/download'),
    ).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND', statusCode: 404 });
  });

  it('clears auth on a 401 binary request', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    authStore.getState().setTokens('expired-token');
    vi.stubGlobal('location', { pathname: '/legal-file', assign: vi.fn() });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'AUTH_UNAUTHORIZED',
              message: 'unauthorized',
              messageAr: 'يلزم تسجيل الدخول',
              statusCode: 401,
            },
          },
          401,
        ),
      ),
    );

    await expect(
      apiRequestBlob('/documents/doc_1/download'),
    ).rejects.toBeInstanceOf(ApiError);
    expect(authStore.getState().accessToken).toBeNull();
  });
});
