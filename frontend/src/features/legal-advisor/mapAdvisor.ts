import { ar } from '../../core/i18n/ar';

import type {
  AdvisorAnswerView,
  AdvisorClaimView,
  AdvisorCitationView,
  AdvisoryReportData,
  BackendAnswerClaim,
  BackendAnswerCitation,
  BackendAnswerResponse,
  BackendAiJobStatus,
  AdvisorJobPoll,
  OpinionFinding,
} from './advisor.types';

export const mapAdvisorJobPoll = (
  record: BackendAiJobStatus,
): AdvisorJobPoll => ({
  jobId: record.jobId,
  status: record.status,
  progress: record.progress,
  stageIndex: record.stageIndex,
  errorCode: record.errorCode,
});

const mapCitation = (
  citation: BackendAnswerCitation,
): AdvisorCitationView => ({
  evidenceId: citation.evidenceId,
  documentName: citation.documentName,
  pageNumber: citation.pageNumber,
});

const mapClaim = (
  claim: BackendAnswerClaim,
  index: number,
): AdvisorClaimView => ({
  id: `claim-${index}`,
  text: claim.text,
  citations: claim.citations.map(mapCitation),
});

export const mapAdvisorAnswer = (
  record: BackendAnswerResponse,
): AdvisorAnswerView => ({
  answer: record.answer,
  claims: record.claims.map(mapClaim),
  insufficientEvidence: record.insufficientEvidence,
});

export const mapClaimsToFindings = (
  claims: AdvisorClaimView[],
): OpinionFinding[] =>
  claims.map((claim, index) => {
    const citationLabel = claim.citations
      .map((citation) =>
        ar.advisor.opinion.citationLabel
          .replace('{evidenceId}', citation.evidenceId)
          .replace('{documentName}', citation.documentName)
          .replace('{page}', String(citation.pageNumber)),
      )
      .join(' · ');

    return {
      id: claim.id,
      tone: index === 0 ? 'success' : index === 1 ? 'warning' : 'info',
      title: claim.text,
      subtitle: citationLabel || ar.advisor.opinion.claimNoCitation,
      icon: index === 0 ? 'check_circle' : index === 1 ? 'warning' : 'lightbulb',
    };
  });

const HIJRI_IN_TEXT =
  /(\d{1,2}|[٠-٩]{1,2})\s+(?:محرم|صفر|ربيع الأول|ربيع الآخر|ربيع الثاني|جمادى الأولى|جمادى الآخرة|رجب|شعبان|رمضان|شوال|ذو القعدة|ذو الحجة)\s+(\d{3,4}|[٠-٩]{3,4})/u;

/** Hijri date written in the analysis, otherwise today's Umm al-Qura date. */
export const reportHijriDate = (text: string, now = new Date()): string => {
  const found = text.match(HIJRI_IN_TEXT);
  if (found) {
    return found[0];
  }
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
};

export const mapAnswerToReport = (
  jobId: string,
  answer: AdvisorAnswerView,
  summary?: string | null,
): AdvisoryReportData => {
  const citationLines = answer.claims
    .flatMap((claim) =>
      claim.citations.map((citation) =>
        ar.advisor.opinion.citationLabel
          .replace('{evidenceId}', citation.evidenceId)
          .replace('{documentName}', citation.documentName)
          .replace('{page}', String(citation.pageNumber)),
      ),
    )
    .filter((line, index, all) => all.indexOf(line) === index);

  const summarySection = summary?.trim()
    ? [
        {
          id: 'summary',
          title: ar.advisor.report.summaryTitle,
          body: summary.trim(),
        },
      ]
    : [];

  const sections = answer.insufficientEvidence
    ? [
        ...summarySection,
        {
          id: 'insufficient',
          title: ar.advisor.opinion.insufficientTitle,
          body: ar.advisor.opinion.insufficientBody,
        },
      ]
    : [
        ...summarySection,
        ...(answer.answer.trim()
          ? [
              {
                id: 'answer',
                title: ar.advisor.opinion.answerTitle,
                body: answer.answer,
              },
            ]
          : []),
        ...(answer.claims.length > 0
          ? [
              {
                id: 'claims',
                title: ar.advisor.opinion.claimsTitle,
                body: answer.claims.map((claim) => claim.text).join('\n\n'),
              },
            ]
          : []),
        ...(citationLines.length > 0
          ? [
              {
                id: 'citations',
                title: ar.advisor.opinion.citationsTitle,
                body: citationLines.join('\n'),
              },
            ]
          : []),
      ];

  return {
    jobId,
    brandTitle: ar.advisor.report.brandTitle,
    brandSubtitle: ar.advisor.report.brandSubtitle,
    reference: jobId,
    dateHijri: reportHijriDate(`${summary ?? ''}\n${answer.answer}`),
    watermark: ar.advisor.report.watermark,
    sections,
    disclaimer: ar.advisor.report.disclaimer,
  };
};
