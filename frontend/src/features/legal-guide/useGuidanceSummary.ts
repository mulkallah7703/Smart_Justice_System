import { useEffect, useState } from 'react';

import { getUserFacingGuideError } from '../../shared/api/errors';

import { fetchGuideSummary } from './guideApi';

import type { GuideSummary } from './guide.types';

interface UseGuidanceSummaryResult {
  summary: GuideSummary | null;
  isLoading: boolean;
  errorMessage: string | null;
}

export const useGuidanceSummary = (
  sessionId: string,
): UseGuidanceSummaryResult => {
  const [summary, setSummary] = useState<GuideSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await fetchGuideSummary(sessionId || 'demo');
        if (!cancelled) {
          setSummary(data);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setSummary(null);
          setErrorMessage(getUserFacingGuideError(error));
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

  return { summary, isLoading, errorMessage };
};
