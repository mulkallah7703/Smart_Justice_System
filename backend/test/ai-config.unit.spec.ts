import { parseAi } from '../src/config/env.validation';

describe('AI configuration', () => {
  it('defaults to the mock adapters outside production', () => {
    const config = parseAi({}, 'development');

    expect(config.providerMode).toBe('mock');
    expect(config.queuePrefix).toBe('sjs:ai');
    expect(config.jobAttempts).toBe(3);
    expect(config.jobBackoffMs).toBe(1000);
    expect(config.workerConcurrency).toBe(2);
  });

  it('defaults chunk max chars to 2000', () => {
    expect(parseAi({}, 'development').chunkMaxChars).toBe(2000);
  });

  it('reads AI_CHUNK_MAX_CHARS', () => {
    expect(
      parseAi({ AI_CHUNK_MAX_CHARS: '1500' }, 'test').chunkMaxChars,
    ).toBe(1500);
  });

  it('defaults embedding mode to mock with 8 dimensions', () => {
    const config = parseAi({}, 'development');
    expect(config.embeddingMode).toBe('mock');
    expect(config.embeddingDimensions).toBe(8);
    expect(config.vectorStoreMode).toBe('mock');
    expect(config.embeddingBatchSize).toBe(32);
  });

  it('requires an API key for openai embeddings', () => {
    expect(() =>
      parseAi({ AI_EMBEDDING_MODE: 'openai' }, 'development'),
    ).toThrow(/AI_EMBEDDING_API_KEY|OPENAI_API_KEY/);
  });

  it('requires qdrant URL when vector store is qdrant', () => {
    expect(() =>
      parseAi({ AI_VECTOR_STORE_MODE: 'qdrant' }, 'development'),
    ).toThrow(/AI_QDRANT_URL/);
  });

  it('selects openai embedding with key and qdrant', () => {
    const config = parseAi(
      {
        AI_EMBEDDING_MODE: 'openai',
        AI_EMBEDDING_API_KEY: 'sk-test',
        AI_VECTOR_STORE_MODE: 'qdrant',
        AI_QDRANT_URL: 'http://127.0.0.1:6333',
      },
      'test',
    );
    expect(config.embeddingMode).toBe('openai');
    expect(config.embeddingDimensions).toBe(1536);
    expect(config.embeddingModel).toBe('text-embedding-3-small');
    expect(config.qdrantCollection).toBe('legal_chunks_v1');
  });

  it('fails closed when mock adapters are selected in production', () => {
    expect(() => parseAi({ AI_PROVIDER_MODE: 'mock' }, 'production')).toThrow(
      /AI_PROVIDER_MODE=mock cannot run when NODE_ENV=production/,
    );
  });

  it('fails closed when production omits AI_PROVIDER_MODE', () => {
    expect(() => parseAi({}, 'production')).toThrow(/AI_PROVIDER_MODE=openai/);
  });

  it('accepts openai provider mode when API key and Qdrant are configured', () => {
    const config = parseAi(
      {
        AI_PROVIDER_MODE: 'openai',
        AI_LLM_MODE: 'openai',
        AI_EMBEDDING_MODE: 'openai',
        AI_VECTOR_STORE_MODE: 'qdrant',
        AI_TEXT_EXTRACTOR_MODE: 'pdf',
        AI_OCR_MODE: 'local',
        OPENAI_API_KEY: 'sk-test',
        AI_QDRANT_URL: 'http://127.0.0.1:6333',
      },
      'production',
    );
    expect(config.providerMode).toBe('openai');
    expect(config.llmMode).toBe('openai');
    expect(config.embeddingMode).toBe('openai');
    expect(config.vectorStoreMode).toBe('qdrant');
  });

  it('refuses openai provider without an API key (no mock fallback)', () => {
    expect(() =>
      parseAi({ AI_PROVIDER_MODE: 'openai', AI_LLM_MODE: 'openai' }, 'development'),
    ).toThrow(/OPENAI_API_KEY/);
  });

  it('reads bounded retry and concurrency settings', () => {
    const config = parseAi(
      {
        AI_JOB_ATTEMPTS: '5',
        AI_JOB_BACKOFF_MS: '250',
        AI_WORKER_CONCURRENCY: '4',
        AI_QUEUE_PREFIX: 'custom:ai',
      },
      'test',
    );

    expect(config.jobAttempts).toBe(5);
    expect(config.jobBackoffMs).toBe(250);
    expect(config.workerConcurrency).toBe(4);
    expect(config.queuePrefix).toBe('custom:ai');
  });

  it('rejects a non-positive attempt bound', () => {
    expect(() => parseAi({ AI_JOB_ATTEMPTS: '0' }, 'development')).toThrow(
      /AI_JOB_ATTEMPTS/,
    );
  });

  it('holds no AI provider credentials', () => {
    expect(Object.keys(parseAi({}, 'development'))).toEqual([
      'providerMode',
      'textExtractorMode',
      'ocrMode',
      'pdfMaxPages',
      'ocrDpi',
      'ocrMaxPixels',
      'ocrTimeoutMs',
      'ocrLangPath',
      'ocrLanguages',
      'chunkMaxChars',
      'chunkOverlap',
      'embeddingMode',
      'embeddingApiKey',
      'embeddingModel',
      'embeddingDimensions',
      'embeddingBatchSize',
      'vectorStoreMode',
      'qdrantUrl',
      'qdrantApiKey',
      'qdrantCollection',
      'retrievalDefaultLimit',
      'retrievalMaxLimit',
      'retrievalDefaultMinScore',
      'llmMode',
      'llmApiKey',
      'llmModel',
      'llmMaxOutputTokens',
      'llmTimeoutMs',
      'llmTemperature',
      'llmMaxEvidenceItems',
      'llmMaxEvidenceChars',
      'guideMaxMessageChars',
      'guideMaxMessages',
      'guideSessionTtlHours',
      'queuePrefix',
      'jobAttempts',
      'jobBackoffMs',
      'workerConcurrency',
    ]);
  });

  it('defaults retrieval limits and unset minScore', () => {
    const config = parseAi({}, 'development');
    expect(config.retrievalDefaultLimit).toBe(5);
    expect(config.retrievalMaxLimit).toBe(20);
    expect(config.retrievalDefaultMinScore).toBeNull();
  });

  it('defaults answer LLM to mock with conservative limits', () => {
    const config = parseAi({}, 'development');
    expect(config.llmMode).toBe('mock');
    expect(config.llmModel).toBe('gpt-4o-mini');
    expect(config.llmMaxOutputTokens).toBe(1024);
    expect(config.llmTimeoutMs).toBe(30_000);
    expect(config.llmTemperature).toBe(0);
    expect(config.llmMaxEvidenceItems).toBe(5);
    expect(config.llmMaxEvidenceChars).toBe(8000);
  });

  it('refuses mock LLM in production', () => {
    expect(() =>
      parseAi({ AI_LLM_MODE: 'mock', AI_PROVIDER_MODE: 'mock' }, 'production'),
    ).toThrow(/AI_LLM_MODE=mock|AI_PROVIDER_MODE=mock/);
  });
});

