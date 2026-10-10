import type { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';

import type { AiJobsService } from '../src/modules/ai/ai-jobs.service';
import type { AiJobPayload } from '../src/modules/ai/ai-job.types';
import { AI_JOB_STAGE_COUNT } from '../src/modules/ai/ai.constants';
import { documentStorageError } from '../src/modules/documents/errors/documents.errors';
import type { ObjectStorage } from '../src/modules/documents/storage/object-storage.interface';
import type { DocumentChunksService } from '../src/modules/ai/document-chunks.service';
import type { DocumentPagesService } from '../src/modules/ai/document-pages.service';
import type { EmbeddingIngestService } from '../src/modules/ai/embedding-ingest.service';
import { AiJobProcessor } from '../src/modules/ai/worker/ai-job.processor';
import { MockLlmProvider } from '../src/modules/ai/providers/mock/mock-llm.provider';
import { MockOcrProvider } from '../src/modules/ai/providers/mock/mock-ocr.provider';
import { MockTextExtractor } from '../src/modules/ai/providers/mock/mock-text-extractor.provider';
import {
  MOCK_FAIL_ALWAYS,
  MOCK_FAIL_ONCE,
  resetMockDirectives,
} from '../src/modules/ai/providers/mock/mock-directives';
import { aiProviderError } from '../src/modules/ai/ai.errors';
import { PDF_TEXT_VISUAL_ORDER } from '../src/modules/ai/providers/pdf/arabic-text-order';
import type {
  DocumentSource,
  ExtractedDocument,
  ExtractedTextPage,
  TextExtractor,
} from '../src/modules/ai/providers/text-extractor.interface';
import type { LlmProvider } from '../src/modules/ai/providers/llm-provider.interface';

interface RecordedJob {
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  attempts: number;
  maxAttempts: number;
  stageIndex: number;
  errorCode: string | null;
  result: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
}

/** In-memory stand-in for the persistence layer, so no database is required. */
const createJobsStub = (
  documentIds: string[],
  maxAttempts = 3,
): { service: AiJobsService; state: RecordedJob; transitions: string[] } => {
  const state: RecordedJob = {
    status: 'PENDING',
    attempts: 0,
    maxAttempts,
    stageIndex: 0,
    errorCode: null,
    result: null,
    startedAt: null,
    completedAt: null,
  };
  const transitions: string[] = ['PENDING'];

  const service = {
    loadForProcessing: () =>
      Promise.resolve({
        userId: 'user-1',
        documents: documentIds.map((id) => ({
          id,
          storageKey: `users/user-1/cases/case-1/documents/${id}`,
          mimeType: 'application/pdf',
          sizeBytes: 4,
          checksum: `checksum-${id}`,
        })),
      }),
    beginAttempt: () => {
      state.attempts += 1;
      state.status = 'PROCESSING';
      state.stageIndex = 0;
      state.errorCode = null;
      state.startedAt ??= new Date();
      transitions.push('PROCESSING');
      return Promise.resolve({
        attempts: state.attempts,
        maxAttempts: state.maxAttempts,
      });
    },
    advanceStage: (_id: string, stageIndex: number) => {
      state.stageIndex = stageIndex;
      return Promise.resolve();
    },
    markDone: (_id: string, result: unknown) => {
      state.status = 'DONE';
      state.result = result;
      state.completedAt = new Date();
      transitions.push('DONE');
      return Promise.resolve();
    },
    markFailed: (_id: string, errorCode: string) => {
      state.status = 'FAILED';
      state.errorCode = errorCode;
      state.completedAt = new Date();
      transitions.push('FAILED');
      return Promise.resolve();
    },
    recordRetry: (_id: string, errorCode: string) => {
      state.status = 'PROCESSING';
      state.errorCode = errorCode;
      return Promise.resolve();
    },
  } as unknown as AiJobsService;

  return { service, state, transitions };
};

const configStub = {
  get: () => ({ workerConcurrency: 2 }),
} as unknown as ConfigService<never, true>;

/** Returns bytes without touching MinIO, unless told to fail. */
const createStorageStub = (fail = false): ObjectStorage =>
  ({
    getObject: () =>
      fail
        ? Promise.reject(documentStorageError())
        : Promise.resolve({ body: Buffer.from('%PDF-1.4') }),
    putObject: () => Promise.resolve(),
    deleteObject: () => Promise.resolve(),
    ping: () => Promise.resolve(true),
  }) as ObjectStorage;

const createPagesStub = (): {
  service: DocumentPagesService;
  calls: Array<{ userId: string; documentId: string; pageCount: number }>;
} => {
  const calls: Array<{ userId: string; documentId: string; pageCount: number }> =
    [];
  const service = {
    persistExtractedPages: (input: {
      userId: string;
      documentId: string;
      pages: readonly unknown[];
    }) => {
      calls.push({
        userId: input.userId,
        documentId: input.documentId,
        pageCount: input.pages.length,
      });
      return Promise.resolve({
        documentId: input.documentId,
        attempted: input.pages.length,
        skippedExisting: 0,
        totalStored: input.pages.length,
      });
    },
  } as unknown as DocumentPagesService;
  return { service, calls };
};

const createChunksStub = (
  texts: string[] = ['Trusted English clause'],
): {
  service: DocumentChunksService;
  calls: number;
} => {
  let calls = 0;
  const service = {
    persistTrustedPageChunks: () => {
      calls += 1;
      return Promise.resolve({
        trustedPagesConsidered: texts.length > 0 ? 1 : 0,
        attempted: texts.length,
        skippedExisting: 0,
        totalStored: texts.length,
        trustedChunkTexts: texts,
      });
    },
  } as unknown as DocumentChunksService;
  return {
    service,
    get calls() {
      return calls;
    },
  };
};

const createEmbedStub = (
  texts: string[] = ['Trusted English clause'],
): {
  service: EmbeddingIngestService;
  seenTexts: string[][];
} => {
  const seenTexts: string[][] = [];
  const service = {
    embedTrustedChunks: (input: { documentIds: readonly string[] }) => {
      // Fail-once / fail-always for the default MockTextExtractor path is driven
      // by MockOcr (document label). Only ALWAYS is mirrored here for belt-and-
      // suspenders when OCR somehow still runs; FAIL_ONCE must not also fail
      // embedding or the processor would need three attempts.
      if (input.documentIds.some((id) => id.includes(MOCK_FAIL_ALWAYS))) {
        return Promise.reject(aiProviderError());
      }
      seenTexts.push([...texts]);
      return Promise.resolve({
        chunksEligible: texts.length,
        chunksEmbedded: texts.length,
        embeddingModel: 'mock-embedding-v1',
        embeddingDimensions: 8,
        collection: 'mock',
        embeddedTexts: texts,
      });
    },
  } as unknown as EmbeddingIngestService;
  return { service, seenTexts };
};

const createProcessor = (
  jobs: AiJobsService,
  storage: ObjectStorage = createStorageStub(),
  overrides: {
    extractor?: TextExtractor;
    llm?: LlmProvider;
    pages?: DocumentPagesService;
    chunks?: DocumentChunksService;
    embed?: EmbeddingIngestService;
  } = {},
): AiJobProcessor =>
  new AiJobProcessor(
    jobs,
    overrides.pages ?? createPagesStub().service,
    overrides.chunks ?? createChunksStub().service,
    overrides.embed ?? createEmbedStub().service,
    configStub as never,
    storage,
    overrides.extractor ?? new MockTextExtractor(new MockOcrProvider()),
    overrides.llm ?? new MockLlmProvider(),
  );

const controlledPage = (
  overrides: Partial<ExtractedTextPage> & Pick<ExtractedTextPage, 'trust' | 'text' | 'method'>,
): ExtractedTextPage => ({
  status: 'EXTRACTED',
  documentId: 'doc-1',
  pageNumber: 1,
  confidence: null,
  language: null,
  warnings: [],
  ...overrides,
});

/** Extractor that returns a fixed page set so trust gating can be asserted. */
class ControlledExtractor implements TextExtractor {
  readonly name = 'controlled-extractor-v1';

  constructor(private readonly pages: readonly ExtractedTextPage[]) {}

  extract(source: DocumentSource): Promise<ExtractedDocument> {
    return Promise.resolve({
      documentId: source.documentId,
      pages: this.pages.map((page) => ({
        ...page,
        documentId: source.documentId,
      })),
      engine: this.name,
      ocrEngine: this.pages.some((page) => page.method === 'OCR')
        ? 'controlled-ocr'
        : null,
    });
  }
}

const job = (aiJobId: string): Job<AiJobPayload> =>
  ({ data: { aiJobId } }) as Job<AiJobPayload>;

describe('AI job processor', () => {
  beforeEach(() => {
    resetMockDirectives();
  });

  it('drives PENDING -> PROCESSING -> DONE and records progress', async () => {
    const { service, state, transitions } = createJobsStub(['doc-1']);

    await createProcessor(service).process(job('ai-1'));

    expect(transitions).toEqual(['PENDING', 'PROCESSING', 'DONE']);
    expect(state.attempts).toBe(1);
    expect(state.stageIndex).toBe(AI_JOB_STAGE_COUNT - 1);
    expect(state.startedAt).toBeInstanceOf(Date);
    expect(state.completedAt).toBeInstanceOf(Date);
    expect(state.errorCode).toBeNull();
  });

  it('produces deterministic result JSON that is clearly marked as mock', async () => {
    const first = createJobsStub(['doc-1']);
    await createProcessor(first.service).process(job('ai-1'));

    resetMockDirectives();
    const second = createJobsStub(['doc-1']);
    await createProcessor(second.service).process(job('ai-2'));

    expect(first.state.result).toEqual(second.state.result);
    expect(first.state.result).toMatchObject({
      mock: true,
      documentCount: 1,
      llmModel: 'mock-llm-v1',
      embeddingModel: 'mock-embedding-v1',
      extractorEngine: 'mock-text-extractor-v1',
    });
  });

  it('persists DocumentPage records after extraction without putting text in resultJson', async () => {
    const { service, state } = createJobsStub(['doc-1']);
    const pages = createPagesStub();

    await createProcessor(service, createStorageStub(), {
      pages: pages.service,
    }).process(job('ai-1'));

    expect(pages.calls).toEqual([
      { userId: 'user-1', documentId: 'doc-1', pageCount: 2 },
    ]);
    expect(state.result).toMatchObject({ pagesPersisted: true });
    const serialised = JSON.stringify(state.result);
    expect(serialised).not.toContain('MOCK_TEXT_LAYER:');
    expect(serialised).not.toContain('MOCK_OCR_TEXT:');
  });

  it('summarises pages by extraction method without persisting any text', async () => {
    const { service, state } = createJobsStub(['doc-1']);

    await createProcessor(service).process(job('ai-1'));

    // One PDF through the mock extractor: one text-layer page, one OCR page.
    expect(state.result).toMatchObject({
      totalPages: 2,
      textLayerPages: 1,
      ocrPages: 1,
      trustedPages: 1,
      reviewRequiredPages: 1,
      unusablePages: 0,
      chunksCreated: 1,
    });

    const serialised = JSON.stringify(state.result);
    expect(serialised).not.toContain('MOCK_TEXT_LAYER:');
    expect(serialised).not.toContain('MOCK_OCR_TEXT:');
  });

  it('excludes Arabic TEXT_LAYER from embedding and LLM input', async () => {
    const { service, state } = createJobsStub(['doc-1']);
    const arabicText = 'هذه قضية إيجارية';
    const seenLlm: string[][] = [];
    const embed = createEmbedStub(['Trusted English clause']);
    const llm: LlmProvider = {
      name: 'spy-llm',
      complete: (input) => {
        seenLlm.push([...input.untrustedContext]);
        return Promise.resolve({
          text: 'MOCK_OK',
          model: 'spy-llm',
          promptTokens: 0,
          completionTokens: 0,
        });
      },
      generateAnswer: () =>
        Promise.resolve({
          text: '{}',
          model: 'spy-llm',
          promptTokens: 0,
          completionTokens: 0,
        }),
    };

    await createProcessor(service, createStorageStub(), {
      extractor: new ControlledExtractor([
        controlledPage({
          pageNumber: 1,
          method: 'TEXT_LAYER',
          text: arabicText,
          warnings: [PDF_TEXT_VISUAL_ORDER],
          trust: 'REVIEW_REQUIRED',
        }),
        controlledPage({
          pageNumber: 2,
          method: 'TEXT_LAYER',
          text: 'Trusted English clause',
          trust: 'TRUSTED',
        }),
      ]),
      llm,
      chunks: createChunksStub(['Trusted English clause']).service,
      embed: embed.service,
    }).process(job('ai-1'));

    expect(embed.seenTexts).toEqual([['Trusted English clause']]);
    expect(seenLlm).toEqual([['Trusted English clause']]);
    expect(JSON.stringify(state.result)).not.toContain(arabicText);
    expect(JSON.stringify(state.result)).not.toContain('Trusted English clause');
  });

  it('excludes REVIEW_REQUIRED and UNUSABLE pages from embeddings input', async () => {
    const { service, state } = createJobsStub(['doc-1']);
    const embed = createEmbedStub(['Safe English']);

    await createProcessor(service, createStorageStub(), {
      extractor: new ControlledExtractor([
        controlledPage({
          pageNumber: 1,
          method: 'OCR',
          text: 'ocr review text',
          confidence: 0.99,
          trust: 'REVIEW_REQUIRED',
        }),
        controlledPage({
          pageNumber: 2,
          method: 'OCR',
          text: '',
          confidence: 0.1,
          trust: 'UNUSABLE',
        }),
        controlledPage({
          pageNumber: 3,
          method: 'TEXT_LAYER',
          text: 'Safe English',
          trust: 'TRUSTED',
        }),
      ]),
      chunks: createChunksStub(['Safe English']).service,
      embed: embed.service,
    }).process(job('ai-1'));

    expect(embed.seenTexts).toEqual([['Safe English']]);
    expect(state.result).toMatchObject({
      trustedPages: 1,
      reviewRequiredPages: 1,
      unusablePages: 1,
      chunksEmbedded: 1,
    });
  });

  it('drives PROCESSING -> FAILED with a stable domain code on the final attempt', async () => {
    const { service, state, transitions } = createJobsStub(
      [`${MOCK_FAIL_ALWAYS}-doc`],
      1,
    );

    await expect(createProcessor(service).process(job('ai-1'))).rejects.toThrow(
      'AI_PROVIDER_ERROR',
    );

    expect(transitions).toEqual(['PENDING', 'PROCESSING', 'FAILED']);
    expect(state.errorCode).toBe('AI_PROVIDER_ERROR');
    expect(state.completedAt).toBeInstanceOf(Date);
  });

  it('never lets a raw stack trace or provider message escape', async () => {
    const { service } = createJobsStub([`${MOCK_FAIL_ALWAYS}-doc`], 1);

    await createProcessor(service)
      .process(job('ai-1'))
      .catch((error: Error) => {
        // The message is exactly the code, with no provider detail appended.
        expect(error.message).toBe('AI_PROVIDER_ERROR');
        expect(error.message).not.toMatch(/at .*\(/);
      });
  });

  it('stays PROCESSING while an attempt remains, then succeeds on retry', async () => {
    const { service, state, transitions } = createJobsStub(
      [`${MOCK_FAIL_ONCE}-doc`],
      3,
    );
    const processor = createProcessor(service);

    await expect(processor.process(job('ai-1'))).rejects.toThrow(
      'AI_PROVIDER_ERROR',
    );
    expect(state.status).toBe('PROCESSING');
    expect(state.attempts).toBe(1);

    await processor.process(job('ai-1'));

    expect(state.status).toBe('DONE');
    expect(state.attempts).toBe(2);
    expect(transitions).toEqual([
      'PENDING',
      'PROCESSING',
      'PROCESSING',
      'DONE',
    ]);
  });

  it('fails with a stable code when storage retrieval fails, leaking no storage detail', async () => {
    const { service, state, transitions } = createJobsStub(['doc-1'], 1);

    await expect(
      createProcessor(service, createStorageStub(true)).process(job('ai-1')),
    ).rejects.toThrow('DOCUMENT_STORAGE_ERROR');

    expect(transitions).toEqual(['PENDING', 'PROCESSING', 'FAILED']);
    expect(state.errorCode).toBe('DOCUMENT_STORAGE_ERROR');
    expect(state.errorCode).not.toMatch(/bucket|endpoint|s3|amazon|access/i);
    expect(state.completedAt).toBeInstanceOf(Date);
  });

  it('reports progress on entering each stage', async () => {
    const { service } = createJobsStub(['doc-1']);
    const seen: Array<{ stageIndex: number }> = [];
    const spied = {
      ...service,
      advanceStage: (_id: string, stageIndex: number) => {
        seen.push({ stageIndex });
        return Promise.resolve();
      },
    } as unknown as AiJobsService;

    await createProcessor(spied).process(job('ai-1'));

    expect(seen.map((entry) => entry.stageIndex)).toEqual([0, 1, 2]);
  });

  it('records no document bytes in the persisted result', async () => {
    const { service, state } = createJobsStub(['doc-1']);

    await createProcessor(service).process(job('ai-1'));

    const serialised = JSON.stringify(state.result);
    expect(serialised).not.toContain('%PDF');
    expect(serialised).not.toContain('users/user-1');
    expect(serialised).toContain('"retrievedBytes":8');
  });

  it('bounds attempts and does not retry forever', async () => {
    const { service, state } = createJobsStub([`${MOCK_FAIL_ALWAYS}-doc`], 3);
    const processor = createProcessor(service);

    await expect(processor.process(job('ai-1'))).rejects.toThrow();
    expect(state.status).toBe('PROCESSING');

    await expect(processor.process(job('ai-1'))).rejects.toThrow();
    expect(state.status).toBe('PROCESSING');

    await expect(processor.process(job('ai-1'))).rejects.toThrow();
    expect(state.status).toBe('FAILED');
    expect(state.attempts).toBe(3);
    expect(state.attempts).toBe(state.maxAttempts);
  });
});

describe('AI job queue payload', () => {
  it('carries an identifier only, so no secret can be persisted in Redis', () => {
    const payload: AiJobPayload = { aiJobId: 'ai-1' };

    expect(Object.keys(payload)).toEqual(['aiJobId']);
  });
});
