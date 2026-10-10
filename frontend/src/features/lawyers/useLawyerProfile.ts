import { useEffect, useState } from 'react';

import { getUserFacingLawyerError } from '../../shared/api/errors';

import { fetchLawyerById } from './lawyersApi';

import type { LawyerProfileData } from './lawyers.types';

interface UseLawyerProfileResult {
  profile: LawyerProfileData | null;
  isLoading: boolean;
  errorMessage: string | null;
  isFavorite: boolean;
  toggleFavorite: () => void;
}

export const useLawyerProfile = (id: string): UseLawyerProfileResult => {
  const [profile, setProfile] = useState<LawyerProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await fetchLawyerById(id);
        if (!cancelled) {
          setProfile(data);
        }
      } catch (error) {
        if (!cancelled) {
          setProfile(null);
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
  }, [id]);

  return {
    profile,
    isLoading,
    errorMessage,
    isFavorite,
    toggleFavorite: () => setIsFavorite((current) => !current),
  };
};
