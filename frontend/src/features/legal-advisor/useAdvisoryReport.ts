import { useEffect, useState } from 'react';

import { ar } from '../../core/i18n/ar';
import { isDomainLive } from '../../shared/api/mode';

import { fetchAdvisorJobOutput } from './advisorApi';
import { mapAnswerToReport } from './mapAdvisor';
import {
  loadAdvisorAnswer,
  loadAdvisorSummary,
  saveAdvisorSummary,
} from './advisorSession';

import type { AdvisoryReportData } from './advisor.types';

interface UseAdvisoryReportResult {
  report: AdvisoryReportData | null;
  isLoading: boolean;
}

const mockAdvisoryReport = (jobId: string): AdvisoryReportData => ({
  jobId,
  brandTitle: ar.advisor.report.brandTitle,
  brandSubtitle: ar.advisor.report.brandSubtitle,
  reference: ar.advisor.report.reference,
  dateHijri: ar.advisor.report.dateHijri,
  watermark: ar.advisor.report.watermark,
  sections: [
    {
      id: 'subject',
      title: ar.advisor.report.sections.subject.title,
      body: ar.advisor.report.sections.subject.body,
    },
    {
      id: 'basis',
      title: ar.advisor.report.sections.basis.title,
      body: ar.advisor.report.sections.basis.body,
    },
    {
      id: 'opinion',
      title: ar.advisor.report.sections.opinion.title,
      body: ar.advisor.report.sections.opinion.body,
    },
  ],
  disclaimer: ar.advisor.report.disclaimer,
});

const emptyAnswer = {
  answer: '',
  claims: [],
  insufficientEvidence: false,
};

export const useAdvisoryReport = (
  jobId: string,
): UseAdvisoryReportResult => {
  const live = isDomainLive('advisor');
  const [report, setReport] = useState<AdvisoryReportData | null>(null);
  const [isLoading, setIsLoading] = useState(live);

  useEffect(() => {
    let cancelled = false;
    const stored = loadAdvisorAnswer(jobId);
    const cachedSummary = loadAdvisorSummary(jobId);

    if (!live) {
      setReport(
        stored
          ? mapAnswerToReport(jobId, stored, cachedSummary)
          : mockAdvisoryReport(jobId || 'demo'),
      );
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    void (async () => {
      let summary = cachedSummary;
      if (!summary && jobId) {
        try {
          summary = await fetchAdvisorJobOutput(jobId);
          if (summary) {
            saveAdvisorSummary(jobId, summary);
          }
        } catch {
          summary = null;
        }
      }
      if (cancelled) {
        return;
      }
      if (!stored && !summary) {
        setReport(null);
      } else {
        setReport(mapAnswerToReport(jobId, stored ?? emptyAnswer, summary));
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, live]);

  return {
    report,
    isLoading,
  };
};
