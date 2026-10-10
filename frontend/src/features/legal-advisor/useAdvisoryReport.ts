import { useMemo } from 'react';

import { ar } from '../../core/i18n/ar';

import { mapAnswerToReport } from './mapAdvisor';
import { loadAdvisorAnswer } from './advisorSession';
import { isDomainLive } from '../../shared/api/mode';

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

export const useAdvisoryReport = (
  jobId: string,
): UseAdvisoryReportResult => {
  const report = useMemo(() => {
    const stored = loadAdvisorAnswer(jobId);
    if (stored) {
      return mapAnswerToReport(jobId, stored);
    }
    if (!isDomainLive('advisor')) {
      return mockAdvisoryReport(jobId || 'demo');
    }
    return null;
  }, [jobId]);

  return {
    report,
    isLoading: false,
  };
};
