import type { PaymentMethod } from '@prisma/client';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CreateProviderPaymentInput {
  /** Local payment id, passed so the provider can echo it back on the webhook. */
  paymentId: string;
  amountMinor: number;
  currency: string;
  method: PaymentMethod;
  /** Forwarded to the provider so a retried create cannot charge twice. */
  idempotencyKey: string;
}

export interface ProviderPayment {
  /** Provider-side payment identifier, stored as Payment.transactionId. */
  transactionId: string;
  /** Opaque reference the client uses to continue the hosted/tokenized flow. */
  checkoutRef: string;
}

export type ProviderEventType = 'payment.succeeded' | 'payment.failed';

export interface ProviderWebhookEvent {
  /** Provider event id. Unique per delivery, used for webhook idempotency. */
  eventId: string;
  type: ProviderEventType;
  paymentId: string;
  transactionId: string;
  amountMinor: number;
  currency: string;
}

/**
 * The seam between payment business logic and any specific gateway. The service
 * depends only on this interface, so swapping in a real provider does not touch
 * the state machine, ownership checks, or idempotency logic.
 */
export interface PaymentProvider {
  readonly name: string;

  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPayment>;

  /**
   * Verifies delivery authenticity and returns the parsed event. Implementations
   * must throw when the signature, timestamp, or payload shape is not valid, and
   * must never return a partially trusted event.
   */
  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): ProviderWebhookEvent;
}