describe('document text extraction configuration', () => {
  it('defaults to the mock extractor outside production', () => {
    const config = parseAi({}, 'development');

    expect(config.textExtractorMode).toBe('mock');
    expect(config.pdfMaxPages).toBe(100);
  });

  it('selects real PDF extraction only when explicitly configured', () => {
    expect(parseAi({ AI_TEXT_EXTRACTOR_MODE: 'pdf' }, 'test').textExtractorMode).toBe(
      'pdf',
    );
  });

  it('refuses to boot in production while text extractor is mock', () => {
    expect(() =>
      parseAi(
        {
          AI_PROVIDER_MODE: 'openai',
          AI_LLM_MODE: 'openai',
          AI_EMBEDDING_MODE: 'openai',
          AI_VECTOR_STORE_MODE: 'qdrant',
          AI_TEXT_EXTRACTOR_MODE: 'mock',
          AI_OCR_MODE: 'local',
          OPENAI_API_KEY: 'sk-test',
          AI_QDRANT_URL: 'http://127.0.0.1:6333',
        },
        'production',
      ),
    ).toThrow(/AI_TEXT_EXTRACTOR_MODE=mock cannot run when NODE_ENV=production/);
  });

  it('rejects an extractor mode with no implementation', () => {
    expect(() =>
      parseAi({ AI_TEXT_EXTRACTOR_MODE: 'tesseract' }, 'development'),
    ).toThrow(/Unsupported AI_TEXT_EXTRACTOR_MODE/);
  });

  it('rejects a non-positive page bound', () => {
    expect(() => parseAi({ AI_PDF_MAX_PAGES: '0' }, 'development')).toThrow(
      /AI_PDF_MAX_PAGES/,
    );
  });
});

describe('OCR configuration', () => {
  it('defaults to mock OCR outside production', () => {
    expect(parseAi({}, 'development').ocrMode).toBe('mock');
  });

  it('selects local OCR only when explicitly configured', () => {
    expect(parseAi({ AI_OCR_MODE: 'local' }, 'test').ocrMode).toBe('local');
  });

  it('rejects an unsupported OCR mode', () => {
    expect(() => parseAi({ AI_OCR_MODE: 'cloud' }, 'development')).toThrow(
      /Unsupported AI_OCR_MODE/,
    );
  });

  it('refuses mock OCR in production', () => {
    expect(() =>
      parseAi(
        {
          AI_PROVIDER_MODE: 'mock',
          AI_TEXT_EXTRACTOR_MODE: 'pdf',
          AI_OCR_MODE: 'mock',
        },
        'production',
      ),
    ).toThrow(/cannot run when NODE_ENV=production/);
  });
});
