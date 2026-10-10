/**
 * Mock-mode AI worker lifecycle. Forces the deterministic extractor and a
 * dedicated queue prefix so neither a sibling PDF-extraction suite nor a
 * leftover local worker can consume these jobs.
 */
process.env.AI_TEXT_EXTRACTOR_MODE = 'mock';
process.env.AI_QUEUE_PREFIX = `sjs:ai:mock-e2e:${process.pid}`;

import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { AiJobStatus } from '@prisma/client';
import request from 'supertest';

import { AiJobsService } from '../src/modules/ai/ai-jobs.service';
import { AiJobProcessor } from '../src/modules/ai/worker/ai-job.processor';
import {
  MOCK_FAIL_ALWAYS,
  MOCK_FAIL_ONCE,
  resetMockDirectives,
} from '../src/modules/ai/providers/mock/mock-directives';
import { OBJECT_STORAGE } from '../src/modules/documents/storage/object-storage.interface';
import type { ObjectStorage } from '../src/modules/documents/storage/object-storage.interface';
import { PrismaService } from '../src/shared/database/prisma.service';
import { WorkerModule } from '../src/worker.module';

import { createTestingApp } from './create-app';

const mockCode = Number(process.env.MOCK_NAFATH_CODE ?? '72');

const pdfBytes = (): Buffer => Buffer.from('%PDF-1.4\ntrailer\n%%EOF\n');

const uniqueNationalId = (): string => {
  const tail = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
  return `1${tail}`;
};

const login = (app: INestApplication, nationalId: string) =>
  request(app.getHttpServer())
    .post('/api/v1/auth/nafath/verify')
    .set('X-Forwarded-For', `198.51.100.${Math.floor(Math.random() * 200) + 1}`)
    .send({ nationalId, nafathCode: mockCode });

const TERMINAL: readonly AiJobStatus[] = ['DONE', 'FAILED'];

