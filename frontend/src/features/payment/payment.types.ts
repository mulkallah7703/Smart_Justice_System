export type PaymentMethodId = 'APPLE_PAY' | 'MADA';

export interface PaymentLineItem {
  label: string;
  amount: number;
  tone?: 'default' | 'discount';
  icon?: string;
}

export interface PaymentSummaryData {
  consultationId: string;
  serviceLabel: string;
  lawyerName: string;
  scheduleLabel: string;
  consultationAmount: number;
  discountLabel: string;
  discountAmount: number;
  totalAmount: number;
  currency: string;
}

export interface InitiatePaymentPayload {
  consultationId: string;
  method: PaymentMethodId;
}

export interface InitiatePaymentResponse {
  paymentId: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}
