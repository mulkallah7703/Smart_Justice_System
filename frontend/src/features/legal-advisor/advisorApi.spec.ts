import { afterEach, describe, expect, it, vi } from 'vitest';

import { authStore } from '../auth/authStore';

import {
  answerAdvisorQuery,
  pollAdvisorJob,
  resetAdvisorJobMock,
  retrieveAdvisorEvidence,
  startDocumentAnalysis,
} from './advisorApi';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('advisorApi (mock mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetAdvisorJobMock();
    authStore.getState().clearAuth();
  });

  it('analyzes, polls, retrieves, and answers without any network call', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { jobId } = await startDocumentAnalysis(['doc-1']);
    expect(jobId).toMatch(/^job-/);

    resetAdvisorJobMock(jobId);
    const pending = await pollAdvisorJob(jobId);
    expect(pending.status).toBe('PENDING');

    const processing = await pollAdvisorJob(jobId);
    expect(processing.status).toBe('PROCESSING');
    expect(processing.progress).toBe(40);

    await pollAdvisorJob(jobId);
    const done = await pollAdvisorJob(jobId);
    expect(done.status).toBe('DONE');
    expect(done.progress).toBe(100);

    const evidence = await retrieveAdvisorEvidence('ما الالتزام؟');
    expect(evidence.results).toHaveLength(1);

    const answer = await answerAdvisorQuery('ما الالتزام؟');
    expect(answer.insufficientEvidence).toBe(false);
    expect(answer.claims.length).toBeGreaterThan(0);
    expect(answer.claims[0].citations[0].evidenceId).toBe('E1');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns insufficient evidence for the mock marker query', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const answer = await answerAdvisorQuery('insufficient');
    expect(answer.insufficientEvidence).toBe(true);
    expect(answer.claims).toEqual([]);
  });
});

describe('advisorApi (real mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetAdvisorJobMock();
    authStore.getState().clearAuth();
  });

  it('posts documentIds only to analyze and uses the shared JWT header', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('advisor-jwt');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { jobId: 'job_1' }, meta: {} }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await startDocumentAnalysis(['doc_a', 'doc_b']);

    expect(result).toEqual({ jobId: 'job_1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${REAL_BASE_URL}/ai/advisor/analyze`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer advisor-jwt',
    );
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toEqual({ documentIds: ['doc_a', 'doc_b'] });
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('nationalId');
    expect(body).not.toHaveProperty('storageKey');
    expect(body).not.toHaveProperty('jwt');
    expect(JSON.stringify(body)).not.toContain('advisor-jwt');
  });

  it('polls GET /ai/advisor/jobs/:jobId', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('advisor-jwt');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          jobId: 'job_1',
          type: 'DOCUMENT_ANALYSIS',
          status: 'PROCESSING',
          progress: 40,
          stageIndex: 1,
          errorCode: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          startedAt: '2026-01-01T00:00:01.000Z',
          completedAt: null,
          result: null,
        },
        meta: {},
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const poll = await pollAdvisorJob('job_1');
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${REAL_BASE_URL}/ai/advisor/jobs/job_1`,
    );
    expect(poll).toMatchObject({
      status: 'PROCESSING',
      progress: 40,
      stageIndex: 1,
    });
  });

  it('posts query only for retrieve and answer', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('advisor-jwt');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            query: 'obligation?',
            results: [],
            retrieval: {
              collection: 'legal_chunks_v1',
              embeddingModel: 'text-embedding-3-small',
              embeddingDimensions: 1536,
              limit: 5,
              returned: 0,
              droppedCount: 0,
            },
          },
          meta: {},
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            answer: 'Based on the documents.',
            claims: [
              {
                text: 'Claim text',
                citations: [
                  {
                    evidenceId: 'E1',
                    documentId: 'doc_1',
                    documentName: 'lease.pdf',
                    pageNumber: 2,
                    chunkId: 'chunk_1',
                    startOffset: 0,
                    endOffset: 10,
                  },
                ],
              },
            ],
            insufficientEvidence: false,
            model: 'gpt-4o-mini',
          },
          meta: {},
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await retrieveAdvisorEvidence('obligation?');
    const answer = await answerAdvisorQuery('obligation?');

    const retrieveBody = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    ) as Record<string, unknown>;
    const answerBody = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body),
    ) as Record<string, unknown>;

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${REAL_BASE_URL}/ai/advisor/retrieve`,
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${REAL_BASE_URL}/ai/advisor/answer`,
    );
    expect(retrieveBody).toEqual({ query: 'obligation?' });
    expect(answerBody).toEqual({ query: 'obligation?' });
    expect(retrieveBody).not.toHaveProperty('userId');
    expect(retrieveBody).not.toHaveProperty('collection');
    expect(answerBody).not.toHaveProperty('nationalId');
    expect(answerBody).not.toHaveProperty('storageKey');
    expect(answer.claims[0].citations[0]).toMatchObject({
      evidenceId: 'E1',
      documentName: 'lease.pdf',
      pageNumber: 2,
    });
  });

  it('sends caseId and documentIds when the question is case-scoped', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('advisor-jwt');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          answer: 'حضانة الأب',
          claims: [],
          insufficientEvidence: false,
          model: 'gpt-4o-mini',
        },
        meta: {},
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await answerAdvisorQuery('لمن الحضانة؟', {
      caseId: 'case-custody',
      documentIds: ['doc-custody'],
    });
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({
      query: 'لمن الحضانة؟',
      caseId: 'case-custody',
      documentIds: ['doc-custody'],
    });
  });
});
