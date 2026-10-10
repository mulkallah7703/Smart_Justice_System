import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/env.validation';
import { AuthModule } from '../auth/auth.module';

import { PaymentRateLimitGuard } from './guards/payment-rate-limit.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PricingService } from './pricing.service';
import { DeferredPaymentProvider } from './providers/deferred-payment.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';

/**
 * Payment gateway is DEFERRED for product delivery.
 * Production uses DeferredPaymentProvider (controlled unavailable).
 * Mock is development/test only — never selected in production.
 */
@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PricingService,
    PaymentRateLimitGuard,
    DeferredPaymentProvider,
    MockPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, DeferredPaymentProvider, MockPaymentProvider],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        deferred: DeferredPaymentProvider,
        mock: MockPaymentProvider,
      ) => {
        const { provider } = configService.get('payments', { infer: true });
        if (provider === 'deferred') {
          return deferred;
        }
        if (provider === 'mock') {
          return mock;
        }
        throw new Error(`No adapter registered for payment provider: ${provider}`);
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
