import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/env.validation';
import { AppError } from '../../shared/exceptions/app-error';
import { PrismaService } from '../../shared/database/prisma.service';
import { AI_PIPELINE_VERSION } from './ai.constants';
import {
  aiEmbeddingDimensionMismatch,
  aiRetrievalConfigMismatch,
  aiRetrievalFailed,
} from './ai.errors';
import { normalizeForEmbedding } from './chunking/text-normalize';
import type { RetrieveQueryDto } from './dto/retrieve-query.dto';
import type { RetrieveResponseDto } from './dto/retrieve-response.dto';
import {
  mapRetrieveResponse,
  mapRetrieveResultItem,
  type RetrievalChunkRow,
} from './mappers/retrieve.mapper';
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from './providers/embedding-provider.interface';
import {
  VECTOR_STORE,
  type VectorSearchHit,
  type VectorStore,
} from './vector/vector-store.interface';

/**
 * Synchronous evidence retrieval (Option C).
 * Qdrant ranks candidates; PostgreSQL authorizes and supplies text.
 */
@Injectable()
export class AiRetrievalService {
  private readonly logger = new Logger(AiRetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
    @Inject(VECTOR_STORE) private readonly vectors: VectorStore,
  ) {}

  async retrieve(
    userId: string,
    body: RetrieveQueryDto,
  ): Promise<RetrieveResponseDto> {
    const ai = this.configService.get('ai', { infer: true });

    const limit = body.limit ?? ai.retrievalDefaultLimit;
    if (limit < 1 || limit > ai.retrievalMaxLimit) {
      throw aiRetrievalConfigMismatch();
    }

    const minScore =
      body.minScore !== undefined
        ? body.minScore
        : (ai.retrievalDefaultMinScore ?? undefined);

    if (
      this.embeddings.dimensions !== ai.embeddingDimensions ||
      this.vectors.dimensions !== ai.embeddingDimensions
    ) {
      throw aiRetrievalConfigMismatch();
    }

    const expectedModel =
      this.embeddings.name === 'mock'
        ? 'mock-embedding-v1'
        : ai.embeddingModel;

    if (
      this.embeddings.name !== 'mock' &&
      this.vectors.collection !== ai.qdrantCollection
    ) {
      throw aiRetrievalConfigMismatch();
    }

    let queryVector: readonly number[];
    let embedModel: string;
    try {
      // Embedding input only — NFC/whitespace normalize; Postgres keeps original.
      // Never log query text.
      const embedded = await this.embeddings.embed({
        texts: [normalizeForEmbedding(body.query)],
      });
      if (
        embedded.dimensions !== ai.embeddingDimensions ||
        embedded.vectors.length !== 1 ||
        embedded.vectors[0]!.length !== ai.embeddingDimensions
      ) {
        throw aiEmbeddingDimensionMismatch();
      }
      if (embedded.model !== expectedModel) {
        throw aiRetrievalConfigMismatch();
      }
      queryVector = embedded.vectors[0]!;
      embedModel = embedded.model;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.warn('Query embedding failed');
      throw aiRetrievalFailed();
    }

    const scopedDocumentIds = await this.resolveDocumentScope(userId, body);
    if (scopedDocumentIds && scopedDocumentIds.length === 0) {
      return mapRetrieveResponse({
        query: body.query,
        results: [],
        collection: this.vectors.collection,
        embeddingModel: embedModel,
        embeddingDimensions: ai.embeddingDimensions,
        limit,
        droppedCount: 0,
      });
    }

    let hits: readonly VectorSearchHit[];
    try {
      hits = await this.vectors.search({
        vector: queryVector,
        limit,
        scoreThreshold: minScore,
        filters: {
          userId,
          trust: 'TRUSTED',
          pipelineVersion: AI_PIPELINE_VERSION,
          embeddingModel: embedModel,
          ...(scopedDocumentIds ? { documentIds: scopedDocumentIds } : {}),
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.warn('Vector search failed');
      throw aiRetrievalFailed();
    }

    const deduped = this.dedupeByChunkId(hits);
    if (deduped.length === 0) {
      return mapRetrieveResponse({
        query: body.query,
        results: [],
        collection: this.vectors.collection,
        embeddingModel: embedModel,
        embeddingDimensions: ai.embeddingDimensions,
        limit,
        droppedCount: 0,
      });
    }

    const chunkIds = deduped.map((hit) => hit.chunkId);
    let rows: RetrievalChunkRow[];
    try {
      rows = (await this.prisma.documentChunk.findMany({
        where: {
          id: { in: chunkIds },
          pipelineVersion: AI_PIPELINE_VERSION,
          embeddingStatus: 'READY',
          embeddingModel: embedModel,
          documentPage: { trust: 'TRUSTED' },
          document: {
            userId,
            deletedAt: null,
            ...(scopedDocumentIds ? { id: { in: [...scopedDocumentIds] } } : {}),
            ...(body.caseId ? { caseId: body.caseId } : {}),
          },
        },
        select: {
          id: true,
          text: true,
          chunkIndex: true,
          startOffset: true,
          endOffset: true,
          pipelineVersion: true,
          embeddingModel: true,
          documentId: true,
          documentPageId: true,
          document: { select: { originalName: true } },
          documentPage: {
            select: {
              pageNumber: true,
              extractionMethod: true,
              trust: true,
            },
          },
        },
      })) as RetrievalChunkRow[];
    } catch {
      this.logger.warn('PostgreSQL chunk lookup failed');
      throw aiRetrievalFailed();
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    const results = [];
    let droppedCount = 0;

    for (const hit of deduped) {
      const row = byId.get(hit.chunkId);
      if (
        !row ||
        row.documentPage.trust !== 'TRUSTED' ||
        row.pipelineVersion !== AI_PIPELINE_VERSION ||
        row.embeddingModel !== embedModel
      ) {
        droppedCount += 1;
        continue;
      }
      results.push(mapRetrieveResultItem(hit.score, row));
    }

    this.logger.log(
      `Retrieval complete returned=${results.length} dropped=${droppedCount} limit=${limit}`,
    );

    return mapRetrieveResponse({
      query: body.query,
      results,
      collection: this.vectors.collection,
      embeddingModel: embedModel,
      embeddingDimensions: ai.embeddingDimensions,
      limit,
      droppedCount,
    });
  }

  /**
   * Ownership check. `undefined` means the caller did not narrow the search.
   * An empty array means the filter matches nothing the caller owns.
   */
  private async resolveDocumentScope(
    userId: string,
    body: RetrieveQueryDto,
  ): Promise<readonly string[] | undefined> {
    if (!body.caseId && !body.documentIds) {
      return undefined;
    }
    if (body.documentIds && body.documentIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.document.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(body.caseId ? { caseId: body.caseId } : {}),
        ...(body.documentIds ? { id: { in: body.documentIds } } : {}),
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private dedupeByChunkId(
    hits: readonly VectorSearchHit[],
  ): VectorSearchHit[] {
    const best = new Map<string, VectorSearchHit>();
    for (const hit of hits) {
      const existing = best.get(hit.chunkId);
      if (!existing || hit.score > existing.score) {
        best.set(hit.chunkId, hit);
      }
    }
    return [...best.values()].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.chunkId.localeCompare(b.chunkId);
    });
  }
}
