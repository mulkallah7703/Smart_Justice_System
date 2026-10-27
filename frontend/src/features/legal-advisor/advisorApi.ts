import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';
import { apiRequest } from '../../shared/api/httpClient';
import { isMockApiMode } from '../../shared/api/mode';

import { mapAdvisorAnswer, mapAdvisorJobPoll } from './mapAdvisor';

import type {
  AdvisorAnswerView,
  AdvisorJobPoll,
  AnalyzeResponse,
  BackendAiJobStatus,
  BackendAnswerResponse,
  BackendRetrieveResponse,
} from './advisor.types';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const mockJobState = new Map<string, number>();

export const resetAdvisorJobMock = (jobId?: string): void => {
  if (jobId) {
    mockJobState.delete(jobId);
    return;
  }
  mockJobState.clear();
};

export const startDocumentAnalysis = async (
  documentIds: string[],
): Promise<AnalyzeResponse> => {
  if (isMockApiMode()) {
    await wait(400);
    return { jobId: `job-${Date.now()}` };
  }

  return apiRequest<AnalyzeResponse>(endpoints.advisor.analyze, {
    method: 'POST',
    body: { documentIds },
  });
};

export const pollAdvisorJob = async (
  jobId: string,
): Promise<AdvisorJobPoll> => {
  if (isMockApiMode()) {
    await wait(200);
    const tick = (mockJobState.get(jobId) ?? 0) + 1;
    mockJobState.set(jobId, tick);

    if (tick === 1) {
      return {
        jobId,
        status: 'PENDING',
        progress: 0,
        stageIndex: 0,
        errorCode: null,
      };
    }
    if (tick === 2) {
      return {
        jobId,
        status: 'PROCESSING',
        progress: 40,
        stageIndex: 1,
        errorCode: null,
      };
    }
    if (tick === 3) {
      return {
        jobId,
        status: 'PROCESSING',
        progress: 70,
        stageIndex: 2,
        errorCode: null,
      };
    }
    return {
      jobId,
      status: 'DONE',
      progress: 100,
      stageIndex: 2,
      errorCode: null,
    };
  }

  const record = await apiRequest<BackendAiJobStatus>(
    endpoints.advisor.jobs(jobId),
  );
  return mapAdvisorJobPoll(record);
};

/** Analysis summary stored on a finished job (`result.output`). */
export const fetchAdvisorJobOutput = async (
  jobId: string,
): Promise<string | null> => {
  if (isMockApiMode()) {
    return null;
  }
  const record = await apiRequest<BackendAiJobStatus>(
    endpoints.advisor.jobs(jobId),
  );
  if (!record.result || typeof record.result !== 'object') {
    return null;
  }
  const output = (record.result as { output?: unknown }).output;
  return typeof output === 'string' && output.trim().length > 0
    ? output.trim()
    : null;
};

export const retrieveAdvisorEvidence = async (
  query: string,
  scope?: { caseId?: string; documentIds?: string[] },
): Promise<BackendRetrieveResponse> => {
  if (isMockApiMode()) {
    await wait(250);
    return {
      query,
      results: [
        {
          score: 0.91,
          text: ar.advisor.opinion.mockEvidence,
          provenance: {
            documentId: 'doc-mock-pdf',
            documentName: ar.advisor.upload.mock.pdfName,
            documentPageId: 'page-1',
            documentChunkId: 'chunk-1',
            pageNumber: 1,
            chunkIndex: 0,
            startOffset: 0,
            endOffset: 40,
            pipelineVersion: 2,
            embeddingModel: 'mock',
            extractionMethod: 'TEXT_LAYER',
            trust: 'TRUSTED',
          },
        },
      ],
      retrieval: {
        collection: 'mock',
        embeddingModel: 'mock',
        embeddingDimensions: 8,
        limit: 5,
        returned: 1,
        droppedCount: 0,
      },
    };
  }

  return apiRequest<BackendRetrieveResponse>(endpoints.advisor.retrieve, {
    method: 'POST',
    body: {
      query,
      ...(scope?.caseId ? { caseId: scope.caseId } : {}),
      ...(scope?.documentIds && scope.documentIds.length > 0
        ? { documentIds: scope.documentIds }
        : {}),
    },
  });
};

export const answerAdvisorQuery = async (
  query: string,
  scope?: { caseId?: string; documentIds?: string[] },
): Promise<AdvisorAnswerView> => {
  if (isMockApiMode()) {
    await wait(300);
    if (query.includes('insufficient') || query.includes('€Ì— ﬂ«›')) {
      return mapAdvisorAnswer({
        answer: ar.advisor.opinion.insufficientBody,
        claims: [],
        insufficientEvidence: true,
        model: 'mock',
      });
    }

    return mapAdvisorAnswer({
      answer: ar.advisor.opinion.summaryBody,
      claims: [
        {
          text: ar.advisor.opinion.findings.documented.title,
          citations: [
            {
              evidenceId: 'E1',
              documentId: 'doc-mock-pdf',
              documentName: ar.advisor.upload.mock.pdfName,
              pageNumber: 1,
              chunkId: 'chunk-1',
              startOffset: 0,
              endOffset: 20,
            },
          ],
        },
        {
          text: ar.advisor.opinion.findings.penalty.title,
          citations: [
            {
              evidenceId: 'E1',
              documentId: 'doc-mock-pdf',
              documentName: ar.advisor.upload.mock.pdfName,
              pageNumber: 2,
              chunkId: 'chunk-1',
              startOffset: 0,
              endOffset: 20,
            },
          ],
        },
        {
          text: ar.advisor.opinion.findings.demand.title,
          citations: [
            {
              evidenceId: 'E1',
              documentId: 'doc-mock-pdf',
              documentName: ar.advisor.upload.mock.pdfName,
              pageNumber: 3,
              chunkId: 'chunk-1',
              startOffset: 0,
              endOffset: 20,
            },
          ],
        },
      ],
      insufficientEvidence: false,
      model: 'mock',
    });
  }

  const record = await apiRequest<BackendAnswerResponse>(
    endpoints.advisor.answer,
    {
      method: 'POST',
      body: {
        query,
        ...(scope?.caseId ? { caseId: scope.caseId } : {}),
        ...(scope?.documentIds && scope.documentIds.length > 0
          ? { documentIds: scope.documentIds }
          : {}),
      },
      timeoutMs: 60_000,
    },
  );
  return mapAdvisorAnswer(record);
};
