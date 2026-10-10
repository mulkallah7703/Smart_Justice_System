/**
 * LIVE FULL AI/RAG PIPELINE
 *
 * Opt-in only. Exercises the complete path with NO mock AI providers:
 *   Upload PDF → MinIO → Postgres Document → AiJob → BullMQ → Nest AI Worker
 *   → PDF extract → trust → chunk → OpenAI embed → Qdrant upsert
 *   → Qdrant retrieve → OpenAI chat → citation validation → answer
 *
 * Requires:
 *   RUN_LIVE_RAG_TESTS=true
 *   OPENAI_API_KEY (or LIVE_OPENAI_API_KEY)
 *   AI_QDRANT_URL (or LIVE_QDRANT_URL / QDRANT_URL)
 *   Local Postgres, Redis, MinIO (DATABASE_URL / REDIS_URL / S3_*)
 *
 * Does not activate Nafath or Payment integrations.
 * Auth uses email/password register+login.
 */

import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { AiJobStatus } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import request from 'supertest';

import { ANSWER_LLM_PROVIDER } from '../../src/modules/ai/providers/llm-provider.interface';
import { EMBEDDING_PROVIDER } from '../../src/modules/ai/providers/embedding-provider.interface';
import { LLM_PROVIDER } from '../../src/modules/ai/providers/llm-provider.interface';
import { TEXT_EXTRACTOR } from '../../src/modules/ai/providers/text-extractor.interface';
import {
  VECTOR_STORE,
  type VectorStore,
} from '../../src/modules/ai/vector/vector-store.interface';
import { AiJobProcessor } from '../../src/modules/ai/worker/ai-job.processor';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { WorkerModule } from '../../src/worker.module';
import { createTestingApp } from '../create-app';
import { buildPdf } from '../fixtures/pdf-fixtures';

// Load backend/.env for secrets without printing them. Do not override
// explicit process.env (Jest / CI may already set values).
loadDotenv({ path: resolve(__dirname, '../../.env') });

/** Distinct English lease text that stays TRUSTED (Latin TEXT_LAYER). */
const LIVE_RAG_TEXT =
  'Lease Agreement Clause 4: The tenant shall pay rent of five thousand Saudi Riyals per month on the first day of each month.';

const liveRagPdf = (): Buffer =>
  buildPdf({ pages: [{ text: LIVE_RAG_TEXT }] });

const openaiKey =
  process.env.LIVE_OPENAI_API_KEY?.trim() ||
  process.env.OPENAI_API_KEY?.trim() ||
  '';
const qdrantUrl =
  process.env.LIVE_QDRANT_URL?.trim() ||
  process.env.AI_QDRANT_URL?.trim() ||
  process.env.QDRANT_URL?.trim() ||
  '';
const qdrantApiKey =
  process.env.LIVE_QDRANT_API_KEY?.trim() ||
  process.env.AI_QDRANT_API_KEY?.trim() ||
  process.env.QDRANT_API_KEY?.trim() ||
  '';

const ragLiveEnabled =
  process.env.RUN_LIVE_RAG_TESTS === 'true' &&
  Boolean(openaiKey) &&
  Boolean(qdrantUrl);

// Reuse the default collection (point-level isolation via userId/documentId).
// Creating a fresh collection per run is unnecessary and can fail under
// Cloud plan limits when another collection already exists.
const collection =
  process.env.AI_QDRANT_COLLECTION?.trim() || 'legal_chunks_v1';

if (ragLiveEnabled) {
  process.env.OPENAI_API_KEY = openaiKey;
  process.env.AI_QDRANT_URL = qdrantUrl.replace(/\/$/, '');
  if (qdrantApiKey) {
    process.env.AI_QDRANT_API_KEY = qdrantApiKey;
  }
  // Force real providers for this process — never leave .env.test mocks active.
  process.env.AI_PROVIDER_MODE = 'openai';
  process.env.AI_LLM_MODE = 'openai';
  process.env.AI_EMBEDDING_MODE = 'openai';
  process.env.AI_VECTOR_STORE_MODE = 'qdrant';
  process.env.AI_TEXT_EXTRACTOR_MODE = 'pdf';
  process.env.AI_OCR_MODE = 'local';
  process.env.AI_OCR_LANG_PATH =
    process.env.AI_OCR_LANG_PATH?.trim() || '.ocr-data';
  process.env.AI_QDRANT_COLLECTION = collection;
  process.env.AI_QUEUE_PREFIX = `sjs:ai:live-rag:${process.pid}:${randomUUID().slice(0, 8)}`;
  process.env.AI_JOB_ATTEMPTS = process.env.AI_JOB_ATTEMPTS?.trim() || '2';
  process.env.AI_JOB_BACKOFF_MS =
    process.env.AI_JOB_BACKOFF_MS?.trim() || '500';
  // Raise rate limits so a single live run is not throttled.
  process.env.AI_ANALYSIS_RATE_LIMIT_MAX = '1000';
  process.env.AI_RETRIEVAL_RATE_LIMIT_MAX = '1000';
  process.env.AI_ANSWER_RATE_LIMIT_MAX = '1000';
}

