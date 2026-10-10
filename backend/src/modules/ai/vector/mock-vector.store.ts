import { Injectable } from '@nestjs/common';

import type {
  VectorPointPayload,
  VectorSearchHit,
  VectorSearchInput,
  VectorStore,
  VectorUpsertPoint,
} from './vector-store.interface';

const cosineSimilarity = (
  a: readonly number[],
  b: readonly number[],
): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * In-memory vector store for tests and AI_VECTOR_STORE_MODE=mock.
 * Not durable across process restarts.
 */
@Injectable()
export class MockVectorStore implements VectorStore {
  readonly name = 'mock';
  readonly collection = 'mock';
  readonly dimensions: number;

  private readonly points = new Map<
    string,
    { vector: number[]; payload: VectorPointPayload }
  >();

  constructor(dimensions: number) {
    this.dimensions = dimensions;
  }

  ensureCollection(): Promise<void> {
    return Promise.resolve();
  }

  upsert(points: readonly VectorUpsertPoint[]): Promise<void> {
    for (const point of points) {
      if (point.vector.length !== this.dimensions) {
        return Promise.reject(new Error('AI_EMBEDDING_DIMENSION_MISMATCH'));
      }
      this.points.set(point.id, {
        vector: [...point.vector],
        payload: { ...point.payload },
      });
    }
    return Promise.resolve();
  }

  deleteByIds(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      this.points.delete(id);
    }
    return Promise.resolve();
  }

  search(input: VectorSearchInput): Promise<readonly VectorSearchHit[]> {
    if (input.vector.length !== this.dimensions) {
      return Promise.reject(new Error('AI_EMBEDDING_DIMENSION_MISMATCH'));
    }

    const { filters, limit, scoreThreshold } = input;
    const hits: VectorSearchHit[] = [];

    for (const point of this.points.values()) {
      const { payload } = point;
      if (
        payload.userId !== filters.userId ||
        payload.trust !== filters.trust ||
        payload.pipelineVersion !== filters.pipelineVersion ||
        payload.embeddingModel !== filters.embeddingModel
      ) {
        continue;
      }

      const score = cosineSimilarity(input.vector, point.vector);
      if (
        scoreThreshold !== undefined &&
        scoreThreshold !== null &&
        score < scoreThreshold
      ) {
        continue;
      }

      hits.push({
        chunkId: payload.chunkId,
        score,
        payload: { ...payload },
      });
    }

    hits.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.payload.documentId !== b.payload.documentId) {
        return a.payload.documentId.localeCompare(b.payload.documentId);
      }
      if (a.payload.pageNumber !== b.payload.pageNumber) {
        return a.payload.pageNumber - b.payload.pageNumber;
      }
      return a.payload.chunkIndex - b.payload.chunkIndex;
    });

    return Promise.resolve(hits.slice(0, Math.max(0, limit)));
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /** Test helper — not part of VectorStore. */
  getPoint(id: string): { vector: number[]; payload: VectorPointPayload } | undefined {
    return this.points.get(id);
  }

  size(): number {
    return this.points.size;
  }

  /** Test helper — clear all points between cases. */
  clear(): void {
    this.points.clear();
  }
}
