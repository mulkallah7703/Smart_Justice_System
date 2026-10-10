import { PaymentStatus } from '@prisma/client';

/**
 * Valid payment transitions.
 *
 *   PENDING   → COMPLETED   (verified provider success)
 *   PENDING   → FAILED      (verified provider failure, or provider create error)
 *   COMPLETED → REFUNDED    (refunds are not issued in this phase)
 *
 * Everything else is rejected, so a payment can never move backwards out of a
 * terminal state — in particular COMPLETED can never return to PENDING.
 */
const ALLOWED: Record<PaymentStatus, readonly PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.COMPLETED, PaymentStatus.FAILED],
  [PaymentStatus.COMPLETED]: [PaymentStatus.REFUNDED],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.REFUNDED]: [],
};

export const canTransition = (
  from: PaymentStatus,
  to: PaymentStatus,
): boolean => ALLOWED[from].includes(to);

export const isTerminal = (status: PaymentStatus): boolean =>
  ALLOWED[status].length === 0;
