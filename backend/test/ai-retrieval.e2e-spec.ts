import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AI_PIPELINE_VERSION } from '../src/modules/ai/ai.constants';
import { MockEmbeddingProvider } from '../src/modules/ai/providers/mock/mock-embedding.provider';
import { chunkIdToPointId } from '../src/modules/ai/vector/point-id';
import { MockVectorStore } from '../src/modules/ai/vector/mock-vector.store';
import { PrismaService } from '../src/shared/database/prisma.service';
import { RedisService } from '../src/shared/cache/redis.service';

import { createTestingApp } from './create-app';

const mockCode = Number(process.env.MOCK_NAFATH_CODE ?? '72');

const uniqueNationalId = (): string => {
  const tail = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
  return `1${tail}`;
};

const login = (app: INestApplication, nationalId: string) =>
  request(app.getHttpServer())
    .post('/api/v1/auth/nafath/verify')
    .set('X-Forwarded-For', `198.51.100.${Math.floor(Math.random() * 200) + 1}`)
    .send({ nationalId, nafathCode: mockCode });

const subOf = (token: string): string =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    .sub as string;

describe('AI Advisor retrieve (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let vectors: MockVectorStore;
  let ownerToken: string;
  let ownerId: string;
  let strangerToken: string;
  let strangerId: string;

  const retrieve = (token: string | null, body: object) => {
    const req = request(app.getHttpServer()).post('/api/v1/ai/advisor/retrieve');
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  const seedOwnedChunk = async (input: {
    userId: string;
    text: string;
    trust?: 'TRUSTED' | 'REVIEW_REQUIRED' | 'UNUSABLE';
    embeddingStatus?: 'PENDING' | 'READY' | 'FAILED';
    embeddingModel?: string;
    pipelineVersion?: number;
    deleted?: boolean;
    originalName?: string;
  }) => {
    const doc = await prisma.document.create({
      data: {
        originalName: input.originalName ?? 'evidence.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
        checksum: `ck-${Date.now()}-${Math.random()}`,
        storageKey: `sk-${Date.now()}-${Math.random()}`,
        status: 'READY',
        userId: input.userId,
        deletedAt: input.deleted ? new Date() : null,
      },
    });

    const page = await prisma.documentPage.create({
      data: {
        documentId: doc.id,
        pageNumber: 1,
        text: input.text,
        extractionMethod: 'TEXT_LAYER',
        trust: input.trust ?? 'TRUSTED',
        warnings: [],
      },
    });

    const chunk = await prisma.documentChunk.create({
      data: {
        documentId: doc.id,
        documentPageId: page.id,
        chunkIndex: 0,
        text: input.text,
        startOffset: 0,
        endOffset: input.text.length,
        pipelineVersion: input.pipelineVersion ?? AI_PIPELINE_VERSION,
        embeddingStatus: input.embeddingStatus ?? 'READY',
        embeddingModel: input.embeddingModel ?? 'mock-embedding-v1',
        embeddedAt: new Date(),
      },
    });

    const dims = vectors.dimensions;
    const embedding = new MockEmbeddingProvider(dims);
    const vector = (await embedding.embed({ texts: [input.text] })).vectors[0]!;

    await vectors.upsert([
      {
        id: chunkIdToPointId(chunk.id),
        vector,
        payload: {
          chunkId: chunk.id,
          documentId: doc.id,
          documentPageId: page.id,
          userId: input.userId,
          pageNumber: 1,
          chunkIndex: 0,
          pipelineVersion: input.pipelineVersion ?? AI_PIPELINE_VERSION,
          embeddingModel: input.embeddingModel ?? 'mock-embedding-v1',
          extractionMethod: 'TEXT_LAYER',
          trust: 'TRUSTED',
        },
      },
    ]);

    return { doc, page, chunk };
  };

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);
    vectors = app.get(MockVectorStore);

    const ownerLogin = await login(app, uniqueNationalId());
    const strangerLogin = await login(app, uniqueNationalId());
    ownerToken = ownerLogin.body.data.accessToken as string;
    strangerToken = strangerLogin.body.data.accessToken as string;
    ownerId = subOf(ownerToken);
    strangerId = subOf(strangerToken);
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    vectors.clear();
  });

  it('rejects missing JWT', async () => {
    const response = await retrieve(null, { query: 'lease' });
    expect(response.status).toBe(401);
  });

  it('rejects invalid JWT', async () => {
    const response = await retrieve('not-a-token', { query: 'lease' });
    expect(response.status).toBe(401);
  });

  it('rejects empty query', async () => {
    const response = await retrieve(ownerToken, { query: '' });
    expect(response.status).toBe(400);
  });

  it('rejects oversized query', async () => {
    const response = await retrieve(ownerToken, {
      query: 'x'.repeat(2001),
    });
    expect(response.status).toBe(400);
  });

  it('rejects invalid limit and limit above max', async () => {
    expect((await retrieve(ownerToken, { query: 'a', limit: 0 })).status).toBe(
      400,
    );
    expect((await retrieve(ownerToken, { query: 'a', limit: 21 })).status).toBe(
      400,
    );
  });

  it('rejects invalid minScore', async () => {
    expect(
      (await retrieve(ownerToken, { query: 'a', minScore: -0.1 })).status,
    ).toBe(400);
    expect(
      (await retrieve(ownerToken, { query: 'a', minScore: 1.1 })).status,
    ).toBe(400);
  });

  it('rejects client-supplied userId', async () => {
    const response = await retrieve(ownerToken, {
      query: 'lease',
      userId: strangerId,
    });
    expect(response.status).toBe(400);
  });

  it('returns 200 with empty results when corpus is empty', async () => {
    const response = await retrieve(ownerToken, { query: 'anything' });
    expect(response.status).toBe(200);
    expect(response.body.data.results).toEqual([]);
    expect(response.body.data.retrieval.returned).toBe(0);
  });

  it('returns TRUSTED READY evidence with exact provenance', async () => {
    const text = 'Exact trusted English clause for retrieval e2e';
    const { chunk, doc, page } = await seedOwnedChunk({
      userId: ownerId,
      text,
      originalName: 'lease-e2e.pdf',
    });

    const response = await retrieve(ownerToken, {
      query: text,
      limit: 5,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.results).toHaveLength(1);
    const hit = response.body.data.results[0];
    expect(hit.text).toBe(text);
    expect(hit.provenance).toMatchObject({
      documentId: doc.id,
      documentName: 'lease-e2e.pdf',
      documentPageId: page.id,
      documentChunkId: chunk.id,
      pageNumber: 1,
      chunkIndex: 0,
      startOffset: 0,
      endOffset: text.length,
      pipelineVersion: AI_PIPELINE_VERSION,
      embeddingModel: 'mock-embedding-v1',
      trust: 'TRUSTED',
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /storageKey|checksum|nationalId|"userId"/,
    );
  });

  it('enforces IDOR: user B cannot retrieve user A chunks', async () => {
    const text = 'Owner-only confidential clause';
    await seedOwnedChunk({ userId: ownerId, text });

    const strangerResponse = await retrieve(strangerToken, {
      query: text,
      limit: 10,
    });
    expect(strangerResponse.status).toBe(200);
    expect(strangerResponse.body.data.results).toEqual([]);

    const ownerResponse = await retrieve(ownerToken, {
      query: text,
      limit: 10,
    });
    expect(ownerResponse.body.data.results).toHaveLength(1);
    expect(ownerResponse.body.data.results[0].text).toBe(text);
  });

  it('excludes soft-deleted documents', async () => {
    const text = 'Deleted document clause';
    await seedOwnedChunk({ userId: ownerId, text, deleted: true });
    const response = await retrieve(ownerToken, { query: text, limit: 5 });
    expect(response.status).toBe(200);
    expect(response.body.data.results).toEqual([]);
  });

  it('excludes REVIEW_REQUIRED and UNUSABLE pages even if Qdrant has a vector', async () => {
    await seedOwnedChunk({
      userId: ownerId,
      text: 'review required text',
      trust: 'REVIEW_REQUIRED',
    });
    await seedOwnedChunk({
      userId: ownerId,
      text: 'unusable text',
      trust: 'UNUSABLE',
    });

    const response = await retrieve(ownerToken, {
      query: 'review required text',
      limit: 10,
    });
    expect(response.status).toBe(200);
    expect(response.body.data.results).toEqual([]);
  });

  it('drops PENDING embedding status', async () => {
    await seedOwnedChunk({
      userId: ownerId,
      text: 'pending embedding text',
      embeddingStatus: 'PENDING',
    });
    const response = await retrieve(ownerToken, {
      query: 'pending embedding text',
      limit: 5,
    });
    expect(response.body.data.results).toEqual([]);
  });

  it('accepts max limit of 20', async () => {
    const response = await retrieve(ownerToken, { query: 'x', limit: 20 });
    expect(response.status).toBe(200);
  });

  it('rate-limits retrieval when Redis counter exceeds the window', async () => {
    const redis = app.get(RedisService);
    const key = `ai:advisor:retrieve:user:${ownerId}`;
    const max = Number(process.env.AI_RETRIEVAL_RATE_LIMIT_MAX ?? '1000');
    for (let i = 0; i <= max; i += 1) {
      await redis.incrementWithTtl(key, 60);
    }

    const response = await retrieve(ownerToken, { query: 'rate limit probe' });
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('AI_RATE_LIMITED');
  });
});
