import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/env.validation';
import { paymentVerificationFailed } from '../payments.errors';

import type {
  CreateProviderPaymentInput,
  PaymentProvider,
  ProviderPayment,
  ProviderEventType,
  ProviderWebhookEvent,
} from './payment-provider.interface';

const SIGNATURE_HEADER = 'x-payment-signature';

/** Rejects replayed deliveries whose signed timestamp is too old. */
const TIMESTAMP_TOLERANCE_SECONDS = 300;

const EVENT_TYPES: readonly ProviderEventType[] = [
  'payment.succeeded',
  'payment.failed',
];

interface MockWebhookBody {
  eventId?: unknown;
  type?: unknown;
  paymentId?: unknown;
  transactionId?: unknown;
  amountMinor?: unknown;
  currency?: unknown;
}

/**
 * DEVELOPMENT ONLY adapter. It never reports a payment as successful on its
 * own: a payment only advances when a signed webhook is delivered, so the
 * production code path (signature verification, amount checks, state machine)
 * is the same one exercised in development. Boot refuses to select this
 * provider when NODE_ENV=production.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPayment> {
    return Promise.resolve({
      transactionId: `mock_txn_${randomUUID()}`,
      checkoutRef: `mock_checkout_${input.paymentId}`,
    });
  }

  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): ProviderWebhookEvent {
    const { timestamp, signature } = this.parseSignatureHeader(
      headers[SIGNATURE_HEADER],
    );

    this.assertFreshTimestamp(timestamp);
    this.assertSignature(timestamp, rawBody, signature);

    return this.parseBody(rawBody);
  }

  /** Test/development helper for producing a valid signature header. */
  sign(rawBody: Buffer, timestampSeconds: number): string {
    return `t=${timestampSeconds},v1=${this.digest(timestampSeconds, rawBody)}`;
  }

  private digest(timestampSeconds: number, rawBody: Buffer): string {
    const secret = this.configService.get('payments', { infer: true })
      .webhookSecret;
    return createHmac('sha256', secret)
      .update(`${timestampSeconds}.${rawBody.toString('utf8')}`)
      .digest('hex');
  }

  private parseSignatureHeader(
    header: string | string[] | undefined,
  ): { timestamp: number; signature: string } {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value) {
      throw paymentVerificationFailed();
    }

    const parts = new Map(
      value.split(',').map((part) => {
        const [key, ...rest] = part.trim().split('=');
        return [key, rest.join('=')] as const;
      }),
    );

    const timestamp = Number(parts.get('t'));
    const signature = parts.get('v1');
    if (!Number.isInteger(timestamp) || !signature) {
      throw paymentVerificationFailed();
    }

    return { timestamp, signature };
  }

  private assertFreshTimestamp(timestampSeconds: number): void {
    const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
    if (ageSeconds > TIMESTAMP_TOLERANCE_SECONDS) {
      throw paymentVerificationFailed();
    }
  }

  private assertSignature(
    timestampSeconds: number,
    rawBody: Buffer,
    signature: string,
  ): void {
    const expected = Buffer.from(this.digest(timestampSeconds, rawBody), 'utf8');
    const received = Buffer.from(signature, 'utf8');

    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw paymentVerificationFailed();
    }
  }

  private parseBody(rawBody: Buffer): ProviderWebhookEvent {
    let parsed: MockWebhookBody;
    try {
      parsed = JSON.parse(rawBody.toString('utf8')) as MockWebhookBody;
    } catch {
      throw paymentVerificationFailed();
    }

    const { eventId, type, paymentId, transactionId, amountMinor, currency } =
      parsed;

    if (
      typeof eventId !== 'string' ||
      typeof paymentId !== 'string' ||
      typeof transactionId !== 'string' ||
      typeof currency !== 'string' ||
      !Number.isInteger(amountMinor) ||
      typeof type !== 'string' ||
      !EVENT_TYPES.includes(type as ProviderEventType)
    ) {
      throw paymentVerificationFailed();
    }

    return {
      eventId,
      type: type as ProviderEventType,
      paymentId,
      transactionId,
      amountMinor: amountMinor as number,
      currency,
    };
  }
}
