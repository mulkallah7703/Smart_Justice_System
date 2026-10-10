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

describe('Cases (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let ownerId: string;
  let strangerToken: string;
  let ownCaseId: string;
  let otherCaseId: string;

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
        caseNumber: `E2E-${Date.now()}-A`,
        type: 'RENTAL',
        status: 'ACTIVE',
        authority: 'E2E Court',
        notes: 'Owner case',
        userId: ownerId,
        hearings: {
          create: {
            scheduledAt: new Date('2031-03-01T09:00:00.000Z'),
            location: 'E2E Room 1',
            notes: 'Bring documents',
          },
        },
        deadlines: {
          create: {
            type: 'DOCUMENT_SUBMIT',
            dueAt: new Date('2031-02-15T21:00:00.000Z'),
            label: 'E2E deadline',
          },
        },
      },
    });
    ownCaseId = ownCase.id;

    await prisma.case.create({
      data: {
        caseNumber: `E2E-${Date.now()}-A2`,
        type: 'COMMERCIAL',
        status: 'PENDING',
        userId: ownerId,
      },
    });

    const otherCase = await prisma.case.create({
      data: {
        caseNumber: `E2E-${Date.now()}-B`,
        type: 'LABOR',
        status: 'ACTIVE',
        userId: strangerId,
      },
    });
    otherCaseId = otherCase.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists only the authenticated user cases with pagination metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/cases')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.meta.version).toBe('v1');
    expect(response.body.meta.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      }),
    );
    expect(response.body.data).toHaveLength(2);
    expect(
      response.body.data.every((item: { id: string }) => item.id !== otherCaseId),
    ).toBe(true);
    expect(JSON.stringify(response.body)).not.toMatch(
      /userId|lawyerId|deletedAt|nationalId|accessToken/,
    );
  });

  it('returns an empty list for a user with no cases', async () => {
    const emptyLogin = await login(app, uniqueNationalId());
    const response = await request(app.getHttpServer())
      .get('/api/v1/cases')
      .set('Authorization', `Bearer ${emptyLogin.body.data.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.pagination.total).toBe(0);
  });

  it('paginates with a bounded page size', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/cases?page=1&limit=1')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.pagination).toEqual(
      expect.objectContaining({ page: 1, limit: 1, total: 2, totalPages: 2 }),
    );
  });

  it('rejects an abusive limit and invalid enum filters', async () => {
    const tooBig = await request(app.getHttpServer())
      .get('/api/v1/cases?limit=51')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.error.code).toBe('VALIDATION_ERROR');

    const badStatus = await request(app.getHttpServer())
      .get('/api/v1/cases?status=NOPE')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(badStatus.status).toBe(400);

    const injectedUser = await request(app.getHttpServer())
      .get(`/api/v1/cases?userId=${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(injectedUser.status).toBe(400);
  });

  it('filters by status and type', async () => {
    const byStatus = await request(app.getHttpServer())
      .get('/api/v1/cases?status=PENDING')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(byStatus.status).toBe(200);
    expect(byStatus.body.data).toHaveLength(1);
    expect(byStatus.body.data[0].status).toBe('PENDING');

    const byType = await request(app.getHttpServer())
      .get('/api/v1/cases?type=RENTAL')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(byType.status).toBe(200);
    expect(byType.body.data).toHaveLength(1);
    expect(byType.body.data[0].type).toBe('RENTAL');
  });

  it('returns own case detail with ordered hearings and deadlines', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/cases/${ownCaseId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(ownCaseId);
    expect(response.body.data.caseNumber).toEqual(expect.any(String));
    expect(response.body.data.hearings[0].location).toBe('E2E Room 1');
    expect(response.body.data.deadlines[0].label).toBe('E2E deadline');
    expect(response.body.data).not.toHaveProperty('userId');
    expect(response.body.data).not.toHaveProperty('lawyerId');
    expect(response.body.data).not.toHaveProperty('documents');
  });

  it('does not reveal another user case (IDOR)', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/cases/${otherCaseId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CASE_NOT_FOUND');
  });

  it('returns the same safe 404 for a nonexistent case', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/cases/cknonexistentcaseid000000001')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CASE_NOT_FOUND');
  });

  it('requires a JWT', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/cases');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('serves concurrent list reads for the same owner', async () => {
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .get('/api/v1/cases')
        .set('Authorization', `Bearer ${ownerToken}`),
      request(app.getHttpServer())
        .get('/api/v1/cases')
        .set('Authorization', `Bearer ${ownerToken}`),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.meta.pagination.total).toBe(second.body.meta.pagination.total);
  });
});
