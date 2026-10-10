import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/env.validation';
import { AppError } from '../../shared/exceptions/app-error';
import { PrismaService } from '../../shared/database/prisma.service';
import { AI_PIPELINE_VERSION } from './ai.constants';
import { aiEmbeddingDimensionMismatch } from './ai.errors';
import { normalizeForEmbedding } from './chunking/text-normalize';
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from './providers/embedding-provider.interface';
import { chunkIdToPointId } from './vector/point-id';
import {
  VECTOR_STORE,
  type VectorStore,
  type VectorUpsertPoint,
} from './vector/vector-store.interface';

export interface EmbedTrustedChunksInput {
  userId: string;
  documentIds: readonly string[];
}

export interface EmbedTrustedChunksResult {
  chunksEligible: number;
  chunksEmbedded: number;
  embeddingModel: string;
  embeddingDimensions: number;
  collection: string;
  /** Exact texts embedded, in upsert order — for mock LLM only; never logged. */
  embeddedTexts: readonly string[];
}

/**
 * Embeds TRUSTED DocumentChunk rows and upserts vectors. Does not call OCR,
 * does not rewrite text, and does not send ownership fields to the embedding API.
 */
@Injectable()
export class EmbeddingIngestService {
  private readonly logger = new Logger(EmbeddingIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
    @Inject(VECTOR_STORE) private readonly vectors: VectorStore,
  ) {}

  async embedTrustedChunks(
    input: EmbedTrustedChunksInput,
  ): Promise<EmbedTrustedChunksResult> {
    const ai = this.configService.get('ai', { infer: true });
    const empty: EmbedTrustedChunksResult = {
      chunksEligible: 0,
      chunksEmbedded: 0,
      embeddingModel: this.embeddings.name === 'mock' ? 'mock-embedding-v1' : ai.embeddingModel,
      embeddingDimensions: this.embeddings.dimensions,
      collection: this.vectors.collection,
      embeddedTexts: [],
    };

    if (input.documentIds.length === 0) {
      return empty;
    }

    const owned = await this.prisma.document.findMany({
      where: {
        id: { in: [...input.documentIds] },
        userId: input.userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (owned.length !== input.documentIds.length) {
      throw new Error('AI_JOB_OWNERSHIP_MISMATCH');
    }

    // Only chunks on TRUSTED pages. Text is never logged.
    const chunks = await this.prisma.documentChunk.findMany({
      where: {
        documentId: { in: [...input.documentIds] },
        pipelineVersion: AI_PIPELINE_VERSION,
        documentPage: { trust: 'TRUSTED' },
      },
      select: {
        id: true,
        documentId: true,
        documentPageId: true,
        chunkIndex: true,
        text: true,
        pipelineVersion: true,
        documentPage: {
          select: {
            pageNumber: true,
            extractionMethod: true,
            trust: true,
          },
        },
      },
      orderBy: [{ documentId: 'asc' }, { chunkIndex: 'asc' }],
    });

    if (chunks.length === 0) {
      return empty;
    }

    if (this.embeddings.dimensions !== ai.embeddingDimensions) {
      throw aiEmbeddingDimensionMismatch();
    }

    await this.vectors.ensureCollection();

    const batchSize = ai.embeddingBatchSize;
    const embeddedTexts: string[] = [];
    let embeddedCount = 0;
    const modelLabel =
      this.embeddings.name === 'mock' ? 'mock-embedding-v1' : ai.embeddingModel;

    for (let offset = 0; offset < chunks.length; offset += batchSize) {
      const batch = chunks.slice(offset, offset + batchSize);
      const texts = batch.map((chunk) =>
        normalizeForEmbedding(chunk.text),
      );

      let result;
      try {
        result = await this.embeddings.embed({ texts });
      } catch (error) {
        const code =
          error instanceof AppError ? error.code : 'AI_EMBEDDING_ERROR';
        await this.prisma.documentChunk.updateMany({
          where: { id: { in: batch.map((chunk) => chunk.id) } },
          data: {
            embeddingStatus: 'FAILED',
            embeddingErrorCode: code,
          },
        });
        throw error instanceof AppError ? error : new Error(code);
      }

      if (
        result.dimensions !== ai.embeddingDimensions ||
        result.vectors.length !== batch.length ||
        result.vectors.some((vector) => vector.length !== ai.embeddingDimensions)
      ) {
        throw aiEmbeddingDimensionMismatch();
      }

      const points: VectorUpsertPoint[] = batch.map((chunk, index) => ({
        id: chunkIdToPointId(chunk.id),
        vector: result.vectors[index]!,
        payload: {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentPageId: chunk.documentPageId,
          userId: input.userId,
          pageNumber: chunk.documentPage.pageNumber,
          chunkIndex: chunk.chunkIndex,
          pipelineVersion: chunk.pipelineVersion,
          embeddingModel: result.model,
          extractionMethod: chunk.documentPage.extractionMethod,
          trust: 'TRUSTED',
        },
      }));

      try {
        await this.vectors.upsert(points);
      } catch (error) {
        const code =
          error instanceof AppError ? error.code : 'AI_VECTOR_STORE_ERROR';
        await this.prisma.documentChunk.updateMany({
          where: { id: { in: batch.map((chunk) => chunk.id) } },
          data: {
            embeddingStatus: 'FAILED',
            embeddingErrorCode: code,
          },
        });
        throw error instanceof AppError ? error : new Error(code);
      }

      await this.prisma.documentChunk.updateMany({
        where: { id: { in: batch.map((chunk) => chunk.id) } },
        data: {
          embeddingStatus: 'READY',
          embeddingModel: result.model,
          embeddedAt: new Date(),
          embeddingErrorCode: null,
        },
      });

      embeddedTexts.push(...texts);
      embeddedCount += batch.length;
    }

    this.logger.log(
      `Embedded chunksEligible=${chunks.length} chunksEmbedded=${embeddedCount} collection=${this.vectors.collection}`,
    );

    return {
      chunksEligible: chunks.length,
      chunksEmbedded: embeddedCount,
      embeddingModel: modelLabel,
      embeddingDimensions: ai.embeddingDimensions,
      collection: this.vectors.collection,
      embeddedTexts,
    };
  }
}
