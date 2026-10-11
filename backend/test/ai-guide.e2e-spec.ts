import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

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

describe('AI Legal Guide (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let ownerToken: string;
  let ownerId: string;
  let strangerToken: string;

  const start = (token: string | null, body: object = {}) => {
    const req = request(app.getHttpServer()).post('/api/v1/ai/guide/start');
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  const answer = (token: string | null, body: object) => {
    const req = request(app.getHttpServer()).post('/api/v1/ai/guide/answer');
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  const summary = (token: string | null, sessionId: string) => {
    const req = request(app.getHttpServer()).get(
      `/api/v1/ai/guide/summary/${sessionId}`,
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);

    const ownerLogin = await login(app, uniqueNationalId());
    const strangerLogin = await login(app, uniqueNationalId());
    ownerToken = ownerLogin.body.data.accessToken as string;
    strangerToken = strangerLogin.body.data.accessToken as string;
    ownerId = JSON.parse(
      Buffer.from(ownerToken.split('.')[1], 'base64url').toString('utf8'),
    ).sub as string;
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  it('rejects missing JWT on all guide routes', async () => {
    expect((await start(null)).status).toBe(401);
    expect((await answer(null, { sessionId: 'x', answer: 'y' })).status).toBe(
      401,
    );
    expect((await summary(null, 'x')).status).toBe(401);
  });

  it('starts a session, answers through stages, and returns summary fields', async () => {
    const started = await start(ownerToken, {});
    expect(started.status).toBe(201);
    expect(started.body.data.sessionId).toBeTruthy();
    expect(started.body.data.reply).toBeTruthy();
    expect(started.body.data).not.toHaveProperty('userId');
    expect(JSON.stringify(started.body)).not.toMatch(/nationalId|sk-|Bearer/i);

    const sessionId = started.body.data.sessionId as string;

    const messages = await prisma.aiGuideMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('ASSISTANT');

    const notReady = await summary(ownerToken, sessionId);
    expect(notReady.status).toBe(409);
    expect(notReady.body.error.code).toBe('AI_GUIDE_SUMMARY_NOT_READY');

    const q1 = await answer(ownerToken, {
      sessionId,
      answer: 'تم فصلي من العمل بدون سبب.',
    });
    expect(q1.status).toBe(200);
    expect(q1.body.data.stage).toBe('QUESTION');
    expect(q1.body.data.reply).toBe(q1.body.data.turn.clarificationQuestion);
    expect(q1.body.data.reply).not.toMatch(/إيجار|Ejar/);
    expect(q1.body.data.turn).toEqual(
      expect.objectContaining({
        needsClarification: true,
        clarificationCount: 1,
        sourcesAvailable: false,
        sources: [],
      }),
    );

    const q2 = await answer(ownerToken, {
      sessionId,
      answer: 'غير محدد المدة',
    });
    expect(q2.status).toBe(200);
    expect(q2.body.data.stage).toBe('ANSWER');
    expect(q2.body.data.turn.needsClarification).toBe(false);

    const stored = await prisma.aiGuideMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    expect(stored.map((m) => m.role)).toEqual([
      'ASSISTANT',
      'USER',
      'ASSISTANT',
      'USER',
      'ASSISTANT',
    ]);
    expect(stored[1]!.content).toBe('تم فصلي من العمل بدون سبب.');
    expect(stored[2]!.analysis).toEqual(
      expect.objectContaining({ needsClarification: true }),
    );

    const sum = await summary(ownerToken, sessionId);
    expect(sum.status).toBe(200);
    expect(sum.body.data.sessionId).toBe(sessionId);
    expect(sum.body.data.caseTypeLabel).toBeTruthy();
    expect(sum.body.data.docs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String), label: expect.any(String) }),
      ]),
    );
    expect(sum.body.data).not.toHaveProperty('userId');
    expect(sum.body.data).not.toHaveProperty('createdAt');
    expect(sum.body.data.durationDays).toBe(0);
  });

  it('starts with an initial question and answers within the same call', async () => {
    const started = await start(ownerToken, {
      initialMessage: 'أريد أرفع قضية.',
    });
    expect(started.status).toBe(201);
    expect(started.body.data.stage).toBe('QUESTION');
    expect(started.body.data.turn.clarificationQuestion).toBeTruthy();
  });

  it('fails closed on malformed model output without persisting or inventing a question', async () => {
    const started = await start(ownerToken, {});
    const sessionId = started.body.data.sessionId as string;

    const failed = await answer(ownerToken, {
      sessionId,
      answer: 'سؤال mock-guide-malformed',
    });
    expect(failed.status).toBe(502);
    expect(failed.body.error.code).toBe('AI_GUIDE_FAILED');
    expect(failed.body.data).toBeUndefined();

    const stored = await prisma.aiGuideMessage.findMany({ where: { sessionId } });
    expect(stored).toHaveLength(1);
    expect(stored[0]!.role).toBe('ASSISTANT');
  });

  it('rejects unexpected identity fields and invalid bodies', async () => {
    expect(
      (await start(ownerToken, { initialMessage: 'hi', userId: 'x' })).status,
    ).toBe(400);
    expect(
      (
        await answer(ownerToken, {
          sessionId: 's',
          answer: 'a',
          nationalId: '1',
        })
      ).status,
    ).toBe(400);
    expect((await start(ownerToken, { initialMessage: '' })).status).toBe(400);
    expect(
      (await answer(ownerToken, { sessionId: 's', answer: '' })).status,
    ).toBe(400);
  });

  it('returns the same 404 for foreign and missing sessions', async () => {
    const started = await start(ownerToken, {});
    const sessionId = started.body.data.sessionId as string;

    const foreign = await answer(strangerToken, {
      sessionId,
      answer: 'probe',
    });
    const missing = await answer(ownerToken, {
      sessionId: 'does-not-exist',
      answer: 'probe',
    });

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body.error.code).toBe('AI_GUIDE_SESSION_NOT_FOUND');
    expect(missing.body.error.code).toBe('AI_GUIDE_SESSION_NOT_FOUND');
    expect(foreign.body.error.message).toBe(missing.body.error.message);

    const foreignSum = await summary(strangerToken, sessionId);
    const missingSum = await summary(ownerToken, 'does-not-exist');
    expect(foreignSum.status).toBe(404);
    expect(missingSum.status).toBe(404);
    expect(foreignSum.body.error.code).toBe(missingSum.body.error.code);
  });

  it('rate-limits guide requests per user and fails closed on redis errors', async () => {
    const key = `ai:guide:user:${ownerId}`;
    const max = Number(process.env.AI_GUIDE_RATE_LIMIT_MAX ?? '1000');
    for (let i = 0; i <= max; i += 1) {
      await redis.incrementWithTtl(key, 60);
    }
    const limited = await start(ownerToken, {});
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('AI_GUIDE_RATE_LIMITED');

    const spy = jest
      .spyOn(redis, 'incrementWithTtl')
      .mockRejectedValueOnce(new Error('redis down'));
    const closed = await start(ownerToken, {});
    expect(closed.status).toBe(429);
    expect(closed.body.error.code).toBe('AI_GUIDE_RATE_LIMITED');
    spy.mockRestore();
  });
});
