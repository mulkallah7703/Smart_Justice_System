import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';
import { ApiError } from '../../shared/api/errors';
import { apiRequest } from '../../shared/api/httpClient';
import { isMockApiMode } from '../../shared/api/mode';

import { mapInitiatedPayment, mapPayment, mapPaymentSummary } from './mapPayment';
import type {
  BackendInitiatedPayment,
  BackendPayment,
  BackendPaymentSummary,
  InitiatePaymentPayload,
  InitiatePaymentResponse,
  PaymentData,
  PaymentSummaryData,
} from './payment.types';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/** Preserved mock figures. Real mode never reads these. */
const MOCK_SUMMARY = {
  consultationAmount: '150.00',
  discountAmount: '37.50',
  totalAmount: '112.50',
  discountPct: 25,
};

const mockPayments = new Map<string, PaymentData>();

/**
 * Price and payment status are authoritative and change out of band, so these
 * reads must always reach the server instead of a possibly stale HTTP cache.
 */
const NO_CACHE = { 'Cache-Control': 'no-cache' };

export const getPaymentSummary = async (
  consultationId: string,
): Promise<PaymentSummaryData> => {
  if (isMockApiMode()) {
    await wait(200);
    return {
      consultationId,
      serviceLabel: ar.payment.summary.serviceInstant,
      lawyerName: ar.lawyers.mock.sarah.name,
      scheduleLabel: ar.payment.summary.scheduleSample,
      consultationAmount: MOCK_SUMMARY.consultationAmount,
      discountLabel: ar.payment.summary.discountLabel,
      discountPct: MOCK_SUMMARY.discountPct,
      discountAmount: MOCK_SUMMARY.discountAmount,
      totalAmount: MOCK_SUMMARY.totalAmount,
      currency: ar.payment.currency,
    };
  }

  const record = await apiRequest<BackendPaymentSummary>(
    endpoints.payments.summary(consultationId),
    { headers: NO_CACHE },
  );
  return mapPaymentSummary(record);
};

/**
 * Creating a payment is not paying. Real mode always returns PENDING; only a
 * provider-verified webhook can move it to COMPLETED.
 */
export const initiatePayment = async (
  payload: InitiatePaymentPayload,
): Promise<InitiatePaymentResponse> => {
  if (isMockApiMode()) {
    await wait(600);
    const mock: InitiatePaymentResponse = {
      id: `pay-${payload.consultationId}-${Date.now()}`,
      status: 'COMPLETED',
      method: payload.method,
      totalAmount: MOCK_SUMMARY.totalAmount,
      currency: ar.payment.currency,
      checkoutRef: `mock-checkout-${payload.consultationId}`,
    };
    mockPayments.set(mock.id, mock);
    return mock;
  }

  const record = await apiRequest<BackendInitiatedPayment>(
    endpoints.payments.initiate,
    {
      method: 'POST',
      // The amount, currency, and user are all derived server-side.
      body: {
        consultationId: payload.consultationId,
        method: payload.method,
      },
      headers: payload.idempotencyKey
        ? { 'Idempotency-Key': payload.idempotencyKey }
        : undefined,
    },
  );

  return mapInitiatedPayment(record);
};

export const getPaymentById = async (
  paymentId: string,
): Promise<PaymentData> => {
  if (isMockApiMode()) {
    await wait(150);
    const mock = mockPayments.get(paymentId);
    if (!mock) {
      throw new ApiError('PAYMENT_NOT_FOUND', 'Payment not found', 404);
    }
    return mock;
  }

  const record = await apiRequest<BackendPayment>(
    endpoints.payments.detail(paymentId),
    { headers: NO_CACHE },
  );
  return mapPayment(record);
};
