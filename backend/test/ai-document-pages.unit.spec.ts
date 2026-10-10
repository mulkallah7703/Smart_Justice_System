import { DocumentPagesService } from '../src/modules/ai/document-pages.service';
import { PDF_TEXT_VISUAL_ORDER } from '../src/modules/ai/providers/pdf/arabic-text-order';
import type { ExtractedTextPage } from '../src/modules/ai/providers/text-extractor.interface';
import type { PrismaService } from '../src/shared/database/prisma.service';

const page = (
  overrides: Partial<ExtractedTextPage> &
    Pick<ExtractedTextPage, 'pageNumber' | 'text' | 'method' | 'trust'>,
): ExtractedTextPage => ({
  status: 'EXTRACTED',
  documentId: 'doc-1',
  confidence: null,
  language: null,
  warnings: [],
  ...overrides,
});

const createPrismaStub = () => {
  const stored: Array<{
    documentId: string;
    pageNumber: number;
    text: string;
    extractionMethod: string;
    trust: string;
    confidence: number | null;
    warnings: string[];
    language: string | null;
  }> = [];

  const prisma = {
    document: {
      findFirst: ({
        where,
      }: {
        where: { id: string; userId: string; deletedAt: null };
      }) =>
        Promise.resolve(
          where.userId === 'user-1' && where.id === 'doc-1'
            ? { id: 'doc-1' }
            : null,
        ),
    },
    documentPage: {
      createMany: ({
        data,
        skipDuplicates,
      }: {
        data: typeof stored;
        skipDuplicates?: boolean;
      }) => {
        let count = 0;
        for (const row of data) {
          const exists = stored.some(
            (entry) =>
              entry.documentId === row.documentId &&
              entry.pageNumber === row.pageNumber,
          );
          if (exists && skipDuplicates) {
            continue;
          }
          if (exists) {
            throw new Error('unique violation');
          }
          stored.push({ ...row });
          count += 1;
        }
        return Promise.resolve({ count });
      },
      count: ({ where }: { where: { documentId: string } }) =>
        Promise.resolve(
          stored.filter((row) => row.documentId === where.documentId).length,
        ),
      findMany: ({ where }: { where: { documentId: string } }) =>
        Promise.resolve(
          stored.filter((row) => row.documentId === where.documentId),
        ),
      groupBy: () => Promise.resolve([]),
    },
  } as unknown as PrismaService;

  return { prisma, stored };
};

