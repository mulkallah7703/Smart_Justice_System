import { getQueueToken } from '@nestjs/bullmq';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AI_JOB_QUEUE } from '../src/modules/ai/ai.constants';
import { GlobalExceptionFilter } from '../src/shared/exceptions/http-exception.filter';
import { PrismaService } from '../src/shared/database/prisma.service';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { createValidationPipe } from '../src/shared/validation/validation.config';

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

const subOf = (token: string): string =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    .sub as string;

describe('AI Advisor API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let ownerId: string;
  let strangerToken: string;
  let strangerId: string;
  let ownCaseId: string;
  let strangerCaseId: string;

  const upload = async (
    token: string,
    caseId: string,
  ): Promise<string> => {
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

  const analyze = (token: string, body: object) =>
    request(app.getHttpServer())
      .post('/api/v1/ai/advisor/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);

    const ownerLogin = await login(app, uniqueNationalId());
    const strangerLogin = await login(app, uniqueNationalId());
    ownerToken = ownerLogin.body.data.accessToken as string;
    strangerToken = strangerLogin.body.data.accessToken as string;
    ownerId = subOf(ownerToken);
    strangerId = subOf(strangerToken);

    ownCaseId = (
      await prisma.case.create({
        data: {
          caseNumber: `AI-ADV-${Date.now()}-A`,
          type: 'RENTAL',
          status: 'ACTIVE',
          userId: ownerId,
        },
      })
    ).id;

    strangerCaseId = (
      await prisma.case.create({
        data: {
          caseNumber: `AI-ADV-${Date.now()}-B`,
          type: 'COMMERCIAL',
          status: 'ACTIVE',
          userId: strangerId,
        },
      })
    ).id;
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  describe('authentication', () => {
    it('rejects a request with no token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/advisor/analyze')
        .send({ documentIds: ['anything'] });

      expect(response.status).toBe(401);
    });

    it('rejects a request with an invalid token', async () => {
      const response = await analyze('not-a-real-token', {
        documentIds: ['anything'],
      });

      expect(response.status).toBe(401);
    });

    it('requires a token on the status endpoint too', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/ai/advisor/jobs/whatever',
      );

      expect(response.status).toBe(401);
    });
  });

  describe('request validation', () => {
    it('rejects an empty document list', async () => {
      expect((await analyze(ownerToken, { documentIds: [] })).status).toBe(400);
    });

    it('rejects a missing document list', async () => {
      expect((await analyze(ownerToken, {})).status).toBe(400);
    });

    it('rejects a non-array document list', async () => {
      expect(
        (await analyze(ownerToken, { documentIds: 'doc-1' })).status,
      ).toBe(400);
    });

    it('rejects a client-supplied userId instead of silently ignoring it', async () => {
      const documentId = await upload(ownerToken, ownCaseId);

      const response = await analyze(ownerToken, {
        documentIds: [documentId],
        userId: strangerId,
      });

      expect(response.status).toBe(400);
    });
  });

  describe('document ownership', () => {
    it('accepts documents owned by the caller and returns 202', async () => {
      const documentId = await upload(ownerToken, ownCaseId);

      const response = await analyze(ownerToken, { documentIds: [documentId] });

      expect(response.status).toBe(202);
      expect(response.body.data.jobId).toEqual(expect.any(String));
      expect(response.body.meta.version).toBe('v1');
      expect(response.body.meta.timestamp).toEqual(expect.any(String));
    });

    it("rejects another citizen's document without revealing that it exists", async () => {
      const foreignId = await upload(strangerToken, strangerCaseId);

      const response = await analyze(ownerToken, { documentIds: [foreignId] });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('AI_DOCUMENT_NOT_FOUND');
    });

    it('returns the same error for an unknown document id', async () => {
      const response = await analyze(ownerToken, {
        documentIds: ['does-not-exist'],
      });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('AI_DOCUMENT_NOT_FOUND');
    });

    it('rejects the entire request when owned and foreign documents are mixed', async () => {
      const ownId = await upload(ownerToken, ownCaseId);
      const foreignId = await upload(strangerToken, strangerCaseId);

      const response = await analyze(ownerToken, {
        documentIds: [ownId, foreignId],
      });

      expect(response.status).toBe(404);
      expect(
        await prisma.aiJob.count({
          where: { userId: ownerId, documents: { some: { documentId: foreignId } } },
        }),
      ).toBe(0);
    });

    it('creates no job at all when ownership validation fails', async () => {
      const before = await prisma.aiJob.count({ where: { userId: ownerId } });

      await analyze(ownerToken, { documentIds: ['does-not-exist'] });

      expect(await prisma.aiJob.count({ where: { userId: ownerId } })).toBe(
        before,
      );
    });

    it('rejects a soft-deleted document', async () => {
      const documentId = await upload(ownerToken, ownCaseId);
      await prisma.document.update({
        where: { id: documentId },
        data: { deletedAt: new Date() },
      });

      const response = await analyze(ownerToken, { documentIds: [documentId] });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('AI_DOCUMENT_NOT_FOUND');
    });
  });

  describe('job creation', () => {
    it('creates a PENDING DOCUMENT_ANALYSIS job with join rows', async () => {
      const documentId = await upload(ownerToken, ownCaseId);
      const response = await analyze(ownerToken, { documentIds: [documentId] });
      const jobId = response.body.data.jobId as string;

      const job = await prisma.aiJob.findUniqueOrThrow({
        where: { id: jobId },
        select: {
          type: true,
          userId: true,
          pipelineVersion: true,
          maxAttempts: true,
          documents: { select: { documentId: true } },
        },
      });

      expect(job.type).toBe('DOCUMENT_ANALYSIS');
      expect(job.userId).toBe(ownerId);
      expect(job.pipelineVersion).toBe(2);
      expect(job.maxAttempts).toBe(3);
      expect(job.documents).toEqual([{ documentId }]);
    });

    it('returns the same job for a repeated identical request', async () => {
      const documentId = await upload(ownerToken, ownCaseId);

      const first = await analyze(ownerToken, { documentIds: [documentId] });
      const second = await analyze(ownerToken, { documentIds: [documentId] });

      expect(second.status).toBe(202);
      expect(second.body.data.jobId).toBe(first.body.data.jobId);
      expect(
        await prisma.aiJob.count({
          where: { userId: ownerId, documents: { some: { documentId } } },
        }),
      ).toBe(1);
    });

    it('treats a reordered, duplicated document list as the same request', async () => {
      const a = await upload(ownerToken, ownCaseId);
      const b = await upload(ownerToken, ownCaseId);

      const first = await analyze(ownerToken, { documentIds: [a, b] });
      const second = await analyze(ownerToken, { documentIds: [b, a, a] });

      expect(second.body.data.jobId).toBe(first.body.data.jobId);
    });

    it('creates a different job for a different document set', async () => {
      const a = await upload(ownerToken, ownCaseId);
      const b = await upload(ownerToken, ownCaseId);

      const first = await analyze(ownerToken, { documentIds: [a] });
      const second = await analyze(ownerToken, { documentIds: [a, b] });

      expect(second.body.data.jobId).not.toBe(first.body.data.jobId);
    });

    it('gives two citizens separate jobs for their own identical-shaped requests', async () => {
      const ownerDoc = await upload(ownerToken, ownCaseId);
      const strangerDoc = await upload(strangerToken, strangerCaseId);

      const mine = await analyze(ownerToken, { documentIds: [ownerDoc] });
      const theirs = await analyze(strangerToken, {
        documentIds: [strangerDoc],
      });

      expect(mine.body.data.jobId).not.toBe(theirs.body.data.jobId);
    });
  });

  describe('status endpoint', () => {
    let jobId: string;

    beforeAll(async () => {
      const documentId = await upload(ownerToken, ownCaseId);
      const response = await analyze(ownerToken, { documentIds: [documentId] });
      jobId = response.body.data.jobId as string;
    });

    it('lets the owner read the job', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/ai/advisor/jobs/${jobId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.jobId).toBe(jobId);
      expect(response.body.data.type).toBe('DOCUMENT_ANALYSIS');
      expect(typeof response.body.data.progress).toBe('number');
      expect(typeof response.body.data.stageIndex).toBe('number');
    });

    it('returns 404, not 403, for another citizen', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/ai/advisor/jobs/${jobId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('AI_JOB_NOT_FOUND');
    });

    it('returns 404 for a job that does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/advisor/jobs/no-such-job')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('AI_JOB_NOT_FOUND');
    });

    it('exposes no internal fields', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/ai/advisor/jobs/${jobId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const body = response.body.data as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual([
        'completedAt',
        'createdAt',
        'errorCode',
        'jobId',
        'progress',
        'result',
        'stageIndex',
        'startedAt',
        'status',
        'type',
      ]);

      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toContain(ownerId);
      expect(serialised).not.toContain('storageKey');
      expect(serialised).not.toContain('idempotencyKey');
      expect(serialised).not.toContain('maxAttempts');
      expect(serialised).not.toContain('stack');
    });
  });
});

