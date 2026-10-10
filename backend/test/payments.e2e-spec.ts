import { createHmac, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/shared/database/prisma.service';
import { createTestingApp } from './create-app';

const mockCode = Number(process.env.MOCK_NAFATH_CODE ?? '72');
const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET as string;

const uniqueNationalId = (): string => {
  const tail = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
  return `1${tail}`;
};

const login = (app: INestApplication, nationalId: string) =>
  request(app.getHttpServer())
    .post('/api/v1/auth/nafath/verify')
    .set('X-Forwarded-For', `198.51.100.${Math.floor(Math.random() * 200) + 1}`)
    .send({ nationalId, nafathCode: mockCode });

const subjectOf = (token: string): string =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    .sub as string;

interface WebhookBody {
  eventId: string;
  type: 'payment.succeeded' | 'payment.failed';
  paymentId: string;
  transactionId: string;
  amountMinor: number;
  currency: string;
}

const sign = (raw: string, seconds = Math.floor(Date.now() / 1000)): string =>
  `t=${seconds},v1=${createHmac('sha256', webhookSecret)
    .update(`${seconds}.${raw}`)
    .digest('hex')}`;

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lawyerId: string;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  let slotCursor = new Date('2030-06-01T08:00:00.000Z').getTime();
  const SLOT_MS = 20 * 60 * 1000;

  /** Each test claims its own 20-minute block so bookings never collide. */
  const nextSlot = (): string => {
    slotCursor += SLOT_MS;
    return new Date(slotCursor).toISOString();
  };

  const createCitizen = async (): Promise<{ token: string; userId: string }> => {
    const response = await login(app, uniqueNationalId());
    const token = response.body.data.accessToken as string;
    return { token, userId: subjectOf(token) };
  };

  const bookConsultation = async (token: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/consultations')
      .set('Authorization', `Bearer ${token}`)
      .send({ lawyerId, scheduledAt: nextSlot(), type: 'INSTANT' });

    expect(response.status).toBe(201);
    return response.body.data.id as string;
  };

  const initiate = (
    token: string,
    body: Record<string, unknown>,
    idempotencyKey?: string,
  ): request.Test => {
    const req = request(app.getHttpServer())
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${token}`);

    if (idempotencyKey) {
      req.set('Idempotency-Key', idempotencyKey);
    }
    return req.send(body);
  };

  const deliverWebhook = (
    body: WebhookBody,
    options: { signature?: string; seconds?: number } = {},
  ): request.Test => {
    const raw = JSON.stringify(body);
    return request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set(
        'x-payment-signature',
        options.signature ?? sign(raw, options.seconds),
      )
      .send(raw);
  };

  const succeededEvent = async (
    paymentId: string,
    overrides: Partial<WebhookBody> = {},
  ): Promise<WebhookBody> => {
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { transactionId: true, amount: true, currency: true },
    });

    return {
      eventId: `evt_${randomUUID()}`,
      type: 'payment.succeeded',
      paymentId,
      transactionId: payment.transactionId as string,
      amountMinor: payment.amount.times(100).toNumber(),
      currency: payment.currency,
      ...overrides,
    };
  };

  /** Books, pays, and settles a consultation. Returns the ids involved. */
  const paidConsultation = async (
    token: string,
  ): Promise<{ consultationId: string; paymentId: string }> => {
    const consultationId = await bookConsultation(token);
    const created = await initiate(token, { consultationId, method: 'MADA' });
    const paymentId = created.body.data.id as string;

    const event = await succeededEvent(paymentId);
    await deliverWebhook(event).expect(200);

    return { consultationId, paymentId };
  };

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);

    const lawyerUser = await prisma.user.create({
      data: {
        nationalId: uniqueNationalId(),
        name: `E2E Payments Lawyer ${suffix}`,
        phone: `05${suffix.slice(-8)}`,
        role: 'LAWYER',
      },
    });

    const lawyer = await prisma.lawyer.create({
      data: {
        userId: lawyerUser.id,
        licenseNumber: `E2E-PAY-${suffix}`,
        specialties: ['RENTAL'],
        city: 'Riyadh',
        rating: 4.7,
        reviewCount: 11,
        experienceYrs: 9,
        priceFrom: 150,
        isAvailable: true,
        isVerified: true,
      },
    });
    lawyerId = lawyer.id;

    await prisma.lawyerAvailabilitySlot.create({
      data: {
        lawyerId,
        startAt: new Date('2030-06-01T08:00:00.000Z'),
        endAt: new Date('2030-06-01T20:00:00.000Z'),
        status: 'AVAILABLE',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('summary', () => {
    it('prices from the lawyer rate and the citizen card discount', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/payments/summary/${consultationId}`)
        .set('Authorization', `Bearer ${citizen.token}`)
        .expect(200);

      // A freshly registered citizen receives a NORMAL card at 0%.
      expect(response.body.data).toMatchObject({
        consultationId,
        original: { amountMinor: 15000, amount: '150.00', currency: 'SAR' },
        discountPct: 0,
        payable: { amountMinor: 15000, amount: '150.00', currency: 'SAR' },
      });
    });

    it('applies a judicial card discount without any client input', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);

      await prisma.judicialCard.update({
        where: { userId: citizen.userId },
        data: { tier: 'SILVER', discountPct: 25 },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/payments/summary/${consultationId}`)
        .set('Authorization', `Bearer ${citizen.token}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        original: { amount: '150.00' },
        discountPct: 25,
        discount: { amount: '37.50' },
        payable: { amountMinor: 11250, amount: '112.50' },
      });
    });

    it("returns 404 for another citizen's consultation", async () => {
      const owner = await createCitizen();
      const attacker = await createCitizen();
      const consultationId = await bookConsultation(owner.token);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/payments/summary/${consultationId}`)
        .set('Authorization', `Bearer ${attacker.token}`)
        .expect(404);

      expect(response.body.error.code).toBe('PAYMENT_CONSULTATION_NOT_FOUND');
    });
  });

  describe('initiate', () => {
    it('creates a PENDING payment with a server-derived amount', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);

      const response = await initiate(citizen.token, {
        consultationId,
        method: 'MADA',
      }).expect(201);

      expect(response.body.data).toMatchObject({
        status: 'PENDING',
        method: 'MADA',
        purpose: 'CONSULTATION',
        consultationId,
        payable: { amountMinor: 15000, currency: 'SAR' },
      });
      expect(response.body.data.checkoutRef).toEqual(expect.any(String));
      expect(response.body.data).not.toHaveProperty('transactionId');
      expect(response.body.data).not.toHaveProperty('idempotencyKey');
    });

    it('leaves the consultation PENDING until a payment is verified', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);

      await initiate(citizen.token, { consultationId, method: 'MADA' }).expect(201);

      const consultation = await prisma.consultation.findUniqueOrThrow({
        where: { id: consultationId },
        select: { status: true },
      });
      expect(consultation.status).toBe('PENDING');
    });

    it('ignores a client-supplied amount by rejecting the request', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);

      const response = await initiate(citizen.token, {
        consultationId,
        method: 'MADA',
        amount: 1,
        currency: 'USD',
        userId: 'someone-else',
      }).expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an unsupported method', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);

      await initiate(citizen.token, { consultationId, method: 'VISA' }).expect(400);
    });

    it("returns 404 when paying for another citizen's consultation", async () => {
      const owner = await createCitizen();
      const attacker = await createCitizen();
      const consultationId = await bookConsultation(owner.token);

      const response = await initiate(attacker.token, {
        consultationId,
        method: 'MADA',
      }).expect(404);

      expect(response.body.error.code).toBe('PAYMENT_CONSULTATION_NOT_FOUND');
    });

    it('refuses a second live payment for the same consultation', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);

      await initiate(citizen.token, { consultationId, method: 'MADA' }).expect(201);
      const second = await initiate(citizen.token, {
        consultationId,
        method: 'MADA',
      }).expect(409);

      expect(second.body.error.code).toBe('PAYMENT_ALREADY_EXISTS');
    });

    it('allows a fresh attempt after a failed payment', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);

      const first = await initiate(citizen.token, {
        consultationId,
        method: 'MADA',
      }).expect(201);
      const paymentId = first.body.data.id as string;

      const failure = await succeededEvent(paymentId, { type: 'payment.failed' });
      await deliverWebhook(failure).expect(200);

      await initiate(citizen.token, { consultationId, method: 'APPLE_PAY' }).expect(201);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .send({ consultationId: 'x', method: 'MADA' })
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', 'Bearer not-a-token')
        .send({ consultationId: 'x', method: 'MADA' })
        .expect(401);
    });
  });

  describe('idempotency', () => {
    it('returns the same payment for a repeated key and payload', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);
      const key = `key-${randomUUID()}`;

      const first = await initiate(
        citizen.token,
        { consultationId, method: 'MADA' },
        key,
      ).expect(201);
      const second = await initiate(
        citizen.token,
        { consultationId, method: 'MADA' },
        key,
      ).expect(201);

      expect(second.body.data.id).toBe(first.body.data.id);

      const count = await prisma.payment.count({ where: { consultationId } });
      expect(count).toBe(1);
    });

    it('rejects the same key reused with a different payload', async () => {
      const citizen = await createCitizen();
      const first = await bookConsultation(citizen.token);
      const other = await bookConsultation(citizen.token);
      const key = `key-${randomUUID()}`;

      await initiate(citizen.token, { consultationId: first, method: 'MADA' }, key)
        .expect(201);

      const conflict = await initiate(
        citizen.token,
        { consultationId: other, method: 'MADA' },
        key,
      ).expect(409);

      expect(conflict.body.error.code).toBe('PAYMENT_IDEMPOTENCY_CONFLICT');
    });

    it('creates exactly one payment under concurrent attempts', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);

      const results = await Promise.all([
        initiate(citizen.token, { consultationId, method: 'MADA' }),
        initiate(citizen.token, { consultationId, method: 'MADA' }),
      ]);

      const statuses = results.map((result) => result.status).sort();
      expect(statuses).toEqual([201, 409]);

      const active = await prisma.payment.count({
        where: { consultationId, status: { in: ['PENDING', 'COMPLETED'] } },
      });
      expect(active).toBe(1);
    });
  });

  describe('webhook', () => {
    it('confirms the consultation after a verified success', async () => {
      const citizen = await createCitizen();
      const { consultationId, paymentId } = await paidConsultation(citizen.token);

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: paymentId },
        select: { status: true },
      });
      const consultation = await prisma.consultation.findUniqueOrThrow({
        where: { id: consultationId },
        select: { status: true },
      });

      expect(payment.status).toBe('COMPLETED');
      expect(consultation.status).toBe('CONFIRMED');
    });

    it('keeps the consultation PENDING after a verified failure', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);
      const created = await initiate(citizen.token, {
        consultationId,
        method: 'MADA',
      }).expect(201);

      const event = await succeededEvent(created.body.data.id as string, {
        type: 'payment.failed',
      });
      await deliverWebhook(event).expect(200);

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: created.body.data.id as string },
        select: { status: true },
      });
      const consultation = await prisma.consultation.findUniqueOrThrow({
        where: { id: consultationId },
        select: { status: true },
      });

      expect(payment.status).toBe('FAILED');
      expect(consultation.status).toBe('PENDING');
    });

    it('rejects an unsigned or wrongly signed delivery', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);
      const created = await initiate(citizen.token, {
        consultationId,
        method: 'MADA',
      }).expect(201);
      const event = await succeededEvent(created.body.data.id as string);
      const raw = JSON.stringify(event);

      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .send(raw)
        .expect(401);

      const forged = await deliverWebhook(event, {
        signature: `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`,
      }).expect(401);
      expect(forged.body.error.code).toBe('PAYMENT_VERIFICATION_FAILED');

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: created.body.data.id as string },
        select: { status: true },
      });
      expect(payment.status).toBe('PENDING');
    });

    it('rejects a stale signature timestamp', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);
      const created = await initiate(citizen.token, {
        consultationId,
        method: 'MADA',
      }).expect(201);

      const event = await succeededEvent(created.body.data.id as string);
      await deliverWebhook(event, {
        seconds: Math.floor(Date.now() / 1000) - 3600,
      }).expect(401);
    });

    it('rejects a mismatched amount, currency, or provider reference', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);
      const created = await initiate(citizen.token, {
        consultationId,
        method: 'MADA',
      }).expect(201);
      const paymentId = created.body.data.id as string;

      const wrongAmount = await deliverWebhook(
        await succeededEvent(paymentId, { amountMinor: 1 }),
      ).expect(400);
      expect(wrongAmount.body.error.code).toBe('PAYMENT_AMOUNT_MISMATCH');

      await deliverWebhook(
        await succeededEvent(paymentId, { currency: 'USD' }),
      ).expect(400);

      await deliverWebhook(
        await succeededEvent(paymentId, { transactionId: 'mock_txn_forged' }),
      ).expect(401);

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: paymentId },
        select: { status: true },
      });
      expect(payment.status).toBe('PENDING');
    });

    it('is idempotent when the same event is replayed', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);
      const created = await initiate(citizen.token, {
        consultationId,
        method: 'MADA',
      }).expect(201);
      const paymentId = created.body.data.id as string;
      const event = await succeededEvent(paymentId);

      const first = await deliverWebhook(event).expect(200);
      const replay = await deliverWebhook(event).expect(200);

      expect(first.body.data.duplicate).toBe(false);
      expect(replay.body.data.duplicate).toBe(true);

      const events = await prisma.paymentWebhookEvent.count({
        where: { paymentId },
      });
      expect(events).toBe(1);
    });

    it('applies exactly one transition under concurrent delivery', async () => {
      const citizen = await createCitizen();
      const consultationId = await bookConsultation(citizen.token);
      const created = await initiate(citizen.token, {
        consultationId,
        method: 'MADA',
      }).expect(201);
      const paymentId = created.body.data.id as string;
      const event = await succeededEvent(paymentId);

      const results = await Promise.all([
        deliverWebhook(event),
        deliverWebhook(event),
      ]);

      expect(results.every((result) => result.status === 200)).toBe(true);
      expect(
        results.filter((result) => result.body.data.duplicate === false),
      ).toHaveLength(1);

      const events = await prisma.paymentWebhookEvent.count({
        where: { paymentId },
      });
      expect(events).toBe(1);

      const audits = await prisma.auditLog.count({
        where: { resourceId: paymentId, action: 'PAYMENT_SUCCEEDED' },
      });
      expect(audits).toBe(1);
    });

    it('records safe audit metadata only', async () => {
      const citizen = await createCitizen();
      const { paymentId } = await paidConsultation(citizen.token);

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { resourceId: paymentId, action: 'PAYMENT_SUCCEEDED' },
        select: { metadata: true, actorType: true },
      });
      const serialised = JSON.stringify(audit.metadata);

      expect(audit.actorType).toBe('SYSTEM');
      expect(serialised).not.toContain(webhookSecret);
      expect(serialised).not.toContain('mock_txn');
      expect(serialised).not.toMatch(/nationalId|cardNumber|cvv/i);
    });
  });

  describe('detail', () => {
    it('returns the payment to its owner without provider internals', async () => {
      const citizen = await createCitizen();
      const { paymentId } = await paidConsultation(citizen.token);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${citizen.token}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: paymentId,
        status: 'COMPLETED',
      });
      expect(response.body.data).not.toHaveProperty('transactionId');
      expect(response.body.data).not.toHaveProperty('gatewayRef');
      expect(response.body.data).not.toHaveProperty('userId');
    });

    it("returns 404 for another citizen's payment and for an unknown id", async () => {
      const owner = await createCitizen();
      const attacker = await createCitizen();
      const { paymentId } = await paidConsultation(owner.token);

      const idor = await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${attacker.token}`)
        .expect(404);

      const unknown = await request(app.getHttpServer())
        .get('/api/v1/payments/pay_does_not_exist')
        .set('Authorization', `Bearer ${attacker.token}`)
        .expect(404);

      expect(idor.body.error).toEqual(unknown.body.error);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/payments/pay_1')
        .expect(401);
    });
  });
});
