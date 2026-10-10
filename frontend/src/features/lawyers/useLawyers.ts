import { useEffect, useMemo, useState } from 'react';

import { getUserFacingLawyerError } from '../../shared/api/errors';

import { fetchLawyers } from './lawyersApi';

import type { Lawyer, LawyerSpecialty } from './lawyers.types';

interface UseLawyersResult {
  lawyers: Lawyer[];
  isLoading: boolean;
  errorMessage: string | null;
  search: string;
  setSearch: (value: string) => void;
  specialty: LawyerSpecialty;
  setSpecialty: (value: LawyerSpecialty) => void;
}

export const useLawyers = (): UseLawyersResult => {
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [specialty, setSpecialty] = useState<LawyerSpecialty>('RENTAL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await fetchLawyers({
          q: debouncedSearch,
          specialty,
        });
        if (!cancelled) {
          setLawyers(data);
        }
      } catch (error) {
        if (!cancelled) {
          setLawyers([]);
          setErrorMessage(getUserFacingLawyerError(error));
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
  }, [debouncedSearch, specialty]);

  return useMemo(
    () => ({
      lawyers,
      isLoading,
      errorMessage,
      search,
      setSearch,
      specialty,
      setSpecialty,
    }),
    [lawyers, isLoading, errorMessage, search, specialty],
  );
};
