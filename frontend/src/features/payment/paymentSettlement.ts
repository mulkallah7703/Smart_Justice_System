import { isTerminalStatus } from './mapPayment';

import type { PaymentData, PaymentStatus } from './payment.types';

/**
 * The provider settles a payment out of band through a signed webhook, so the
 * only way for the client to observe completion is to re-read the payment.
 * Polling is deliberately bounded and stops at the first terminal state.
 */
export const POLL_INTERVAL_MS = 2000;
export const MAX_POLL_ATTEMPTS = 15;

export const createAttemptKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export interface PaymentAttempt {
  /** Identifies the logical attempt: consultation, method, and retry count. */
  scope: string;
  key: string;
}

/**
 * Keeps the existing key while the request stays materially the same, so a
 * duplicated or network-retried submission collapses onto one payment. A change
 * of scope is a different request and gets a fresh key, matching the backend's
 * idempotency contract.
 */
export const resolveAttemptKey = (
  current: PaymentAttempt | null,
  scope: string,
): PaymentAttempt =>
  current && current.scope === scope
    ? current
    : { scope, key: createAttemptKey() };

export const attemptScope = (
  consultationId: string,
  method: string,
  sequence: number,
): string => `${consultationId}|${method}|${sequence}`;

export interface SettlementOptions {
  paymentId: string;
  readPayment: (paymentId: string) => Promise<PaymentData>;
  /** Aborts polling, e.g. once the payment screen has unmounted. */
  isActive: () => boolean;
  onStatus?: (status: PaymentStatus) => void;
  intervalMs?: number;
  maxAttempts?: number;
  wait?: (ms: number) => Promise<void>;
}

const defaultWait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Resolves with the terminal status the backend reported, or `null` if polling
 * was exhausted or aborted while the payment was still pending.
 */
export const waitForSettlement = async ({
  paymentId,
  readPayment,
  isActive,
  onStatus,
  intervalMs = POLL_INTERVAL_MS,
  maxAttempts = MAX_POLL_ATTEMPTS,
  wait = defaultWait,
}: SettlementOptions): Promise<PaymentStatus | null> => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await wait(intervalMs);

    if (!isActive()) {
      return null;
    }

    try {
      const payment = await readPayment(paymentId);
      if (!isActive()) {
        return null;
      }

      onStatus?.(payment.status);

      if (isTerminalStatus(payment.status)) {
        return payment.status;
      }
    } catch {
      // A transient read failure must not end the attempt; the payment may
      // still settle, and the next poll will observe it.
    }
  }

  return null;
};
