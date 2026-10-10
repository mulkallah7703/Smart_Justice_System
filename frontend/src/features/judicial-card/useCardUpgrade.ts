import { useCallback, useEffect, useMemo, useState } from 'react';

import { getUserFacingJudicialCardError } from '../../shared/api/errors';

import {
  getJudicialCard,
  getTierOptions,
  upgradeJudicialCard,
} from './cardApi';

import type { CardTier, TierOption } from './card.types';

const TIER_RANK: Record<CardTier, number> = {
  NORMAL: 0,
  SILVER: 1,
  GOLD: 2,
};

interface UseCardUpgradeResult {
  currentTier: CardTier;
  selectedTier: CardTier;
  setSelectedTier: (tier: CardTier) => void;
  tiers: TierOption[];
  isLoading: boolean;
  isSubmitting: boolean;
  canUpgrade: boolean;
  errorMessage: string | null;
  submitUpgrade: () => Promise<boolean>;
}

export const useCardUpgrade = (): UseCardUpgradeResult => {
  const [currentTier, setCurrentTier] = useState<CardTier>('SILVER');
  const [selectedTier, setSelectedTier] = useState<CardTier>('GOLD');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const card = await getJudicialCard();
        if (active) {
          setCurrentTier(card.tier);
          setSelectedTier('GOLD');
        }
      } catch (error) {
        if (active) {
          setCurrentTier('SILVER');
          setSelectedTier('GOLD');
          setErrorMessage(getUserFacingJudicialCardError(error));
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

  const tiers = useMemo(
    () => getTierOptions(currentTier),
    [currentTier],
  );

  const canUpgrade =
    !isLoading &&
    !isSubmitting &&
    TIER_RANK[selectedTier] > TIER_RANK[currentTier];

  const submitUpgrade = useCallback(async (): Promise<boolean> => {
    if (!canUpgrade) {
      return false;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await upgradeJudicialCard({ tier: selectedTier });
      if (result.success) {
        setCurrentTier(result.tier);
      }
      return result.success;
    } catch (error) {
      setErrorMessage(getUserFacingJudicialCardError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [canUpgrade, selectedTier]);

  return {
    currentTier,
    selectedTier,
    setSelectedTier,
    tiers,
    isLoading,
    isSubmitting,
    canUpgrade,
    errorMessage,
    submitUpgrade,
  };
};
