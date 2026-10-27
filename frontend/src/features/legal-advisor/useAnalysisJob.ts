import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';

import { pollAdvisorJob, resetAdvisorJobMock } from './advisorApi';
import {
  ADVISOR_POLL_BUDGET_MS,
  advisorPollDelayMs,
  clampAdvisorStageIndex,
  decideAdvisorPoll,
} from './advisorPoll';

import type { AnalysisStep, AnalysisStepStatus } from './advisor.types';

interface UseAnalysisJobResult {
  steps: AnalysisStep[];
  progress: number;
  title: string;
  subtitle: string;
}

const stageLabels = [
  ar.advisor.analyzing.steps.extract,
  ar.advisor.analyzing.steps.match,
  ar.advisor.analyzing.steps.report,
];

const buildSteps = (activeIndex: number): AnalysisStep[] =>
  stageLabels.map((label, index) => {
    let status: AnalysisStepStatus = 'pending';
    if (index < activeIndex) status = 'done';
    if (index === activeIndex) status = 'active';
    return {
      id: `stage-${index}`,
      label,
      status,
    };
  });

export const useAnalysisJob = (jobId: string): UseAnalysisJobResult => {
  const navigate = useNavigate();
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!jobId) {
      navigate('/advisor', { replace: true, state: { error: true } });
      return undefined;
    }

    resetAdvisorJobMock(jobId);
    let cancelled = false;
    let attempt = 0;
    let timeoutId = 0;
    let inFlight = false;
    const startedAt = Date.now();

    const failToUpload = (reason?: string): void => {
      navigate('/advisor', {
        replace: true,
        state: { error: reason ?? true },
      });
    };

    const scheduleNext = (): void => {
      timeoutId = window.setTimeout(() => {
        void tick();
      }, advisorPollDelayMs(attempt));
    };

    const tick = async (): Promise<void> => {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;
      attempt += 1;

      try {
        const result = await pollAdvisorJob(jobId);
        if (cancelled) {
          return;
        }

        setProgress(result.progress);
        setStageIndex(
          clampAdvisorStageIndex(result.stageIndex, stageLabels.length),
        );

        const decision = decideAdvisorPoll({
          status: result.status,
          attempt,
          elapsedMs: Date.now() - startedAt,
          budgetMs: ADVISOR_POLL_BUDGET_MS,
        });

        if (decision.terminal === 'DONE') {
          navigate(
            `/advisor/opinion?jobId=${encodeURIComponent(jobId)}`,
            { replace: true },
          );
          return;
        }

        if (decision.terminal === 'FAILED') {
          failToUpload(result.errorCode ?? 'FAILED');
          return;
        }

        if (decision.terminal === 'TIMEOUT') {
          failToUpload('TIMEOUT');
          return;
        }

        scheduleNext();
      } catch {
        if (!cancelled) {
          failToUpload();
        }
      } finally {
        inFlight = false;
      }
    };

    void tick();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [jobId, navigate]);

  const steps = useMemo(() => buildSteps(stageIndex), [stageIndex]);

  return {
    steps,
    progress,
    title: ar.advisor.analyzing.title,
    subtitle: ar.advisor.analyzing.subtitle,
  };
};
