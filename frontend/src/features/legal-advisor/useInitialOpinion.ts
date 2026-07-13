import { useEffect, useState } from 'react';

import { fetchInitialOpinion } from './advisorApi';

import type { InitialOpinionData } from './advisor.types';

interface UseInitialOpinionResult {
  opinion: InitialOpinionData | null;
  isLoading: boolean;
}

export const useInitialOpinion = (
  jobId: string,
): UseInitialOpinionResult => {
  const [opinion, setOpinion] = useState<InitialOpinionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await fetchInitialOpinion(jobId || 'demo');
        if (!cancelled) {
          setOpinion(data);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return { opinion, isLoading };
};
