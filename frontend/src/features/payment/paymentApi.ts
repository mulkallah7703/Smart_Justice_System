import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';

import type {
  InitiatePaymentPayload,
  InitiatePaymentResponse,
  PaymentSummaryData,
} from './payment.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const getPaymentSummary = async (
  consultationId: string,
): Promise<PaymentSummaryData> => {
  if (!API_BASE_URL) {
    await wait(200);
    return {
      consultationId,
      serviceLabel: ar.payment.summary.serviceInstant,
      lawyerName: ar.lawyers.mock.sarah.name,
      scheduleLabel: ar.payment.summary.scheduleSample,
      consultationAmount: 150,
      discountLabel: ar.payment.summary.discountLabel,
      discountAmount: 37.5,
      totalAmount: 112.5,
      currency: ar.payment.currency,
    };
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoints.payments.summary(consultationId)}`,
  );

  if (!response.ok) {
    throw new Error('PAYMENT_SUMMARY_FAILED');
  }

  const json = (await response.json()) as { data: PaymentSummaryData };
  return json.data;
};

export const initiatePayment = async (
  payload: InitiatePaymentPayload,
): Promise<InitiatePaymentResponse> => {
  if (!API_BASE_URL) {
    await wait(600);
    return {
      paymentId: `pay-${payload.consultationId}-${Date.now()}`,
      status: 'COMPLETED',
    };
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.payments.initiate}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('PAYMENT_INITIATE_FAILED');
  }

  const json = (await response.json()) as { data: InitiatePaymentResponse };
  return json.data;
};
