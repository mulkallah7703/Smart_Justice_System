import 'reflect-metadata';

import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, Prisma } from '@prisma/client';

import { validateEnv, type AppConfig } from '../src/config/env.validation';
import { InitiatePaymentDto } from '../src/modules/payments/dto/initiate-payment.dto';
import { PaymentRateLimitGuard } from '../src/modules/payments/guards/payment-rate-limit.guard';
import {
  mapPayment,
  type PaymentRecord,
} from '../src/modules/payments/mappers/payment.mapper';
import {
  applyDiscount,
  decimalToMinor,
  isValidDiscountPct,
  majorToMinor,
  minorToDecimal,
  minorToString,
} from '../src/modules/payments/money';
import { canTransition, isTerminal } from '../src/modules/payments/payment-state';
import { PricingService } from '../src/modules/payments/pricing.service';
import { MockPaymentProvider } from '../src/modules/payments/providers/mock-payment.provider';
import { RedisService } from '../src/shared/cache/redis.service';
import { PrismaService } from '../src/shared/database/prisma.service';

const WEBHOOK_SECRET = 'unit-test-payment-webhook-secret-32-chars';

const paymentRecord = (
  overrides: Partial<PaymentRecord> = {},
): PaymentRecord => ({
  id: 'pay-1',
  status: 'PENDING',
  method: 'MADA',
  purpose: 'CONSULTATION',
  consultationId: 'consult-1',
  amount: new Prisma.Decimal('112.50'),
  originalAmount: new Prisma.Decimal('150.00'),
  discountPct: 25,
  currency: 'SAR',
  createdAt: new Date('2030-01-01T00:00:00Z'),
  ...overrides,
});

const providerConfig = {
  get: () => ({ provider: 'mock', webhookSecret: WEBHOOK_SECRET }),
} as unknown as ConfigService<AppConfig, true>;

const executionContext = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const baseEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'development',
  CORS_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET,
});

describe('money', () => {
  it('converts whole and fractional SAR without floating point drift', () => {
    expect(majorToMinor(150)).toBe(15000);
    expect(majorToMinor(100.5)).toBe(10050);
    expect(minorToString(11250)).toBe('112.50');
    expect(minorToString(0)).toBe('0.00');
  });

  it('round-trips through Prisma Decimal', () => {
    expect(decimalToMinor(minorToDecimal(11250))).toBe(11250);
    expect(minorToDecimal(11250).toFixed(2)).toBe('112.50');
  });

  it('applies a whole-percent discount deterministically', () => {
    expect(applyDiscount(15000, 25)).toEqual({
      payableMinor: 11250,
      discountMinor: 3750,
    });
    expect(applyDiscount(15000, 0)).toEqual({
      payableMinor: 15000,
      discountMinor: 0,
    });
    expect(applyDiscount(15000, 100)).toEqual({
      payableMinor: 0,
      discountMinor: 15000,
    });
  });

  it('rounds a fractional halala half-up rather than truncating', () => {
    // 3.33 SAR at 50% is 1.665 SAR, which must settle on a whole halala.
    expect(applyDiscount(333, 50).payableMinor).toBe(167);
  });

  it('handles a very large amount exactly', () => {
    expect(applyDiscount(999_999_999_99, 10).payableMinor).toBe(899_999_999_99);
  });

  it('rejects negative and non-integer inputs', () => {
    expect(() => applyDiscount(-1, 10)).toThrow();
    expect(() => applyDiscount(10.5, 10)).toThrow();
    expect(() => applyDiscount(15000, -5)).toThrow();
    expect(() => applyDiscount(15000, 101)).toThrow();
    expect(() => applyDiscount(15000, 12.5)).toThrow();
    expect(isValidDiscountPct(25)).toBe(true);
    expect(isValidDiscountPct(-1)).toBe(false);
  });
});

