import { useEffect, useState } from 'react';

import { getLegalCases } from './legalFileApi';

import type { LegalCase, LegalFileTabId } from './legalFile.types';

interface UseLegalFileResult {
  activeTab: LegalFileTabId;
  setActiveTab: (tab: LegalFileTabId) => void;
  cases: LegalCase[];
  isLoading: boolean;
  reloadCases: () => void;
}

export const useLegalFile = (): UseLegalFileResult => {
  const [activeTab, setActiveTab] = useState<LegalFileTabId>('cases');
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await getLegalCases();
        if (active) {
          setCases(data);
        }
      } catch {
        if (active) {
          setCases([]);
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
  }, [reloadToken]);

  return {
    activeTab,
    setActiveTab,
    cases,
    isLoading,
    reloadCases: () => setReloadToken((value) => value + 1),
  };
};
