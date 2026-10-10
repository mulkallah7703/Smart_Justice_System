import { Injectable } from '@nestjs/common';
import type {
  DocumentPageExtractionMethod,
  DocumentPageTrust,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../shared/database/prisma.service';
import type { ExtractedTextPage } from './providers/text-extractor.interface';

export interface PersistDocumentPagesInput {
  /** Owning citizen, re-checked against Document.userId. Never client-supplied alone. */
  userId: string;
  documentId: string;
  pages: readonly ExtractedTextPage[];
}

export interface PersistDocumentPagesResult {
  documentId: string;
  attempted: number;
  /** Rows that already existed (unique conflict / skipDuplicates). */
  skippedExisting: number;
  /** Total pages stored for this document after the write. */
  totalStored: number;
}

/**
 * Persists extraction output as DocumentPage rows. Short DB operations only —
 * never call this while holding a transaction across MinIO/OCR/render work.
 *
 * Idempotent: UNIQUE(documentId, pageNumber) + createMany(skipDuplicates) so
 * retries and partial failures never duplicate or silently overwrite text.
 */
@Injectable()
export class DocumentPagesService {
  constructor(private readonly prisma: PrismaService) {}

  async persistExtractedPages(
    input: PersistDocumentPagesInput,
  ): Promise<PersistDocumentPagesResult> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        userId: input.userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!document) {
      throw new Error('AI_JOB_OWNERSHIP_MISMATCH');
    }

    const rows: Prisma.DocumentPageCreateManyInput[] = input.pages.map(
      (page) => ({
        documentId: input.documentId,
        pageNumber: page.pageNumber,
        text: page.text,
        extractionMethod: page.method as DocumentPageExtractionMethod,
        trust: page.trust as DocumentPageTrust,
        confidence: page.confidence,
        warnings: [...page.warnings],
        language: page.language,
      }),
    );

    let created = 0;
    if (rows.length > 0) {
      // First write wins. Existing trusted/legal text is never overwritten.
      const result = await this.prisma.documentPage.createMany({
        data: rows,
        skipDuplicates: true,
      });
      created = result.count;
    }

    const totalStored = await this.prisma.documentPage.count({
      where: { documentId: input.documentId },
    });

    return {
      documentId: input.documentId,
      attempted: rows.length,
      skippedExisting: rows.length - created,
      totalStored,
    };
  }

  /**
   * Counts only — never returns page text. Safe for job result metadata.
   */
  async countByTrust(
    documentIds: readonly string[],
  ): Promise<{
    total: number;
    trusted: number;
    reviewRequired: number;
    unusable: number;
  }> {
    if (documentIds.length === 0) {
      return { total: 0, trusted: 0, reviewRequired: 0, unusable: 0 };
    }

    const groups = await this.prisma.documentPage.groupBy({
      by: ['trust'],
      where: { documentId: { in: [...documentIds] } },
      _count: { _all: true },
    });

    const counts = {
      total: 0,
      trusted: 0,
      reviewRequired: 0,
      unusable: 0,
    };
    for (const group of groups) {
      const n = group._count._all;
      counts.total += n;
      if (group.trust === 'TRUSTED') counts.trusted += n;
      else if (group.trust === 'REVIEW_REQUIRED') counts.reviewRequired += n;
      else if (group.trust === 'UNUSABLE') counts.unusable += n;
    }
    return counts;
  }
}
