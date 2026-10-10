import { useCallback, useEffect, useRef, useState } from 'react';

import { ar } from '../../core/i18n/ar';
import { getUserFacingPaymentError } from '../../shared/api/errors';

import { getPaymentById, getPaymentSummary, initiatePayment } from './paymentApi';
import {
  attemptScope,
  resolveAttemptKey,
  waitForSettlement,
} from './paymentSettlement';

import type { PaymentAttempt } from './paymentSettlement';
import type {
  PaymentMethodId,
  PaymentStatus,
  PaymentSummaryData,
} from './payment.types';

interface UsePaymentResult {
  summary: PaymentSummaryData | null;
  isLoading: boolean;
  selectedMethod: PaymentMethodId;
  setSelectedMethod: (method: PaymentMethodId) => void;
  isPaying: boolean;
  canPay: boolean;
  status: PaymentStatus | null;
  statusMessage: string | null;
  errorMessage: string | null;
  canRetry: boolean;
  pay: () => Promise<boolean>;
  retry: () => void;
}

export const usePayment = (consultationId: string): UsePaymentResult => {
  const [summary, setSummary] = useState<PaymentSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethodId>('APPLE_PAY');
  const [isPaying, setIsPaying] = useState(false);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const mountedRef = useRef(true);
  /**
   * A logical payment attempt is identified by the consultation, the chosen
   * method, and the retry sequence. Re-sending the very same request reuses the
   * key so the backend collapses it onto one payment; changing the consultation
   * or method makes it a materially different request, which must not reuse a
   * key or the backend would reject it as an idempotency conflict.
   */
  const attemptRef = useRef<PaymentAttempt | null>(null);
  const attemptSeqRef = useRef(0);

  const attemptKeyFor = (scope: string): string => {
    attemptRef.current = resolveAttemptKey(attemptRef.current, scope);
    return attemptRef.current.key;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await getPaymentSummary(consultationId);
        if (active) {
          setSummary(data);
        }
      } catch (error) {
        if (active) {
          setSummary(null);
          setErrorMessage(getUserFacingPaymentError(error));
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
  }, [consultationId, reloadToken]);

  const canPay = Boolean(
    summary && selectedMethod && !isPaying && !isLoading && status === null,
  );
  const canRetry = status === 'FAILED';

  const pollUntilTerminal = useCallback(
    (paymentId: string): Promise<PaymentStatus | null> =>
      waitForSettlement({
        paymentId,
        readPayment: getPaymentById,
        isActive: () => mountedRef.current,
        onStatus: (next) => {
          setStatus(next);
          setStatusMessage(
            next === 'PENDING' ? ar.payment.status.pending : null,
          );
        },
      }),
    [],
  );

  const pay = useCallback(async (): Promise<boolean> => {
    if (!summary || isPaying) {
      return false;
    }

    setIsPaying(true);
    setErrorMessage(null);

    try {
      const payment = await initiatePayment({
        consultationId: summary.consultationId,
        method: selectedMethod,
        idempotencyKey: attemptKeyFor(
          attemptScope(
            summary.consultationId,
            selectedMethod,
            attemptSeqRef.current,
          ),
        ),
      });

      if (!mountedRef.current) {
        return false;
      }

      setStatus(payment.status);
      setStatusMessage(
        payment.status === 'PENDING'
          ? ar.payment.status.pending
          : ar.payment.status.completed,
      );

      // Initiation is not payment. Only a terminal status reported by the
      // backend counts as a completed payment.
      if (payment.status === 'COMPLETED') {
        return true;
      }
      if (payment.status !== 'PENDING') {
        setStatusMessage(null);
        setErrorMessage(ar.payment.status.failed);
        return false;
      }

      const settled = await pollUntilTerminal(payment.id);
      if (!mountedRef.current) {
        return false;
      }

      if (settled === 'COMPLETED') {
        setStatusMessage(ar.payment.status.completed);
        return true;
      }
      if (settled === null) {
        setStatusMessage(ar.payment.status.stillPending);
        return false;
      }

      setStatusMessage(null);
      setErrorMessage(
        settled === 'FAILED'
          ? ar.payment.status.failed
          : ar.payment.status.refunded,
      );
      return false;
    } catch (error) {
      if (mountedRef.current) {
        setStatus(null);
        setStatusMessage(null);
        setErrorMessage(getUserFacingPaymentError(error));
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setIsPaying(false);
      }
    }
  }, [isPaying, pollUntilTerminal, selectedMethod, summary]);

  /**
   * A failed payment frees the consultation for another attempt, which is a new
   * logical payment and therefore needs a fresh key and a fresh authoritative
   * summary.
   */
  const retry = useCallback((): void => {
    attemptSeqRef.current += 1;
    setStatus(null);
    setStatusMessage(null);
    setErrorMessage(null);
    setReloadToken((token) => token + 1);
  }, []);

  return {
    summary,
    isLoading,
    selectedMethod,
    setSelectedMethod,
    isPaying,
    canPay,
    status,
    statusMessage,
    errorMessage,
    canRetry,
    pay,
    retry,
  };
};
