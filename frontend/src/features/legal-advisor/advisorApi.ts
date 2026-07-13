import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';

import type {
  AdvisorReportPoll,
  AdvisoryReportData,
  AnalyzeResponse,
  InitialOpinionData,
} from './advisor.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const mockJobState = new Map<string, number>();

export const resetAdvisorJobMock = (jobId: string): void => {
  mockJobState.delete(jobId);
};

const mockOpinion = (jobId: string): InitialOpinionData => ({
  jobId,
  summaryTitle: ar.advisor.opinion.summaryTitle,
  summaryBody: ar.advisor.opinion.summaryBody,
  strengthLabel: ar.advisor.opinion.strengthLabel,
  strengthValue: ar.advisor.opinion.strengthValue,
  strengthScore: 82,
  strengthLevel: 'strong',
  findingsTitle: ar.advisor.opinion.findingsTitle,
  findings: [
    {
      id: 'f1',
      tone: 'success',
      title: ar.advisor.opinion.findings.documented.title,
      subtitle: ar.advisor.opinion.findings.documented.subtitle,
      icon: 'check_circle',
    },
    {
      id: 'f2',
      tone: 'warning',
      title: ar.advisor.opinion.findings.penalty.title,
      subtitle: ar.advisor.opinion.findings.penalty.subtitle,
      icon: 'warning',
    },
    {
      id: 'f3',
      tone: 'info',
      title: ar.advisor.opinion.findings.demand.title,
      subtitle: ar.advisor.opinion.findings.demand.subtitle,
      icon: 'lightbulb',
    },
  ],
  disclaimer: ar.advisor.opinion.disclaimer,
  cta: ar.advisor.opinion.cta,
});

export const uploadDocument = async (
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ documentId: string }> => {
  if (!API_BASE_URL) {
    for (let percent = 10; percent <= 100; percent += 10) {
      await wait(120);
      onProgress?.(percent);
    }
    return { documentId: `doc-${Date.now()}-${file.name}` };
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}${endpoints.advisor.upload}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('DOCUMENT_UPLOAD_FAILED');
  }

  const json = (await response.json()) as { data: { documentId: string } };
  onProgress?.(100);
  return json.data;
};

export const startDocumentAnalysis = async (
  documentIds: string[],
): Promise<AnalyzeResponse> => {
  if (!API_BASE_URL) {
    await wait(400);
    return { jobId: `job-${Date.now()}` };
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.advisor.analyze}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentIds }),
  });

  if (!response.ok) {
    throw new Error('ADVISOR_ANALYZE_FAILED');
  }

  const json = (await response.json()) as { data: AnalyzeResponse };
  return json.data;
};

export const pollAdvisorReport = async (
  jobId: string,
): Promise<AdvisorReportPoll> => {
  if (!API_BASE_URL) {
    await wait(200);
    const tick = (mockJobState.get(jobId) ?? 0) + 1;
    mockJobState.set(jobId, tick);

    if (tick <= 2) {
      return { status: 'PROCESSING', progress: 67, stageIndex: 1 };
    }
    if (tick === 3) {
      return { status: 'PROCESSING', progress: 90, stageIndex: 2 };
    }
    return { status: 'DONE', progress: 100, stageIndex: 2 };
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoints.advisor.report(jobId)}`,
  );

  if (!response.ok) {
    throw new Error('ADVISOR_REPORT_POLL_FAILED');
  }

  const json = (await response.json()) as { data: AdvisorReportPoll };
  return json.data;
};

export const fetchInitialOpinion = async (
  jobId: string,
): Promise<InitialOpinionData> => {
  if (!API_BASE_URL) {
    await wait(250);
    return mockOpinion(jobId || 'demo');
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoints.advisor.opinion(jobId)}`,
  );

  if (!response.ok) {
    throw new Error('ADVISOR_OPINION_FAILED');
  }

  const json = (await response.json()) as { data: InitialOpinionData };
  return json.data;
};

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

export const fetchAdvisoryReport = async (
  jobId: string,
): Promise<AdvisoryReportData> => {
  if (!API_BASE_URL) {
    await wait(300);
    return mockAdvisoryReport(jobId || 'demo');
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoints.advisor.report(jobId)}`,
  );

  if (!response.ok) {
    throw new Error('ADVISOR_REPORT_FAILED');
  }

  const json = (await response.json()) as { data: AdvisoryReportData };
  return json.data;
};

export const downloadAdvisoryReportPdf = async (
  jobId: string,
): Promise<string | null> => {
  if (!API_BASE_URL) {
    await wait(200);
    return null;
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoints.advisor.reportPdf(jobId)}`,
  );

  if (!response.ok) {
    throw new Error('ADVISOR_REPORT_PDF_FAILED');
  }

  const json = (await response.json()) as { data: { url: string } };
  return json.data.url;
};
