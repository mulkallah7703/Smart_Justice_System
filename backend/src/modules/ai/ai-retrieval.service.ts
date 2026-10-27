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
import {
  rewriteArabicLegalQuery,
  rulingTermBoost,
} from './providers/ruling-grounding';
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

    const scoped =
      Boolean(body.caseId) || Boolean(body.documentIds && body.documentIds.length > 0);
    const limit =
      body.limit ??
      (scoped
        ? Math.min(ai.retrievalMaxLimit, Math.max(ai.retrievalDefaultLimit * 2, 12))
        : ai.retrievalDefaultLimit);
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
        texts: [
          normalizeForEmbedding(rewriteArabicLegalQuery(body.query)),
        ],
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

    let deduped = this.dedupeByChunkId(hits);
    let activeIds = scopedDocumentIds;
    if (deduped.length > 0) {
      activeIds = await this.focusDocumentIds(userId, deduped, scopedDocumentIds);
      deduped = deduped.filter((hit) =>
        activeIds?.includes(hit.payload.documentId),
      );
    }
    if (activeIds && activeIds.length > 0) {
      let priorityIds: string[] = [];
      try {
        priorityIds = await this.findScopedPriorityChunkIds(
          userId,
          body,
          activeIds,
          embedModel,
        );
      } catch {
        this.logger.warn('PostgreSQL chunk lookup failed');
        throw aiRetrievalFailed();
      }
      for (const chunkId of priorityIds) {
        if (deduped.some((hit) => hit.chunkId === chunkId)) {
          continue;
        }
        deduped.push({
          chunkId,
          score: 0.95,
          payload: {
            chunkId,
            documentId: activeIds[0] ?? '',
            documentPageId: '',
            userId,
            pageNumber: 0,
            chunkIndex: 0,
            pipelineVersion: AI_PIPELINE_VERSION,
            embeddingModel: embedModel,
            extractionMethod: 'OCR',
            trust: 'TRUSTED',
            section: 'RULING',
          },
        });
      }
    }
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
            ...(activeIds ? { id: { in: [...activeIds] } } : {}),
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
      results.push(
        mapRetrieveResultItem(hit.score + rulingTermBoost(row.text), row),
      );
    }
    results.sort((left, right) => right.score - left.score);

    const summary = await this.loadAnalysisSummary(
      userId,
      activeIds ?? results.map((item) => item.provenance.documentId),
    );
    if (summary && results[0]) {
      results.splice(1, 0, {
        score: results[0].score,
        text: `ملخص التحليل:\n${summary}`,
        provenance: { ...results[0].provenance },
      });
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

  /**
   * Scoped questions must still see the ruling (منطوق الحكم) and any chunk
   * that literally contains a distinctive query word, even when the vector
   * rank misses that section.
   */
  private async findScopedPriorityChunkIds(
    userId: string,
    body: RetrieveQueryDto,
    documentIds: readonly string[],
    embedModel: string,
  ): Promise<string[]> {
    const keyword = longestArabicToken(body.query);
    const rows = await this.prisma.documentChunk.findMany({
      where: {
        pipelineVersion: AI_PIPELINE_VERSION,
        embeddingStatus: 'READY',
        embeddingModel: embedModel,
        documentPage: { trust: 'TRUSTED' },
        document: {
          userId,
          deletedAt: null,
          id: { in: [...documentIds] },
          ...(body.caseId ? { caseId: body.caseId } : {}),
        },
        OR: [
          { section: 'RULING' },
          { text: { contains: 'منطوق الحكم' } },
          { text: { contains: 'نص الحكم' } },
          { text: { contains: 'حكمت المحكمة' } },
          { text: { contains: 'حق الاعتراض' } },
          { text: { contains: 'استئناف' } },
          ...(keyword ? [{ text: { contains: keyword } }] : []),
        ],
      },
      select: { id: true },
      take: 8,
    });
    return rows.map((row) => row.id);
  }

  /**
   * Keeps the case with the strongest hit. Unscoped search never mixes
   * facts from the caller's other cases.
   */
  private async focusDocumentIds(
    userId: string,
    hits: readonly VectorSearchHit[],
    scopedDocumentIds: readonly string[] | undefined,
  ): Promise<readonly string[]> {
    const hitIds = [
      ...new Set(hits.map((hit) => hit.payload.documentId).filter(Boolean)),
    ];
    const ids = scopedDocumentIds ?? hitIds;
    let rows: Array<{ id: string; caseId: string | null }> = [];
    try {
      rows = await this.prisma.document.findMany({
        where: { userId, deletedAt: null, id: { in: [...ids] } },
        select: { id: true, caseId: true },
      });
    } catch {
      rows = [];
    }
    if (rows.length === 0) {
      const top = hits[0]?.payload.documentId;
      return top ? [top] : [...(scopedDocumentIds ?? [])];
    }
    const caseKey = (id: string): string => {
      const row = rows.find((item) => item.id === id);
      return row?.caseId ?? id;
    };
    const groups = new Map<string, { score: number; docs: Set<string> }>();
    for (const hit of hits) {
      const docId = hit.payload.documentId;
      if (scopedDocumentIds && !scopedDocumentIds.includes(docId)) {
        continue;
      }
      const key = caseKey(docId);
      const group = groups.get(key) ?? { score: -Infinity, docs: new Set<string>() };
      if (hit.score > group.score) {
        group.score = hit.score;
      }
      group.docs.add(docId);
      groups.set(key, group);
    }
    if (groups.size === 0) {
      return [...(scopedDocumentIds ?? hitIds)];
    }
    let winner = '';
    let winnerScore = -Infinity;
    for (const [key, group] of groups) {
      if (group.score > winnerScore) {
        winner = key;
        winnerScore = group.score;
      }
    }
    const sameCase = rows
      .filter((row) => (row.caseId ?? row.id) === winner)
      .map((row) => row.id);
    return sameCase.length > 0 ? sameCase : [...(groups.get(winner)?.docs ?? [])];
  }

  /** Latest analysis summary for the focused documents. Missing mocks skip it. */
  private async loadAnalysisSummary(
    userId: string,
    documentIds: readonly string[],
  ): Promise<string | null> {
    const jobs = (
      this.prisma as unknown as {
        aiJob?: {
          findFirst: (args: unknown) => Promise<{ resultJson: unknown } | null>;
        };
      }
    ).aiJob;
    if (!jobs?.findFirst || documentIds.length === 0) {
      return null;
    }
    try {
      const job = await jobs.findFirst({
        where: {
          userId,
          status: 'DONE',
          documents: { some: { documentId: { in: [...documentIds] } } },
        },
        orderBy: { completedAt: 'desc' },
        select: { resultJson: true },
      });
      const result = job?.resultJson;
      if (!result || typeof result !== 'object') {
        return null;
      }
      const output = (result as { output?: unknown }).output;
      return typeof output === 'string' && output.trim().length > 0
        ? output.trim().slice(0, 1500)
        : null;
    } catch {
      return null;
    }
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
    return [...best.values()].sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.chunkId.localeCompare(right.chunkId);
    });
  }
}

const longestArabicToken = (query: string): string | null => {
  const tokens = query.match(/[\u0621-\u064A]{4,}/gu) ?? [];
  let best: string | null = null;
  for (const token of tokens) {
    if (!best || token.length > best.length) {
      best = token;
    }
  }
  return best;
};