describe('payment state machine', () => {
  it('allows only the documented transitions', () => {
    expect(canTransition(PaymentStatus.PENDING, PaymentStatus.COMPLETED)).toBe(true);
    expect(canTransition(PaymentStatus.PENDING, PaymentStatus.FAILED)).toBe(true);
    expect(canTransition(PaymentStatus.COMPLETED, PaymentStatus.REFUNDED)).toBe(true);
  });

  it('never moves backwards out of a terminal state', () => {
    expect(canTransition(PaymentStatus.COMPLETED, PaymentStatus.PENDING)).toBe(false);
    expect(canTransition(PaymentStatus.FAILED, PaymentStatus.COMPLETED)).toBe(false);
    expect(canTransition(PaymentStatus.REFUNDED, PaymentStatus.COMPLETED)).toBe(false);
    expect(isTerminal(PaymentStatus.FAILED)).toBe(true);
    expect(isTerminal(PaymentStatus.PENDING)).toBe(false);
  });
});

describe('payment mapper', () => {
  it('maps money as minor units plus a fixed-decimal string', () => {
    expect(mapPayment(paymentRecord())).toEqual({
      id: 'pay-1',
      status: 'PENDING',
      method: 'MADA',
      purpose: 'CONSULTATION',
      consultationId: 'consult-1',
      original: { amountMinor: 15000, amount: '150.00', currency: 'SAR' },
      discountPct: 25,
      payable: { amountMinor: 11250, amount: '112.50', currency: 'SAR' },
      createdAt: '2030-01-01T00:00:00.000Z',
    });
  });

  it('never exposes provider or idempotency internals', () => {
    const dto = mapPayment(paymentRecord()) as unknown as Record<string, unknown>;

    expect(dto).not.toHaveProperty('transactionId');
    expect(dto).not.toHaveProperty('gatewayRef');
    expect(dto).not.toHaveProperty('idempotencyKey');
    expect(dto).not.toHaveProperty('requestHash');
    expect(dto).not.toHaveProperty('userId');
  });
});

describe('initiate payment DTO', () => {
  it('rejects a client-supplied amount, currency, status, or userId', async () => {
    const pipe = (await import('../src/shared/validation/validation.config')).createValidationPipe();

    await expect(
      pipe.transform(
        {
          consultationId: 'consult-1',
          method: 'MADA',
          amount: 1,
          currency: 'USD',
          userId: 'someone-else',
          status: 'COMPLETED',
        },
        { type: 'body', metatype: InitiatePaymentDto },
      ),
    ).rejects.toThrow();
  });

  it('rejects an unknown payment method', async () => {
    const pipe = (await import('../src/shared/validation/validation.config')).createValidationPipe();

    await expect(
      pipe.transform(
        { consultationId: 'consult-1', method: 'VISA' },
        { type: 'body', metatype: InitiatePaymentDto },
      ),
    ).rejects.toThrow();
  });

  it('accepts the supported methods', async () => {
    const pipe = (await import('../src/shared/validation/validation.config')).createValidationPipe();

    await expect(
      pipe.transform(
        { consultationId: 'consult-1', method: 'APPLE_PAY' },
        { type: 'body', metatype: InitiatePaymentDto },
      ),
    ).resolves.toMatchObject({ method: 'APPLE_PAY' });
  });
});

describe('pricing service', () => {
  const prismaFor = (
    consultation: unknown,
    card: unknown,
  ): PrismaService =>
    ({
      consultation: { findFirst: jest.fn().mockResolvedValue(consultation) },
      judicialCard: { findUnique: jest.fn().mockResolvedValue(card) },
    }) as unknown as PrismaService;

  const consultation = {
    id: 'consult-1',
    type: 'INSTANT',
    status: 'PENDING',
    scheduledAt: new Date('2030-02-03T06:00:00Z'),
    lawyer: { priceFrom: 150, user: { name: 'DEV Lawyer' } },
  };

  it('prices from the lawyer rate and the citizen judicial card discount', async () => {
    const service = new PricingService(prismaFor(consultation, { discountPct: 25 }));

    await expect(service.quoteConsultation('user-1', 'consult-1')).resolves.toMatchObject({
      originalMinor: 15000,
      discountPct: 25,
      discountMinor: 3750,
      payableMinor: 11250,
      currency: 'SAR',
    });
  });

  it('charges the full rate when the citizen has no card', async () => {
    const service = new PricingService(prismaFor(consultation, null));

    await expect(service.quoteConsultation('user-1', 'consult-1')).resolves.toMatchObject({
      discountPct: 0,
      payableMinor: 15000,
    });
  });

  it('refuses to price a cancelled consultation', async () => {
    const service = new PricingService(
      prismaFor({ ...consultation, status: 'CANCELLED' }, { discountPct: 0 }),
    );

    await expect(service.quoteConsultation('user-1', 'consult-1')).rejects.toMatchObject({
      code: 'PAYMENT_CONSULTATION_NOT_PAYABLE',
    });
  });

  it("hides another citizen's consultation behind a not-found error", async () => {
    const service = new PricingService(prismaFor(null, { discountPct: 25 }));

    await expect(service.quoteConsultation('user-1', 'consult-1')).rejects.toMatchObject({
      code: 'PAYMENT_CONSULTATION_NOT_FOUND',
    });
  });
});

