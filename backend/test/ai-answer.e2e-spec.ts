import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AI_PIPELINE_VERSION } from '../src/modules/ai/ai.constants';
import { MockEmbeddingProvider } from '../src/modules/ai/providers/mock/mock-embedding.provider';
import {
  MOCK_ANSWER_MALFORMED,
} from '../src/modules/ai/providers/mock/mock-llm.provider';
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
    .set('X-Forwarded-For', `203.0.113.${Math.floor(Math.random() * 200) + 1}`)
    .send({ nationalId, nafathCode: mockCode });

const subOf = (token: string): string =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    .sub as string;

describe('AI Advisor answer (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let vectors: MockVectorStore;
  let ownerToken: string;
  let ownerId: string;
  let strangerToken: string;

  const answer = (token: string | null, body: object) => {
    const req = request(app.getHttpServer()).post('/api/v1/ai/advisor/answer');
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  const seedOwnedChunk = async (input: {
    userId: string;
    text: string;
    trust?: 'TRUSTED' | 'REVIEW_REQUIRED' | 'UNUSABLE';
    deleted?: boolean;
  }) => {
    const doc = await prisma.document.create({
      data: {
        originalName: 'answer-e2e.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
        checksum: `ck-ans-${Date.now()}-${Math.random()}`,
        storageKey: `sk-ans-${Date.now()}-${Math.random()}`,
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
        pipelineVersion: AI_PIPELINE_VERSION,
        embeddingStatus: 'READY',
        embeddingModel: 'mock-embedding-v1',
        embeddedAt: new Date(),
      },
    });

    const embedding = new MockEmbeddingProvider(vectors.dimensions);
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
          pipelineVersion: AI_PIPELINE_VERSION,
          embeddingModel: 'mock-embedding-v1',
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
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    vectors.clear();
  });

  it('rejects missing and invalid JWT', async () => {
    expect((await answer(null, { query: 'q' })).status).toBe(401);
    expect((await answer('bad', { query: 'q' })).status).toBe(401);
  });

  it('rejects empty, oversized, and forbidden fields', async () => {
    expect((await answer(ownerToken, { query: '' })).status).toBe(400);
    expect(
      (await answer(ownerToken, { query: 'x'.repeat(2001) })).status,
    ).toBe(400);
    expect(
      (await answer(ownerToken, { query: 'q', userId: 'x' })).status,
    ).toBe(400);
    expect(
      (await answer(ownerToken, { query: 'q', model: 'gpt' })).status,
    ).toBe(400);
    expect(
      (await answer(ownerToken, { query: 'q', evidence: [] })).status,
    ).toBe(400);
  });

  it('returns insufficientEvidence without LLM when corpus is empty', async () => {
    const response = await answer(ownerToken, { query: 'anything' });
    expect(response.status).toBe(200);
    expect(response.body.data.insufficientEvidence).toBe(true);
    expect(response.body.data.claims).toEqual([]);
  });

  it('returns cited answer with PostgreSQL provenance for owner', async () => {
    const text = 'The lease rent is five thousand riyals per month.';
    const { chunk, doc } = await seedOwnedChunk({ userId: ownerId, text });

    const response = await answer(ownerToken, { query: text });
    expect(response.status).toBe(200);
    expect(response.body.data.insufficientEvidence).toBe(false);
    expect(response.body.data.claims.length).toBeGreaterThan(0);
    const citation = response.body.data.claims[0].citations[0];
    expect(citation.evidenceId).toBe('E1');
    expect(citation.documentId).toBe(doc.id);
    expect(citation.chunkId).toBe(chunk.id);
    expect(citation.pageNumber).toBe(1);
    expect(JSON.stringify(response.body)).not.toMatch(
      /storageKey|checksum|"userId"|nationalId/,
    );
  });

  it('enforces IDOR: stranger cannot answer from owner evidence', async () => {
    const text = 'Confidential owner-only rent clause for answer e2e';
    await seedOwnedChunk({ userId: ownerId, text });

    const strangerResponse = await answer(strangerToken, { query: text });
    expect(strangerResponse.status).toBe(200);
    expect(strangerResponse.body.data.insufficientEvidence).toBe(true);
    expect(strangerResponse.body.data.claims).toEqual([]);

    const ownerResponse = await answer(ownerToken, { query: text });
    expect(ownerResponse.body.data.insufficientEvidence).toBe(false);
    expect(ownerResponse.body.data.claims[0].citations[0].evidenceId).toBe(
      'E1',
    );
  });

  it('excludes REVIEW_REQUIRED evidence from answers', async () => {
    await seedOwnedChunk({
      userId: ownerId,
      text: 'arabic-looking review text',
      trust: 'REVIEW_REQUIRED',
    });
    const response = await answer(ownerToken, {
      query: 'arabic-looking review text',
    });
    expect(response.body.data.insufficientEvidence).toBe(true);
  });

  it('rejects malformed model output with a stable code', async () => {
    await seedOwnedChunk({
      userId: ownerId,
      text: `clause ${MOCK_ANSWER_MALFORMED}`,
    });
    const response = await answer(ownerToken, {
      query: MOCK_ANSWER_MALFORMED,
    });
    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('AI_ANSWER_INVALID');
  });

  it('rate-limits answer generation', async () => {
    const redis = app.get(RedisService);
    const key = `ai:advisor:answer:user:${ownerId}`;
    const max = Number(process.env.AI_ANSWER_RATE_LIMIT_MAX ?? '1000');
    for (let i = 0; i <= max; i += 1) {
      await redis.incrementWithTtl(key, 60);
    }
    const response = await answer(ownerToken, { query: 'rate probe' });
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('AI_RATE_LIMITED');
  });
});
