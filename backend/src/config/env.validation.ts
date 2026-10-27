export type NodeEnv = 'development' | 'test' | 'staging' | 'production';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface S3Config {
  endpoint: string;
  accessKey: string;
  secret: string;
  bucket: string;
  region: string;
  /** R2 and MinIO are path-style. The client always sends path-style requests. */
  forcePathStyle: true;
}

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
}

/**
 * Nafath is DEFERRED for product delivery.
 * - `inactive` — production-safe default; endpoint fails closed; not a boot dependency
 * - `mock` — development/test only
 * - `real` — future official client (credentials required; HTTP contract not in repo)
 */
export type NafathMode = 'inactive' | 'mock' | 'real';

/**
 * Identity provider configuration.
 * Active application auth is email/password. Nafath never blocks production boot.
 */
export interface NafathConfig {
  mode: NafathMode;
  /** DEVELOPMENT ONLY when mode=mock. */
  mockCode: number;
  /** Required when mode=real. Placeholder for official client registration. */
  clientId: string | null;
  /** Required when mode=real. Never log or commit. */
  clientSecret: string | null;
  /**
   * Required when mode=real. Official base URL supplied by the accreditation
   * package — not invented by this repository.
   */
  baseUrl: string | null;
}

export interface AuthRateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

export interface DocumentUploadRateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

export interface ConsultationBookingRateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

/**
 * Payment is DEFERRED for product delivery.
 * - `deferred` — production-safe; initiate/webhook fail with controlled errors
 * - `mock` — development/test only (HMAC local adapter); never selected in production
 */
export type PaymentProviderName = 'deferred' | 'mock';

export interface PaymentsConfig {
  /**
   * Selected provider adapter. Real gateways are out of scope for Phase S.
   * Production must use `deferred` so payment absence does not block boot.
   */
  provider: PaymentProviderName;
  /**
   * HMAC secret used to verify provider webhook deliveries.
   * Required for `mock`; unused for `deferred` (may be empty placeholder).
   */
  webhookSecret: string;
}

export interface PaymentRateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

/**
 * Worker LLM / analysis GENERATE path (`LLM_PROVIDER`).
 * Production must be `openai`. Mock is test/dev only — never silently swapped.
 */
export type AiProviderMode = 'mock' | 'openai';

/** Embedding adapter. Separate from LLM `providerMode`. */
export type AiEmbeddingMode = 'mock' | 'openai';

/** Vector index backend. */
export type AiVectorStoreMode = 'mock' | 'qdrant';

/** Answer / chat LLM adapter (Phase H / Guide). Independent of worker providerMode. */
export type AiLlmMode = 'mock' | 'openai';

/** `pdf` reads a real PDF text layer and OCRs pages without usable text. */
export type AiTextExtractorMode = 'mock' | 'pdf';

/** `local` runs in-process Tesseract via tesseract.js. No external OCR API. */
export type AiOcrMode = 'mock' | 'local';

const AI_PROVIDER_MODES: readonly AiProviderMode[] = ['mock', 'openai'];
const AI_TEXT_EXTRACTOR_MODES: readonly AiTextExtractorMode[] = ['mock', 'pdf'];
const AI_OCR_MODES: readonly AiOcrMode[] = ['mock', 'local'];
const AI_EMBEDDING_MODES: readonly AiEmbeddingMode[] = ['mock', 'openai'];
const AI_VECTOR_STORE_MODES: readonly AiVectorStoreMode[] = ['mock', 'qdrant'];
const AI_LLM_MODES: readonly AiLlmMode[] = ['mock', 'openai'];

/** OpenAI text-embedding-3-small default output size (also max for that model family when set). */
export const OPENAI_EMBEDDING_3_SMALL_DIMENSIONS = 1536;
export const OPENAI_EMBEDDING_3_SMALL_MODEL = 'text-embedding-3-small';
export const DEFAULT_MOCK_EMBEDDING_DIMENSIONS = 8;
export const DEFAULT_QDRANT_COLLECTION = 'legal_chunks_v1';
/** Conservative chat default for legal RAG (configurable). */
export const DEFAULT_LLM_MODEL = 'gpt-4o-mini';

