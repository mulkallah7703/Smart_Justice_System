import { describe, expect, it, vi } from 'vitest';

import {
  MAX_POLL_ATTEMPTS,
  attemptScope,
  createAttemptKey,
  resolveAttemptKey,
  waitForSettlement,
} from './paymentSettlement';

import type { PaymentData, PaymentStatus } from './payment.types';

const payment = (status: PaymentStatus): PaymentData => ({
  id: 'pay-1',
  status,
  method: 'MADA',
  totalAmount: '150.00',
  currency: 'SAR',
});

const noWait = (): Promise<void> => Promise.resolve();

const settle = (
  readPayment: (id: string) => Promise<PaymentData>,
  overrides: Partial<Parameters<typeof waitForSettlement>[0]> = {},
) =>
  waitForSettlement({
    paymentId: 'pay-1',
    readPayment,
    isActive: () => true,
    wait: noWait,
    ...overrides,
  });

describe('waitForSettlement', () => {
  it('returns the terminal status the backend reported', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(payment('PENDING'))
      .mockResolvedValueOnce(payment('PENDING'))
      .mockResolvedValue(payment('COMPLETED'));

    await expect(settle(read)).resolves.toBe('COMPLETED');
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('stops immediately at a terminal state', async () => {
    const read = vi.fn().mockResolvedValue(payment('FAILED'));

    await expect(settle(read)).resolves.toBe('FAILED');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reports REFUNDED as terminal', async () => {
    const read = vi.fn().mockResolvedValue(payment('REFUNDED'));

    await expect(settle(read)).resolves.toBe('REFUNDED');
  });

  it('gives up after a bounded number of attempts', async () => {
    const read = vi.fn().mockResolvedValue(payment('PENDING'));

    await expect(settle(read)).resolves.toBeNull();
    expect(read).toHaveBeenCalledTimes(MAX_POLL_ATTEMPTS);
  });

  it('never claims success while the payment is still pending', async () => {
    const read = vi.fn().mockResolvedValue(payment('PENDING'));

    await expect(settle(read, { maxAttempts: 3 })).resolves.not.toBe(
      'COMPLETED',
    );
  });

  it('stops polling once the caller becomes inactive', async () => {
    const read = vi.fn().mockResolvedValue(payment('PENDING'));
    let active = true;

    const result = await settle(read, {
      isActive: () => {
        const wasActive = active;
        active = false;
        return wasActive;
      },
    });

    expect(result).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('survives a transient read failure and keeps polling', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(payment('COMPLETED'));

    await expect(settle(read)).resolves.toBe('COMPLETED');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('surfaces each observed status to the caller', async () => {
    const onStatus = vi.fn();
    const read = vi
      .fn()
      .mockResolvedValueOnce(payment('PENDING'))
      .mockResolvedValue(payment('COMPLETED'));

    await settle(read, { onStatus });

    expect(onStatus.mock.calls.map((call) => call[0])).toEqual([
      'PENDING',
      'COMPLETED',
    ]);
  });

  it('waits between polls so the API is not hammered', async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const read = vi.fn().mockResolvedValue(payment('COMPLETED'));

    await settle(read, { wait, intervalMs: 2000 });

    expect(wait).toHaveBeenCalledWith(2000);
  });
});

describe('createAttemptKey', () => {
  it('produces a distinct opaque key per logical attempt', () => {
    const first = createAttemptKey();
    const second = createAttemptKey();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(8);
  });

  it('carries no user or payment information', () => {
    const key = createAttemptKey();
    expect(key).not.toMatch(/consult|pay|user|@/i);
    expect(key).not.toMatch(/national|token|Bearer/i);
  });
});

describe('resolveAttemptKey', () => {
  const scope = attemptScope('consult-1', 'MADA', 0);

  it('reuses the key when the same request is submitted again', () => {
    const first = resolveAttemptKey(null, scope);
    const second = resolveAttemptKey(first, scope);
    const third = resolveAttemptKey(second, scope);

    expect(second.key).toBe(first.key);
    expect(third.key).toBe(first.key);
  });

  it('issues a new key for an explicit retry', () => {
    const first = resolveAttemptKey(null, scope);
    const retried = resolveAttemptKey(
      first,
      attemptScope('consult-1', 'MADA', 1),
    );

    expect(retried.key).not.toBe(first.key);
  });

  it('issues a new key when the payment method changes', () => {
    const first = resolveAttemptKey(null, scope);
    const switched = resolveAttemptKey(
      first,
      attemptScope('consult-1', 'APPLE_PAY', 0),
    );

    expect(switched.key).not.toBe(first.key);
  });

  it('issues a new key for a different consultation', () => {
    const first = resolveAttemptKey(null, scope);
    const other = resolveAttemptKey(
      first,
      attemptScope('consult-2', 'MADA', 0),
    );

    expect(other.key).not.toBe(first.key);
  });

  it('never derives the key from the scope it is bound to', () => {
    const attempt = resolveAttemptKey(null, scope);

    expect(attempt.key).not.toContain('consult-1');
    expect(attempt.key).not.toContain('MADA');
  });
});