describe('mock payment provider webhook verification', () => {
  const provider = new MockPaymentProvider(providerConfig);

  const body = (overrides: Record<string, unknown> = {}): Buffer =>
    Buffer.from(
      JSON.stringify({
        eventId: 'evt_1',
        type: 'payment.succeeded',
        paymentId: 'pay-1',
        transactionId: 'mock_txn_1',
        amountMinor: 11250,
        currency: 'SAR',
        ...overrides,
      }),
    );

  const signedHeaders = (
    raw: Buffer,
    seconds = Math.floor(Date.now() / 1000),
  ): Record<string, string> => ({
    'x-payment-signature': provider.sign(raw, seconds),
  });

  it('accepts a correctly signed delivery', () => {
    const raw = body();

    expect(provider.verifyAndParseWebhook(raw, signedHeaders(raw))).toEqual({
      eventId: 'evt_1',
      type: 'payment.succeeded',
      paymentId: 'pay-1',
      transactionId: 'mock_txn_1',
      amountMinor: 11250,
      currency: 'SAR',
    });
  });

  it('rejects a missing or malformed signature header', () => {
    const raw = body();

    expect(() => provider.verifyAndParseWebhook(raw, {})).toThrow();
    expect(() =>
      provider.verifyAndParseWebhook(raw, { 'x-payment-signature': 'garbage' }),
    ).toThrow();
  });

  it('rejects a wrong signature', () => {
    const raw = body();
    const seconds = Math.floor(Date.now() / 1000);

    expect(() =>
      provider.verifyAndParseWebhook(raw, {
        'x-payment-signature': `t=${seconds},v1=${'0'.repeat(64)}`,
      }),
    ).toThrow();
  });

  it('rejects a tampered body signed for different bytes', () => {
    const original = body();
    const headers = signedHeaders(original);

    expect(() =>
      provider.verifyAndParseWebhook(body({ amountMinor: 1 }), headers),
    ).toThrow();
  });

  it('rejects a stale timestamp', () => {
    const raw = body();
    const stale = Math.floor(Date.now() / 1000) - 3600;

    expect(() => provider.verifyAndParseWebhook(raw, signedHeaders(raw, stale))).toThrow();
  });

  it('rejects an unknown event type and a malformed payload', () => {
    const unknownType = body({ type: 'payment.refunded' });
    const malformed = Buffer.from('not json');

    expect(() =>
      provider.verifyAndParseWebhook(unknownType, signedHeaders(unknownType)),
    ).toThrow();
    expect(() =>
      provider.verifyAndParseWebhook(malformed, signedHeaders(malformed)),
    ).toThrow();
  });

  it('never reports success on its own when creating a payment', async () => {
    const created = await provider.createPayment({
      paymentId: 'pay-1',
      amountMinor: 11250,
      currency: 'SAR',
      method: 'MADA',
      idempotencyKey: 'key-1',
    });

    expect(created.transactionId).toMatch(/^mock_txn_/);
    expect(created).not.toHaveProperty('status');
  });
});

