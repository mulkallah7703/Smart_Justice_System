import { useEffect, useState } from 'react';

import { ApiError } from '../../shared/api/errors';

import { getLegalCaseById } from './legalFileApi';

import type { FrontendCaseDetail } from './cases.types';

interface UseCaseDetailResult {
  detail: FrontendCaseDetail | null;
  isLoading: boolean;
  notFound: boolean;
}

export const useCaseDetail = (caseId: string): UseCaseDetailResult => {
  const [detail, setDetail] = useState<FrontendCaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setNotFound(false);
      setDetail(null);
      try {
        const data = await getLegalCaseById(caseId);
        if (active) {
          setDetail(data);
        }
      } catch (error) {
        if (!active) {
          return;
        }
        setDetail(null);
        setNotFound(
          error instanceof ApiError &&
            (error.code === 'CASE_NOT_FOUND' || error.statusCode === 404),
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [caseId]);

  return { detail, isLoading, notFound };
};
