import { useEffect, useMemo, useState } from 'react';

import { fetchLawyers } from './lawyersApi';

import type { Lawyer, LawyerSpecialty } from './lawyers.types';

interface UseLawyersResult {
  lawyers: Lawyer[];
  isLoading: boolean;
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
      try {
        const data = await fetchLawyers({
          q: debouncedSearch,
          specialty,
        });
        if (!cancelled) {
          setLawyers(data);
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
      search,
      setSearch,
      specialty,
      setSpecialty,
    }),
    [lawyers, isLoading, search, specialty],
  );
};
