import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ar } from '../../core/i18n/ar';
import { authStore } from '../auth/authStore';

import indexHtml from '../../../index.html?raw';

import LegalGuideChat from './LegalGuideChat';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';
const STATIC_QUESTIONNAIRE = /منصة «إيجار»|2 من 4|عقد إيجار موثّق/;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const questionTurn = (reply: string, suggestedReplies: string[] = []) => ({
  reply,
  stage: 'QUESTION',
  turn: {
    needsClarification: true,
    clarificationQuestion: reply,
    suggestedReplies,
    urgent: false,
  },
});

const answerTurn = (reply: string) => ({
  reply,
  stage: 'ANSWER',
  turn: {
    needsClarification: false,
    clarificationQuestion: null,
    suggestedReplies: [],
    urgent: false,
  },
});

type AnswerReply = Record<string, unknown> | 'error';

/** Backend stand-in: sessions are numbered; /answer replies are consumed in order. */
const stubApi = (answers: AnswerReply[]) => {
  let sessions = 0;
  const queue = [...answers];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/ai/guide/start')) {
      sessions += 1;
      return Promise.resolve(
        jsonResponse(
          { data: { sessionId: `sess_${sessions}`, reply: 'أهلاً بك' }, meta: {} },
          201,
        ),
      );
    }
    if (url.endsWith('/ai/guide/answer')) {
      const next = queue.shift();
      if (!next || next === 'error') {
        return Promise.resolve(
          jsonResponse(
            { error: { code: 'AI_GUIDE_FAILED', message: 'x', statusCode: 502 } },
            502,
          ),
        );
      }
      const body = JSON.parse(String(init?.body)) as { sessionId: string };
      return Promise.resolve(
        jsonResponse({ data: { sessionId: body.sessionId, ...next }, meta: {} }),
      );
    }
    return Promise.resolve(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'x', statusCode: 404 } }, 404),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const answerBodies = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls
    .filter(([input]) => String(input).endsWith('/ai/guide/answer'))
    .map(([, init]) => JSON.parse(String(init?.body)) as { sessionId: string; answer: string });

