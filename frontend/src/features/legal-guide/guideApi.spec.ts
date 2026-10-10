import { afterEach, describe, expect, it, vi } from 'vitest';

import { ar } from '../../core/i18n/ar';
import { ApiError, getUserFacingGuideError } from '../../shared/api/errors';
import { authStore } from '../auth/authStore';

import {
  fetchGuideSummary,
  resetGuideMock,
  sendGuideAnswer,
  startGuideSession,
} from './guideApi';
import { mapGuideAnswer, mapGuideStart, mapGuideSummary } from './mapGuide';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('guideApi (mock mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetGuideMock();
    authStore.getState().clearAuth();
  });

  it('starts, answers through stages, and loads summary without fetch', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const started = await startGuideSession();
    expect(started.sessionId).toMatch(/^guide-/);
    expect(started.reply).toBe(ar.guide.messages.welcome);

    const first = await sendGuideAnswer(started.sessionId, 'إيجار');
    expect(first.stage).toBe('QUESTION');

    const second = await sendGuideAnswer(started.sessionId, 'موثق');
    expect(second.stage).toBe('SUMMARY');

    const summary = await fetchGuideSummary(started.sessionId);
    expect(summary.sessionId).toBe(started.sessionId);
    expect(summary.docs.length).toBeGreaterThan(0);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('guideApi (real mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetGuideMock();
    authStore.getState().clearAuth();
  });

  it('posts start/answer and gets summary with JWT and without userId', async () => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('guide-jwt');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { sessionId: 'sess_1', reply: 'مرحبا' }, meta: {} }, 201),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: { sessionId: 'sess_1', reply: 'سؤال', stage: 'QUESTION' },
          meta: {},
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            sessionId: 'sess_1',
            resultTitle: 't',
            resultBody: 'b',
            caseTypeLabel: 'c',
            caseTypeValue: 'v',
            authorityLabel: 'a',
            authorityValue: 'av',
            durationLabel: 'd',
            durationValue: 'dv',
            durationDays: 60,
            durationUnit: 'يوماً',
            docsTitle: 'docs',
            docs: [{ id: 'd1', label: 'عقد', done: false }],
            stepsTitle: 'steps',
            steps: [{ number: 1, label: 'خطوة' }],
          },
          meta: {},
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const started = await startGuideSession();
    expect(started).toEqual({ sessionId: 'sess_1', reply: 'مرحبا' });

    const answered = await sendGuideAnswer('sess_1', 'مشكلة إيجار');
    expect(answered.stage).toBe('QUESTION');

    const summary = await fetchGuideSummary('sess_1');
    expect(summary.docs[0].label).toBe('عقد');

    expect(fetchMock.mock.calls[0][0]).toBe(`${REAL_BASE_URL}/ai/guide/start`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${REAL_BASE_URL}/ai/guide/answer`);
    expect(fetchMock.mock.calls[2][0]).toBe(
      `${REAL_BASE_URL}/ai/guide/summary/sess_1`,
    );

    const startBody = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    ) as Record<string, unknown>;
    const answerBody = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body),
    ) as Record<string, unknown>;

    expect(startBody).not.toHaveProperty('userId');
    expect(startBody).not.toHaveProperty('nationalId');
    expect(answerBody).toEqual({ sessionId: 'sess_1', answer: 'مشكلة إيجار' });
    expect(answerBody).not.toHaveProperty('userId');
    expect(JSON.stringify(answerBody)).not.toContain('guide-jwt');
    expect(
      (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
        string,
        string
      >,
    ).toMatchObject({ Authorization: 'Bearer guide-jwt' });
  });
});

describe('mapGuide', () => {
  it('maps start, answer stages, and summary', () => {
    expect(mapGuideStart({ sessionId: 's', reply: 'r' })).toEqual({
      sessionId: 's',
      reply: 'r',
    });
    expect(
      mapGuideAnswer({ sessionId: 's', reply: 'r', stage: 'SUMMARY' }).stage,
    ).toBe('SUMMARY');
    expect(
      mapGuideAnswer({ sessionId: 's', reply: 'r', stage: 'CHAT' }).stage,
    ).toBe('CHAT');
    expect(
      mapGuideAnswer({ sessionId: 's', reply: 'r', stage: 'QUESTION' }).stage,
    ).toBe('QUESTION');

    const summary = mapGuideSummary({
      sessionId: 's',
      resultTitle: 't',
      resultBody: 'b',
      caseTypeLabel: 'c',
      caseTypeValue: 'v',
      authorityLabel: 'a',
      authorityValue: 'av',
      durationLabel: 'd',
      durationValue: 'dv',
      durationDays: 0,
      durationUnit: 'يوماً',
      docsTitle: 'docs',
      docs: [],
      stepsTitle: 'steps',
      steps: [],
    });
    expect(summary).not.toHaveProperty('userId');
  });
});

describe('guide error mapping', () => {
  it('maps guide backend codes to Arabic messages', () => {
    expect(
      getUserFacingGuideError(
        new ApiError('AI_GUIDE_SESSION_NOT_FOUND', 'x', 404),
      ),
    ).toBe(ar.guide.errors.sessionNotFound);
    expect(
      getUserFacingGuideError(new ApiError('AI_GUIDE_RATE_LIMITED', 'x', 429)),
    ).toBe(ar.guide.errors.rateLimited);
    expect(
      getUserFacingGuideError(new ApiError('AI_GUIDE_FAILED', 'x', 502)),
    ).toBe(ar.guide.errors.failed);
    expect(
      getUserFacingGuideError(new ApiError('AUTH_UNAUTHORIZED', 'x', 401)),
    ).toBe(ar.guide.errors.unauthorized);
  });
});
