import { ar } from '../../core/i18n/ar';
import { toArabicNumerals } from '../../shared/utils/arabicNumerals';
import {
  formatSlotDayNumberAr,
  formatSlotTimeAr,
  formatSlotWeekdayAr,
} from '../booking/mapAvailability';

import type {
  BackendInitiatedPayment,
  BackendPayment,
  BackendPaymentSummary,
  ConsultationTypeId,
  InitiatePaymentResponse,
  PaymentData,
  PaymentStatus,
  PaymentSummaryData,
} from './payment.types';

const SERVICE_LABELS: Record<ConsultationTypeId, string> = {
  INSTANT: ar.booking.types.instant.title,
  WRITTEN: ar.booking.types.written.title,
  IN_PERSON: ar.booking.types.inPerson.title,
  REPRESENTATION: ar.booking.types.representation.title,
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: ar.payment.status.pending,
  COMPLETED: ar.payment.status.completed,
  FAILED: ar.payment.status.failed,
  REFUNDED: ar.payment.status.refunded,
};

export const mapPaymentStatus = (status: PaymentStatus): string =>
  STATUS_LABELS[status];

export const isTerminalStatus = (status: PaymentStatus): boolean =>
  status !== 'PENDING';

export const serviceLabel = (type: ConsultationTypeId): string =>
  SERVICE_LABELS[type] ?? ar.payment.summary.serviceInstant;

/** Matches the sample layout already used by the summary card. */
export const formatScheduleAr = (iso: string): string => {
  const weekday = formatSlotWeekdayAr(iso);
  const day = formatSlotDayNumberAr(iso);
  const time = formatSlotTimeAr(iso);

  return weekday && time ? `${weekday} ${day} • ${time}` : '';
};

export const discountLabel = (discountPct: number): string =>
  ar.payment.summary.discountTemplate.replace(
    '{pct}',
    toArabicNumerals(discountPct),
  );

/**
 * Every monetary figure is taken verbatim from the backend. Nothing here
 * subtracts, multiplies, or otherwise re-derives the payable amount.
 */
export const mapPaymentSummary = (
  record: BackendPaymentSummary,
): PaymentSummaryData => ({
  consultationId: record.consultationId,
  serviceLabel: serviceLabel(record.consultationType),
  lawyerName: record.lawyerName?.trim() || ar.payment.summary.lawyerFallback,
  scheduleLabel: formatScheduleAr(record.scheduledAt),
  consultationAmount: record.original.amount,
  discountLabel: discountLabel(record.discountPct),
  discountPct: record.discountPct,
  discountAmount: record.discount.amount,
  totalAmount: record.payable.amount,
  currency: record.payable.currency,
});

export const mapPayment = (record: BackendPayment): PaymentData => ({
  id: record.id,
  status: record.status,
  method: record.method,
  totalAmount: record.payable.amount,
  currency: record.payable.currency,
});

export const mapInitiatedPayment = (
  record: BackendInitiatedPayment,
): InitiatePaymentResponse => ({
  ...mapPayment(record),
  checkoutRef: record.checkoutRef,
});
