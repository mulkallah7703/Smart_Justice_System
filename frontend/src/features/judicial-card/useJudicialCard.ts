import { useCallback, useEffect, useState } from 'react';

import { getUserFacingJudicialCardError } from '../../shared/api/errors';

import { getCardQr, getJudicialCard } from './cardApi';

import type { JudicialCardData } from './card.types';

interface UseJudicialCardResult {
  card: JudicialCardData | null;
  isLoading: boolean;
  isFlipped: boolean;
  errorMessage: string | null;
  toggleFlip: () => void;
  showIdentity: () => void;
  qrPayload: string | null;
}

export const useJudicialCard = (): UseJudicialCardResult => {
  const [card, setCard] = useState<JudicialCardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [cardData, qrData] = await Promise.all([
          getJudicialCard(),
          getCardQr(),
        ]);
        if (active) {
          setCard({ ...cardData, qrPayload: qrData.payload });
          setQrPayload(qrData.payload);
        }
      } catch (error) {
        if (active) {
          setCard(null);
          setQrPayload(null);
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

  const toggleFlip = useCallback((): void => {
    setIsFlipped((prev) => !prev);
  }, []);

  const showIdentity = useCallback((): void => {
    setIsFlipped(true);
  }, []);

  return {
    card,
    isLoading,
    isFlipped,
    errorMessage,
    toggleFlip,
    showIdentity,
    qrPayload,
  };
};
