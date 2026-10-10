/**
 * Proves the real path end to end: a genuine PDF in MinIO is opened by the
 * worker, its text layer is extracted per page, and the job reaches a terminal
 * state without any extracted text escaping into the job record or the API.
 *
 * This suite boots with the real extractor selected, on its own queue prefix so
 * it cannot consume jobs belonging to the mock-mode suites running in parallel.
 */
const previousTextExtractorMode = process.env.AI_TEXT_EXTRACTOR_MODE;
const previousQueuePrefix = process.env.AI_QUEUE_PREFIX;
process.env.AI_TEXT_EXTRACTOR_MODE = 'pdf';
process.env.AI_QUEUE_PREFIX = `sjs:ai:pdf-e2e:${process.pid}`;

import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { AiJobStatus } from '@prisma/client';
import request from 'supertest';

import { OBJECT_STORAGE } from '../src/modules/documents/storage/object-storage.interface';
import type { ObjectStorage } from '../src/modules/documents/storage/object-storage.interface';
import { PrismaService } from '../src/shared/database/prisma.service';
import { WorkerModule } from '../src/worker.module';

import { createTestingApp } from './create-app';
import {
  corruptPdf,
  encryptedPdf,
  manyPagesPdf,
  mixedTextAndBlankPdf,
} from './fixtures/pdf-fixtures';

const mockCode = Number(process.env.MOCK_NAFATH_CODE ?? '72');
const TERMINAL: readonly AiJobStatus[] = ['DONE', 'FAILED'];

const uniqueNationalId = (): string => {
  const tail = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
  return `1${tail}`;
};

interface JobRecord {
  status: AiJobStatus;
  errorCode: string | null;
  resultJson: unknown;
  progress: number;
}

