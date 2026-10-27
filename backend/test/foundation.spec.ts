import { IsNotEmpty, IsString } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';

import { originAllowed, validateEnv } from '../src/config/env.validation';
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
    expect(config.runWorkerInProcess).toBe(false);
    expect(config.directDatabaseUrl).toBe(validEnv.DATABASE_URL);
    expect(config.redisUrl).toBe('redis://localhost:6379');
  });

  it('runs the worker in process only when the flag is true', () => {
    const config = validateEnv({
      ...validEnv,
      RUN_WORKER_IN_PROCESS: 'true',
    });
    expect(config.runWorkerInProcess).toBe(true);
  });

  it('keeps a separate direct database URL for migrations', () => {
    const direct =
      'postgresql://sjs:sjs@ep-direct.eu-central-1.aws.neon.tech/sjs_dev?sslmode=require';
    const config = validateEnv({
      ...validEnv,
      DIRECT_URL: direct,
    });
    expect(config.databaseUrl).toBe(validEnv.DATABASE_URL);
    expect(config.directDatabaseUrl).toBe(direct);
  });

  it('accepts an Upstash rediss URL', () => {
    const config = validateEnv({
      ...validEnv,
      REDIS_URL: 'rediss://default:secret@example.upstash.io:6379',
    });
    expect(config.redisUrl).toBe(
      'rediss://default:secret@example.upstash.io:6379',
    );
  });

  it('trims whitespace around REDIS_URL', () => {
    const config = validateEnv({
      ...validEnv,
      REDIS_URL: '  rediss://default:secret@example.upstash.io:6379\n',
    });
    expect(config.redisUrl).toBe(
      'rediss://default:secret@example.upstash.io:6379',
    );
  });

  it('rejects a Redis URL that is not redis or rediss', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        REDIS_URL: 'http://localhost:6379',
      }),
    ).toThrow(/REDIS_URL/);
  });

  it('matches a Vercel preview host and rejects other hosts', () => {
    expect(
      originAllowed('https://sjs-abc.vercel.app', ['https://*.vercel.app']),
    ).toBe(true);
    expect(
      originAllowed('https://app.vercel.app', ['https://app.vercel.app']),
    ).toBe(true);
    expect(originAllowed('https://evil.example', ['https://*.vercel.app'])).toBe(
      false,
    );
    expect(
      originAllowed('https://app.vercel.app/extra', ['https://*.vercel.app']),
    ).toBe(false);
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
    expect(config.s3?.forcePathStyle).toBe(true);
    expect(config.s3?.region).toBe('us-east-1');
  });

  it('keeps an explicit object-storage region such as R2 auto', () => {
    const config = validateEnv({
      ...validEnv,
      S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
      S3_ACCESS_KEY: 'r2-key',
      S3_SECRET: 'r2-secret',
      S3_BUCKET: 'sjs-documents',
      S3_REGION: 'auto',
    });
    expect(config.s3).toMatchObject({
      region: 'auto',
      forcePathStyle: true,
      endpoint: 'https://account.r2.cloudflarestorage.com',
    });
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
