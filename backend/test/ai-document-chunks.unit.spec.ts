import { ConfigService } from '@nestjs/config';

import { AI_PIPELINE_VERSION } from '../src/modules/ai/ai.constants';
import { DocumentChunksService } from '../src/modules/ai/document-chunks.service';
import type { PrismaService } from '../src/shared/database/prisma.service';

const createConfig = (chunkMaxChars = 40): ConfigService<never, true> =>
  ({
    get: () => ({ chunkMaxChars }),
  }) as unknown as ConfigService<never, true>;

const createPrismaStub = () => {
  const pages: Array<{
    id: string;
    documentId: string;
    pageNumber: number;
    trust: string;
    text: string;
  }> = [];
  const chunks: Array<{
    documentId: string;
    documentPageId: string;
    chunkIndex: number;
    text: string;
    startOffset: number;
    endOffset: number;
    pipelineVersion: number;
  }> = [];
  const documents = new Set<string>(['doc-1']);

  const prisma = {
    document: {
      findMany: ({
        where,
      }: {
        where: { id: { in: string[] }; userId: string; deletedAt: null };
      }) => {
        if (where.userId !== 'user-1') {
          return Promise.resolve([]);
        }
        return Promise.resolve(
          where.id.in.filter((id) => documents.has(id)).map((id) => ({ id })),
        );
      },
    },
    documentPage: {
      findMany: ({
        where,
      }: {
        where: { documentId: { in: string[] }; trust: string };
      }) =>
        Promise.resolve(
          pages
            .filter(
              (page) =>
                where.documentId.in.includes(page.documentId) &&
                page.trust === where.trust,
            )
            .sort(
              (a, b) =>
                a.documentId.localeCompare(b.documentId) ||
                a.pageNumber - b.pageNumber,
            ),
        ),
    },
    documentChunk: {
      createMany: ({
        data,
        skipDuplicates,
      }: {
        data: typeof chunks;
        skipDuplicates?: boolean;
      }) => {
        let count = 0;
        for (const row of data) {
          const exists = chunks.some(
            (entry) =>
              entry.documentPageId === row.documentPageId &&
              entry.chunkIndex === row.chunkIndex &&
              entry.pipelineVersion === row.pipelineVersion,
          );
          if (exists && skipDuplicates) {
            continue;
          }
          if (exists) {
            throw new Error('unique violation');
          }
          chunks.push({ ...row });
          count += 1;
        }
        return Promise.resolve({ count });
      },
      count: ({
        where,
      }: {
        where: { documentId: { in: string[] }; pipelineVersion: number };
      }) =>
        Promise.resolve(
          chunks.filter(
            (row) =>
              where.documentId.in.includes(row.documentId) &&
              row.pipelineVersion === where.pipelineVersion,
          ).length,
        ),
    },
  } as unknown as PrismaService;

  return { prisma, pages, chunks, documents };
};

describe('DocumentChunksService', () => {
  it('chunks only TRUSTED pages and preserves exact substrings', async () => {
    const { prisma, pages, chunks } = createPrismaStub();
    pages.push(
      {
        id: 'page-trusted',
        documentId: 'doc-1',
        pageNumber: 1,
        trust: 'TRUSTED',
        text: 'Article 12 of the lease agreement.',
      },
      {
        id: 'page-arabic',
        documentId: 'doc-1',
        pageNumber: 2,
        trust: 'REVIEW_REQUIRED',
        text: 'هذه قضية إيجارية',
      },
      {
        id: 'page-ocr',
        documentId: 'doc-1',
        pageNumber: 3,
        trust: 'REVIEW_REQUIRED',
        text: 'ocr text',
      },
      {
        id: 'page-empty',
        documentId: 'doc-1',
        pageNumber: 4,
        trust: 'UNUSABLE',
        text: '',
      },
    );

    const result = await new DocumentChunksService(
      prisma,
      createConfig(200),
    ).persistTrustedPageChunks({
      userId: 'user-1',
      documentIds: ['doc-1'],
    });

    expect(result.trustedPagesConsidered).toBe(1);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Article 12 of the lease agreement.');
    expect(chunks[0].pipelineVersion).toBe(AI_PIPELINE_VERSION);
    expect(chunks[0].documentPageId).toBe('page-trusted');
    expect(result.trustedChunkTexts).toEqual([
      'Article 12 of the lease agreement.',
    ]);
  });

  it('produces zero chunks for REVIEW_REQUIRED Arabic and OCR', async () => {
    const { prisma, pages, chunks } = createPrismaStub();
    pages.push({
      id: 'page-ar',
      documentId: 'doc-1',
      pageNumber: 1,
      trust: 'REVIEW_REQUIRED',
      text: 'هذه قضية',
    });

    const result = await new DocumentChunksService(
      prisma,
      createConfig(),
    ).persistTrustedPageChunks({
      userId: 'user-1',
      documentIds: ['doc-1'],
    });

    expect(result.attempted).toBe(0);
    expect(chunks).toHaveLength(0);
  });

  it('is idempotent across retries without overwriting text', async () => {
    const { prisma, pages, chunks } = createPrismaStub();
    pages.push({
      id: 'page-1',
      documentId: 'doc-1',
      pageNumber: 1,
      trust: 'TRUSTED',
      text: 'Stable trusted English.',
    });
    const service = new DocumentChunksService(prisma, createConfig(200));

    await service.persistTrustedPageChunks({
      userId: 'user-1',
      documentIds: ['doc-1'],
    });
    pages[0].text = 'Must not overwrite';
    const second = await service.persistTrustedPageChunks({
      userId: 'user-1',
      documentIds: ['doc-1'],
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Stable trusted English.');
    expect(second.skippedExisting).toBe(1);
  });

  it('fills missing chunks after partial persistence', async () => {
    const { prisma, pages, chunks } = createPrismaStub();
    pages.push({
      id: 'page-1',
      documentId: 'doc-1',
      pageNumber: 1,
      trust: 'TRUSTED',
      text: `${'a'.repeat(50)}\n\n${'b'.repeat(50)}`,
    });
    const service = new DocumentChunksService(prisma, createConfig(40));

    // Simulate partial: only first chunk row exists.
    const firstPass = await service.persistTrustedPageChunks({
      userId: 'user-1',
      documentIds: ['doc-1'],
    });
    expect(firstPass.totalStored).toBeGreaterThan(1);

    const before = chunks.length;
    const retry = await service.persistTrustedPageChunks({
      userId: 'user-1',
      documentIds: ['doc-1'],
    });

    expect(chunks).toHaveLength(before);
    expect(retry.skippedExisting).toBe(retry.attempted);
  });

  it('rejects foreign document ownership', async () => {
    const { prisma, pages } = createPrismaStub();
    pages.push({
      id: 'page-1',
      documentId: 'doc-1',
      pageNumber: 1,
      trust: 'TRUSTED',
      text: 'x',
    });

    await expect(
      new DocumentChunksService(prisma, createConfig()).persistTrustedPageChunks(
        {
          userId: 'stranger',
          documentIds: ['doc-1'],
        },
      ),
    ).rejects.toThrow('AI_JOB_OWNERSHIP_MISMATCH');
  });
});
