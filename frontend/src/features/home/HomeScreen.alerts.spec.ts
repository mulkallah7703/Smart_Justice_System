import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { alertsStore } from '../alerts/alertsStore';
import type { BackendAlert } from '../alerts/mapAlert';
import { authStore } from '../auth/authStore';

import HomeScreen from './HomeScreen';

const REAL_BASE_URL = 'http://localhost:3000/api/v1';
const FABRICATED_STRINGS = ['تنبيه استباقي', 'مهلة اعتراض', 'تبقى يومان'];

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const backendAlert = (overrides: Partial<BackendAlert> = {}): BackendAlert => ({
  id: 'alert_1',
  type: 'DEADLINE',
  severity: 'URGENT',
  title: 'موعد تقديم المذكرة',
  body: 'يجب تقديم المذكرة قبل الموعد المحدد.',
  isRead: false,
  triggeredAt: '2030-01-01T10:00:00.000Z',
  createdAt: '2030-01-01T10:00:00.000Z',
  dueAt: null,
  ...overrides,
});

type AlertsReply = BackendAlert[] | 'error' | 'pending';

/** Routes the dashboard's real API calls; only the alerts reply varies per test. */
const stubApi = (alertsReply: AlertsReply) => {
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/alerts')) {
      if (alertsReply === 'pending') {
        return new Promise<Response>(() => undefined);
      }
      if (alertsReply === 'error') {
        return Promise.resolve(
          jsonResponse(
            { error: { code: 'ALERT_FAILED', message: 'x', statusCode: 502 } },
            502,
          ),
        );
      }
      return Promise.resolve(jsonResponse({ data: alertsReply, meta: {} }));
    }
    if (url.endsWith('/cases')) {
      return Promise.resolve(jsonResponse({ data: [], meta: {} }));
    }
    return Promise.resolve(
      jsonResponse(
        { error: { code: 'NOT_FOUND', message: 'x', statusCode: 404 } },
        404,
      ),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('HomeScreen proactive alert banner', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async (): Promise<void> => {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            Routes,
            null,
            createElement(Route, { path: '/', element: createElement(HomeScreen) }),
            createElement(Route, {
              path: '/alerts',
              element: createElement('p', null, 'ALERTS_CENTER'),
            }),
          ),
        ),
      );
    });
    await flush();
  };

  const banner = (): Element | null =>
    container.querySelector('button[class*="banner"]');

  beforeEach(() => {
    vi.stubEnv('VITE_API_MODE', 'real');
    vi.stubEnv('VITE_API_BASE_URL', REAL_BASE_URL);
    authStore.getState().setTokens('user-a-jwt');
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

  it('renders no banner and no fabricated warning for a user with zero alerts', async () => {
    stubApi([]);
    await render();

    expect(banner()).toBeNull();
    for (const text of FABRICATED_STRINGS) {
      expect(container.textContent).not.toContain(text);
    }
    expect(alertsStore.getState().unreadCount).toBe(0);
    expect(container.querySelector('[aria-label="الإشعارات"] [class*="notificationDot"]')).toBeNull();
  });

  it('renders the genuine message for one alert and navigates on click', async () => {
    stubApi([backendAlert()]);
    await render();

    expect(banner()).not.toBeNull();
    expect(banner()?.textContent).toContain('موعد تقديم المذكرة');
    expect(banner()?.textContent).toContain('يجب تقديم المذكرة قبل الموعد المحدد.');
    expect(alertsStore.getState().unreadCount).toBe(1);

    await act(async () => {
      (banner() as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain('ALERTS_CENTER');
  });

  it('keeps an urgent alert visible among multiple genuine alerts', async () => {
    stubApi([
      backendAlert({ id: 'w', severity: 'WARNING', type: 'MISSING_DOC', title: 'مستند ناقص' }),
      backendAlert({ id: 'u', severity: 'URGENT', title: 'مهلة عاجلة' }),
      backendAlert({ id: 'i', severity: 'INFO', type: 'LAW_UPDATE', title: 'تحديث نظامي' }),
    ]);
    await render();

    expect(container.querySelectorAll('button[class*="banner"]')).toHaveLength(1);
    expect(banner()?.textContent).toContain('مهلة عاجلة');
    expect(alertsStore.getState().unreadCount).toBe(3);
  });

  it('shows no fabricated warning while the alerts request is pending', async () => {
    stubApi('pending');
    await render();

    expect(banner()).toBeNull();
    for (const text of FABRICATED_STRINGS) {
      expect(container.textContent).not.toContain(text);
    }
    expect(container.querySelector('nav')).not.toBeNull();
  });

  it('shows no fabricated warning when the alerts request fails', async () => {
    stubApi('error');
    await render();

    expect(banner()).toBeNull();
    for (const text of FABRICATED_STRINGS) {
      expect(container.textContent).not.toContain(text);
    }
    expect(container.querySelector('nav')).not.toBeNull();
  });

  it('does not carry user A alerts over to user B after an account switch', async () => {
    stubApi([backendAlert({ title: 'تنبيه المستخدم أ' })]);
    await render();
    expect(banner()?.textContent).toContain('تنبيه المستخدم أ');
    act(() => root.unmount());

    authStore.getState().clearAuth();
    expect(alertsStore.getState().unreadCount).toBe(0);
    authStore.getState().setTokens('user-b-jwt');

    root = createRoot(container);
    const fetchMock = stubApi([]);
    await render();

    expect(banner()).toBeNull();
    expect(container.textContent).not.toContain('تنبيه المستخدم أ');
    const alertsCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith('/alerts'),
    );
    expect(
      alertsCall?.[1]?.headers as Record<string, string>,
    ).toMatchObject({ Authorization: 'Bearer user-b-jwt' });
  });
});
