import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ar } from '../../core/i18n/ar';
import { RequireAuth } from '../../core/router/RequireAuth';
import { authStore } from '../auth/authStore';

import LegalFileScreen from './LegalFileScreen';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const backendCase = {
  id: 'case_own_1',
  caseNumber: 'DEV-CASE-0001',
  type: 'LABOR',
  status: 'ACTIVE',
  authority: 'DEV Court',
  createdAt: '2026-01-01T00:00:00.000Z',
  nextHearing: null,
  nextDeadline: null,
};

const stubCases = (records: unknown[]) => {
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    if (String(input) === `${REAL_BASE_URL}/cases`) {
      return Promise.resolve(
        jsonResponse({
          data: records,
          meta: {
            version: 'v1',
            pagination: { page: 1, limit: 10, total: records.length, totalPages: 1 },
          },
        }),
      );
    }
    return Promise.resolve(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'x', statusCode: 404 } }, 404),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const LocationProbe = (): JSX.Element => {
  const location = useLocation();
  return createElement('output', { 'data-testid': 'location' }, location.pathname);
};

describe('LegalFileScreen — add case or follow-up action', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async (): Promise<void> => {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ['/legal-file'] },
          createElement(LocationProbe),
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: '/legal-file',
              element: createElement(RequireAuth, null, createElement(LegalFileScreen)),
            }),
            createElement(Route, {
              path: '/legal-file/:caseId',
              element: createElement('p', null, 'CASE_DETAIL_SCREEN'),
            }),
            createElement(Route, {
              path: '/login',
              element: createElement('p', null, 'LOGIN_SCREEN'),
            }),
          ),
        ),
      );
    });
    await flush();
  };

  const addButton = (): HTMLButtonElement | undefined =>
    Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes(ar.legalFile.addCase),
    );
  const pathname = (): string =>
    container.querySelector('[data-testid="location"]')?.textContent ?? '';
  const notice = (): Element[] =>
    Array.from(container.querySelectorAll('[role="status"]')).filter((el) =>
      el.textContent?.includes(ar.legalFile.addCaseUnavailable),
    );

  beforeEach(() => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('test-access-token');
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
  });

  it('renders the empty state together with the add action when the user has no cases', async () => {
    stubCases([]);
    await render();

    expect(container.textContent).toContain(ar.legalFile.empty.cases.title);
    expect(container.textContent).toContain(ar.legalFile.empty.cases.body);
    expect(addButton()).toBeDefined();
  });

  it('shows the honest "not available yet" notice on click instead of doing nothing', async () => {
    stubCases([]);
    await render();
    expect(notice()).toHaveLength(0);

    await act(async () => {
      addButton()!.click();
    });

    expect(notice()).toHaveLength(1);
    expect(pathname()).toBe('/legal-file');
  });

  it('never creates a case or calls a write endpoint, even on repeated clicks', async () => {
    const fetchMock = stubCases([]);
    await render();

    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        addButton()!.click();
      });
    }
    await flush();

    expect(notice()).toHaveLength(1);
    expect(container.textContent).toContain(ar.legalFile.empty.cases.title);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined];
    expect(url).toBe(`${REAL_BASE_URL}/cases`);
    expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('is a keyboard-reachable native button that is not disabled or click-blocked', async () => {
    stubCases([]);
    await render();
    const button = addButton()!;

    expect(button.tagName).toBe('BUTTON');
    expect(button.type).toBe('button');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('tabindex')).not.toBe('-1');
    expect(button.querySelector('a, button, input')).toBeNull();
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('keeps existing behaviour: own cases list and open their detail route', async () => {
    const fetchMock = stubCases([backendCase]);
    await render();

    expect(container.textContent).not.toContain(ar.legalFile.empty.cases.title);
    expect(container.textContent).toContain(ar.legalFile.caseTypes.LABOR);
    expect(addButton()).toBeDefined();

    const caseCard = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(ar.legalFile.caseTypes.LABOR),
    )!;
    await act(async () => {
      caseCard.click();
    });
    await flush();

    expect(pathname()).toBe('/legal-file/case_own_1');
    expect(container.textContent).toContain('CASE_DETAIL_SCREEN');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-access-token');
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toMatch(/userId=/);
  });

  it('still requires authentication for the judicial file', async () => {
    const fetchMock = stubCases([]);
    authStore.getState().clearAuth();
    await render();

    expect(pathname()).toBe('/login');
    expect(container.textContent).toContain('LOGIN_SCREEN');
    expect(addButton()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