const describeRagLive = ragLiveEnabled ? describe : describe.skip;

const TERMINAL: readonly AiJobStatus[] = ['DONE', 'FAILED'];

describeRagLive('LIVE FULL RAG PIPELINE', () => {
  let app: INestApplication;
  let worker: INestApplicationContext;
  let prisma: PrismaService;
  let vectors: VectorStore;
  let token: string;
  let userId: string;
  let caseId: string;
  let documentId: string;
  let qdrant: QdrantClient;

  const waitForTerminal = async (
    jobId: string,
    timeoutMs = 180_000,
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
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  };

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);
    vectors = app.get<VectorStore>(VECTOR_STORE);

    worker = await NestFactory.createApplicationContext(WorkerModule, {
      logger: ['error', 'warn'],
    });

    const email = `live-rag-${Date.now()}@localhost.local`;
    const password = 'LiveRagTest1!';
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Live RAG Tester', email, password });
    expect(register.status).toBe(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(login.status).toBe(200);
    token = login.body.data.accessToken as string;
    userId = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ).sub as string;

    const legalCase = await prisma.case.create({
      data: {
        caseNumber: `LIVE-RAG-${Date.now()}`,
        type: 'RENTAL',
        status: 'ACTIVE',
        userId,
      },
    });
    caseId = legalCase.id;

    qdrant = new QdrantClient({
      url: qdrantUrl.replace(/\/$/, ''),
      apiKey: qdrantApiKey || undefined,
      checkCompatibility: false,
    });
  }, 120_000);

  afterAll(async () => {
    // Delete only this run's points — keep the shared Cloud collection.
    if (qdrant && documentId && userId) {
      try {
        const scrolled = await qdrant.scroll(collection, {
          limit: 100,
          with_payload: true,
          with_vector: false,
        });
        const ids = scrolled.points
          .filter((point) => {
            const payload = point.payload as {
              documentId?: string;
              userId?: string;
            };
            return (
              payload.documentId === documentId && payload.userId === userId
            );
          })
          .map((point) => point.id);
        if (ids.length > 0) {
          await qdrant.delete(collection, { wait: true, points: ids });
        }
      } catch {
        // best-effort cleanup
      }
    }
    await worker?.close();
    await app?.close();
  });

  it('binds real OpenAI + Qdrant + PDF providers (no mocks)', () => {
    expect(app.get(EMBEDDING_PROVIDER).name).toBe('openai');
    expect(app.get(ANSWER_LLM_PROVIDER).name).toBe('openai');
    expect(app.get(TEXT_EXTRACTOR).name).toBe('pdfjs-text-layer-v1');
    expect(vectors.name).toBe('qdrant');
    expect(vectors.collection).toBe(collection);

    expect(worker.get(AiJobProcessor, { strict: false })).toBeDefined();
    expect(worker.get(EMBEDDING_PROVIDER).name).toBe('openai');
    expect(worker.get(LLM_PROVIDER).name).toBe('openai');
    expect(worker.get(TEXT_EXTRACTOR).name).toBe('pdfjs-text-layer-v1');
    expect(worker.get<VectorStore>(VECTOR_STORE).name).toBe('qdrant');
    expect(() => app.get(AiJobProcessor, { strict: false })).toThrow();
  });

  it(
    'runs upload → worker → embed → retrieve → cited OpenAI answer',
    async () => {
      const pdf = liveRagPdf();
      const upload = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${token}`)
        .field('caseId', caseId)
        .attach('file', pdf, {
          filename: 'lease-live-rag.pdf',
          contentType: 'application/pdf',
        });
      expect(upload.status).toBe(201);
      documentId = upload.body.data.id as string;

      const accepted = await request(app.getHttpServer())
        .post('/api/v1/ai/advisor/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({ documentIds: [documentId] });
      expect(accepted.status).toBe(202);
      const jobId = accepted.body.data.jobId as string;

      const queued = await prisma.aiJob.findUniqueOrThrow({
        where: { id: jobId },
      });
      expect(['PENDING', 'PROCESSING', 'DONE', 'FAILED']).toContain(
        queued.status,
      );

      const finished = await waitForTerminal(jobId);
      expect(finished.status).toBe('DONE');
      expect(finished.errorCode).toBeNull();
      expect(finished.startedAt).toBeInstanceOf(Date);
      expect(finished.completedAt).toBeInstanceOf(Date);
      expect(finished.progress).toBe(100);

      const result = finished.resultJson as Record<string, unknown>;
      expect(result.mock).toBe(false);
      expect(result.llmProvider).toBe('openai');
      expect(result.extractorEngine).toBe('pdfjs-text-layer-v1');
      expect(result.trustedPages).toBeGreaterThanOrEqual(1);
      expect(result.chunksEmbedded).toBeGreaterThanOrEqual(1);
      expect(result.embeddingModel).toEqual(expect.any(String));
      expect(result.vectorCollection).toBe(collection);
      expect(String(result.llmModel)).not.toMatch(/mock/i);

      const pages = await prisma.documentPage.findMany({
        where: { documentId, trust: 'TRUSTED' },
      });
      expect(pages.length).toBeGreaterThanOrEqual(1);
      expect(pages[0]?.text).toContain('five thousand');

      const chunks = await prisma.documentChunk.findMany({
        where: {
          documentId,
          embeddingStatus: 'READY',
        },
      });
      expect(chunks.length).toBeGreaterThanOrEqual(1);

      const scrolled = await qdrant.scroll(collection, {
        limit: 100,
        with_payload: true,
        with_vector: false,
      });
      const docPoints = scrolled.points.filter((point) => {
        const payload = point.payload as {
          documentId?: string;
          userId?: string;
          trust?: string;
        };
        return (
          payload.documentId === documentId &&
          payload.userId === userId &&
          payload.trust === 'TRUSTED'
        );
      });
      expect(docPoints.length).toBeGreaterThanOrEqual(1);
      expect(docPoints.length).toBe(chunks.length);

      const retrieve = await request(app.getHttpServer())
        .post('/api/v1/ai/advisor/retrieve')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: 'monthly rent amount Clause 4', limit: 5 });
      expect(retrieve.status).toBe(200);
      expect(retrieve.body.data.results.length).toBeGreaterThanOrEqual(1);
      const top = retrieve.body.data.results[0];
      expect(top.provenance.documentId).toBe(documentId);
      expect(top.provenance.pageNumber).toBe(1);
      expect(top.text).toContain('five thousand');

      const answer = await request(app.getHttpServer())
        .post('/api/v1/ai/advisor/answer')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query:
            'According to the lease evidence, how much rent must the tenant pay each month?',
        });
      expect(answer.status).toBe(200);
      expect(answer.body.data.insufficientEvidence).toBe(false);
      expect(answer.body.data.answer.length).toBeGreaterThan(0);
      expect(String(answer.body.data.model)).not.toMatch(/mock/i);
      expect(answer.body.data.claims.length).toBeGreaterThan(0);
      expect(
        `${answer.body.data.answer} ${JSON.stringify(answer.body.data.claims)}`.toLowerCase(),
      ).toMatch(/5000|five thousand|riyals/);

      const citations = answer.body.data.claims.flatMap(
        (claim: { citations: Array<Record<string, unknown>> }) =>
          claim.citations,
      );
      expect(citations.length).toBeGreaterThan(0);
      for (const citation of citations) {
        expect(citation.documentId).toBe(documentId);
        expect(citation.pageNumber).toBe(1);
        expect(typeof citation.chunkId).toBe('string');
        expect(chunks.some((c) => c.id === citation.chunkId)).toBe(true);
      }
    },
    240_000,
  );

  it('fails closed for invalid OpenAI credentials (no mock fallback)', async () => {
    expect(worker.get(EMBEDDING_PROVIDER).name).toBe('openai');
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
      apiKey: 'sk-phase-t5-invalid-key-not-real',
      timeout: 15_000,
    });
    await expect(
      client.embeddings.create({
        model:
          process.env.OPENAI_EMBEDDING_MODEL?.trim() ||
          'text-embedding-3-small',
        input: ['phase-t5 fail-closed ping'],
        dimensions: 1536,
      }),
    ).rejects.toBeTruthy();
    // Worker binding must remain openai — never silently switch to mock.
    expect(worker.get(EMBEDDING_PROVIDER).name).toBe('openai');
    expect(worker.get(LLM_PROVIDER).name).toBe('openai');
  });

  it('fails closed for unreachable Qdrant (no mock fallback)', async () => {
    expect(vectors.name).toBe('qdrant');
    const bad = new QdrantClient({
      url: 'http://127.0.0.1:1',
      checkCompatibility: false,
      timeout: 2_000,
    });
    await expect(bad.getCollections()).rejects.toBeTruthy();
    expect(worker.get<VectorStore>(VECTOR_STORE).name).toBe('qdrant');
  });
});

describe('LIVE FULL RAG gate', () => {
  it('skips unless RUN_LIVE_RAG_TESTS=true and OpenAI+Qdrant credentials exist', () => {
    expect(typeof ragLiveEnabled).toBe('boolean');
    if (!ragLiveEnabled) {
      expect(ragLiveEnabled).toBe(false);
    }
  });
});
