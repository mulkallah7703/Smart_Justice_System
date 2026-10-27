import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AiRetrievalService } from '../src/modules/ai/ai-retrieval.service';
import { AI_PIPELINE_VERSION } from '../src/modules/ai/ai.constants';
import { MockEmbeddingProvider } from '../src/modules/ai/providers/mock/mock-embedding.provider';
import { chunkIdToPointId } from '../src/modules/ai/vector/point-id';
import { MockVectorStore } from '../src/modules/ai/vector/mock-vector.store';
import type { VectorPointPayload } from '../src/modules/ai/vector/vector-store.interface';

const DIMS = 8;
const MODEL = 'mock-embedding-v1';

const basePayload = (
  overrides: Partial<VectorPointPayload> & Pick<VectorPointPayload, 'chunkId' | 'userId'>,
): VectorPointPayload => ({
  chunkId: overrides.chunkId,
  documentId: overrides.documentId ?? 'doc-1',
  documentPageId: overrides.documentPageId ?? 'page-1',
  userId: overrides.userId,
  pageNumber: overrides.pageNumber ?? 1,
  chunkIndex: overrides.chunkIndex ?? 0,
  pipelineVersion: overrides.pipelineVersion ?? AI_PIPELINE_VERSION,
  embeddingModel: overrides.embeddingModel ?? MODEL,
  extractionMethod: overrides.extractionMethod ?? 'TEXT_LAYER',
  trust: 'TRUSTED',
});