export interface AiConfig {
  /**
   * Worker GENERATE LLM (`LLM_PROVIDER`). Use `openai` in production.
   * Embeddings / vector / answer LLM are configured separately.
   */
  providerMode: AiProviderMode;
  /** Namespace for BullMQ keys so AI queues cannot collide with other users of Redis. */
  queuePrefix: string;
  /** Bounded attempts per job. There is no unlimited retry path. */
  jobAttempts: number;
  /** Base delay for exponential backoff between attempts. */
  jobBackoffMs: number;
  workerConcurrency: number;
  /**
   * Selected document text extractor. Separate from `providerMode` because
   * real text extraction is available before any real LLM or embedding adapter.
   */
  textExtractorMode: AiTextExtractorMode;
  /** Upper bound on pages processed per document. Bounds CPU and memory. */
  pdfMaxPages: number;
  /**
   * Selected OCR adapter. Separate from `providerMode` so local OCR can be
   * exercised while LLM/embedding remain mock.
   */
  ocrMode: AiOcrMode;
  /** Render DPI for PDF pages destined for OCR. */
  ocrDpi: number;
  /** Hard cap on width×height of a rendered page. */
  ocrMaxPixels: number;
  /** Per-page OCR wall-clock budget in milliseconds. */
  ocrTimeoutMs: number;
  /**
   * Local directory containing `eng.traineddata` and `ara.traineddata`.
   * Never downloaded at runtime in production; provisioned by Docker/script.
   */
  ocrLangPath: string;
  /** Tesseract language codes joined with `+`, e.g. `ara+eng`. */
  ocrLanguages: string;
  /** Default `fast`. `best` selects tessdata_best for Arabic. */
  ocrTessdata: 'best' | 'fast';
  /** Pages rendered at once. OCR itself stays serialized. Capped at 4. */
  ocrConcurrency: number;
  /** Document advisor is experimental at launch. Default true. */
  advisorExperimental: boolean;
  /**
   * Maximum UTF-16 length of a DocumentChunk. Soft-breaks prefer paragraphs
   * and newlines; hard splits never cut surrogate pairs. Default 2000.
   */
  chunkMaxChars: number;
  /**
   * Overlap between consecutive chunks (UTF-16). Default 0 (legacy).
   * Must be less than chunkMaxChars. Configurable via AI_CHUNK_OVERLAP.
   */
  chunkOverlap: number;
  /** Embedding adapter. Independent of LLM `providerMode`. */
  embeddingMode: AiEmbeddingMode;
  /** Required when embeddingMode=openai. Never logged. */
  embeddingApiKey: string | null;
  /** Exact model id, e.g. text-embedding-3-small. */
  embeddingModel: string;
  /** Must match the model output and the Qdrant collection size. */
  embeddingDimensions: number;
  /** Bounded texts per embedding API call. */
  embeddingBatchSize: number;
  vectorStoreMode: AiVectorStoreMode;
  qdrantUrl: string | null;
  qdrantApiKey: string | null;
  qdrantCollection: string;
  /** Default top-K for evidence retrieval. */
  retrievalDefaultLimit: number;
  /** Hard upper bound on top-K (DTO + service). */
  retrievalMaxLimit: number;
  /**
   * Optional default cosine similarity floor for retrieval. null = no floor
   * unless the client sends minScore.
   */
  retrievalDefaultMinScore: number | null;
  /** Answer LLM adapter. Independent of worker `providerMode`. */
  llmMode: AiLlmMode;
  /** Required when llmMode=openai. Never logged. */
  llmApiKey: string | null;
  /** Chat model id, e.g. gpt-4o-mini. */
  llmModel: string;
  llmMaxOutputTokens: number;
  llmTimeoutMs: number;
  llmTemperature: number;
  llmMaxEvidenceItems: number;
  llmMaxEvidenceChars: number;
  /** Max UTF-16 length of a Guide user/assistant message body. */
  guideMaxMessageChars: number;
  /** Max messages (USER+ASSISTANT) stored per Guide session. */
  guideMaxMessages: number;
  /** Session TTL from creation; expired sessions reject further answers. */
  guideSessionTtlHours: number;
}

export interface AiAnalysisRateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

export interface AiRetrievalRateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

export interface AiAnswerRateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

export interface AiGuideRateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

export interface KioskRateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  logLevel: LogLevel;
  corsOrigins: string[];
  /**
   * Express `trust proxy` hop count. Production behind Nginx should be >= 1.
   * API must not be publicly published when > 0 (otherwise clients can spoof XFF).
   */
  trustProxyHops: number;
  databaseUrl: string;
  /** Direct Postgres URL for Prisma Migrate. Falls back to `databaseUrl` when unset. */
  directDatabaseUrl: string;
  redisUrl: string;
  /**
   * When true, the API process also starts the BullMQ consumer.
   * Leave false when a separate `node dist/worker.js` process is running.
   */
  runWorkerInProcess: boolean;
  s3: S3Config | null;
  jwt: JwtConfig;
  nafath: NafathConfig;
  authRateLimit: AuthRateLimitConfig;
  documentUploadRateLimit: DocumentUploadRateLimitConfig;
  consultationBookingRateLimit: ConsultationBookingRateLimitConfig;
  payments: PaymentsConfig;
  paymentRateLimit: PaymentRateLimitConfig;
  ai: AiConfig;
  aiAnalysisRateLimit: AiAnalysisRateLimitConfig;
  aiRetrievalRateLimit: AiRetrievalRateLimitConfig;
  aiAnswerRateLimit: AiAnswerRateLimitConfig;
  aiGuideRateLimit: AiGuideRateLimitConfig;
  /** Short-lived kiosk session lifetime in seconds. */
  kioskSessionTtlSeconds: number;
  kioskRateLimit: KioskRateLimitConfig;
}

const NODE_ENVS: readonly NodeEnv[] = [
  'development',
  'test',
  'staging',
  'production',
];

const LOG_LEVELS: readonly LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
];

