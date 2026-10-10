export type PaymentMethodId = 'APPLE_PAY' | 'MADA';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export type ConsultationTypeId =
  | 'INSTANT'
  | 'WRITTEN'
  | 'IN_PERSON'
  | 'REPRESENTATION';

/**
 * Money exactly as the backend serialises it: an integer minor-unit amount and
 * a fixed 2-decimal string. The frontend displays these and never recomputes
 * the payable amount from them.
 */
export interface BackendMoney {
  amountMinor: number;
  amount: string;
  currency: string;
}

export interface BackendPaymentSummary {
  consultationId: string;
  lawyerName: string | null;
  consultationType: ConsultationTypeId;
  scheduledAt: string;
  original: BackendMoney;
  discountPct: number;
  discount: BackendMoney;
  payable: BackendMoney;
}

export interface BackendPayment {
  id: string;
  status: PaymentStatus;
  method: PaymentMethodId;
  purpose: string;
  consultationId: string | null;
  original: BackendMoney;
  discountPct: number;
  payable: BackendMoney;
  createdAt: string;
}

/** Returned by initiation only. Continues the provider-hosted flow. */
export interface BackendInitiatedPayment extends BackendPayment {
  checkoutRef: string;
}

export interface PaymentLineItem {
  label: string;
  amount: number;
  tone?: 'default' | 'discount';
  icon?: string;
}

/**
 * UI model. Amounts stay as the server's fixed-decimal strings so nothing in
 * the view layer can drift from the authoritative figures.
 */
export interface PaymentSummaryData {
  consultationId: string;
  serviceLabel: string;
  lawyerName: string;
  scheduleLabel: string;
  consultationAmount: string;
  discountLabel: string;
  discountPct: number;
  discountAmount: string;
  totalAmount: string;
  currency: string;
}

export interface PaymentData {
  id: string;
  status: PaymentStatus;
  method: PaymentMethodId;
  totalAmount: string;
  currency: string;
}

export interface InitiatePaymentPayload {
  consultationId: string;
  method: PaymentMethodId;
  /** Scopes one logical payment attempt so retries cannot double-charge. */
  idempotencyKey?: string;
}

export interface InitiatePaymentResponse extends PaymentData {
  checkoutRef: string;
}
