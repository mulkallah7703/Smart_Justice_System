import { MockEmbeddingProvider } from '../src/modules/ai/providers/mock/mock-embedding.provider';
import { MockVectorStore } from '../src/modules/ai/vector/mock-vector.store';
import { chunkIdToPointId } from '../src/modules/ai/vector/point-id';
import type { VectorUpsertPoint } from '../src/modules/ai/vector/vector-store.interface';

describe('chunkIdToPointId', () => {
  it('is deterministic and UUID-shaped', () => {
    const first = chunkIdToPointId('chunk_abc');
    const second = chunkIdToPointId('chunk_abc');
    expect(first).toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(chunkIdToPointId('chunk_other')).not.toBe(first);
  });
});

describe('MockEmbeddingProvider exact text', () => {
  it('embeds the exact supplied strings without rewriting', async () => {
    const provider = new MockEmbeddingProvider(8);
    const text = 'Article 12 — ١٤٤٦';
    const seen: string[][] = [];
    const original = provider.embed.bind(provider);
    provider.embed = (input) => {
      seen.push([...input.texts]);
      return original(input);
    };

    const result = await provider.embed({ texts: [text] });

    expect(seen).toEqual([[text]]);
    expect(result.vectors[0]).toHaveLength(8);
    expect(result.dimensions).toBe(8);
    expect(result.model).toBe('mock-embedding-v1');
  });

  it('batches one vector per input text', async () => {
    const provider = new MockEmbeddingProvider(8);
    const result = await provider.embed({ texts: ['a', 'b', 'c'] });
    expect(result.vectors).toHaveLength(3);
  });
});

describe('MockVectorStore', () => {
  it('upserts idempotently by point id', async () => {
    const store = new MockVectorStore(8);
    await store.ensureCollection();
    const point: VectorUpsertPoint = {
      id: chunkIdToPointId('c1'),
      vector: Array.from({ length: 8 }, () => 0.1),
      payload: {
        chunkId: 'c1',
        documentId: 'd1',
        documentPageId: 'p1',
        userId: 'u1',
        pageNumber: 1,
        chunkIndex: 0,
        pipelineVersion: 2,
        embeddingModel: 'mock-embedding-v1',
        extractionMethod: 'TEXT_LAYER',
        trust: 'TRUSTED',
      },
    };

    await store.upsert([point]);
    await store.upsert([
      {
        ...point,
        vector: Array.from({ length: 8 }, () => 0.2),
      },
    ]);

    expect(store.size()).toBe(1);
    expect(store.getPoint(point.id)?.vector[0]).toBe(0.2);
    expect(store.getPoint(point.id)?.payload.chunkId).toBe('c1');
    expect(store.getPoint(point.id)?.payload).not.toHaveProperty('storageKey');
    expect(store.getPoint(point.id)?.payload).not.toHaveProperty('nationalId');
  });

  it('rejects dimension mismatch', async () => {
    const store = new MockVectorStore(8);
    await expect(
      store.upsert([
        {
          id: chunkIdToPointId('c1'),
          vector: [1, 2],
          payload: {
            chunkId: 'c1',
            documentId: 'd1',
            documentPageId: 'p1',
            userId: 'u1',
            pageNumber: 1,
            chunkIndex: 0,
            pipelineVersion: 2,
            embeddingModel: 'mock',
            extractionMethod: 'TEXT_LAYER',
            trust: 'TRUSTED',
          },
        },
      ]),
    ).rejects.toThrow('AI_EMBEDDING_DIMENSION_MISMATCH');
  });
});
