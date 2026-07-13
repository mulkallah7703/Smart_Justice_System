import { useCallback, useEffect, useState } from 'react';

import { getPaymentSummary, initiatePayment } from './paymentApi';

import type { PaymentMethodId, PaymentSummaryData } from './payment.types';

interface UsePaymentResult {
  summary: PaymentSummaryData | null;
  isLoading: boolean;
  selectedMethod: PaymentMethodId;
  setSelectedMethod: (method: PaymentMethodId) => void;
  isPaying: boolean;
  canPay: boolean;
  pay: () => Promise<boolean>;
}

export const usePayment = (consultationId: string): UsePaymentResult => {
  const [summary, setSummary] = useState<PaymentSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethodId>('APPLE_PAY');
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await getPaymentSummary(consultationId);
        if (active) {
          setSummary(data);
        }
      } catch {
        if (active) {
          setSummary(null);
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
  }, [consultationId]);

  const canPay = Boolean(summary && selectedMethod && !isPaying && !isLoading);

  const pay = useCallback(async (): Promise<boolean> => {
    if (!summary || isPaying) {
      return false;
    }

    setIsPaying(true);
    try {
      const result = await initiatePayment({
        consultationId: summary.consultationId,
        method: selectedMethod,
      });
      return result.status === 'COMPLETED' || result.status === 'PENDING';
    } catch {
      return false;
    } finally {
      setIsPaying(false);
    }
  }, [isPaying, selectedMethod, summary]);

  return {
    summary,
    isLoading,
    selectedMethod,
    setSelectedMethod,
    isPaying,
    canPay,
    pay,
  };
};
