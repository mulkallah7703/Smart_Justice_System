import type { PaymentMethod, PaymentPurpose, PaymentStatus } from '@prisma/client';

/**
 * Monetary values are exposed as an integer minor-unit amount plus a fixed
 * 2-decimal string. No float ever crosses the API boundary.
 */
export interface MoneyDto {
  amountMinor: number;
  amount: string;
  currency: string;
}

export interface PaymentDto {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  purpose: PaymentPurpose;
  consultationId: string | null;
  original: MoneyDto;
  discountPct: number;
  payable: MoneyDto;
  createdAt: string;
}

/** Returned on creation. `checkoutRef` continues the provider-hosted flow. */
export interface InitiatedPaymentDto extends PaymentDto {
  checkoutRef: string;
}

export interface PaymentSummaryDto {
  consultationId: string;
  lawyerName: string | null;
  consultationType: string;
  scheduledAt: string;
  original: MoneyDto;
  discountPct: number;
  discount: MoneyDto;
  payable: MoneyDto;
}