describe('payments environment validation', () => {
  it('refuses the mock provider in production', () => {
    expect(() =>
      validateEnv({
        ...baseEnv(),
        NODE_ENV: 'production',
        NAFATH_MODE: 'inactive',
        PAYMENT_PROVIDER: 'mock',
        AI_PROVIDER_MODE: 'openai',
        AI_LLM_MODE: 'openai',
        AI_EMBEDDING_MODE: 'openai',
        AI_VECTOR_STORE_MODE: 'qdrant',
        AI_TEXT_EXTRACTOR_MODE: 'pdf',
        AI_OCR_MODE: 'local',
        OPENAI_API_KEY: 'sk-test-production-key-not-real',
        AI_QDRANT_URL: 'http://127.0.0.1:6333',
        S3_ENDPOINT: 'http://localhost:9000',
        S3_ACCESS_KEY: 'sjs_minio_dev',
        S3_SECRET: 'sjs_minio_dev_secret_local_only',
        S3_BUCKET: 'sjs-documents-dev',
      }),
    ).toThrow(/PAYMENT_PROVIDER=mock/);
  });

  it('refuses an unimplemented provider rather than falling back', () => {
    expect(() =>
      validateEnv({ ...baseEnv(), PAYMENT_PROVIDER: 'tap' }),
    ).toThrow(/Unsupported PAYMENT_PROVIDER/);
  });

  it('defaults to deferred payment in production without blocking boot', () => {
    const config = validateEnv({
      ...baseEnv(),
      NODE_ENV: 'production',
      NAFATH_MODE: 'inactive',
      PAYMENT_PROVIDER: 'deferred',
      AI_PROVIDER_MODE: 'openai',
      AI_LLM_MODE: 'openai',
      AI_EMBEDDING_MODE: 'openai',
      AI_VECTOR_STORE_MODE: 'qdrant',
      AI_TEXT_EXTRACTOR_MODE: 'pdf',
      AI_OCR_MODE: 'local',
      OPENAI_API_KEY: 'sk-test-production-key-not-real',
      AI_QDRANT_URL: 'http://127.0.0.1:6333',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'sjs_minio_dev',
      S3_SECRET: 'sjs_minio_dev_secret_local_only',
      S3_BUCKET: 'sjs-documents-dev',
    });
    expect(config.payments.provider).toBe('deferred');
    expect(config.nafath.mode).toBe('inactive');
  });

  it('requires a sufficiently long webhook secret for mock payments', () => {
    expect(() =>
      validateEnv({ ...baseEnv(), PAYMENT_WEBHOOK_SECRET: 'short' }),
    ).toThrow(/at least 32/);
    expect(() =>
      validateEnv({ ...baseEnv(), PAYMENT_WEBHOOK_SECRET: undefined }),
    ).toThrow(/PAYMENT_WEBHOOK_SECRET/);
  });

  it('defaults to the mock provider outside production', () => {
    expect(validateEnv(baseEnv()).payments.provider).toBe('mock');
  });
});

describe('payment rate limit guard', () => {
  const config = {
    get: () => ({ maxAttempts: 2, windowSeconds: 3600 }),
  } as unknown as ConfigService<AppConfig, true>;

  it('allows attempts up to the limit and rejects beyond it', async () => {
    let count = 0;
    const redis = {
      incrementWithTtl: jest.fn().mockImplementation(() => {
        count += 1;
        return Promise.resolve(count);
      }),
    } as unknown as RedisService;
    const guard = new PaymentRateLimitGuard(redis, config);
    const context = executionContext({ sub: 'user-1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'PAYMENT_RATE_LIMITED',
    });
  });

  it('fails closed when Redis is unavailable or the user is missing', async () => {
    const redis = {
      incrementWithTtl: jest.fn().mockRejectedValue(new Error('down')),
    } as unknown as RedisService;
    const guard = new PaymentRateLimitGuard(redis, config);

    await expect(
      guard.canActivate(executionContext({ sub: 'user-1' })),
    ).rejects.toMatchObject({ code: 'PAYMENT_RATE_LIMITED' });
    await expect(
      guard.canActivate(executionContext(undefined)),
    ).rejects.toMatchObject({ code: 'PAYMENT_RATE_LIMITED' });
  });
});
