import { useEffect, useState } from 'react';

import { fetchAdvisoryReport } from './advisorApi';

import type { AdvisoryReportData } from './advisor.types';

interface UseAdvisoryReportResult {
  report: AdvisoryReportData | null;
  isLoading: boolean;
}

export const useAdvisoryReport = (
  jobId: string,
): UseAdvisoryReportResult => {
  const [report, setReport] = useState<AdvisoryReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await fetchAdvisoryReport(jobId || 'demo');
        if (!cancelled) {
          setReport(data);
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

  return { report, isLoading };
};
