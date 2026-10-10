import { afterEach, describe, expect, it, vi } from 'vitest';

import { ar } from '../../core/i18n/ar';
import { authStore } from '../auth/authStore';
import { ApiError } from '../../shared/api/errors';

import { getLegalCaseById, getLegalCases } from './legalFileApi';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('legalFileApi', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
  });

  it('returns mock cases when the API base URL is empty', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const cases = await getLegalCases();
    expect(cases).toHaveLength(2);
    expect(cases[0]?.id).toBe('case-1');
    expect(cases[0]?.title).toBe(ar.legalFile.cases.rental.title);
    expect(cases[0]).not.toHaveProperty('userId');
  });

  it('returns mock case detail in mock mode', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const detail = await getLegalCaseById('case-1');
    expect(detail.id).toBe('case-1');
    expect(detail.hearings.length).toBeGreaterThan(0);
    expect(detail.deadlines.length).toBeGreaterThan(0);
  });

  it('returns CASE_NOT_FOUND for an unknown mock case', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    await expect(getLegalCaseById('someone-else')).rejects.toMatchObject({
      code: 'CASE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('maps GET /cases in real mode', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    authStore.getState().setTokens('test-access-token');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'case_1',
            caseNumber: 'DEV-CASE-0001',
            type: 'RENTAL',
            status: 'ACTIVE',
            authority: 'DEV Court',
            createdAt: '2026-01-01T00:00:00.000Z',
            nextHearing: null,
            nextDeadline: null,
          },
        ],
        meta: {
          version: 'v1',
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const cases = await getLegalCases();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/cases',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      }),
    );
    expect(cases).toHaveLength(1);
    expect(cases[0]?.id).toBe('case_1');
    expect(cases[0]?.title).toBe(ar.legalFile.caseTypes.RENTAL);
    expect(cases[0]?.status).toBe(ar.legalFile.caseStatus.ACTIVE);
    expect(cases[0]).not.toHaveProperty('type');
  });

  it('maps GET /cases/:id in real mode', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    authStore.getState().setTokens('test-access-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            id: 'case_1',
            caseNumber: 'DEV-CASE-0001',
            type: 'LABOR',
            status: 'APPEALING',
            authority: 'DEV Appeals',
            notes: 'Seed notes',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
            hearings: [
              {
                id: 'h1',
                scheduledAt: '2030-01-15T09:00:00.000Z',
                location: 'Room 1',
                notes: 'Bring ID',
              },
            ],
            deadlines: [
              {
                id: 'd1',
                type: 'APPEAL',
                dueAt: '2030-01-10T21:00:00.000Z',
                label: 'Appeal window',
              },
            ],
          },
          meta: { version: 'v1' },
        }),
      ),
    );

    const detail = await getLegalCaseById('case_1');
    expect(detail.id).toBe('case_1');
    expect(detail.title).toBe(ar.legalFile.caseTypes.LABOR);
    expect(detail.hearings).toHaveLength(1);
    expect(detail.deadlines[0]?.label).toBe('Appeal window');
    expect(detail.hearings[0]).not.toHaveProperty('notes');
  });

  it('surfaces 401 from the shared HTTP client', async () => {
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
              message: 'Authentication is required',
              messageAr: 'يلزم تسجيل الدخول',
              statusCode: 401,
            },
          },
          401,
        ),
      ),
    );

    await expect(getLegalCases()).rejects.toBeInstanceOf(ApiError);
    expect(authStore.getState().accessToken).toBeNull();
  });

  it('surfaces a safe 404 for a missing case', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    authStore.getState().setTokens('test-access-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'CASE_NOT_FOUND',
              message: 'The case was not found',
              messageAr: 'القضية غير موجودة',
              statusCode: 404,
            },
          },
          404,
        ),
      ),
    );

    await expect(getLegalCaseById('other-user-case')).rejects.toMatchObject({
      code: 'CASE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('surfaces validation errors', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    authStore.getState().setTokens('test-access-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              messageAr: 'البيانات المدخلة غير صالحة',
              statusCode: 400,
            },
          },
          400,
        ),
      ),
    );

    await expect(getLegalCases()).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });
});
