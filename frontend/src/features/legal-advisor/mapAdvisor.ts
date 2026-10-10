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

export const mapAnswerToReport = (
  jobId: string,
  answer: AdvisorAnswerView,
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

  const sections = answer.insufficientEvidence
    ? [
        {
          id: 'insufficient',
          title: ar.advisor.opinion.insufficientTitle,
          body: ar.advisor.opinion.insufficientBody,
        },
      ]
    : [
        {
          id: 'answer',
          title: ar.advisor.opinion.answerTitle,
          body: answer.answer,
        },
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
    dateHijri: ar.advisor.report.dateHijri,
    watermark: ar.advisor.report.watermark,
    sections,
    disclaimer: ar.advisor.report.disclaimer,
  };
};
