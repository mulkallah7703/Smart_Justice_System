import { describe, expect, it } from 'vitest';

import { ar } from '../../core/i18n/ar';
import { ApiError, getUserFacingAdvisorError } from '../../shared/api/errors';

import {
  clampAdvisorStageIndex,
  decideAdvisorPoll,
} from './advisorPoll';
import { mapAdvisorAnswer, mapAnswerToReport, mapClaimsToFindings } from './mapAdvisor';

describe('advisorPoll', () => {
  it('stops on DONE and FAILED', () => {
    expect(
      decideAdvisorPoll({ status: 'DONE', attempt: 1, maxAttempts: 90 }),
    ).toEqual({ continue: false, terminal: 'DONE' });
    expect(
      decideAdvisorPoll({ status: 'FAILED', attempt: 1, maxAttempts: 90 }),
    ).toEqual({ continue: false, terminal: 'FAILED' });
  });

  it('continues while PENDING/PROCESSING within the attempt budget', () => {
    expect(
      decideAdvisorPoll({ status: 'PENDING', attempt: 1, maxAttempts: 90 }),
    ).toEqual({ continue: true });
    expect(
      decideAdvisorPoll({ status: 'PROCESSING', attempt: 89, maxAttempts: 90 }),
    ).toEqual({ continue: true });
  });

  it('times out when attempts are exhausted', () => {
    expect(
      decideAdvisorPoll({
        status: 'PROCESSING',
        attempt: 90,
        maxAttempts: 90,
      }),
    ).toEqual({ continue: false, terminal: 'TIMEOUT' });
  });

  it('clamps stage indexes into the UI stage count', () => {
    expect(clampAdvisorStageIndex(-1, 3)).toBe(0);
    expect(clampAdvisorStageIndex(1, 3)).toBe(1);
    expect(clampAdvisorStageIndex(9, 3)).toBe(2);
  });
});

describe('mapAdvisor', () => {
  it('maps a successful answer with claims and citations', () => {
    const view = mapAdvisorAnswer({
      answer: 'Answer text',
      claims: [
        {
          text: 'Claim A',
          citations: [
            {
              evidenceId: 'E1',
              documentId: 'doc_1',
              documentName: 'lease.pdf',
              pageNumber: 1,
              chunkId: 'c1',
              startOffset: 0,
              endOffset: 5,
            },
          ],
        },
      ],
      insufficientEvidence: false,
      model: 'mock',
    });

    expect(view.answer).toBe('Answer text');
    expect(view.claims[0].citations[0]).toEqual({
      evidenceId: 'E1',
      documentName: 'lease.pdf',
      pageNumber: 1,
    });

    const findings = mapClaimsToFindings(view.claims);
    expect(findings[0].title).toBe('Claim A');
    expect(findings[0].subtitle).toContain('E1');
    expect(findings[0].subtitle).toContain('lease.pdf');
  });

  it('maps insufficient evidence into a safe report section', () => {
    const view = mapAdvisorAnswer({
      answer: '',
      claims: [],
      insufficientEvidence: true,
      model: 'mock',
    });
    const report = mapAnswerToReport('job_1', view);
    expect(report.sections[0].title).toBe(ar.advisor.opinion.insufficientTitle);
    expect(report.sections[0].body).toBe(ar.advisor.opinion.insufficientBody);
  });
});

describe('advisor error mapping', () => {
  it('maps rate-limit and job failures safely', () => {
    expect(
      getUserFacingAdvisorError(
        new ApiError('AI_RATE_LIMITED', 'x', 429),
      ),
    ).toBe(ar.advisor.errors.rateLimited);
    expect(
      getUserFacingAdvisorError(
        new ApiError('AI_JOB_NOT_FOUND', 'x', 404),
      ),
    ).toBe(ar.advisor.errors.jobNotFound);
    expect(getUserFacingAdvisorError(new Error('boom'))).toBe(
      ar.advisor.errors.generic,
    );
  });
});
