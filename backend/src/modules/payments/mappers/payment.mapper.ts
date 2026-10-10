import type { PaymentMethod, PaymentPurpose, PaymentStatus, Prisma } from '@prisma/client';

import { decimalToMinor, minorToString } from '../money';

import type { MoneyDto, PaymentDto } from '../dto/payment-response.dto';

export interface PaymentRecord {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  purpose: PaymentPurpose;
  consultationId: string | null;
  amount: Prisma.Decimal;
  originalAmount: Prisma.Decimal;
  discountPct: number;
  currency: string;
  createdAt: Date;
}

export const toMoney = (amountMinor: number, currency: string): MoneyDto => ({
  amountMinor,
  amount: minorToString(amountMinor),
  currency,
});

/**
 * Explicit projection. Provider identifiers (`transactionId`, `gatewayRef`),
 * the idempotency key, and the request hash are internal and never mapped.
 */
export const mapPayment = (record: PaymentRecord): PaymentDto => ({
  id: record.id,
  status: record.status,
  method: record.method,
  purpose: record.purpose,
  consultationId: record.consultationId,
  original: toMoney(decimalToMinor(record.originalAmount), record.currency),
  discountPct: record.discountPct,
  payable: toMoney(decimalToMinor(record.amount), record.currency),
  createdAt: record.createdAt.toISOString(),
});
