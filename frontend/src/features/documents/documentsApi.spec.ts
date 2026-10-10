import { afterEach, describe, expect, it, vi } from 'vitest';

import { ar } from '../../core/i18n/ar';
import { ApiError } from '../../shared/api/errors';
import { authStore } from '../auth/authStore';

import {
  downloadDocument,
  getDocumentById,
  getDocuments,
  resetDocumentsMock,
  uploadDocument,
} from './documentsApi';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const errorResponse = (code: string, status: number): Response =>
  jsonResponse(
    {
      error: {
        code,
        message: 'failed',
        messageAr: 'فشل',
        statusCode: status,
      },
    },
    status,
  );

const backendDocument = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc_1',
  caseId: 'case_1',
  originalName: 'lease.pdf',
  mimeType: 'application/pdf',
  size: 245678,
  status: 'UPLOADED',
  isAnalyzed: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const pdfFile = (name = 'lease.pdf', size = 1024): File => {
  const file = new File(['%PDF-1.4'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('documentsApi (mock mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetDocumentsMock();
    authStore.getState().clearAuth();
  });

  it('starts with no mock documents so the empty state is preserved', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    await expect(getDocuments()).resolves.toEqual([]);
  });

  it('uploads, lists, reads detail, and downloads without any network call', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const created = await uploadDocument({ file: pdfFile(), caseId: 'case-1' });
    expect(created.name).toBe('lease.pdf');
    expect(created.statusLabel).toBe(ar.documents.status.UPLOADED);
    expect(created.isAnalyzed).toBe(false);

    await expect(getDocuments('case-1')).resolves.toHaveLength(1);
    await expect(getDocuments('case-2')).resolves.toHaveLength(0);
    await expect(getDocumentById(created.id)).resolves.toMatchObject({
      id: created.id,
    });

    const download = await downloadDocument(created.id, created.name);
    expect(download.fileName).toBe('lease.pdf');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns DOCUMENT_NOT_FOUND for an unknown mock document', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    await expect(getDocumentById('missing')).rejects.toMatchObject({
      code: 'DOCUMENT_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('documentsApi (real mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetDocumentsMock();
    authStore.getState().clearAuth();
  });

  it('lists documents with the Bearer token and maps the DTO', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('test-access-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: [backendDocument()] }));
    vi.stubGlobal('fetch', fetchMock);

    const documents = await getDocuments();

    expect(fetchMock).toHaveBeenCalledWith(
      `${REAL_BASE_URL}/documents`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      }),
    );
    expect(documents).toHaveLength(1);
    expect(documents[0]?.name).toBe('lease.pdf');
    expect(documents[0]).not.toHaveProperty('storageKey');
    expect(documents[0]).not.toHaveProperty('userId');
  });

  it('scopes the list by caseId without sending a userId', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('test-access-token');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await getDocuments('case_1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${REAL_BASE_URL}/documents?caseId=case_1`);
    expect(JSON.stringify(init)).not.toMatch(/userId/i);
  });

  it('uploads multipart form data with file and caseId', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('test-access-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: backendDocument() }));
    vi.stubGlobal('fetch', fetchMock);

    const created = await uploadDocument({
      file: pdfFile(),
      caseId: 'case_1',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe(`${REAL_BASE_URL}/documents`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(headers['Content-Type']).toBeUndefined();

    const body = init.body as FormData;
    expect(body.get('caseId')).toBe('case_1');
    expect(body.get('file')).toBeInstanceOf(File);
    expect(body.get('userId')).toBeNull();
    expect(created.id).toBe('doc_1');
  });

  it('rejects oversized files before any network request', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('test-access-token');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      uploadDocument({
        file: pdfFile('huge.pdf', 11 * 1024 * 1024),
        caseId: 'case_1',
      }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_FILE_TOO_LARGE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('downloads a blob without parsing it as JSON', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('test-access-token');
    const bytes = new Blob(['%PDF-1.4 binary'], { type: 'application/pdf' });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await downloadDocument('doc_1', 'lease.pdf');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe(`${REAL_BASE_URL}/documents/doc_1/download`);
    expect(headers.Authorization).toBe('Bearer test-access-token');
    expect(result.blob).toBeInstanceOf(Blob);
    expect(await result.blob.text()).toBe('%PDF-1.4 binary');
    expect(result.fileName).toBe('lease.pdf');
  });

  it('maps a 404 download to the shared error system', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('test-access-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(errorResponse('DOCUMENT_NOT_FOUND', 404)),
    );

    await expect(downloadDocument('other-user-doc', 'x.pdf')).rejects.toMatchObject(
      { code: 'DOCUMENT_NOT_FOUND', statusCode: 404 },
    );
  });

  it('clears auth on a 401 from the documents list', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('expired-token');
    vi.stubGlobal('location', { pathname: '/legal-file', assign: vi.fn() });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(errorResponse('AUTH_UNAUTHORIZED', 401)),
    );

    await expect(getDocuments()).rejects.toBeInstanceOf(ApiError);
    expect(authStore.getState().accessToken).toBeNull();
  });

  it('surfaces a safe case-not-found on upload', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('test-access-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(errorResponse('DOCUMENT_CASE_NOT_FOUND', 404)),
    );

    await expect(
      uploadDocument({ file: pdfFile(), caseId: 'other-user-case' }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_CASE_NOT_FOUND', statusCode: 404 });
  });
});