describe('AI Advisor enqueue failure (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    // The queue is replaced with one that always rejects, so the compensation
    // path runs against the real controller, service, and database.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getQueueToken(AI_JOB_QUEUE))
      .useValue({
        add: () => Promise.reject(new Error('ECONNREFUSED 127.0.0.1:6379')),
      })
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    const httpApp = app.getHttpAdapter().getInstance() as {
      set?: (key: string, value: number) => void;
    };
    httpApp.set?.('trust proxy', 1);
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        { path: 'readyz', method: RequestMethod.GET },
      ],
    });
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get(PrismaService);

    const auth = await login(app, uniqueNationalId());
    token = auth.body.data.accessToken as string;
    userId = subOf(token);
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  it('returns a clean service error and leaves no orphaned PENDING job', async () => {
    const legalCase = await prisma.case.create({
      data: {
        caseNumber: `AI-ENQ-${Date.now()}`,
        type: 'RENTAL',
        status: 'ACTIVE',
        userId,
      },
    });

    const uploaded = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('caseId', legalCase.id)
      .attach('file', pdfBytes(), {
        filename: 'lease.pdf',
        contentType: 'application/pdf',
      });
    const documentId = uploaded.body.data.id as string;

    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/advisor/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ documentIds: [documentId] });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('AI_JOB_ENQUEUE_FAILED');

    // No Redis detail may reach the client.
    const serialised = JSON.stringify(response.body);
    expect(serialised).not.toContain('ECONNREFUSED');
    expect(serialised).not.toContain('6379');
    expect(serialised).not.toContain('stack');

    // The compensating delete ran: nothing is left stranded in PENDING.
    expect(await prisma.aiJob.count({ where: { userId } })).toBe(0);
    expect(
      await prisma.aiJobDocument.count({ where: { documentId } }),
    ).toBe(0);
  }, 60000);
});

