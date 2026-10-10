import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/shared/database/prisma.service';
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

const subjectOf = (token: string): string =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    .sub as string;

describe('Consultations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lawyerId: string;
  let blockedLawyerId: string;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  /** Availability windows are wide so each test can claim its own block. */
  const WINDOW_START = '2030-04-01T08:00:00.000Z';

  const createCitizen = async (): Promise<{ token: string; userId: string }> => {
    const response = await login(app, uniqueNationalId());
    const token = response.body.data.accessToken as string;
    return { token, userId: subjectOf(token) };
  };

  const book = (
    token: string,
    body: Record<string, unknown>,
  ): request.Test =>
    request(app.getHttpServer())
      .post('/api/v1/consultations')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);

    const lawyerUser = await prisma.user.create({
      data: {
        nationalId: uniqueNationalId(),
        name: `E2E Booking Lawyer ${suffix}`,
        phone: `05${suffix.slice(-8)}`,
        role: 'LAWYER',
      },
    });

    const lawyer = await prisma.lawyer.create({
      data: {
        userId: lawyerUser.id,
        licenseNumber: `E2E-BOOK-${suffix}`,
        specialties: ['RENTAL'],
        city: 'Riyadh',
        rating: 4.6,
        reviewCount: 8,
        experienceYrs: 7,
        priceFrom: 150,
        isAvailable: true,
        isVerified: true,
      },
    });
    lawyerId = lawyer.id;

    await prisma.lawyerAvailabilitySlot.create({
      data: {
        lawyerId,
        startAt: new Date(WINDOW_START),
        endAt: new Date('2030-04-01T14:00:00.000Z'),
        status: 'AVAILABLE',
      },
    });

    const blockedLawyer = await prisma.lawyer.create({
      data: {
        licenseNumber: `E2E-BLOCKED-${suffix}`,
        specialties: ['LABOR'],
        city: 'Jeddah',
        rating: 4,
        reviewCount: 1,
        experienceYrs: 2,
        priceFrom: 80,
      },
    });
    blockedLawyerId = blockedLawyer.id;

    await prisma.lawyerAvailabilitySlot.create({
      data: {
        lawyerId: blockedLawyerId,
        startAt: new Date('2030-04-02T08:00:00.000Z'),
        endAt: new Date('2030-04-02T10:00:00.000Z'),
        status: 'BLOCKED',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('books a consultation, lists it, and returns its detail', async () => {
    const citizen = await createCitizen();
    const scheduledAt = '2030-04-01T08:00:00.000Z';

    const created = await book(citizen.token, {
      lawyerId,
      scheduledAt,
      type: 'INSTANT',
      notes: 'E2E booking note',
    });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      status: 'PENDING',
      type: 'INSTANT',
      scheduledAt,
      durationMin: 20,
      notes: 'E2E booking note',
    });
    expect(created.body.data.lawyer).toMatchObject({ id: lawyerId });
    expect(created.body.data.lawyer).not.toHaveProperty('user');
    expect(created.body.data).not.toHaveProperty('userId');

    const consultationId = created.body.data.id as string;

    const list = await request(app.getHttpServer())
      .get('/api/v1/consultations')
      .set('Authorization', `Bearer ${citizen.token}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.pagination).toMatchObject({ page: 1, limit: 10, total: 1 });
    expect(list.body.data[0].id).toBe(consultationId);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/consultations/${consultationId}`)
      .set('Authorization', `Bearer ${citizen.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.id).toBe(consultationId);

    const stored = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(stored.userId).toBe(citizen.userId);
    expect(stored.scheduledAt.toISOString()).toBe(scheduledAt);

    const payments = await prisma.payment.count({ where: { consultationId } });
    expect(payments).toBe(0);
  });

  it('lets exactly one of two concurrent bookings win the same block', async () => {
    const [first, second] = await Promise.all([createCitizen(), createCitizen()]);
    const scheduledAt = '2030-04-01T08:20:00.000Z';

    const results = await Promise.all([
      book(first.token, { lawyerId, scheduledAt, type: 'INSTANT' }),
      book(second.token, { lawyerId, scheduledAt, type: 'WRITTEN' }),
    ]);

    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual([201, 409]);

    const loser = results.find((result) => result.status === 409);
    expect(['CONSULTATION_CONFLICT', 'CONSULTATION_SLOT_UNAVAILABLE']).toContain(
      loser?.body.error.code,
    );

    const active = await prisma.consultation.count({
      where: {
        lawyerId,
        scheduledAt: new Date(scheduledAt),
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
    });
    expect(active).toBe(1);
  });

  it('rejects a block that another citizen already booked', async () => {
    const [first, second] = await Promise.all([createCitizen(), createCitizen()]);
    const scheduledAt = '2030-04-01T08:40:00.000Z';

    const created = await book(first.token, { lawyerId, scheduledAt, type: 'INSTANT' });
    expect(created.status).toBe(201);

    const duplicate = await book(second.token, {
      lawyerId,
      scheduledAt,
      type: 'INSTANT',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONSULTATION_CONFLICT');
  });

  it('frees the block again once the consultation is cancelled', async () => {
    const citizen = await createCitizen();
    const scheduledAt = '2030-04-01T09:00:00.000Z';

    const created = await book(citizen.token, { lawyerId, scheduledAt, type: 'INSTANT' });
    expect(created.status).toBe(201);

    await prisma.consultation.update({
      where: { id: created.body.data.id as string },
      data: { status: 'CANCELLED' },
    });

    const rebooked = await book(citizen.token, {
      lawyerId,
      scheduledAt,
      type: 'INSTANT',
    });
    expect(rebooked.status).toBe(201);
  });

  it('rejects a booking that clashes with the citizen own consultation', async () => {
    const citizen = await createCitizen();
    const scheduledAt = '2030-04-01T09:20:00.000Z';

    const otherLawyer = await prisma.lawyer.create({
      data: {
        licenseNumber: `E2E-SECOND-${suffix}`,
        specialties: ['RENTAL'],
        city: 'Riyadh',
        rating: 4,
        reviewCount: 1,
        experienceYrs: 2,
        priceFrom: 100,
      },
    });
    await prisma.lawyerAvailabilitySlot.create({
      data: {
        lawyerId: otherLawyer.id,
        startAt: new Date(scheduledAt),
        endAt: new Date('2030-04-01T10:00:00.000Z'),
        status: 'AVAILABLE',
      },
    });

    expect(
      (await book(citizen.token, { lawyerId, scheduledAt, type: 'INSTANT' })).status,
    ).toBe(201);

    const clash = await book(citizen.token, {
      lawyerId: otherLawyer.id,
      scheduledAt,
      type: 'INSTANT',
    });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('CONSULTATION_CONFLICT');
  });

  it('rejects a time in the past', async () => {
    const citizen = await createCitizen();

    const response = await book(citizen.token, {
      lawyerId,
      scheduledAt: '2020-01-01T09:00:00.000Z',
      type: 'INSTANT',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CONSULTATION_IN_PAST');
  });

  it('rejects a time outside the availability window', async () => {
    const citizen = await createCitizen();

    const response = await book(citizen.token, {
      lawyerId,
      scheduledAt: '2030-04-01T16:00:00.000Z',
      type: 'INSTANT',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONSULTATION_SLOT_UNAVAILABLE');
  });

  it('rejects a time that is not aligned to a published block', async () => {
    const citizen = await createCitizen();

    const response = await book(citizen.token, {
      lawyerId,
      scheduledAt: '2030-04-01T10:05:00.000Z',
      type: 'INSTANT',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONSULTATION_SLOT_UNAVAILABLE');
  });

  it('rejects a blocked availability window', async () => {
    const citizen = await createCitizen();

    const response = await book(citizen.token, {
      lawyerId: blockedLawyerId,
      scheduledAt: '2030-04-02T08:00:00.000Z',
      type: 'INSTANT',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONSULTATION_SLOT_UNAVAILABLE');
  });

  it('rejects an unknown lawyer', async () => {
    const citizen = await createCitizen();

    const response = await book(citizen.token, {
      lawyerId: 'not-a-real-lawyer',
      scheduledAt: '2030-04-01T11:00:00.000Z',
      type: 'INSTANT',
    });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('LAWYER_NOT_FOUND');
  });

  it('rejects a client supplied userId, an unknown type, and a malformed date', async () => {
    const citizen = await createCitizen();
    const other = await createCitizen();

    const withUserId = await book(citizen.token, {
      lawyerId,
      scheduledAt: '2030-04-01T11:20:00.000Z',
      type: 'INSTANT',
      userId: other.userId,
    });
    expect(withUserId.status).toBe(400);

    const withStatus = await book(citizen.token, {
      lawyerId,
      scheduledAt: '2030-04-01T11:20:00.000Z',
      type: 'INSTANT',
      status: 'CONFIRMED',
    });
    expect(withStatus.status).toBe(400);

    const badType = await book(citizen.token, {
      lawyerId,
      scheduledAt: '2030-04-01T11:20:00.000Z',
      type: 'VIDEO_CALL',
    });
    expect(badType.status).toBe(400);

    const badDate = await book(citizen.token, {
      lawyerId,
      scheduledAt: 'not-a-date',
      type: 'INSTANT',
    });
    expect(badDate.status).toBe(400);
  });

  it('hides another citizen consultation behind a 404 (IDOR)', async () => {
    const [owner, stranger] = await Promise.all([createCitizen(), createCitizen()]);

    const created = await book(owner.token, {
      lawyerId,
      scheduledAt: '2030-04-01T12:00:00.000Z',
      type: 'INSTANT',
      notes: 'confidential matter',
    });
    expect(created.status).toBe(201);
    const consultationId = created.body.data.id as string;

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/consultations/${consultationId}`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe('CONSULTATION_NOT_FOUND');
    expect(JSON.stringify(detail.body)).not.toContain('confidential matter');

    const missing = await request(app.getHttpServer())
      .get('/api/v1/consultations/does-not-exist')
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe(detail.body.error.code);

    const list = await request(app.getHttpServer())
      .get('/api/v1/consultations')
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(list.body.data).toHaveLength(0);
  });

  it('ignores a userId query parameter on the list', async () => {
    const [owner, stranger] = await Promise.all([createCitizen(), createCitizen()]);

    expect(
      (
        await book(owner.token, {
          lawyerId,
          scheduledAt: '2030-04-01T12:20:00.000Z',
          type: 'INSTANT',
        })
      ).status,
    ).toBe(201);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/consultations?userId=${owner.userId}`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(response.status).toBe(400);
  });

  it('requires a valid JWT', async () => {
    const anonymous = await request(app.getHttpServer()).get('/api/v1/consultations');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('AUTH_UNAUTHORIZED');

    const invalid = await request(app.getHttpServer())
      .post('/api/v1/consultations')
      .set('Authorization', 'Bearer not.a.token')
      .send({ lawyerId, scheduledAt: '2030-04-01T13:00:00.000Z', type: 'INSTANT' });
    expect(invalid.status).toBe(401);
  });

  it('writes a safe audit entry for a booking', async () => {
    const citizen = await createCitizen();

    const created = await book(citizen.token, {
      lawyerId,
      scheduledAt: '2030-04-01T13:20:00.000Z',
      type: 'INSTANT',
      notes: 'audit privacy check',
    });
    expect(created.status).toBe(201);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'CONSULTATION_BOOKED',
        resourceId: created.body.data.id as string,
      },
    });

    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBe(citizen.userId);
    expect(JSON.stringify(audit?.metadata)).not.toContain('audit privacy check');
    expect(JSON.stringify(audit?.metadata)).toContain(lawyerId);
  });
});