describe('DocumentPagesService', () => {
  it('persists one page with exact text round-trip fields', async () => {
    const { prisma, stored } = createPrismaStub();
    const service = new DocumentPagesService(prisma);
    const text = 'Article 12 of the lease agreement';

    await service.persistExtractedPages({
      userId: 'user-1',
      documentId: 'doc-1',
      pages: [
        page({
          pageNumber: 1,
          text,
          method: 'TEXT_LAYER',
          trust: 'TRUSTED',
          language: 'en',
        }),
      ],
    });

    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      documentId: 'doc-1',
      pageNumber: 1,
      text,
      extractionMethod: 'TEXT_LAYER',
      trust: 'TRUSTED',
      language: 'en',
    });
    expect(stored[0].text).toBe(text);
  });

  it('persists all pages of a multipage document', async () => {
    const { prisma, stored } = createPrismaStub();
    const service = new DocumentPagesService(prisma);

    await service.persistExtractedPages({
      userId: 'user-1',
      documentId: 'doc-1',
      pages: [
        page({
          pageNumber: 1,
          text: 'page one',
          method: 'TEXT_LAYER',
          trust: 'TRUSTED',
        }),
        page({
          pageNumber: 2,
          text: 'page two',
          method: 'OCR',
          trust: 'REVIEW_REQUIRED',
          confidence: 0.8,
        }),
      ],
    });

    expect(stored.map((row) => row.pageNumber)).toEqual([1, 2]);
    expect(stored[1].confidence).toBe(0.8);
  });

  it('preserves Arabic TEXT_LAYER exactly with REVIEW_REQUIRED and warning', async () => {
    const { prisma, stored } = createPrismaStub();
    const service = new DocumentPagesService(prisma);
    const arabic = 'هذه قضية ١٤٤٦/٠٣/١٥ ؛';

    await service.persistExtractedPages({
      userId: 'user-1',
      documentId: 'doc-1',
      pages: [
        page({
          pageNumber: 1,
          text: arabic,
          method: 'TEXT_LAYER',
          trust: 'REVIEW_REQUIRED',
          warnings: [PDF_TEXT_VISUAL_ORDER],
        }),
      ],
    });

    expect(stored[0].text).toBe(arabic);
    expect(stored[0].trust).toBe('REVIEW_REQUIRED');
    expect(stored[0].warnings).toEqual([PDF_TEXT_VISUAL_ORDER]);
    expect(stored[0].text).toContain('١٤٤٦');
    expect(stored[0].text).toContain('؛');
  });

  it('persists OCR as REVIEW_REQUIRED and empty OCR as UNUSABLE without rewriting', async () => {
    const { prisma, stored } = createPrismaStub();
    const service = new DocumentPagesService(prisma);

    await service.persistExtractedPages({
      userId: 'user-1',
      documentId: 'doc-1',
      pages: [
        page({
          pageNumber: 1,
          text: 'ocr clause',
          method: 'OCR',
          trust: 'REVIEW_REQUIRED',
          confidence: 0.99,
        }),
        page({
          pageNumber: 2,
          text: '',
          method: 'OCR',
          trust: 'UNUSABLE',
          confidence: 0.1,
          warnings: ['OCR_EMPTY_RESULT'],
        }),
      ],
    });

    expect(stored[0].trust).toBe('REVIEW_REQUIRED');
    expect(stored[0].text).toBe('ocr clause');
    expect(stored[1].trust).toBe('UNUSABLE');
    expect(stored[1].text).toBe('');
  });

  it('is idempotent: second persist of the same pages creates no duplicates', async () => {
    const { prisma, stored } = createPrismaStub();
    const service = new DocumentPagesService(prisma);
    const pages = [
      page({
        pageNumber: 1,
        text: 'stable',
        method: 'TEXT_LAYER',
        trust: 'TRUSTED',
      }),
    ];

    const first = await service.persistExtractedPages({
      userId: 'user-1',
      documentId: 'doc-1',
      pages,
    });
    const second = await service.persistExtractedPages({
      userId: 'user-1',
      documentId: 'doc-1',
      pages: [
        page({
          pageNumber: 1,
          text: 'different text must not overwrite',
          method: 'TEXT_LAYER',
          trust: 'TRUSTED',
        }),
      ],
    });

    expect(first.totalStored).toBe(1);
    expect(second.skippedExisting).toBe(1);
    expect(second.totalStored).toBe(1);
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('stable');
  });

  it('fills missing pages on retry after partial persistence', async () => {
    const { prisma, stored } = createPrismaStub();
    const service = new DocumentPagesService(prisma);

    await service.persistExtractedPages({
      userId: 'user-1',
      documentId: 'doc-1',
      pages: [
        page({
          pageNumber: 1,
          text: 'first',
          method: 'TEXT_LAYER',
          trust: 'TRUSTED',
        }),
      ],
    });

    await service.persistExtractedPages({
      userId: 'user-1',
      documentId: 'doc-1',
      pages: [
        page({
          pageNumber: 1,
          text: 'first-retry',
          method: 'TEXT_LAYER',
          trust: 'TRUSTED',
        }),
        page({
          pageNumber: 2,
          text: 'second',
          method: 'OCR',
          trust: 'REVIEW_REQUIRED',
        }),
      ],
    });

    expect(stored).toHaveLength(2);
    expect(stored[0].text).toBe('first');
    expect(stored[1].text).toBe('second');
  });

  it('rejects persistence when the document is not owned by the user', async () => {
    const { prisma } = createPrismaStub();
    const service = new DocumentPagesService(prisma);

    await expect(
      service.persistExtractedPages({
        userId: 'stranger',
        documentId: 'doc-1',
        pages: [
          page({
            pageNumber: 1,
            text: 'x',
            method: 'TEXT_LAYER',
            trust: 'TRUSTED',
          }),
        ],
      }),
    ).rejects.toThrow('AI_JOB_OWNERSHIP_MISMATCH');
  });
});
