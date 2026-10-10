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

describe('Lawyers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let lawyerId: string;
  let otherLawyerId: string;
  let licenseNumber: string;
  let lawyerUserId: string;
  let openWindowId: string;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);

    const citizen = await login(app, uniqueNationalId());
    token = citizen.body.data.accessToken as string;

    const lawyerUser = await prisma.user.create({
      data: {
        nationalId: uniqueNationalId(),
        name: `E2E Lawyer Alpha ${suffix}`,
        phone: `05${suffix.slice(-8)}`,
        role: 'LAWYER',
      },
    });
    lawyerUserId = lawyerUser.id;
    licenseNumber = `E2E-LIC-${suffix}-A`;

    const lawyer = await prisma.lawyer.create({
      data: {
        userId: lawyerUser.id,
        licenseNumber,
        specialties: ['RENTAL'],
        city: `E2ECity${suffix}`,
        bio: 'E2E lawyer bio',
        rating: 4.9,
        reviewCount: 5,
        experienceYrs: 11,
        priceFrom: 150,
        isAvailable: true,
        isVerified: true,
      },
    });
    lawyerId = lawyer.id;

    const otherLawyer = await prisma.lawyer.create({
      data: {
        licenseNumber: `E2E-LIC-${suffix}-B`,
        specialties: ['LABOR'],
        city: `E2ECity${suffix}`,
        rating: 4.1,
        reviewCount: 2,
        experienceYrs: 3,
        priceFrom: 90,
        isAvailable: false,
        isVerified: false,
      },
    });
    otherLawyerId = otherLawyer.id;

    const openWindow = await prisma.lawyerAvailabilitySlot.create({
      data: {
        lawyerId,
        startAt: new Date('2030-03-01T09:00:00.000Z'),
        endAt: new Date('2030-03-01T10:00:00.000Z'),
        status: 'AVAILABLE',
      },
    });
    openWindowId = openWindow.id;

    await prisma.lawyerAvailabilitySlot.create({
      data: {
        lawyerId,
        startAt: new Date('2030-03-02T09:00:00.000Z'),
        endAt: new Date('2030-03-02T10:00:00.000Z'),
        status: 'BLOCKED',
      },
    });

    await prisma.lawyerAvailabilitySlot.create({
      data: {
        lawyerId,
        startAt: new Date('2020-01-01T09:00:00.000Z'),
        endAt: new Date('2020-01-01T10:00:00.000Z'),
        status: 'AVAILABLE',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists lawyers with pagination metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/lawyers?page=1&limit=50')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.meta.version).toBe('v1');
    expect(response.body.meta.pagination).toMatchObject({ page: 1, limit: 50 });
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('never exposes private lawyer or user data in the list', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/lawyers?q=E2E Lawyer Alpha ${suffix}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const item = response.body.data.find(
      (entry: { id: string }) => entry.id === lawyerId,
    );
    expect(item).toBeDefined();
    expect(item.name).toBe(`E2E Lawyer Alpha ${suffix}`);
    expect(item).not.toHaveProperty('licenseNumber');
    expect(item).not.toHaveProperty('userId');
    expect(item).not.toHaveProperty('user');

    const serialised = JSON.stringify(response.body);
    expect(serialised).not.toContain(lawyerUserId);
    expect(serialised).not.toMatch(/nationalId|passwordHash|createdAt/);
  });

  it('filters by specialty without returning unrelated lawyers', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/lawyers?specialty=RENTAL&limit=50')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(
      response.body.data.every((item: { specialties: string[] }) =>
        item.specialties.includes('RENTAL'),
      ),
    ).toBe(true);
    expect(
      response.body.data.some((item: { id: string }) => item.id === otherLawyerId),
    ).toBe(false);
  });

  it('rejects an unknown specialty and a client supplied sort', async () => {
    const badSpecialty = await request(app.getHttpServer())
      .get('/api/v1/lawyers?specialty=TRAFFIC')
      .set('Authorization', `Bearer ${token}`);
    expect(badSpecialty.status).toBe(400);

    const badSort = await request(app.getHttpServer())
      .get('/api/v1/lawyers?orderBy=priceFrom')
      .set('Authorization', `Bearer ${token}`);
    expect(badSort.status).toBe(400);
  });

  it('returns the public profile including the licence on detail', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/lawyers/${lawyerId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: lawyerId,
      name: `E2E Lawyer Alpha ${suffix}`,
      licenseNumber,
      bio: 'E2E lawyer bio',
      city: `E2ECity${suffix}`,
    });
    expect(response.body.data).not.toHaveProperty('user');
    expect(response.body.data).not.toHaveProperty('userId');
  });

  it('returns 404 for an unknown lawyer', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/lawyers/not-a-real-lawyer')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('LAWYER_NOT_FOUND');
  });

  it('returns aligned bookable blocks and excludes blocked and past windows', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/lawyers/${lawyerId}/availability?from=2030-03-01T00:00:00.000Z&to=2030-03-03T00:00:00.000Z`,
      )
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const starts = response.body.data.map(
      (slot: { startAt: string }) => slot.startAt,
    );
    expect(starts).toEqual([
      '2030-03-01T09:00:00.000Z',
      '2030-03-01T09:20:00.000Z',
      '2030-03-01T09:40:00.000Z',
    ]);
    expect(response.body.data[0]).toMatchObject({
      slotId: openWindowId,
      endAt: '2030-03-01T09:20:00.000Z',
      durationMin: 20,
    });
  });

  it('excludes blocks taken by an active consultation', async () => {
    const holder = await prisma.user.create({
      data: {
        nationalId: uniqueNationalId(),
        name: 'E2E Availability Holder',
        phone: `05${`${Date.now()}`.slice(-8)}`,
        role: 'CITIZEN',
      },
    });
    const booking = await prisma.consultation.create({
      data: {
        userId: holder.id,
        lawyerId,
        type: 'INSTANT',
        scheduledAt: new Date('2030-03-01T09:20:00.000Z'),
        durationMin: 20,
        status: 'PENDING',
      },
    });

    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/lawyers/${lawyerId}/availability?from=2030-03-01T00:00:00.000Z&to=2030-03-02T00:00:00.000Z`,
      )
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(
      response.body.data.map((slot: { startAt: string }) => slot.startAt),
    ).toEqual(['2030-03-01T09:00:00.000Z', '2030-03-01T09:40:00.000Z']);

    await prisma.consultation.delete({ where: { id: booking.id } });
  });

  it('rejects an invalid availability range', async () => {
    const inverted = await request(app.getHttpServer())
      .get(
        `/api/v1/lawyers/${lawyerId}/availability?from=2030-03-05T00:00:00.000Z&to=2030-03-01T00:00:00.000Z`,
      )
      .set('Authorization', `Bearer ${token}`);
    expect(inverted.status).toBe(400);
    expect(inverted.body.error.code).toBe('AVAILABILITY_RANGE_INVALID');

    const malformed = await request(app.getHttpServer())
      .get(`/api/v1/lawyers/${lawyerId}/availability?from=tomorrow`)
      .set('Authorization', `Bearer ${token}`);
    expect(malformed.status).toBe(400);
  });

  it('returns 404 when reading availability for an unknown lawyer', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/lawyers/not-a-real-lawyer/availability')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('LAWYER_NOT_FOUND');
  });

  it('requires a valid JWT', async () => {
    const anonymous = await request(app.getHttpServer()).get('/api/v1/lawyers');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('AUTH_UNAUTHORIZED');

    const invalid = await request(app.getHttpServer())
      .get(`/api/v1/lawyers/${lawyerId}/availability`)
      .set('Authorization', 'Bearer not.a.token');
    expect(invalid.status).toBe(401);
  });
});