describe('AI worker lifecycle (e2e)', () => {
  let app: INestApplication;
  let worker: INestApplicationContext;
  let prisma: PrismaService;
  let jobs: AiJobsService;
  let storage: ObjectStorage;
  let token: string;
  let userId: string;
  let caseId: string;

  const waitForTerminal = async (
    jobId: string,
    timeoutMs = 25000,
  ): Promise<{
    status: AiJobStatus;
    attempts: number;
    errorCode: string | null;
    resultJson: unknown;
    progress: number;
    stageIndex: number;
    startedAt: Date | null;
    completedAt: Date | null;
  }> => {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const job = await prisma.aiJob.findUniqueOrThrow({
        where: { id: jobId },
        select: {
          status: true,
          attempts: true,
          errorCode: true,
          resultJson: true,
          progress: true,
          stageIndex: true,
          startedAt: true,
          completedAt: true,
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

  /**
   * Uploads through the real endpoint, so the object genuinely exists in MinIO
   * under the storage key the worker will resolve.
   */
  const uploadDocument = async (): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('caseId', caseId)
      .attach('file', pdfBytes(), {
        filename: 'lease.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(201);
    return response.body.data.id as string;
  };

  /**
   * Creates a document with a chosen id so a mock failure directive can reach
   * the adapters through the storage key. Nothing in production derives
   * behaviour from a document id.
   */
  const seedDocument = async (
    idPrefix: string,
    options: { withObject: boolean } = { withObject: true },
  ): Promise<string> => {
    const id = `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storageKey = `users/${userId}/cases/${caseId}/documents/${id}`;

    if (options.withObject) {
      await storage.putObject(storageKey, pdfBytes(), 'application/pdf');
    }

    await prisma.document.create({
      data: {
        id,
        userId,
        caseId,
        originalName: 'seeded.pdf',
        mimeType: 'application/pdf',
        sizeBytes: pdfBytes().byteLength,
        checksum: id,
        storageKey,
        status: 'UPLOADED',
        isAnalyzed: false,
      },
    });
    return id;
  };

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);
    jobs = app.get(AiJobsService);
    storage = app.get<ObjectStorage>(OBJECT_STORAGE);

    // The worker runs as its own application context, exactly as `worker.ts`
    // starts it in production. The API app above never registers a processor.
    worker = await NestFactory.createApplicationContext(WorkerModule, {
      logger: ['error'],
    });

    const auth = await login(app, uniqueNationalId());
    token = auth.body.data.accessToken as string;
    userId = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ).sub as string;

    const legalCase = await prisma.case.create({
      data: {
        caseNumber: `AI-E2E-${Date.now()}`,
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
  });

  beforeEach(() => {
    resetMockDirectives();
  });

  it('does not register a processor in the API process', () => {
    // The API may enqueue and read jobs, but must never execute them.
    expect(() => app.get(AiJobProcessor, { strict: false })).toThrow();
    expect(worker.get(AiJobProcessor, { strict: false })).toBeDefined();
  });

  it('runs API -> queue -> worker -> MinIO -> DONE for a real uploaded document', async () => {
    const documentId = await uploadDocument();

    const accepted = await request(app.getHttpServer())
      .post('/api/v1/ai/advisor/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ documentIds: [documentId] });

    expect(accepted.status).toBe(202);
    const jobId = accepted.body.data.jobId as string;

    const finished = await waitForTerminal(jobId);

    expect(finished.status).toBe('DONE');
    expect(finished.attempts).toBe(1);
    expect(finished.progress).toBe(100);
    expect(finished.errorCode).toBeNull();
    expect(finished.startedAt).toBeInstanceOf(Date);
    expect(finished.completedAt).toBeInstanceOf(Date);
    expect(finished.resultJson).toMatchObject({
      mock: true,
      documentCount: 1,
      retrieval: [
        {
          mimeType: 'application/pdf',
          retrievedBytes: pdfBytes().byteLength,
          declaredBytes: pdfBytes().byteLength,
        },
      ],
    });
  }, 60000);

  it('reports progress through the status endpoint until DONE', async () => {
    const documentId = await uploadDocument();
    const accepted = await request(app.getHttpServer())
      .post('/api/v1/ai/advisor/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ documentIds: [documentId] });
    const jobId = accepted.body.data.jobId as string;

    const observed = new Set<string>();
    const deadline = Date.now() + 20000;
    for (;;) {
      const status = await request(app.getHttpServer())
        .get(`/api/v1/ai/advisor/jobs/${jobId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(status.status).toBe(200);
      observed.add(status.body.data.status as string);
      if (
        status.body.data.status === 'DONE' ||
        status.body.data.status === 'FAILED'
      ) {
        expect(status.body.data.progress).toBe(100);
        expect(status.body.data.stageIndex).toBe(2);
        expect(status.body.data.result).toMatchObject({ mock: true });
        break;
      }
      if (Date.now() > deadline) {
        throw new Error('status never reached a terminal state');
      }
    }

    expect(observed.has('DONE')).toBe(true);
  }, 60000);

  it('fails with a stable code when the object is missing from storage', async () => {
    const documentId = await seedDocument('nostorage', { withObject: false });

    const created = await jobs.create({
      userId,
      type: 'DOCUMENT_ANALYSIS',
      documentIds: [documentId],
    });

    const finished = await waitForTerminal(created.id, 30000);

    expect(finished.status).toBe('FAILED');
    expect(finished.errorCode).toBe('DOCUMENT_STORAGE_ERROR');
    expect(finished.completedAt).toBeInstanceOf(Date);
    // No endpoint, bucket, credential, key, or SDK message may appear.
    expect(finished.errorCode).not.toMatch(
      /bucket|endpoint|9000|minio|s3|accesskey|users\//i,
    );
  }, 60000);

  it('reaches FAILED after bounded attempts on a deterministic provider failure', async () => {
    const documentId = await seedDocument(MOCK_FAIL_ALWAYS);

    const created = await jobs.create({
      userId,
      type: 'DOCUMENT_ANALYSIS',
      documentIds: [documentId],
    });

    const finished = await waitForTerminal(created.id, 30000);

    expect(finished.status).toBe('FAILED');
    expect(finished.errorCode).toBe('AI_PROVIDER_ERROR');
    expect(finished.attempts).toBe(3);
  }, 60000);

  it('retries a transient failure and succeeds on the second attempt', async () => {
    const documentId = await seedDocument(MOCK_FAIL_ONCE);

    const created = await jobs.create({
      userId,
      type: 'DOCUMENT_ANALYSIS',
      documentIds: [documentId],
    });

    const finished = await waitForTerminal(created.id, 30000);

    expect(finished.status).toBe('DONE');
    expect(finished.attempts).toBe(2);
    expect(finished.errorCode).toBeNull();
  }, 60000);

  it('persists no document bytes, storage key, or user id in the result', async () => {
    const documentId = await uploadDocument();
    const created = await jobs.create({
      userId,
      type: 'DOCUMENT_ANALYSIS',
      documentIds: [documentId],
    });

    const finished = await waitForTerminal(created.id);
    const serialised = JSON.stringify(finished.resultJson);

    expect(serialised).not.toContain('%PDF');
    expect(serialised).not.toContain(userId);
    expect(serialised).not.toContain(documentId);
    expect(serialised).not.toContain('users/');
    expect(serialised).toContain('"mock":true');
  }, 60000);
});