const requireString = (
  env: NodeJS.ProcessEnv,
  key: string,
): string => {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const isNodeEnv = (value: string): value is NodeEnv =>
  (NODE_ENVS as readonly string[]).includes(value);

const isLogLevel = (value: string): value is LogLevel =>
  (LOG_LEVELS as readonly string[]).includes(value);

const parsePort = (raw: string | undefined): number => {
  const value = raw?.trim() || '3000';
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: "${value}"`);
  }
  return port;
};

const parseCorsOrigins = (raw: string): string[] => {
  const origins = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one origin');
  }

  if (origins.some((origin) => origin === '*')) {
    throw new Error('CORS_ORIGINS must not include "*"');
  }

  return origins;
};

/**
 * Exact origins, or a host wildcard such as `https://*.vercel.app`.
 * A bare `*` is rejected by `parseCorsOrigins`.
 */
export const originAllowed = (
  origin: string,
  allowed: readonly string[],
): boolean =>
  allowed.some((entry) => {
    if (!entry.includes('*')) {
      return entry === origin;
    }
    const pattern = `^${entry
      .replace(/[.+?^${}()|[\]\\*]/g, '\\$&')
      .replace(/\\\*/g, '[^/]*')}$`;
    return new RegExp(pattern).test(origin);
  });

const parseDatabaseUrl = (raw: string, key = 'DATABASE_URL'): string => {
  if (!raw.startsWith('postgresql://') && !raw.startsWith('postgres://')) {
    throw new Error(
      `${key} must be a PostgreSQL connection string (postgresql:// or postgres://)`,
    );
  }
  return raw;
};

/** `redis://` for local Redis, `rediss://` for Upstash TLS. */
const parseRedisUrl = (raw: string): string => {
  if (!raw.startsWith('redis://') && !raw.startsWith('rediss://')) {
    throw new Error('REDIS_URL must start with redis:// or rediss://');
  }
  return raw;
};

const parseS3 = (
  env: NodeJS.ProcessEnv,
  nodeEnv: NodeEnv,
): S3Config | null => {
  const endpoint =
    env.S3_ENDPOINT?.trim() || env.MINIO_ENDPOINT?.trim() || undefined;
  const accessKey =
    env.S3_ACCESS_KEY?.trim() || env.MINIO_ACCESS_KEY?.trim() || undefined;
  const secret =
    env.S3_SECRET?.trim() || env.MINIO_SECRET_KEY?.trim() || undefined;
  const bucket =
    env.S3_BUCKET?.trim() || env.MINIO_BUCKET?.trim() || undefined;

  const provided = [endpoint, accessKey, secret, bucket].filter(Boolean);
  if (provided.length === 0) {
    if (nodeEnv === 'production') {
      throw new Error(
        'Production requires object storage. Set S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET/S3_BUCKET (or MINIO_* aliases).',
      );
    }
    return null;
  }
  if (provided.length !== 4) {
    throw new Error(
      'S3/MinIO configuration is incomplete. Set ENDPOINT, ACCESS_KEY, SECRET, and BUCKET together (S3_* or MINIO_*), or omit all four outside production.',
    );
  }

  return {
    endpoint: endpoint as string,
    accessKey: accessKey as string,
    secret: secret as string,
    bucket: bucket as string,
    region: env.S3_REGION?.trim() || 'us-east-1',
    forcePathStyle: true,
  };
};

const parseOptionalBool = (
  raw: string | undefined,
  fallback: boolean,
  key: string,
): boolean => {
  const value = raw?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  throw new Error(`${key} must be true or false`);
};

const parseTessdataVariant = (raw: string | undefined): 'best' | 'fast' => {
  const value = raw?.trim().toLowerCase() || 'fast';
  if (value !== 'best' && value !== 'fast') {
    throw new Error('AI_OCR_TESSDATA must be best or fast');
  }
  return value;
};

const parsePositiveInt = (
  raw: string | undefined,
  fallback: number,
  key: string,
): number => {
  const value = raw?.trim();
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${key} must be a positive integer`);
  }
  return parsed;
};

const parseNonNegativeInt = (
  raw: string | undefined,
  fallback: number,
  key: string,
): number => {
  const value = raw?.trim();
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }
  return parsed;
};

/** Empty/unset → null (no default floor). Otherwise must be in [0, 1]. */
const parseOptionalUnitInterval = (
  raw: string | undefined,
  key: string,
): number | null => {
  const value = raw?.trim();
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${key} must be a number between 0 and 1 inclusive`);
  }
  return parsed;
};

const parseJwt = (env: NodeJS.ProcessEnv): JwtConfig => {
  const accessSecret =
    env.JWT_ACCESS_SECRET?.trim() || env.JWT_SECRET?.trim() || '';
  if (!accessSecret) {
    throw new Error('Missing required environment variable: JWT_ACCESS_SECRET (or JWT_SECRET)');
  }
  if (accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET (or JWT_SECRET) must be at least 32 characters');
  }

  return {
    accessSecret,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN?.trim() || '15m',
  };
};

const NAFATH_MODES: readonly NafathMode[] = ['inactive', 'mock', 'real'];

