import { useCallback, useState } from 'react';

import { getUserFacingAdvisorError } from '../../shared/api/errors';

import {
  answerAdvisorQuery,
  retrieveAdvisorEvidence,
} from './advisorApi';
import { mapClaimsToFindings } from './mapAdvisor';
import { saveAdvisorAnswer } from './advisorSession';

import type {
  AdvisorAnswerView,
  AdvisorQuestionPhase,
  OpinionFinding,
} from './advisor.types';

interface UseAdvisorQuestionResult {
  query: string;
  setQuery: (value: string) => void;
  phase: AdvisorQuestionPhase;
  answer: AdvisorAnswerView | null;
  findings: OpinionFinding[];
  errorMessage: string | null;
  isBusy: boolean;
  submit: () => Promise<void>;
}

export const useAdvisorQuestion = (
  jobId: string,
): UseAdvisorQuestionResult => {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<AdvisorQuestionPhase>('ready');
  const [answer, setAnswer] = useState<AdvisorAnswerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = phase === 'retrieving' || phase === 'answering';

  const submit = useCallback(async (): Promise<void> => {
    const trimmed = query.trim();
    if (!trimmed || isBusy) {
      return;
    }

    setErrorMessage(null);
    setPhase('retrieving');

    try {
      // Evidence retrieve then answer — answer re-retrieves server-side.
      await retrieveAdvisorEvidence(trimmed);
      setPhase('answering');
      const result = await answerAdvisorQuery(trimmed);
      setAnswer(result);
      saveAdvisorAnswer(jobId, result);
      setPhase('done');
    } catch (error: unknown) {
      setErrorMessage(getUserFacingAdvisorError(error));
      setPhase('error');
    }
  }, [isBusy, jobId, query]);

  const findings =
    answer && !answer.insufficientEvidence
      ? mapClaimsToFindings(answer.claims)
      : [];

  return {
    query,
    setQuery,
    phase,
    answer,
    findings,
    errorMessage,
    isBusy,
    submit,
  };
};
