import { useEffect, useState } from 'react';

import { getUserProfile } from './profileApi';

import type { UserProfile } from './profile.types';

interface UseProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
}

export const useProfile = (): UseProfileResult => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await getUserProfile();
        if (active) {
          setProfile(data);
        }
      } catch {
        if (active) {
          setProfile(null);
        }
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
  }, []);

  return {
    profile,
    isLoading,
  };
};