/**
 * Exported for unit tests.
 * Production: NAFATH_MODE=inactive (deferred — does not block boot).
 * Mock is refused in production. Real requires official credential placeholders.
 */
export const parseNafath = (
  env: NodeJS.ProcessEnv,
  nodeEnv: NodeEnv,
): NafathConfig => {
  const defaultMode: NafathMode =
    nodeEnv === 'production' ? 'inactive' : 'mock';
  const mode = (env.NAFATH_MODE?.trim() || defaultMode) as NafathMode;
  if (!NAFATH_MODES.includes(mode)) {
    throw new Error(
      `Unsupported NAFATH_MODE: "${mode}". Supported modes: ${NAFATH_MODES.join(', ')}.`,
    );
  }

  if (mode === 'mock' && nodeEnv === 'production') {
    throw new Error(
      'NAFATH_MODE=mock cannot run when NODE_ENV=production. Use NAFATH_MODE=inactive (deferred) or NAFATH_MODE=real with official credentials.',
    );
  }

  const rawCode = env.MOCK_NAFATH_CODE?.trim();
  const mockCode = rawCode ? Number(rawCode) : 72;
  if (!Number.isInteger(mockCode) || mockCode < 0 || mockCode > 99) {
    throw new Error('MOCK_NAFATH_CODE must be an integer from 0 to 99');
  }

  if (mode === 'inactive' || mode === 'mock') {
    return {
      mode,
      mockCode,
      clientId: null,
      clientSecret: null,
      baseUrl: null,
    };
  }

  const clientId = requireString(env, 'NAFATH_CLIENT_ID');
  const clientSecret = requireString(env, 'NAFATH_CLIENT_SECRET');
  const baseUrl = requireString(env, 'NAFATH_BASE_URL');

  if (!/^https:\/\//i.test(baseUrl)) {
    throw new Error('NAFATH_BASE_URL must be an https:// URL supplied by the official accreditation package.');
  }

  return {
    mode: 'real',
    mockCode,
    clientId,
    clientSecret,
    baseUrl,
  };
};

const parseAuthRateLimit = (env: NodeJS.ProcessEnv): AuthRateLimitConfig => ({
  maxAttempts: parsePositiveInt(env.AUTH_RATE_LIMIT_MAX, 10, 'AUTH_RATE_LIMIT_MAX'),
  windowSeconds: parsePositiveInt(
    env.AUTH_RATE_LIMIT_WINDOW_SEC,
    60,
    'AUTH_RATE_LIMIT_WINDOW_SEC',
  ),
});

const parseDocumentUploadRateLimit = (
  env: NodeJS.ProcessEnv,
): DocumentUploadRateLimitConfig => ({
  maxAttempts: parsePositiveInt(
    env.DOCUMENT_UPLOAD_RATE_LIMIT_MAX,
    20,
    'DOCUMENT_UPLOAD_RATE_LIMIT_MAX',
  ),
  windowSeconds: parsePositiveInt(
    env.DOCUMENT_UPLOAD_RATE_LIMIT_WINDOW_SEC,
    900,
    'DOCUMENT_UPLOAD_RATE_LIMIT_WINDOW_SEC',
  ),
});

const parseConsultationBookingRateLimit = (
  env: NodeJS.ProcessEnv,
): ConsultationBookingRateLimitConfig => ({
  maxAttempts: parsePositiveInt(
    env.CONSULTATION_BOOKING_RATE_LIMIT_MAX,
    10,
    'CONSULTATION_BOOKING_RATE_LIMIT_MAX',
  ),
  windowSeconds: parsePositiveInt(
    env.CONSULTATION_BOOKING_RATE_LIMIT_WINDOW_SEC,
    3600,
    'CONSULTATION_BOOKING_RATE_LIMIT_WINDOW_SEC',
  ),
});

const PAYMENT_PROVIDERS: readonly PaymentProviderName[] = ['deferred', 'mock'];

const parsePayments = (
  env: NodeJS.ProcessEnv,
  nodeEnv: NodeEnv,
): PaymentsConfig => {
  const defaultProvider: PaymentProviderName =
    nodeEnv === 'production' ? 'deferred' : 'mock';
  const provider = (env.PAYMENT_PROVIDER?.trim() ||
    defaultProvider) as PaymentProviderName;

  if (!PAYMENT_PROVIDERS.includes(provider)) {
    throw new Error(
      `Unsupported PAYMENT_PROVIDER: "${provider}". Supported: ${PAYMENT_PROVIDERS.join(', ')}. Real gateways are DEFERRED — use deferred in production.`,
    );
  }

  if (provider === 'mock' && nodeEnv === 'production') {
    throw new Error(
      'PAYMENT_PROVIDER=mock cannot run when NODE_ENV=production. Use PAYMENT_PROVIDER=deferred (payment integration is not part of current delivery).',
    );
  }

  if (provider === 'deferred') {
    return {
      provider: 'deferred',
      webhookSecret:
        env.PAYMENT_WEBHOOK_SECRET?.trim() ||
        'deferred-payment-no-webhook-secret-unused',
    };
  }

  const webhookSecret = requireString(env, 'PAYMENT_WEBHOOK_SECRET');
  if (webhookSecret.length < 32) {
    throw new Error('PAYMENT_WEBHOOK_SECRET must be at least 32 characters');
  }

  return { provider: 'mock', webhookSecret };
};