const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('LegalGuideChat (real API mode)', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async (path = '/guide'): Promise<void> => {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(
            Routes,
            null,
            createElement(Route, { path: '/guide', element: createElement(LegalGuideChat) }),
            createElement(Route, {
              path: '/guide/question',
              element: createElement(Navigate, { to: '/guide', replace: true }),
            }),
            createElement(Route, {
              path: '/guide/summary/:sessionId',
              element: createElement('p', null, 'SUMMARY_SCREEN'),
            }),
          ),
        ),
      );
    });
    await flush();
  };

  const bubbles = (): string[] =>
    Array.from(container.querySelectorAll('[class*="bubble"] p')).map(
      (p) => p.textContent ?? '',
    );
  const chips = (): HTMLButtonElement[] =>
    Array.from(container.querySelectorAll('[aria-label="ردود سريعة"] button'));
  const errorBanner = (): Element | null => container.querySelector('[role="alert"]');

  const send = async (text: string): Promise<void> => {
    const input = container.querySelector('form input') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();
  };

  const click = async (el: HTMLElement): Promise<void> => {
    await act(async () => {
      el.click();
    });
    await flush();
  };

  beforeEach(() => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('guide-jwt');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    authStore.getState().clearAuth();
    sessionStorage.clear();
  });

  it('shows the model question in the chat with its own replies — no static questionnaire', async () => {
    const fetchMock = stubApi([
      questionTurn('هل وصلك إشعار رسمي بإنهاء العقد، وما نوع عقدك؟', [
        'محدد المدة',
        'غير محدد المدة',
      ]),
    ]);
    await render();
    await send('تم فصلي من العمل بدون سبب.');

    expect(bubbles()).toEqual([
      'أهلاً بك',
      'تم فصلي من العمل بدون سبب.',
      'هل وصلك إشعار رسمي بإنهاء العقد، وما نوع عقدك؟',
    ]);
    expect(chips().map((c) => c.textContent)).toEqual(['محدد المدة', 'غير محدد المدة']);
    expect(container.textContent).not.toMatch(STATIC_QUESTIONNAIRE);
    expect(container.textContent).not.toContain('SUMMARY_SCREEN');
    expect(answerBodies(fetchMock)).toEqual([
      { sessionId: 'sess_1', answer: 'تم فصلي من العمل بدون سبب.' },
    ]);
  });

  it('answers a direct question immediately and offers the summary', async () => {
    stubApi([answerTurn('الشرط الجزائي اتفاق مسبق على تعويض عند الإخلال بالعقد.')]);
    await render();
    await send('ما المقصود بالشرط الجزائي في العقود؟');

    expect(bubbles().slice(-1)[0]).toBe('الشرط الجزائي اتفاق مسبق على تعويض عند الإخلال بالعقد.');
    expect(chips().map((c) => c.textContent)).toEqual([ar.guide.actions.viewSummary]);

    await click(chips()[0]!);
    expect(container.textContent).toContain('SUMMARY_SCREEN');
  });

  it('sends a chosen reply to the same session and keeps the conversation order', async () => {
    const fetchMock = stubApi([
      questionTurn('هل لديك إثبات للمبلغ؟', ['نعم، تحويل بنكي', 'لا']),
      answerTurn('يمكنك المطالبة بالمبلغ مع تقديم ما يثبته.'),
    ]);
    await render();
    await send('شخص استدان مني مبلغًا ويرفض السداد.');
    await click(chips()[0]!);

    expect(answerBodies(fetchMock)).toEqual([
      { sessionId: 'sess_1', answer: 'شخص استدان مني مبلغًا ويرفض السداد.' },
      { sessionId: 'sess_1', answer: 'نعم، تحويل بنكي' },
    ]);
    expect(bubbles()).toEqual([
      'أهلاً بك',
      'شخص استدان مني مبلغًا ويرفض السداد.',
      'هل لديك إثبات للمبلغ؟',
      'نعم، تحويل بنكي',
      'يمكنك المطالبة بالمبلغ مع تقديم ما يثبته.',
    ]);
  });

  it('on failure shows an error, no invented question, and retries without duplicating', async () => {
    const fetchMock = stubApi(['error', questionTurn('ما موضوع القضية، وما الذي حدث معك؟')]);
    await render();
    await send('أريد أرفع قضية.');

    expect(errorBanner()?.textContent).toBe(ar.guide.errors.failed);
    expect(bubbles()).toEqual(['أهلاً بك', 'أريد أرفع قضية.']);
    expect(chips().map((c) => c.textContent)).toEqual([ar.guide.actions.retry]);

    await click(chips()[0]!);
    expect(errorBanner()).toBeNull();
    expect(bubbles()).toEqual([
      'أهلاً بك',
      'أريد أرفع قضية.',
      'ما موضوع القضية، وما الذي حدث معك؟',
    ]);
    expect(answerBodies(fetchMock)).toEqual([
      { sessionId: 'sess_1', answer: 'أريد أرفع قضية.' },
      { sessionId: 'sess_1', answer: 'أريد أرفع قضية.' },
    ]);
  });

  it('treats a malformed response as an error, never as a fallback question', async () => {
    stubApi([{ reply: 'هل يوجد عقد إيجار موثّق؟', stage: 'SUMMARY' }]);
    await render();
    await send('سؤال');

    expect(errorBanner()?.textContent).toBe(ar.guide.errors.failed);
    expect(bubbles()).toEqual(['أهلاً بك', 'سؤال']);
    expect(container.textContent).not.toContain('عقد إيجار');
  });

  it('a new inquiry starts a new session without earlier messages', async () => {
    const fetchMock = stubApi([
      questionTurn('هل وصلك إشعار رسمي؟'),
      questionTurn('هل لديك إثبات للمبلغ؟'),
    ]);
    await render();
    await send('تم فصلي من العمل بدون سبب.');

    act(() => root.unmount());
    root = createRoot(container);
    await render();
    expect(bubbles()).toEqual(['أهلاً بك']);

    await send('شخص استدان مني مبلغًا ويرفض السداد.');
    expect(answerBodies(fetchMock).slice(-1)[0]).toEqual({
      sessionId: 'sess_2',
      answer: 'شخص استدان مني مبلغًا ويرفض السداد.',
    });
    expect(container.textContent).not.toContain('فصلي');
  });

  it('the old questionnaire route lands in the chat', async () => {
    stubApi([]);
    await render('/guide/question');
    expect(container.querySelector('form input')).not.toBeNull();
    expect(container.textContent).not.toMatch(STATIC_QUESTIONNAIRE);
  });

  it('keeps the document Arabic and right-to-left', () => {
    expect(indexHtml).toMatch(/<html lang="ar" dir="rtl">/);
  });
});