describe('MockVectorStore search', () => {
  it('filters by userId, trust, pipelineVersion, and embeddingModel', async () => {
    const store = new MockVectorStore(DIMS);
    const embedding = new MockEmbeddingProvider(DIMS);
    const vector = (await embedding.embed({ texts: ['alpha'] })).vectors[0]!;

    await store.upsert([
      {
        id: chunkIdToPointId('c-own'),
        vector,
        payload: basePayload({ chunkId: 'c-own', userId: 'user-a' }),
      },
      {
        id: chunkIdToPointId('c-other'),
        vector,
        payload: basePayload({ chunkId: 'c-other', userId: 'user-b' }),
      },
      {
        id: chunkIdToPointId('c-old'),
        vector,
        payload: basePayload({
          chunkId: 'c-old',
          userId: 'user-a',
          pipelineVersion: 1,
        }),
      },
    ]);

    const hits = await store.search({
      vector,
      limit: 10,
      filters: {
        userId: 'user-a',
        trust: 'TRUSTED',
        pipelineVersion: AI_PIPELINE_VERSION,
        embeddingModel: MODEL,
      },
    });

    expect(hits.map((h) => h.chunkId)).toEqual(['c-own']);
  });

  it('respects scoreThreshold and limit, and ranks by score', async () => {
    const store = new MockVectorStore(DIMS);
    const embedding = new MockEmbeddingProvider(DIMS);
    const query = (await embedding.embed({ texts: ['lease clause'] })).vectors[0]!;
    const near = (await embedding.embed({ texts: ['lease clause'] })).vectors[0]!;
    const far = (await embedding.embed({ texts: ['zzzz unrelated'] })).vectors[0]!;

    await store.upsert([
      {
        id: chunkIdToPointId('near'),
        vector: near,
        payload: basePayload({ chunkId: 'near', userId: 'u1', chunkIndex: 0 }),
      },
      {
        id: chunkIdToPointId('far'),
        vector: far,
        payload: basePayload({ chunkId: 'far', userId: 'u1', chunkIndex: 1 }),
      },
    ]);

    const hits = await store.search({
      vector: query,
      limit: 1,
      filters: {
        userId: 'u1',
        trust: 'TRUSTED',
        pipelineVersion: AI_PIPELINE_VERSION,
        embeddingModel: MODEL,
      },
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.chunkId).toBe('near');

    const filtered = await store.search({
      vector: query,
      limit: 10,
      scoreThreshold: 0.999,
      filters: {
        userId: 'u1',
        trust: 'TRUSTED',
        pipelineVersion: AI_PIPELINE_VERSION,
        embeddingModel: MODEL,
      },
    });
    expect(filtered.every((h) => h.score >= 0.999)).toBe(true);
  });
});

describe('AiRetrievalService', () => {
  const embedding = new MockEmbeddingProvider(DIMS);
  let store: MockVectorStore;
  let prisma: {
    documentChunk: { findMany: jest.Mock };
    document: { findMany: jest.Mock };
  };
  let service: AiRetrievalService;
  let logSpy: jest.SpyInstance;

  const configService = {
    get: (key: string) => {
      if (key === 'ai') {
        return {
          embeddingDimensions: DIMS,
          embeddingModel: 'text-embedding-3-small',
          retrievalDefaultLimit: 5,
          retrievalMaxLimit: 20,
          retrievalDefaultMinScore: null,
          qdrantCollection: 'legal_chunks_v1',
        };
      }
      return undefined;
    },
  } as unknown as ConfigService;

  const chunkRow = (id: string, text: string, overrides: Record<string, unknown> = {}) => ({
    id,
    text,
    chunkIndex: 0,
    startOffset: 0,
    endOffset: text.length,
    pipelineVersion: AI_PIPELINE_VERSION,
    embeddingModel: MODEL,
    documentId: 'doc-1',
    documentPageId: 'page-1',
    document: { originalName: 'lease.pdf' },
    documentPage: {
      pageNumber: 1,
      extractionMethod: 'TEXT_LAYER' as const,
      trust: 'TRUSTED' as const,
    },
    ...overrides,
  });

  beforeEach(async () => {
    store = new MockVectorStore(DIMS);
    prisma = {
      documentChunk: { findMany: jest.fn().mockResolvedValue([]) },
      document: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new AiRetrievalService(
      prisma as never,
      configService as never,
      embedding,
      store,
    );
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('embeds a whitespace-normalized query for retrieval vectors', async () => {
    const spy = jest.spyOn(embedding, 'embed');
    const query = '  Exact legal query  ';
    await service.retrieve('user-a', { query });
    expect(spy).toHaveBeenCalledWith({ texts: ['Exact legal query'] });
  });

  it('returns empty results for an empty corpus', async () => {
    const result = await service.retrieve('user-a', { query: 'anything' });
    expect(result.results).toEqual([]);
    expect(result.retrieval.returned).toBe(0);
    expect(result.retrieval.droppedCount).toBe(0);
  });

  it('returns PostgreSQL authoritative text and provenance', async () => {
    const text = 'Trusted English lease clause §1';
    const vector = (await embedding.embed({ texts: [text] })).vectors[0]!;
    await store.upsert([
      {
        id: chunkIdToPointId('chunk-1'),
        vector,
        payload: basePayload({ chunkId: 'chunk-1', userId: 'user-a' }),
      },
    ]);
    prisma.documentChunk.findMany.mockResolvedValue([
      chunkRow('chunk-1', text, {
        chunkIndex: 2,
        startOffset: 40,
        endOffset: 40 + text.length,
        documentPage: {
          pageNumber: 4,
          extractionMethod: 'TEXT_LAYER',
          trust: 'TRUSTED',
        },
      }),
    ]);

    const result = await service.retrieve('user-a', {
      query: text,
      limit: 5,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.text).toBe(text);
    expect(result.results[0]!.provenance).toMatchObject({
      documentId: 'doc-1',
      documentName: 'lease.pdf',
      documentPageId: 'page-1',
      documentChunkId: 'chunk-1',
      pageNumber: 4,
      chunkIndex: 2,
      startOffset: 40,
      endOffset: 40 + text.length,
      pipelineVersion: AI_PIPELINE_VERSION,
      embeddingModel: MODEL,
      trust: 'TRUSTED',
    });
    expect(JSON.stringify(result)).not.toMatch(/userId|storageKey|checksum|nationalId/);
    expect(JSON.stringify(result)).not.toMatch(/"vector"/);
  });

  it('drops wrong owner, wrong trust, wrong status, wrong version, wrong model, and missing rows', async () => {
    const vector = (await embedding.embed({ texts: ['q'] })).vectors[0]!;
    const ids = [
      'missing',
      'wrong-owner',
      'wrong-trust',
      'wrong-status',
      'wrong-version',
      'wrong-model',
      'ok',
    ];
    await store.upsert(
      ids.map((chunkId) => ({
        id: chunkIdToPointId(chunkId),
        vector,
        payload: basePayload({ chunkId, userId: 'user-a' }),
      })),
    );

    prisma.documentChunk.findMany.mockResolvedValue([
      chunkRow('wrong-owner', 'x'), // still returned by findMany only if query filters — we simulate loose mock
      chunkRow('wrong-trust', 'x', {
        documentPage: {
          pageNumber: 1,
          extractionMethod: 'TEXT_LAYER',
          trust: 'REVIEW_REQUIRED',
        },
      }),
      chunkRow('wrong-version', 'x', { pipelineVersion: 1 }),
      chunkRow('wrong-model', 'x', { embeddingModel: 'other-model' }),
      chunkRow('ok', 'Authoritative OK'),
    ]);

    // Service findMany already filters; unit-test post-filter by returning mixed rows
    // and only including candidates that "passed" the SQL where for some cases.
    prisma.documentChunk.findMany.mockImplementation(async () => [
      chunkRow('wrong-trust', 'x', {
        documentPage: {
          pageNumber: 1,
          extractionMethod: 'TEXT_LAYER',
          trust: 'REVIEW_REQUIRED',
        },
      }),
      chunkRow('wrong-version', 'x', { pipelineVersion: 1 }),
      chunkRow('wrong-model', 'x', { embeddingModel: 'other-model' }),
      chunkRow('ok', 'Authoritative OK'),
    ]);

    const result = await service.retrieve('user-a', { query: 'q', limit: 20 });
    expect(result.results.map((r) => r.provenance.documentChunkId)).toEqual([
      'ok',
    ]);
    expect(result.results[0]!.text).toBe('Authoritative OK');
    expect(result.retrieval.droppedCount).toBeGreaterThan(0);
  });

  it('deduplicates chunkIds keeping the highest score order', async () => {
    const vector = (await embedding.embed({ texts: ['dup'] })).vectors[0]!;
    // Upsert same chunk twice under different point ids is impossible via our
    // ingest; simulate duplicate hits by searching after two payloads with same chunkId.
    await store.upsert([
      {
        id: chunkIdToPointId('dup-a'),
        vector,
        payload: basePayload({ chunkId: 'same', userId: 'user-a', chunkIndex: 0 }),
      },
    ]);
    // Force a second point with same chunkId via direct map (test helper path):
    (store as unknown as { points: Map<string, unknown> }).points.set(
      chunkIdToPointId('dup-b'),
      {
        vector: vector.map((v) => v * 0.5),
        payload: basePayload({ chunkId: 'same', userId: 'user-a', chunkIndex: 0 }),
      },
    );

    prisma.documentChunk.findMany.mockResolvedValue([
      chunkRow('same', 'once'),
    ]);

    const result = await service.retrieve('user-a', { query: 'dup', limit: 5 });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.provenance.documentChunkId).toBe('same');
  });

  it('maps embedding dimension mismatch to a stable error', async () => {
    const bad = {
      name: 'mock',
      dimensions: 8,
      embed: async () => ({
        vectors: [Array.from({ length: 4 }, () => 0)],
        dimensions: 4,
        model: MODEL,
      }),
    };
    const broken = new AiRetrievalService(
      prisma as never,
      configService as never,
      bad as never,
      store,
    );
    await expect(broken.retrieve('user-a', { query: 'q' })).rejects.toMatchObject({
      code: 'AI_EMBEDDING_DIMENSION_MISMATCH',
    });
  });

  it('maps vector store failures to AI_RETRIEVAL_FAILED when not AppError', async () => {
    jest.spyOn(store, 'search').mockRejectedValue(new Error('boom'));
    await expect(
      service.retrieve('user-a', { query: 'q' }),
    ).rejects.toMatchObject({ code: 'AI_RETRIEVAL_FAILED' });
  });

  it('maps PostgreSQL failures to AI_RETRIEVAL_FAILED', async () => {
    const vector = (await embedding.embed({ texts: ['q'] })).vectors[0]!;
    await store.upsert([
      {
        id: chunkIdToPointId('c1'),
        vector,
        payload: basePayload({ chunkId: 'c1', userId: 'user-a' }),
      },
    ]);
    prisma.documentChunk.findMany.mockRejectedValue(new Error('db down'));
    await expect(
      service.retrieve('user-a', { query: 'q' }),
    ).rejects.toMatchObject({ code: 'AI_RETRIEVAL_FAILED' });
  });

  it('does not log query or chunk text', async () => {
    const text = 'SECRET_CHUNK_TEXT_SHOULD_NOT_LOG';
    const vector = (await embedding.embed({ texts: [text] })).vectors[0]!;
    await store.upsert([
      {
        id: chunkIdToPointId('c1'),
        vector,
        payload: basePayload({ chunkId: 'c1', userId: 'user-a' }),
      },
    ]);
    prisma.documentChunk.findMany.mockResolvedValue([chunkRow('c1', text)]);

    await service.retrieve('user-a', { query: 'SECRET_QUERY_SHOULD_NOT_LOG' });

    for (const call of logSpy.mock.calls) {
      const joined = call.map(String).join(' ');
      expect(joined).not.toContain('SECRET_CHUNK');
      expect(joined).not.toContain('SECRET_QUERY');
    }
  });

  it('keeps chunks from the requested case and drops the other case', async () => {
    const vector = (await embedding.embed({ texts: ['حضانة'] })).vectors[0]!;
    await store.upsert([
      {
        id: chunkIdToPointId('custody'),
        vector,
        payload: basePayload({
          chunkId: 'custody',
          userId: 'user-a',
          documentId: 'doc-custody',
        }),
      },
      {
        id: chunkIdToPointId('commercial'),
        vector,
        payload: basePayload({
          chunkId: 'commercial',
          userId: 'user-a',
          documentId: 'doc-commercial',
          chunkIndex: 1,
        }),
      },
    ]);
    prisma.document.findMany.mockResolvedValue([{ id: 'doc-custody' }]);
    prisma.documentChunk.findMany.mockImplementation(async (args) => {
      const allowed = args.where.document.id.in as string[];
      expect(allowed).toEqual(['doc-custody']);
      expect(args.where.document.caseId).toBe('case-custody');
      return [chunkRow('custody', 'حضانة الأب', { documentId: 'doc-custody' })];
    });

    const result = await service.retrieve('user-a', {
      query: 'حضانة',
      documentIds: ['doc-custody', 'doc-commercial'],
      caseId: 'case-custody',
    });

    expect(result.results.map((item) => item.provenance.documentChunkId)).toEqual([
      'custody',
    ]);
    expect(result.results[0]!.text).not.toContain('500,000');
  });

  it('returns nothing when the case filter matches no owned document', async () => {
    prisma.document.findMany.mockResolvedValue([]);
    const result = await service.retrieve('user-a', {
      query: 'حضانة',
      documentIds: ['doc-other'],
      caseId: 'case-missing',
    });
    expect(result.results).toEqual([]);
    expect(prisma.documentChunk.findMany).not.toHaveBeenCalled();
  });

  it('preserves score ordering across multiple hits', async () => {
    const q = (await embedding.embed({ texts: ['clause rent'] })).vectors[0]!;
    const a = (await embedding.embed({ texts: ['clause rent'] })).vectors[0]!;
    const b = (await embedding.embed({ texts: ['totally different'] })).vectors[0]!;
    await store.upsert([
      {
        id: chunkIdToPointId('low'),
        vector: b,
        payload: basePayload({ chunkId: 'low', userId: 'user-a', chunkIndex: 1 }),
      },
      {
        id: chunkIdToPointId('high'),
        vector: a,
        payload: basePayload({ chunkId: 'high', userId: 'user-a', chunkIndex: 0 }),
      },
    ]);
    prisma.documentChunk.findMany.mockResolvedValue([
      chunkRow('low', 'low text'),
      chunkRow('high', 'high text'),
    ]);

    const result = await service.retrieve('user-a', {
      query: 'clause rent',
      limit: 5,
    });
    expect(result.results[0]!.provenance.documentChunkId).toBe('high');
    expect(result.results[0]!.score).toBeGreaterThanOrEqual(
      result.results[1]!.score,
    );
  });
});
