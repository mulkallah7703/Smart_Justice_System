import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

import type { AppConfig } from '../../../config/env.validation';
import { AppError } from '../../../shared/exceptions/app-error';
import {
  aiEmbeddingDimensionMismatch,
  aiVectorStoreError,
} from '../ai.errors';

import type {
  VectorSearchHit,
  VectorSearchInput,
  VectorStore,
  VectorUpsertPoint,
} from './vector-store.interface';

/**
 * Qdrant-backed vector index. Derived storage only — Postgres remains canonical.
 *
 * Cloud and recent Qdrant builds require payload indexes for filtered search.
 * `ensureCollection` creates keyword/integer indexes for every filter key used
 * by `search` (userId, trust, pipelineVersion, embeddingModel).
 */
@Injectable()
export class QdrantVectorStore implements VectorStore, OnModuleInit {
  readonly name = 'qdrant';
  readonly collection: string;
  readonly dimensions: number;

  private readonly logger = new Logger(QdrantVectorStore.name);
  private readonly client: QdrantClient | null;
  private readonly distance = 'Cosine' as const;
  private readonly enabled: boolean;

  /** Payload keys applied as must-filters in `search`. */
  private static readonly FILTER_INDEXES: readonly {
    field: string;
    schema: 'keyword' | 'integer';
  }[] = [
    { field: 'userId', schema: 'keyword' },
    { field: 'trust', schema: 'keyword' },
    { field: 'embeddingModel', schema: 'keyword' },
    { field: 'pipelineVersion', schema: 'integer' },
  ];

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const ai = this.configService.get('ai', { infer: true });
    this.collection = ai.qdrantCollection;
    this.dimensions = ai.embeddingDimensions;
    this.enabled = ai.vectorStoreMode === 'qdrant';
    this.client = ai.qdrantUrl
      ? new QdrantClient({
          url: ai.qdrantUrl,
          apiKey: ai.qdrantApiKey ?? undefined,
          checkCompatibility: false,
        })
      : null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    await this.ensureCollection();
  }

  async ensureCollection(): Promise<void> {
    if (!this.client) {
      throw aiVectorStoreError();
    }
    try {
      const exists = await this.client.collectionExists(this.collection);
      if (exists.exists) {
        const info = await this.client.getCollection(this.collection);
        const vectors = info.config?.params?.vectors;
        const size =
          typeof vectors === 'object' &&
          vectors !== null &&
          'size' in vectors
            ? Number((vectors as { size: number }).size)
            : null;
        if (size !== null && size !== this.dimensions) {
          throw aiEmbeddingDimensionMismatch();
        }
      } else {
        await this.client.createCollection(this.collection, {
          vectors: {
            size: this.dimensions,
            distance: this.distance,
          },
        });
      }

      await this.ensureFilterIndexes();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const detail =
        error instanceof Error ? error.message : 'unknown vector-store error';
      this.logger.warn(`Qdrant ensureCollection failed: ${detail}`);
      throw aiVectorStoreError();
    }
  }

  /**
   * Idempotent. Qdrant Cloud rejects filtered search without indexes whose
   * schema matches the stored payload types (pipelineVersion is an integer).
   */
  private async ensureFilterIndexes(): Promise<void> {
    if (!this.client) {
      return;
    }
    for (const index of QdrantVectorStore.FILTER_INDEXES) {
      try {
        await this.client.createPayloadIndex(this.collection, {
          wait: true,
          field_name: index.field,
          field_schema: index.schema,
        });
      } catch (error) {
        if (this.isAlreadyExistsIndexError(error)) {
          continue;
        }
        // Wrong schema left from an earlier run — drop and recreate.
        try {
          await this.client.deletePayloadIndex(this.collection, index.field);
          await this.client.createPayloadIndex(this.collection, {
            wait: true,
            field_name: index.field,
            field_schema: index.schema,
          });
        } catch (retryError) {
          if (this.isAlreadyExistsIndexError(retryError)) {
            continue;
          }
          throw retryError;
        }
      }
    }
  }

  private isAlreadyExistsIndexError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const nested = JSON.stringify(
      (error as { data?: unknown })?.data ?? '',
    );
    return /already exists|already present|duplicate/i.test(
      `${message} ${nested}`,
    );
  }

  async upsert(points: readonly VectorUpsertPoint[]): Promise<void> {
    if (!this.client) {
      throw aiVectorStoreError();
    }
    if (points.length === 0) {
      return;
    }
    for (const point of points) {
      if (point.vector.length !== this.dimensions) {
        throw aiEmbeddingDimensionMismatch();
      }
    }

    try {
      await this.client.upsert(this.collection, {
        wait: true,
        points: points.map((point) => ({
          id: point.id,
          vector: [...point.vector],
          payload: { ...point.payload },
        })),
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.warn('Qdrant upsert failed');
      throw aiVectorStoreError();
    }
  }

  async deleteByIds(ids: readonly string[]): Promise<void> {
    if (!this.client) {
      throw aiVectorStoreError();
    }
    if (ids.length === 0) {
      return;
    }
    try {
      await this.client.delete(this.collection, {
        wait: true,
        points: [...ids],
      });
    } catch {
      this.logger.warn('Qdrant delete failed');
      throw aiVectorStoreError();
    }
  }

  async search(input: VectorSearchInput): Promise<readonly VectorSearchHit[]> {
    if (!this.client) {
      throw aiVectorStoreError();
    }
    if (input.vector.length !== this.dimensions) {
      throw aiEmbeddingDimensionMismatch();
    }
    if (input.limit <= 0) {
      return [];
    }

    try {
      const result = await this.client.search(this.collection, {
        vector: [...input.vector],
        limit: input.limit,
        with_payload: true,
        score_threshold: input.scoreThreshold,
        filter: {
          must: [
            {
              key: 'userId',
              match: { value: input.filters.userId },
            },
            {
              key: 'trust',
              match: { value: input.filters.trust },
            },
            {
              key: 'pipelineVersion',
              match: { value: input.filters.pipelineVersion },
            },
            {
              key: 'embeddingModel',
              match: { value: input.filters.embeddingModel },
            },
          ],
        },
      });

      const hits: VectorSearchHit[] = [];
      for (const point of result) {
        const raw = point.payload;
        if (!raw || typeof raw !== 'object') {
          continue;
        }
        const payload = raw as Record<string, unknown>;
        const chunkId =
          typeof payload.chunkId === 'string' ? payload.chunkId : null;
        if (!chunkId || typeof point.score !== 'number') {
          continue;
        }
        hits.push({
          chunkId,
          score: point.score,
          payload: {
            chunkId,
            documentId: String(payload.documentId ?? ''),
            documentPageId: String(payload.documentPageId ?? ''),
            userId: String(payload.userId ?? ''),
            pageNumber: Number(payload.pageNumber ?? 0),
            chunkIndex: Number(payload.chunkIndex ?? 0),
            pipelineVersion: Number(payload.pipelineVersion ?? 0),
            embeddingModel: String(payload.embeddingModel ?? ''),
            extractionMethod:
              payload.extractionMethod === 'OCR' ? 'OCR' : 'TEXT_LAYER',
            trust: 'TRUSTED',
          },
        });
      }
      return hits;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const detail =
        error instanceof Error ? error.message : 'unknown vector-store error';
      this.logger.warn(`Qdrant search failed: ${detail}`);
      throw aiVectorStoreError();
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      await this.client.getCollections();
      return true;
    } catch {
      return false;
    }
  }
}