const parsePaymentRateLimit = (
  env: NodeJS.ProcessEnv,
): PaymentRateLimitConfig => ({
  maxAttempts: parsePositiveInt(
    env.PAYMENT_RATE_LIMIT_MAX,
    20,
    'PAYMENT_RATE_LIMIT_MAX',
  ),
  windowSeconds: parsePositiveInt(
    env.PAYMENT_RATE_LIMIT_WINDOW_SEC,
    3600,
    'PAYMENT_RATE_LIMIT_WINDOW_SEC',
  ),
});

/**
 * Exported so fail-closed AI behaviour is directly testable.
 * Production requires real OpenAI + Qdrant + PDF extract + local OCR.
 * There is no silent fallback from real → mock.
 */
export const parseAi = (env: NodeJS.ProcessEnv, nodeEnv: NodeEnv): AiConfig => {
  const isProd = nodeEnv === 'production';

  const providerMode = (env.AI_PROVIDER_MODE?.trim() ||
    (isProd ? '' : 'mock')) as AiProviderMode | '';
  if (!providerMode || !AI_PROVIDER_MODES.includes(providerMode as AiProviderMode)) {
    throw new Error(
      isProd
        ? 'Production requires AI_PROVIDER_MODE=openai (worker LLM). Mock AI is forbidden. Set OPENAI_API_KEY and related AI_* modes.'
        : `Unsupported AI_PROVIDER_MODE: "${providerMode || '(empty)'}". Supported: ${AI_PROVIDER_MODES.join(', ')}.`,
    );
  }
  if (providerMode === 'mock' && isProd) {
    throw new Error(
      'AI_PROVIDER_MODE=mock cannot run when NODE_ENV=production. Set AI_PROVIDER_MODE=openai with OPENAI_API_KEY.',
    );
  }

  const textExtractorMode = (env.AI_TEXT_EXTRACTOR_MODE?.trim() ||
    (isProd ? 'pdf' : 'mock')) as AiTextExtractorMode;

  if (!AI_TEXT_EXTRACTOR_MODES.includes(textExtractorMode)) {
    throw new Error(
      `Unsupported AI_TEXT_EXTRACTOR_MODE: "${textExtractorMode}". Supported modes: ${AI_TEXT_EXTRACTOR_MODES.join(', ')}.`,
    );
  }

  if (textExtractorMode === 'mock' && isProd) {
    throw new Error(
      'AI_TEXT_EXTRACTOR_MODE=mock cannot run when NODE_ENV=production. Configure AI_TEXT_EXTRACTOR_MODE=pdf.',
    );
  }

  const ocrMode = (env.AI_OCR_MODE?.trim() ||
    (isProd ? 'local' : 'mock')) as AiOcrMode;

  if (!AI_OCR_MODES.includes(ocrMode)) {
    throw new Error(
      `Unsupported AI_OCR_MODE: "${ocrMode}". Supported modes: ${AI_OCR_MODES.join(', ')}.`,
    );
  }

  if (ocrMode === 'mock' && isProd) {
    throw new Error(
      'AI_OCR_MODE=mock cannot run when NODE_ENV=production. Configure AI_OCR_MODE=local with tessdata.',
    );
  }

  const embeddingMode = (env.AI_EMBEDDING_MODE?.trim() ||
    (isProd ? 'openai' : 'mock')) as AiEmbeddingMode;
  if (!AI_EMBEDDING_MODES.includes(embeddingMode)) {
    throw new Error(
      `Unsupported AI_EMBEDDING_MODE: "${embeddingMode}". Supported modes: ${AI_EMBEDDING_MODES.join(', ')}.`,
    );
  }
  if (embeddingMode === 'mock' && isProd) {
    throw new Error(
      'AI_EMBEDDING_MODE=mock cannot run when NODE_ENV=production. Configure AI_EMBEDDING_MODE=openai.',
    );
  }

  const embeddingApiKey =
    env.AI_EMBEDDING_API_KEY?.trim() ||
    env.OPENAI_API_KEY?.trim() ||
    null;
  const embeddingModel =
    env.OPENAI_EMBEDDING_MODEL?.trim() ||
    env.AI_EMBEDDING_MODEL?.trim() ||
    OPENAI_EMBEDDING_3_SMALL_MODEL;
  const embeddingDimensions = parsePositiveInt(
    env.AI_EMBEDDING_DIMENSIONS,
    embeddingMode === 'openai'
      ? OPENAI_EMBEDDING_3_SMALL_DIMENSIONS
      : DEFAULT_MOCK_EMBEDDING_DIMENSIONS,
    'AI_EMBEDDING_DIMENSIONS',
  );
  const embeddingBatchSize = parsePositiveInt(
    env.AI_EMBEDDING_BATCH_SIZE,
    32,
    'AI_EMBEDDING_BATCH_SIZE',
  );

  if (embeddingMode === 'openai') {
    if (!embeddingApiKey) {
      throw new Error(
        'AI_EMBEDDING_MODE=openai requires AI_EMBEDDING_API_KEY or OPENAI_API_KEY.',
      );
    }
    if (embeddingDimensions > OPENAI_EMBEDDING_3_SMALL_DIMENSIONS) {
      throw new Error(
        `AI_EMBEDDING_DIMENSIONS cannot exceed ${OPENAI_EMBEDDING_3_SMALL_DIMENSIONS} for ${OPENAI_EMBEDDING_3_SMALL_MODEL}.`,
      );
    }
  }

  const vectorStoreMode = (env.AI_VECTOR_STORE_MODE?.trim() ||
    (embeddingMode === 'openai' || isProd
      ? 'qdrant'
      : 'mock')) as AiVectorStoreMode;
  if (!AI_VECTOR_STORE_MODES.includes(vectorStoreMode)) {
    throw new Error(
      `Unsupported AI_VECTOR_STORE_MODE: "${vectorStoreMode}". Supported modes: ${AI_VECTOR_STORE_MODES.join(', ')}.`,
    );
  }
  if (vectorStoreMode === 'mock' && isProd) {
    throw new Error(
      'AI_VECTOR_STORE_MODE=mock cannot run when NODE_ENV=production. Configure AI_VECTOR_STORE_MODE=qdrant.',
    );
  }
  if (embeddingMode === 'openai' && vectorStoreMode !== 'qdrant') {
    throw new Error(
      'AI_EMBEDDING_MODE=openai requires AI_VECTOR_STORE_MODE=qdrant.',
    );
  }

  const qdrantUrl =
    env.AI_QDRANT_URL?.trim() || env.QDRANT_URL?.trim() || null;
  const qdrantApiKey =
    env.AI_QDRANT_API_KEY?.trim() || env.QDRANT_API_KEY?.trim() || null;
  const qdrantCollection =
    env.AI_QDRANT_COLLECTION?.trim() || DEFAULT_QDRANT_COLLECTION;

  if (vectorStoreMode === 'qdrant' && !qdrantUrl) {
    throw new Error(
      'AI_VECTOR_STORE_MODE=qdrant requires AI_QDRANT_URL or QDRANT_URL (e.g. http://127.0.0.1:6333).',
    );
  }

  const llmMode = (env.AI_LLM_MODE?.trim() ||
    (isProd || providerMode === 'openai' ? 'openai' : 'mock')) as AiLlmMode;
  if (!AI_LLM_MODES.includes(llmMode)) {
    throw new Error(
      `Unsupported AI_LLM_MODE: "${llmMode}". Supported modes: ${AI_LLM_MODES.join(', ')}.`,
    );
  }
  if (llmMode === 'mock' && isProd) {
    throw new Error(
      'AI_LLM_MODE=mock cannot run when NODE_ENV=production. Configure AI_LLM_MODE=openai.',
    );
  }
  if (providerMode === 'openai' && llmMode !== 'openai') {
    throw new Error(
      'AI_PROVIDER_MODE=openai requires AI_LLM_MODE=openai (no mixed mock answer LLM).',
    );
  }

  const llmApiKey =
    env.AI_LLM_API_KEY?.trim() ||
    env.OPENAI_API_KEY?.trim() ||
    env.AI_EMBEDDING_API_KEY?.trim() ||
    null;
  const llmModel =
    env.OPENAI_CHAT_MODEL?.trim() ||
    env.AI_LLM_MODEL?.trim() ||
    DEFAULT_LLM_MODEL;
  const llmMaxOutputTokens = parsePositiveInt(
    env.AI_LLM_MAX_OUTPUT_TOKENS,
    1024,
    'AI_LLM_MAX_OUTPUT_TOKENS',
  );
  const llmTimeoutMs = parsePositiveInt(
    env.AI_LLM_TIMEOUT_MS,
    30_000,
    'AI_LLM_TIMEOUT_MS',
  );
  const llmTemperature = parseOptionalUnitInterval(
    env.AI_LLM_TEMPERATURE,
    'AI_LLM_TEMPERATURE',
  );
  const llmMaxEvidenceItems = parsePositiveInt(
    env.AI_LLM_MAX_EVIDENCE_ITEMS,
    5,
    'AI_LLM_MAX_EVIDENCE_ITEMS',
  );
  const llmMaxEvidenceChars = parsePositiveInt(
    env.AI_LLM_MAX_EVIDENCE_CHARS,
    8000,
    'AI_LLM_MAX_EVIDENCE_CHARS',
  );

  if ((llmMode === 'openai' || providerMode === 'openai') && !llmApiKey) {
    throw new Error(
      'OpenAI LLM requires AI_LLM_API_KEY or OPENAI_API_KEY. Missing key — refusing to start (no mock fallback).',
    );
  }

  const result = {
    providerMode,
    textExtractorMode,
    ocrMode,
    pdfMaxPages: parsePositiveInt(env.AI_PDF_MAX_PAGES, 100, 'AI_PDF_MAX_PAGES'),
    ocrDpi: parsePositiveInt(env.AI_OCR_DPI, 300, 'AI_OCR_DPI'),
    ocrMaxPixels: parsePositiveInt(
      env.AI_OCR_MAX_PIXELS,
      16_777_216,
      'AI_OCR_MAX_PIXELS',
    ),
    ocrTimeoutMs: parsePositiveInt(
      env.AI_OCR_TIMEOUT_MS,
      60_000,
      'AI_OCR_TIMEOUT_MS',
    ),
    ocrLangPath: env.AI_OCR_LANG_PATH?.trim() || '.ocr-data',
    ocrLanguages: env.AI_OCR_LANGUAGES?.trim() || 'ara+eng',
    ocrTessdata: parseTessdataVariant(env.AI_OCR_TESSDATA),
    ocrConcurrency: Math.min(
      4,
      parsePositiveInt(env.AI_OCR_CONCURRENCY, 2, 'AI_OCR_CONCURRENCY'),
    ),
    chunkMaxChars: parsePositiveInt(
      env.AI_CHUNK_MAX_CHARS,
      2000,
      'AI_CHUNK_MAX_CHARS',
    ),
    chunkOverlap: (() => {
      const raw = env.AI_CHUNK_OVERLAP?.trim();
      if (!raw) {
        return 0;
      }
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error('AI_CHUNK_OVERLAP must be an integer >= 0');
      }
      return parsed;
    })(),
    embeddingMode,
    embeddingApiKey,
    embeddingModel,
    embeddingDimensions,
    embeddingBatchSize,
    vectorStoreMode,
    qdrantUrl,
    qdrantApiKey,
    qdrantCollection,
    retrievalDefaultLimit: parsePositiveInt(
      env.AI_RETRIEVAL_DEFAULT_LIMIT,
      5,
      'AI_RETRIEVAL_DEFAULT_LIMIT',
    ),
    retrievalMaxLimit: parsePositiveInt(
      env.AI_RETRIEVAL_MAX_LIMIT,
      20,
      'AI_RETRIEVAL_MAX_LIMIT',
    ),
    retrievalDefaultMinScore: parseOptionalUnitInterval(
      env.AI_RETRIEVAL_DEFAULT_MIN_SCORE,
      'AI_RETRIEVAL_DEFAULT_MIN_SCORE',
    ),
    llmMode,
    llmApiKey,
    llmModel,
    llmMaxOutputTokens,
    llmTimeoutMs,
    llmTemperature: llmTemperature ?? 0,
    llmMaxEvidenceItems,
    llmMaxEvidenceChars,
    guideMaxMessageChars: parsePositiveInt(
      env.AI_GUIDE_MAX_MESSAGE_CHARS,
      2000,
      'AI_GUIDE_MAX_MESSAGE_CHARS',
    ),
    guideMaxMessages: parsePositiveInt(
      env.AI_GUIDE_MAX_MESSAGES,
      40,
      'AI_GUIDE_MAX_MESSAGES',
    ),
    guideSessionTtlHours: parsePositiveInt(
      env.AI_GUIDE_SESSION_TTL_HOURS,
      48,
      'AI_GUIDE_SESSION_TTL_HOURS',
    ),
    queuePrefix: env.AI_QUEUE_PREFIX?.trim() || 'sjs:ai',
    jobAttempts: parsePositiveInt(env.AI_JOB_ATTEMPTS, 3, 'AI_JOB_ATTEMPTS'),
    jobBackoffMs: parsePositiveInt(
      env.AI_JOB_BACKOFF_MS,
      1000,
      'AI_JOB_BACKOFF_MS',
    ),
    workerConcurrency: parsePositiveInt(
      env.AI_WORKER_CONCURRENCY,
      2,
      'AI_WORKER_CONCURRENCY',
    ),
    advisorExperimental: parseOptionalBool(
      env.AI_ADVISOR_EXPERIMENTAL,
      true,
      'AI_ADVISOR_EXPERIMENTAL',
    ),
  };

  if (result.retrievalDefaultLimit > result.retrievalMaxLimit) {
    throw new Error(
      'AI_RETRIEVAL_DEFAULT_LIMIT cannot exceed AI_RETRIEVAL_MAX_LIMIT',
    );
  }

  if (result.chunkOverlap >= result.chunkMaxChars) {
    throw new Error('AI_CHUNK_OVERLAP must be less than AI_CHUNK_MAX_CHARS');
  }

  return result as AiConfig;
};

