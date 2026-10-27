import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pollAdvisorJob = vi.fn();

vi.mock('./advisorApi', () => ({
  pollAdvisorJob: (...args: unknown[]) => pollAdvisorJob(...args),
  resetAdvisorJobMock: vi.fn(),
}));

import { useAnalysisJob } from './useAnalysisJob';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Probe = (): null => {
  useAnalysisJob('job-strict');
  return null;
};

describe('useAnalysisJob', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    pollAdvisorJob.mockReset();
    pollAdvisorJob.mockResolvedValue({
      jobId: 'job-strict',
      status: 'PROCESSING',
      progress: 15,
      stageIndex: 0,
      errorCode: null,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it('keeps polling after a StrictMode double effect', async () => {
    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(MemoryRouter, null, createElement(Probe)),
        ),
      );
      await Promise.resolve();
    });

    expect(pollAdvisorJob).toHaveBeenCalled();
    const first = pollAdvisorJob.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(pollAdvisorJob.mock.calls.length).toBeGreaterThan(first);
  });
});
