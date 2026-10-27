import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AdvisorExperimentalNote from './AdvisorExperimentalNote';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('AdvisorExperimentalNote', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
  });

  const render = async (): Promise<void> => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(AdvisorExperimentalNote));
    });
  };

  it('shows the experimental badge by default', async () => {
    await render();
    expect(container.textContent).toContain('تجريبي');
    expect(container.textContent).toContain('ليست استشارة قانونية');
  });

  it('hides the note when the experimental flag is off', async () => {
    vi.stubEnv('VITE_AI_ADVISOR_EXPERIMENTAL', 'false');
    await render();
    expect(container.textContent ?? '').toBe('');
    vi.unstubAllEnvs();
  });
});
