import { useEffect, useState } from 'react';

import { fetchLawyerById } from './lawyersApi';

import type { LawyerProfileData } from './lawyers.types';

interface UseLawyerProfileResult {
  profile: LawyerProfileData | null;
  isLoading: boolean;
  isFavorite: boolean;
  toggleFavorite: () => void;
}

export const useLawyerProfile = (id: string): UseLawyerProfileResult => {
  const [profile, setProfile] = useState<LawyerProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await fetchLawyerById(id || 'lawyer-1');
        if (!cancelled) {
          setProfile(data);
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
    isFavorite,
    toggleFavorite: () => setIsFavorite((current) => !current),
  };
};
