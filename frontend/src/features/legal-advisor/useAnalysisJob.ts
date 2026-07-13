import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';

import { pollAdvisorReport, resetAdvisorJobMock } from './advisorApi';

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
  const [stageIndex, setStageIndex] = useState(1);
  const [progress, setProgress] = useState(67);

  useEffect(() => {
    const activeJobId = jobId || `demo-${Date.now()}`;
    resetAdvisorJobMock(activeJobId);
    let cancelled = false;

    const tick = async (): Promise<void> => {
      try {
        const result = await pollAdvisorReport(activeJobId);
        if (cancelled) {
          return;
        }

        setProgress(result.progress);
        setStageIndex(result.stageIndex);

        if (result.status === 'DONE') {
          navigate('/advisor/opinion', { replace: true });
          return;
        }

        if (result.status === 'FAILED') {
          navigate('/advisor', { replace: true, state: { error: true } });
        }
      } catch {
        if (!cancelled) {
          navigate('/advisor', { replace: true, state: { error: true } });
        }
      }
    };

    void tick();
    const interval = window.setInterval(() => {
      void tick();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
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
