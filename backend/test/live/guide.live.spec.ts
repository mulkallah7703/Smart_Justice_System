/**
 * LIVE LEGAL GUIDE (real OpenAI chat model, no mock LLM)
 *
 * Opt-in only:
 *   RUN_LIVE_GUIDE_TESTS=true
 *   OPENAI_API_KEY (or LIVE_OPENAI_API_KEY)
 *   Local Postgres + Redis (DATABASE_URL / REDIS_URL)
 *
 * Assertions use the validated response contract (stage, domains, facts), never the
 * model's exact wording. Does not activate Nafath or Payment.
 */

import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestingApp } from '../create-app';

loadDotenv({ path: resolve(__dirname, '../../.env') });

const openaiKey =
  process.env.LIVE_OPENAI_API_KEY?.trim() ||
  process.env.OPENAI_API_KEY?.trim() ||
  '';
const guideLiveEnabled =
  process.env.RUN_LIVE_GUIDE_TESTS === 'true' && Boolean(openaiKey);

if (guideLiveEnabled) {
  process.env.OPENAI_API_KEY = openaiKey;
  process.env.AI_LLM_MODE = 'openai';
  process.env.AI_GUIDE_RATE_LIMIT_MAX = '1000';
}

const describeGuideLive = guideLiveEnabled ? describe : describe.skip;

const UNRELATED_RENTAL = /إيجار|ايجار|المؤجر|المستأجر|Ejar/;

interface TurnBody {
  sessionId: string;
  reply: string;
  stage: 'QUESTION' | 'ANSWER';
  turn: {
    domains: string[];
    knownFacts: string[];
    needsClarification: boolean;
    sourcesAvailable: boolean;
  };
}

describeGuideLive('LIVE LEGAL GUIDE', () => {
  let app: INestApplication;
  let token: string;
  const transcript: Array<Record<string, unknown>> = [];

  const ask = async (
    text: string,
    sessionId?: string,
  ): Promise<TurnBody> => {
    let id = sessionId;
    if (!id) {
      const started = await request(app.getHttpServer())
        .post('/api/v1/ai/guide/start')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(started.status).toBe(201);
      id = started.body.data.sessionId as string;
    }
    const res = await request(app.getHttpServer())
      .post('/api/v1/ai/guide/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId: id, answer: text });
    expect(res.status).toBe(200);
    const body = res.body.data as TurnBody;
    transcript.push({
      input: text,
      stage: body.stage,
      domains: body.turn.domains,
      reply: body.reply,
    });
    expect(body.turn.sourcesAvailable).toBe(false);
    expect(body.reply).not.toMatch(/المادة\s*[0-9٠-٩]|Article\s+\d/);
    return body;
  };

  beforeAll(async () => {
    app = await createTestingApp();
    const email = `live-guide-${Date.now()}@localhost.local`;
    const password = 'LiveGuideTest1!';
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Live Guide Tester', email, password });
    expect(register.status).toBe(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(login.status).toBe(200);
    token = login.body.data.accessToken as string;
  }, 60_000);

  afterAll(async () => {
    // Model output only (no secrets) — recorded for the verification report.
    // eslint-disable-next-line no-console
    console.log(`LIVE_GUIDE_TRANSCRIPT ${JSON.stringify(transcript, null, 2)}`);
    await app?.close();
  });

  it('A. employment → employment domain, no rental question', async () => {
    const body = await ask('تم فصلي من العمل بدون سبب.');
    expect(body.turn.domains).toContain('EMPLOYMENT');
    expect(body.reply).not.toMatch(UNRELATED_RENTAL);
  });

  it('B. rental deposit → rental domain', async () => {
    const body = await ask('المؤجر يرفض إعادة مبلغ التأمين.');
    expect(body.turn.domains).toContain('RENTAL_REAL_ESTATE');
    expect(body.reply).not.toMatch(/فصل|صاحب العمل/);
  });

  it('C. debt → debt domain, no employment/rental question', async () => {
    const body = await ask('شخص استدان مني مبلغًا ويرفض السداد.');
    expect(body.turn.domains).toContain('DEBT_FINANCIAL');
    expect(body.reply).not.toMatch(UNRELATED_RENTAL);
  });

  it('D. definition → direct answer, no clarification', async () => {
    const body = await ask('ما المقصود بالشرط الجزائي في العقود؟');
    expect(body.stage).toBe('ANSWER');
    expect(body.turn.domains).toContain('CONTRACTS');
  });

  it('E. ambiguous → asks for context', async () => {
    const body = await ask('أريد أرفع قضية.');
    expect(body.stage).toBe('QUESTION');
    expect(body.reply).not.toMatch(UNRELATED_RENTAL);
  });

  it('F. complex → keeps employment and injury aspects', async () => {
    const body = await ask('شركتي فصلتني بعد إصابة أثناء العمل ولم تصرف مستحقاتي.');
    expect(body.turn.domains).toEqual(
      expect.arrayContaining(['EMPLOYMENT']),
    );
    expect(
      body.turn.domains.includes('WORKPLACE_INJURY') ||
        body.turn.knownFacts.some((f) => /إصاب/.test(f)),
    ).toBe(true);
    expect(body.reply).not.toMatch(UNRELATED_RENTAL);
  });

  it('G. follow-up keeps the original employment issue', async () => {
    const first = await ask('تم فصلي من العمل بدون سبب.');
    if (first.stage === 'ANSWER') {
      return;
    }
    const second = await ask(
      'عقدي غير محدد المدة ووصلتني رسالة واتساب فقط بإنهاء العقد.',
      first.sessionId,
    );
    expect(second.turn.domains).toContain('EMPLOYMENT');
    expect(second.reply).not.toMatch(UNRELATED_RENTAL);
  });
});