export const parseAiAnalysisRateLimit = (
  env: NodeJS.ProcessEnv,
): AiAnalysisRateLimitConfig => ({
  maxAttempts: parsePositiveInt(
    env.AI_ANALYSIS_RATE_LIMIT_MAX,
    10,
    'AI_ANALYSIS_RATE_LIMIT_MAX',
  ),
  windowSeconds: parsePositiveInt(
    env.AI_ANALYSIS_RATE_LIMIT_WINDOW_SEC,
    900,
    'AI_ANALYSIS_RATE_LIMIT_WINDOW_SEC',
  ),
});

export const parseAiRetrievalRateLimit = (
  env: NodeJS.ProcessEnv,
): AiRetrievalRateLimitConfig => ({
  maxAttempts: parsePositiveInt(
    env.AI_RETRIEVAL_RATE_LIMIT_MAX,
    30,
    'AI_RETRIEVAL_RATE_LIMIT_MAX',
  ),
  windowSeconds: parsePositiveInt(
    env.AI_RETRIEVAL_RATE_LIMIT_WINDOW_SEC,
    60,
    'AI_RETRIEVAL_RATE_LIMIT_WINDOW_SEC',
  ),
});

export const parseAiAnswerRateLimit = (
  env: NodeJS.ProcessEnv,
): AiAnswerRateLimitConfig => ({
  maxAttempts: parsePositiveInt(
    env.AI_ANSWER_RATE_LIMIT_MAX,
    20,
    'AI_ANSWER_RATE_LIMIT_MAX',
  ),
  windowSeconds: parsePositiveInt(
    env.AI_ANSWER_RATE_LIMIT_WINDOW_SEC,
    60,
    'AI_ANSWER_RATE_LIMIT_WINDOW_SEC',
  ),
});

