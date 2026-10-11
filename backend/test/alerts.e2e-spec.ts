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

describe('Alerts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let ownerId: string;
  let strangerToken: string;
  let ownAlertId: string;
  let foreignAlertId: string;

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);

    const ownerLogin = await login(app, uniqueNationalId());
    const strangerLogin = await login(app, uniqueNationalId());
    ownerToken = ownerLogin.body.data.accessToken as string;
    strangerToken = strangerLogin.body.data.accessToken as string;
    ownerId = JSON.parse(
      Buffer.from(ownerToken.split('.')[1], 'base64url').toString('utf8'),
    ).sub as string;
    const strangerId = JSON.parse(
      Buffer.from(strangerToken.split('.')[1], 'base64url').toString('utf8'),
    ).sub as string;

    const ownCase = await prisma.case.create({
      data: {
        caseNumber: `E2E-ALERT-${Date.now()}-A`,
        type: 'RENTAL',
        status: 'ACTIVE',
        userId: ownerId,
        deadlines: {
          create: {
            type: 'DOCUMENT_SUBMIT',
            dueAt: new Date('2031-06-01T12:00:00.000Z'),
            label: 'E2E alert deadline',
          },
        },
      },
      include: { deadlines: true },
    });

    const ownAlert = await prisma.alert.create({
      data: {
        userId: ownerId,
        caseId: ownCase.id,
        deadlineId: ownCase.deadlines[0]?.id,
        type: 'DEADLINE',
        severity: 'URGENT',
        title: 'E2E own alert',
        body: 'Owner alert body',
        isRead: false,
      },
    });
    ownAlertId = ownAlert.id;

    await prisma.alert.create({
      data: {
        userId: ownerId,
        caseId: ownCase.id,
        type: 'LAW_UPDATE',
        severity: 'INFO',
        title: 'E2E read alert',
        body: 'Already read',
        isRead: true,
      },
    });

    const foreignAlert = await prisma.alert.create({
      data: {
        userId: strangerId,
        type: 'MISSING_DOC',
        severity: 'WARNING',
        title: 'E2E foreign alert',
        body: 'Must not leak',
        isRead: false,
      },
    });
    foreignAlertId = foreignAlert.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated list with 401', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/alerts');
    expect(response.status).toBe(401);
  });

  it('lists only the authenticated user alerts sorted newest first', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/alerts')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.meta.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        total: 2,
      }),
    );
    expect(response.body.data).toHaveLength(2);
    expect(
      response.body.data.every((item: { id: string }) => item.id !== foreignAlertId),
    ).toBe(true);
    expect(response.body.data[0].createdAt >= response.body.data[1].createdAt).toBe(
      true,
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /userId|nationalId|accessToken|deadlineId/,
    );
  });

  it('returns an empty list for a user with no alerts and creates none', async () => {
    const emptyLogin = await login(app, uniqueNationalId());
    const emptyToken = emptyLogin.body.data.accessToken as string;
    const emptyUserId = JSON.parse(
      Buffer.from(emptyToken.split('.')[1], 'base64url').toString('utf8'),
    ).sub as string;

    const response = await request(app.getHttpServer())
      .get('/api/v1/alerts')
      .set('Authorization', `Bearer ${emptyToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.pagination).toEqual(
      expect.objectContaining({ page: 1, total: 0 }),
    );
    expect(await prisma.alert.count({ where: { userId: emptyUserId } })).toBe(0);
  });

  it('filters unreadOnly', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/alerts?unreadOnly=true')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(ownAlertId);
    expect(response.body.data[0].isRead).toBe(false);
  });

  it('returns 404 for foreign and nonexistent alerts without revealing ownership', async () => {
    const foreign = await request(app.getHttpServer())
      .get(`/api/v1/alerts/${foreignAlertId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const missing = await request(app.getHttpServer())
      .get('/api/v1/alerts/does-not-exist')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body.error.code).toBe('ALERT_NOT_FOUND');
    expect(missing.body.error.code).toBe('ALERT_NOT_FOUND');
  });

  it('rejects invalid pagination and unexpected userId', async () => {
    const badPage = await request(app.getHttpServer())
      .get('/api/v1/alerts?page=0')
      .set('Authorization', `Bearer ${ownerToken}`);
    const badUserId = await request(app.getHttpServer())
      .get('/api/v1/alerts?userId=someone-else')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(badPage.status).toBe(400);
    expect(badUserId.status).toBe(400);
  });

  it('marks own alert read idempotently and blocks foreign mark-read', async () => {
    const first = await request(app.getHttpServer())
      .patch(`/api/v1/alerts/${ownAlertId}/read`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const second = await request(app.getHttpServer())
      .patch(`/api/v1/alerts/${ownAlertId}/read`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const foreign = await request(app.getHttpServer())
      .patch(`/api/v1/alerts/${foreignAlertId}/read`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(first.status).toBe(200);
    expect(first.body.data.isRead).toBe(true);
    expect(second.status).toBe(200);
    expect(second.body.data.isRead).toBe(true);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('ALERT_NOT_FOUND');
  });
});
