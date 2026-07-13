import { useCallback, useEffect, useState } from 'react';

import { getCardQr, getJudicialCard } from './cardApi';

import type { JudicialCardData } from './card.types';

interface UseJudicialCardResult {
  card: JudicialCardData | null;
  isLoading: boolean;
  isFlipped: boolean;
  toggleFlip: () => void;
  showIdentity: () => void;
  qrPayload: string | null;
}

export const useJudicialCard = (): UseJudicialCardResult => {
  const [card, setCard] = useState<JudicialCardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const [cardData, qrData] = await Promise.all([
          getJudicialCard(),
          getCardQr(),
        ]);
        if (active) {
          setCard(cardData);
          setQrPayload(qrData.payload);
        }
      } catch {
        if (active) {
          setCard(null);
          setQrPayload(null);
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
    toggleFlip,
    showIdentity,
    qrPayload,
  };
};