export const parseAiGuideRateLimit = (
  env: NodeJS.ProcessEnv,
): AiGuideRateLimitConfig => ({
  maxAttempts: parsePositiveInt(
    env.AI_GUIDE_RATE_LIMIT_MAX,
    30,
    'AI_GUIDE_RATE_LIMIT_MAX',
  ),
  windowSeconds: parsePositiveInt(
    env.AI_GUIDE_RATE_LIMIT_WINDOW_SEC,
    60,
    'AI_GUIDE_RATE_LIMIT_WINDOW_SEC',
  ),
});

const parseKioskRateLimit = (env: NodeJS.ProcessEnv): KioskRateLimitConfig => ({
  maxAttempts: parsePositiveInt(
    env.KIOSK_RATE_LIMIT_MAX,
    5,
    'KIOSK_RATE_LIMIT_MAX',
  ),
  windowSeconds: parsePositiveInt(
    env.KIOSK_RATE_LIMIT_WINDOW_SEC,
    60,
    'KIOSK_RATE_LIMIT_WINDOW_SEC',
  ),
});

export const validateEnv = (
  env: NodeJS.ProcessEnv = process.env,
): AppConfig => {
  const nodeEnvRaw = requireString(env, 'NODE_ENV');
  if (!isNodeEnv(nodeEnvRaw)) {
    throw new Error(
      `NODE_ENV must be one of: ${NODE_ENVS.join(', ')}. Received: "${nodeEnvRaw}"`,
    );
  }

  const logLevelRaw = env.LOG_LEVEL?.trim() || 'info';
  if (!isLogLevel(logLevelRaw)) {
    throw new Error(
      `LOG_LEVEL must be one of: ${LOG_LEVELS.join(', ')}. Received: "${logLevelRaw}"`,
    );
  }

  return {
    nodeEnv: nodeEnvRaw,
    port: parsePort(env.PORT),
    logLevel: logLevelRaw,
    corsOrigins: parseCorsOrigins(requireString(env, 'CORS_ORIGINS')),
    // Default 1 so Express derives client IP from a single reverse-proxy hop.
    // Never publish the API port publicly when trustProxyHops > 0.
    trustProxyHops: parseNonNegativeInt(
      env.TRUST_PROXY_HOPS,
      1,
      'TRUST_PROXY_HOPS',
    ),
    databaseUrl: parseDatabaseUrl(requireString(env, 'DATABASE_URL')),
    directDatabaseUrl: parseDatabaseUrl(
      env.DIRECT_URL?.trim() || requireString(env, 'DATABASE_URL'),
      'DIRECT_URL',
    ),
    redisUrl: parseRedisUrl(requireString(env, 'REDIS_URL')),
    runWorkerInProcess: parseOptionalBool(
      env.RUN_WORKER_IN_PROCESS,
      false,
      'RUN_WORKER_IN_PROCESS',
    ),
    s3: parseS3(env, nodeEnvRaw),
    jwt: parseJwt(env),
    nafath: parseNafath(env, nodeEnvRaw),
    authRateLimit: parseAuthRateLimit(env),
    documentUploadRateLimit: parseDocumentUploadRateLimit(env),
    consultationBookingRateLimit: parseConsultationBookingRateLimit(env),
    payments: parsePayments(env, nodeEnvRaw),
    paymentRateLimit: parsePaymentRateLimit(env),
    ai: parseAi(env, nodeEnvRaw),
    aiAnalysisRateLimit: parseAiAnalysisRateLimit(env),
    aiRetrievalRateLimit: parseAiRetrievalRateLimit(env),
    aiAnswerRateLimit: parseAiAnswerRateLimit(env),
    aiGuideRateLimit: parseAiGuideRateLimit(env),
    kioskSessionTtlSeconds: parsePositiveInt(
      env.KIOSK_SESSION_TTL_SEC,
      900,
      'KIOSK_SESSION_TTL_SEC',
    ),
    kioskRateLimit: parseKioskRateLimit(env),
  };
};

export const configuration = (): AppConfig => validateEnv(process.env);
