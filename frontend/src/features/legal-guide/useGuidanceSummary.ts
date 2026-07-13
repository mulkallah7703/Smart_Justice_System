import { useEffect, useState } from 'react';

import { fetchGuideSummary } from './guideApi';

import type { GuideSummary } from './guide.types';

interface UseGuidanceSummaryResult {
  summary: GuideSummary | null;
  isLoading: boolean;
}

export const useGuidanceSummary = (
  sessionId: string,
): UseGuidanceSummaryResult => {
  const [summary, setSummary] = useState<GuideSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await fetchGuideSummary(sessionId || 'demo');
        if (!cancelled) {
          setSummary(data);
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
  }, [sessionId]);

  return { summary, isLoading };
};