describe('AI Advisor rate limit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let documentId: string;
  const maxAttempts = 3;
  let previousMax: string | undefined;

  beforeAll(async () => {
    // Lowered for this application only, so the limit can be reached in a few
    // requests without slowing the rest of the suite.
    previousMax = process.env.AI_ANALYSIS_RATE_LIMIT_MAX;
    process.env.AI_ANALYSIS_RATE_LIMIT_MAX = String(maxAttempts);

    app = await createTestingApp();
    prisma = app.get(PrismaService);

    // A dedicated citizen, so no other test consumes this budget.
    const auth = await login(app, uniqueNationalId());
    token = auth.body.data.accessToken as string;
    userId = subOf(token);

    const legalCase = await prisma.case.create({
      data: {
        caseNumber: `AI-RL-${Date.now()}`,
        type: 'RENTAL',
        status: 'ACTIVE',
        userId,
      },
    });

    const uploaded = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('caseId', legalCase.id)
      .attach('file', pdfBytes(), {
        filename: 'lease.pdf',
        contentType: 'application/pdf',
      });
    documentId = uploaded.body.data.id as string;
  }, 60000);

  afterAll(async () => {
    await app?.close();
    if (previousMax === undefined) {
      delete process.env.AI_ANALYSIS_RATE_LIMIT_MAX;
    } else {
      process.env.AI_ANALYSIS_RATE_LIMIT_MAX = previousMax;
    }
  });

  it('rejects with 429 once the per-user limit is exceeded', async () => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < maxAttempts + 1; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/advisor/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({ documentIds: [documentId] });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, maxAttempts).every((code) => code === 202)).toBe(
      true,
    );
    expect(statuses[maxAttempts]).toBe(429);

    const limited = await request(app.getHttpServer())
      .post('/api/v1/ai/advisor/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ documentIds: [documentId] });
    expect(limited.body.error.code).toBe('AI_RATE_LIMITED');

    // Idempotency means the repeated requests never multiplied the work.
    expect(await prisma.aiJob.count({ where: { userId } })).toBe(1);
  }, 90000);
});
