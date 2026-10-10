import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';

import type { AppConfig } from '../../config/env.validation';
import { PrismaService } from '../../shared/database/prisma.service';
import { AI_PIPELINE_VERSION } from './ai.constants';
import { chunkPageText } from './chunking/text-chunker';

export interface PersistDocumentChunksInput {
  /** Owning citizen, re-checked against Document.userId. */
  userId: string;
  documentIds: readonly string[];
}

export interface PersistDocumentChunksResult {
  /** TRUSTED pages that were considered for chunking. */
  trustedPagesConsidered: number;
  /** Rows attempted (spans produced). */
  attempted: number;
  /** Rows skipped because they already existed. */
  skippedExisting: number;
  /** Chunks stored for these documents at the current pipeline version. */
  totalStored: number;
  /** Exact chunk texts for mock downstream only — never logged or put in resultJson. */
  trustedChunkTexts: readonly string[];
}

/**
 * Chunks TRUSTED DocumentPage rows into DocumentChunk records.
 * REVIEW_REQUIRED / UNUSABLE pages are never chunked.
 */
@Injectable()
export class DocumentChunksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async persistTrustedPageChunks(
    input: PersistDocumentChunksInput,
  ): Promise<PersistDocumentChunksResult> {
    if (input.documentIds.length === 0) {
      return {
        trustedPagesConsidered: 0,
        attempted: 0,
        skippedExisting: 0,
        totalStored: 0,
        trustedChunkTexts: [],
      };
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

    const ai = this.configService.get('ai', { infer: true });
    const maxChars = ai.chunkMaxChars;
    const overlap = ai.chunkOverlap;

    // Only TRUSTED pages. Text is loaded for chunking and never logged.
    const trustedPages = await this.prisma.documentPage.findMany({
      where: {
        documentId: { in: [...input.documentIds] },
        trust: 'TRUSTED',
      },
      select: {
        id: true,
        documentId: true,
        text: true,
      },
      orderBy: [{ documentId: 'asc' }, { pageNumber: 'asc' }],
    });

    const rows: Prisma.DocumentChunkCreateManyInput[] = [];
    const trustedChunkTexts: string[] = [];

    for (const page of trustedPages) {
      const spans = chunkPageText(page.text, {
        maxChars,
        overlap,
      });
      for (const span of spans) {
        rows.push({
          documentId: page.documentId,
          documentPageId: page.id,
          chunkIndex: span.chunkIndex,
          text: span.text,
          startOffset: span.startOffset,
          endOffset: span.endOffset,
          pipelineVersion: AI_PIPELINE_VERSION,
        });
        trustedChunkTexts.push(span.text);
      }
    }

    let created = 0;
    if (rows.length > 0) {
      // First write wins — never overwrite existing legal spans on retry.
      const result = await this.prisma.documentChunk.createMany({
        data: rows,
        skipDuplicates: true,
      });
      created = result.count;
    }

    const totalStored = await this.prisma.documentChunk.count({
      where: {
        documentId: { in: [...input.documentIds] },
        pipelineVersion: AI_PIPELINE_VERSION,
      },
    });

    return {
      trustedPagesConsidered: trustedPages.length,
      attempted: rows.length,
      skippedExisting: rows.length - created,
      totalStored,
      trustedChunkTexts,
    };
  }
}
