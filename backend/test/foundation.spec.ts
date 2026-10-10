import { IsNotEmpty, IsString } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';

import { validateEnv } from '../src/config/env.validation';
import { wrapError, wrapSuccess } from '../src/shared/http/envelope';
import { validationPipeOptions } from '../src/shared/validation/validation.config';

class SampleDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

const validEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  LOG_LEVEL: 'info',
  CORS_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://sjs:sjs_dev_only_change_me@localhost:5432/sjs_dev',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'local-dev-jwt-access-secret-do-not-reuse',
  JWT_ACCESS_EXPIRES_IN: '15m',
  MOCK_NAFATH_CODE: '72',
  PAYMENT_WEBHOOK_SECRET: 'local-dev-payment-webhook-secret-do-not-reuse',
};

describe('env validation', () => {
  it('accepts a complete development configuration', () => {
    const config = validateEnv(validEnv);

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.corsOrigins).toEqual(['http://localhost:5173']);
    expect(config.jwt.accessExpiresIn).toBe('15m');
    expect(config.nafath.mode).toBe('mock');
    expect(config.nafath.mockCode).toBe(72);
    expect(config.s3).toBeNull();
  });

  it('rejects NODE_ENV=production with NAFATH_MODE=mock', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        NAFATH_MODE: 'mock',
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
      }),
    ).toThrow(/NAFATH_MODE=mock cannot run when NODE_ENV=production/);
  });

  it('accepts NODE_ENV=production with deferred Nafath/Payment and real AI', () => {
    const config = validateEnv({
      ...validEnv,
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
    expect(config.nafath.mode).toBe('inactive');
    expect(config.payments.provider).toBe('deferred');
    expect(config.ai.providerMode).toBe('openai');
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        DATABASE_URL: undefined,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('fails fast when DATABASE_URL is not PostgreSQL', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        DATABASE_URL: 'mysql://localhost/sjs',
      }),
    ).toThrow(/PostgreSQL/);
  });

  it('rejects wildcard CORS', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        CORS_ORIGINS: '*',
      }),
    ).toThrow(/\*/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'local',
      }),
    ).toThrow(/NODE_ENV/);
  });
});

describe('response envelope', () => {
  it('wraps success payloads so frontend can read response.data', () => {
    const body = wrapSuccess({ status: 'ok' });

    expect(body.data).toEqual({ status: 'ok' });
    expect(body.meta.version).toBe('v1');
    expect(body.meta.timestamp).toEqual(expect.any(String));
  });

  it('attaches pagination metadata when provided', () => {
    const body = wrapSuccess([], {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });

    expect(body.meta.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it('wraps errors without leaking internals', () => {
    const body = wrapError(
      'VALIDATION_ERROR',
      'name should not be empty',
      'البيانات المرسلة غير صالحة',
      400,
    );

    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.statusCode).toBe(400);
    expect(body.meta.version).toBe('v1');
  });
});

describe('validation pipeline', () => {
  const pipe = new ValidationPipe({ ...validationPipeOptions });

  it('strips unknown properties and accepts a valid body', async () => {
    const result = await pipe.transform(
      { name: 'ok' },
      { type: 'body', metatype: SampleDto },
    );

    expect(result).toEqual({ name: 'ok' });
  });

  it('rejects non-whitelisted properties', async () => {
    await expect(
      pipe.transform(
        { name: 'ok', extra: true },
        { type: 'body', metatype: SampleDto },
      ),
    ).rejects.toBeDefined();
  });

  it('rejects an invalid body', async () => {
    await expect(
      pipe.transform({ name: '' }, { type: 'body', metatype: SampleDto }),
    ).rejects.toBeDefined();
  });
});
