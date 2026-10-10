import { describe, expect, it } from 'vitest';

import { ar } from '../../core/i18n/ar';

import {
  discountLabel,
  formatScheduleAr,
  isTerminalStatus,
  mapInitiatedPayment,
  mapPayment,
  mapPaymentStatus,
  mapPaymentSummary,
} from './mapPayment';

import type {
  BackendInitiatedPayment,
  BackendPayment,
  BackendPaymentSummary,
} from './payment.types';

const summary = (
  overrides: Partial<BackendPaymentSummary> = {},
): BackendPaymentSummary => ({
  consultationId: 'consult-1',
  lawyerName: 'DEV Lawyer',
  consultationType: 'INSTANT',
  scheduledAt: '2030-03-01T10:30:00.000Z',
  original: { amountMinor: 15000, amount: '150.00', currency: 'SAR' },
  discountPct: 25,
  discount: { amountMinor: 3750, amount: '37.50', currency: 'SAR' },
  payable: { amountMinor: 11250, amount: '112.50', currency: 'SAR' },
  ...overrides,
});

const payment = (overrides: Partial<BackendPayment> = {}): BackendPayment => ({
  id: 'pay-1',
  status: 'PENDING',
  method: 'MADA',
  purpose: 'CONSULTATION',
  consultationId: 'consult-1',
  original: { amountMinor: 15000, amount: '150.00', currency: 'SAR' },
  discountPct: 25,
  payable: { amountMinor: 11250, amount: '112.50', currency: 'SAR' },
  createdAt: '2030-01-01T00:00:00.000Z',
  ...overrides,
});

describe('mapPaymentSummary', () => {
  it('takes every amount verbatim from the backend', () => {
    const mapped = mapPaymentSummary(summary());

    expect(mapped.consultationAmount).toBe('150.00');
    expect(mapped.discountAmount).toBe('37.50');
    expect(mapped.totalAmount).toBe('112.50');
    expect(mapped.currency).toBe('SAR');
    expect(mapped.discountPct).toBe(25);
  });

  it('does not derive the payable amount from the other figures', () => {
    // A deliberately inconsistent payload proves the mapper reports the
    // server's payable amount rather than original minus discount.
    const mapped = mapPaymentSummary(
      summary({
        payable: { amountMinor: 9900, amount: '99.00', currency: 'SAR' },
      }),
    );

    expect(mapped.totalAmount).toBe('99.00');
  });

  it('builds the discount label from the server percentage', () => {
    expect(mapPaymentSummary(summary()).discountLabel).toContain('٢٥');
    expect(discountLabel(10)).toContain('١٠');
  });

  it('maps the consultation type to its Arabic service label', () => {
    expect(mapPaymentSummary(summary()).serviceLabel).toBe(
      ar.booking.types.instant.title,
    );
    expect(
      mapPaymentSummary(summary({ consultationType: 'REPRESENTATION' }))
        .serviceLabel,
    ).toBe(ar.booking.types.representation.title);
  });

  it('falls back when the lawyer has no linked user name', () => {
    expect(mapPaymentSummary(summary({ lawyerName: null })).lawyerName).toBe(
      ar.payment.summary.lawyerFallback,
    );
    expect(mapPaymentSummary(summary({ lawyerName: '  ' })).lawyerName).toBe(
      ar.payment.summary.lawyerFallback,
    );
  });

  it('renders the schedule in Arabic Riyadh time', () => {
    // 10:30 UTC is 13:30 in Riyadh.
    const label = mapPaymentSummary(summary()).scheduleLabel;

    expect(label).toContain('١:٣٠');
    expect(label).toContain('•');
  });

  it('returns an empty schedule for a malformed timestamp', () => {
    expect(formatScheduleAr('not-a-date')).toBe('');
  });
});

describe('mapPayment', () => {
  it('exposes only UI-relevant fields', () => {
    expect(mapPayment(payment())).toEqual({
      id: 'pay-1',
      status: 'PENDING',
      method: 'MADA',
      totalAmount: '112.50',
      currency: 'SAR',
    });
  });

  it('never surfaces provider internals', () => {
    const mapped = mapPayment(payment()) as unknown as Record<string, unknown>;

    expect(mapped).not.toHaveProperty('transactionId');
    expect(mapped).not.toHaveProperty('gatewayRef');
    expect(mapped).not.toHaveProperty('userId');
  });

  it('keeps the checkout reference on an initiated payment', () => {
    const initiated: BackendInitiatedPayment = {
      ...payment(),
      checkoutRef: 'mock_checkout_pay-1',
    };

    expect(mapInitiatedPayment(initiated).checkoutRef).toBe(
      'mock_checkout_pay-1',
    );
  });
});

describe('payment status', () => {
  it('labels every backend status', () => {
    expect(mapPaymentStatus('PENDING')).toBe(ar.payment.status.pending);
    expect(mapPaymentStatus('COMPLETED')).toBe(ar.payment.status.completed);
    expect(mapPaymentStatus('FAILED')).toBe(ar.payment.status.failed);
    expect(mapPaymentStatus('REFUNDED')).toBe(ar.payment.status.refunded);
  });

  it('treats only PENDING as non-terminal', () => {
    expect(isTerminalStatus('PENDING')).toBe(false);
    expect(isTerminalStatus('COMPLETED')).toBe(true);
    expect(isTerminalStatus('FAILED')).toBe(true);
    expect(isTerminalStatus('REFUNDED')).toBe(true);
  });
});
