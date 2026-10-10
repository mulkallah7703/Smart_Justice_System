import { useCallback, useEffect, useMemo, useState } from 'react';

import { getUserFacingKioskError } from '../../shared/api/errors';

import {
  getQuickServices,
  scanKioskIdentity,
  startKioskSession,
} from './kioskApi';

import type {
  KioskAuthMode,
  KioskQuickService,
  KioskQuickServiceId,
  KioskSession,
} from './kiosk.types';

interface UseKioskResult {
  session: KioskSession | null;
  services: KioskQuickService[];
  isReady: boolean;
  isBusy: boolean;
  lastAction: string | null;
  authMode: KioskAuthMode;
  errorMessage: string | null;
  scanQr: () => Promise<void>;
  tapCard: () => Promise<void>;
  runQuickService: (id: KioskQuickServiceId) => void;
  toggleLanguageLabel: () => void;
  languageLabel: string;
}

export const useKiosk = (): UseKioskResult => {
  const [session, setSession] = useState<KioskSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<KioskAuthMode>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [languageLabel, setLanguageLabel] = useState('EN / عربي');

  const services = useMemo(() => getQuickServices(), []);

  useEffect(() => {
    let active = true;

    const boot = async (): Promise<void> => {
      setErrorMessage(null);
      try {
        const next = await startKioskSession();
        if (active) {
          setSession(next);
          setIsReady(true);
        }
      } catch (error) {
        if (active) {
          setIsReady(false);
          setErrorMessage(getUserFacingKioskError(error));
        }
      }
    };

    void boot();

    return () => {
      active = false;
    };
  }, []);

  const scanQr = useCallback(async (): Promise<void> => {
    if (!session || isBusy) {
      return;
    }

    setIsBusy(true);
    setAuthMode('qr');
    setErrorMessage(null);
    try {
      const result = await scanKioskIdentity({
        sessionId: session.sessionId,
        mode: 'qr',
      });
      setLastAction(result.success ? 'qr' : null);
    } catch (error) {
      setErrorMessage(getUserFacingKioskError(error));
      setLastAction(null);
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, session]);

  const tapCard = useCallback(async (): Promise<void> => {
    if (!session || isBusy) {
      return;
    }

    setIsBusy(true);
    setAuthMode('card');
    setErrorMessage(null);
    try {
      const result = await scanKioskIdentity({
        sessionId: session.sessionId,
        mode: 'card',
      });
      setLastAction(result.success ? 'card' : null);
    } catch (error) {
      setErrorMessage(getUserFacingKioskError(error));
      setLastAction(null);
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, session]);

  const runQuickService = useCallback((id: KioskQuickServiceId): void => {
    setLastAction(id);
  }, []);

  const toggleLanguageLabel = useCallback((): void => {
    setLanguageLabel((prev) =>
      prev === 'EN / عربي' ? 'عربي / EN' : 'EN / عربي',
    );
  }, []);

  return {
    session,
    services,
    isReady,
    isBusy,
    lastAction,
    authMode,
    errorMessage,
    scanQr,
    tapCard,
    runQuickService,
    toggleLanguageLabel,
    languageLabel,
  };
};