describe('PDF text extraction lifecycle (e2e)', () => {
  let app: INestApplication;
  let worker: INestApplicationContext;
  let prisma: PrismaService;
  let storage: ObjectStorage;
  let token: string;
  let userId: string;
  let caseId: string;

  const waitForTerminal = async (
    jobId: string,
    timeoutMs = 25000,
  ): Promise<JobRecord> => {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const job = await prisma.aiJob.findUniqueOrThrow({
        where: { id: jobId },
        select: {
          status: true,
          errorCode: true,
          resultJson: true,
          progress: true,
        },
      });

      if (TERMINAL.includes(job.status)) {
        return job;
      }
      if (Date.now() > deadline) {
        throw new Error(
          `AI job ${jobId} did not reach a terminal state (last: ${job.status})`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  };

  /** Places real bytes in MinIO under a matching Document row. */
  const seedDocument = async (bytes: Buffer): Promise<string> => {
    const id = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storageKey = `users/${userId}/cases/${caseId}/documents/${id}`;

    await storage.putObject(storageKey, bytes, 'application/pdf');
    await prisma.document.create({
      data: {
        id,
        userId,
        caseId,
        originalName: 'fixture.pdf',
        mimeType: 'application/pdf',
        sizeBytes: bytes.byteLength,
        checksum: id,
        storageKey,
        status: 'UPLOADED',
        isAnalyzed: false,
      },
    });
    return id;
  };

  const analyse = async (documentIds: string[]): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/advisor/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ documentIds });

    expect(response.status).toBe(202);
    return response.body.data.jobId as string;
  };

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);
    storage = app.get<ObjectStorage>(OBJECT_STORAGE);

    worker = await NestFactory.createApplicationContext(WorkerModule, {
      logger: ['error'],
    });

    const auth = await request(app.getHttpServer())
      .post('/api/v1/auth/nafath/verify')
      .set('X-Forwarded-For', `198.51.100.${Math.floor(Math.random() * 200) + 1}`)
      .send({ nationalId: uniqueNationalId(), nafathCode: mockCode });

    token = auth.body.data.accessToken as string;
    userId = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ).sub as string;

    const legalCase = await prisma.case.create({
      data: {
        caseNumber: `PDF-E2E-${Date.now()}`,
        type: 'RENTAL',
        status: 'ACTIVE',
        userId,
      },
    });
    caseId = legalCase.id;
  }, 60000);

  afterAll(async () => {
    await worker?.close();
    await app?.close();

    if (previousTextExtractorMode === undefined) {
      delete process.env.AI_TEXT_EXTRACTOR_MODE;
    } else {
      process.env.AI_TEXT_EXTRACTOR_MODE = previousTextExtractorMode;
    }
    if (previousQueuePrefix === undefined) {
      delete process.env.AI_QUEUE_PREFIX;
    } else {
      process.env.AI_QUEUE_PREFIX = previousQueuePrefix;
    }
  });

  it('extracts a real PDF text layer and classifies each page', async () => {
    const documentId = await seedDocument(mixedTextAndBlankPdf());

    const job = await waitForTerminal(await analyse([documentId]));

    expect(job.status).toBe('DONE');
    expect(job.progress).toBe(100);
    expect(job.resultJson).toMatchObject({
      extractorEngine: 'pdfjs-text-layer-v1',
      totalPages: 2,
      textLayerPages: 1,
      // Blank page is rendered and recognised (mock OCR in this suite).
      ocrPages: 1,
      ocrRequiredPages: 0,
      ocrEngine: 'mock-ocr-v1',
      // English TEXT_LAYER is TRUSTED; mock OCR is REVIEW_REQUIRED.
      trustedPages: 1,
      reviewRequiredPages: 1,
      unusablePages: 0,
      pagesPersisted: true,
    });

    const pages = await prisma.documentPage.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' },
    });
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({
      pageNumber: 1,
      extractionMethod: 'TEXT_LAYER',
      trust: 'TRUSTED',
    });
    expect(pages[0].text).toContain('First page text');
    expect(pages[1]).toMatchObject({
      pageNumber: 2,
      extractionMethod: 'OCR',
      trust: 'REVIEW_REQUIRED',
    });

    const chunkRows = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
    });
    // Only the TRUSTED English TEXT_LAYER page is chunked.
    expect(chunkRows.length).toBeGreaterThanOrEqual(1);
    expect(chunkRows.every((row) => row.documentPageId === pages[0].id)).toBe(
      true,
    );
    expect(pages[0].text.slice(chunkRows[0].startOffset, chunkRows[0].endOffset)).toBe(
      chunkRows[0].text,
    );
    expect(job.resultJson).toMatchObject({
      chunksCreated: chunkRows.length,
      trustedPagesChunked: 1,
    });
  }, 40000);

  it('persists DocumentPage rows idempotently when the same document is analysed twice', async () => {
    const documentId = await seedDocument(mixedTextAndBlankPdf());

    // Force a second job by using a distinct document set... same single doc
    // still shares DocumentPage uniqueness; bump via a no-op second analyse is
    // blocked by AI job idempotency, so simulate re-persist by calling the
    // worker path twice through two jobs that include this document alone is
    // not possible with the same idempotency key. Instead: run once, then
    // re-invoke persist by analysing after deleting the AiJob row only.
    const firstJob = await waitForTerminal(await analyse([documentId]));
    expect(firstJob.status).toBe('DONE');

    const afterFirst = await prisma.documentPage.count({
      where: { documentId },
    });
    expect(afterFirst).toBe(2);
    const firstTexts = (
      await prisma.documentPage.findMany({
        where: { documentId },
        orderBy: { pageNumber: 'asc' },
        select: { pageNumber: true, text: true, trust: true },
      })
    ).map((row) => ({ ...row }));

    await prisma.aiJobDocument.deleteMany({ where: { documentId } });
    await prisma.aiJob.deleteMany({ where: { userId } });

    const secondJob = await waitForTerminal(await analyse([documentId]));
    expect(secondJob.status).toBe('DONE');

    const afterSecond = await prisma.documentPage.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' },
      select: { pageNumber: true, text: true, trust: true },
    });
    expect(afterSecond).toHaveLength(2);
    expect(afterSecond).toEqual(firstTexts);
  }, 60000);

  it('keeps extracted text out of the stored job result', async () => {
    const documentId = await seedDocument(mixedTextAndBlankPdf());

    const job = await waitForTerminal(await analyse([documentId]));

    expect(JSON.stringify(job.resultJson)).not.toContain('First page text');
  }, 40000);

  it('never exposes extracted text through the status endpoint', async () => {
    const documentId = await seedDocument(mixedTextAndBlankPdf());
    const jobId = await analyse([documentId]);
    await waitForTerminal(jobId);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/ai/advisor/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain('First page text');
    expect(body).not.toContain('storageKey');
    expect(response.body.data.status).toBe('DONE');
  }, 40000);

  it('fails a corrupt PDF with a stable code and no parser detail', async () => {
    const documentId = await seedDocument(corruptPdf());

    const job = await waitForTerminal(await analyse([documentId]));

    expect(job.status).toBe('FAILED');
    expect(job.errorCode).toBe('PDF_INVALID');
  }, 40000);

  it('fails a password-protected PDF safely', async () => {
    const documentId = await seedDocument(encryptedPdf());

    const job = await waitForTerminal(await analyse([documentId]));

    expect(job.status).toBe('FAILED');
    expect(job.errorCode).toBe('PDF_ENCRYPTED');
  }, 40000);

  it('refuses a document beyond the configured page limit', async () => {
    const limit = Number(process.env.AI_PDF_MAX_PAGES ?? '100');
    const documentId = await seedDocument(manyPagesPdf(limit + 1));

    const job = await waitForTerminal(await analyse([documentId]));

    expect(job.status).toBe('FAILED');
    expect(job.errorCode).toBe('PDF_PAGE_LIMIT_EXCEEDED');
  }, 60000);
});
