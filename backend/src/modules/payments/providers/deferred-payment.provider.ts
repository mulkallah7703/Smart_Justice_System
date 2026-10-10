import { Injectable } from '@nestjs/common';

import { paymentDeferred } from '../payments.errors';

import type {
  CreateProviderPaymentInput,
  PaymentProvider,
  ProviderPayment,
  ProviderWebhookEvent,
} from './payment-provider.interface';

/**
 * Production-safe deferred payment adapter.
 * Never invents success, transactions, or webhooks.
 */
@Injectable()
export class DeferredPaymentProvider implements PaymentProvider {
  readonly name = 'deferred';

  async createPayment(
    _input: CreateProviderPaymentInput,
  ): Promise<ProviderPayment> {
    throw paymentDeferred();
  }

  verifyAndParseWebhook(
    _rawBody: Buffer,
    _headers: Record<string, string | string[] | undefined>,
  ): ProviderWebhookEvent {
    throw paymentDeferred();
  }
}
