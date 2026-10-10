import type { INestApplication } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import request from 'supertest';

import { PrismaService } from '../src/shared/database/prisma.service';
import { createTestingApp } from './create-app';

const mockCode = Number(process.env.MOCK_NAFATH_CODE ?? '72');

const uniqueNationalId = (): string => {
  const tail = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
  return `1${tail}`;
};

let clientSeq = 0;
const uniqueClientIp = (): string => {
  clientSeq += 1;
  return `203.0.113.${(clientSeq % 250) + 1}`;
};

const postVerify = (
  app: INestApplication,
  body: Record<string, unknown>,
  ip = uniqueClientIp(),
) =>
  request(app.getHttpServer())
    .post('/api/v1/auth/nafath/verify')
    .set('X-Forwarded-For', ip)
    .send(body);

describe('Auth + Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('verifies mock Nafath, issues JWT, and returns /users/me from the token', async () => {
    const nationalId = uniqueNationalId();

    const login = await postVerify(app, { nationalId, nafathCode: mockCode });

    expect(login.status).toBe(200);
    expect(login.body.data.accessToken).toEqual(expect.any(String));
    expect(login.body.meta.version).toBe('v1');

    const token = login.body.data.accessToken as string;
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;

    expect(payload).toEqual(
      expect.objectContaining({
        sub: expect.any(String),
        role: 'CITIZEN',
      }),
    );
    expect(payload).not.toHaveProperty('nationalId');
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('email');

    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.data.id).toBe(payload.sub);
    expect(me.body.data.name).toEqual(expect.any(String));
    expect(me.body.data.role).toBe('CITIZEN');
    expect(me.body.data.card.cardNumber).toEqual(expect.any(String));
    expect(me.body.data.card.tier).toBe('NORMAL');
    expect(JSON.stringify(me.body)).not.toMatch(/nationalId/);
  });

  it('returns 401 when the token is missing', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/users/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('returns 401 when the token is invalid', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer not-a-jwt');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_INVALID_TOKEN');
  });

  it('returns 401 when the token is expired', async () => {
    const login = await postVerify(app, {
      nationalId: uniqueNationalId(),
      nafathCode: mockCode,
    });

    const token = login.body.data.accessToken as string;
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as { sub: string; role: string };

    const expired = sign(
      {
        sub: payload.sub,
        role: payload.role,
        iat: Math.floor(Date.now() / 1000) - 120,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      process.env.JWT_ACCESS_SECRET as string,
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${expired}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_INVALID_TOKEN');
  });

  it('rejects an invalid National ID', async () => {
    const response = await postVerify(app, {
      nationalId: '0999999991',
      nafathCode: mockCode,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('AUTH_INVALID_NATIONAL_ID');
    expect(JSON.stringify(response.body)).not.toContain('0999999991');
  });

  it('rejects an invalid Nafath challenge', async () => {
    const response = await postVerify(app, {
      nationalId: uniqueNationalId(),
      nafathCode: 11,
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_NAFATH_VERIFICATION_FAILED');
  });

  it('does not create a second User or JudicialCard on repeat login', async () => {
    const nationalId = uniqueNationalId();
    const ip = uniqueClientIp();

    await postVerify(app, { nationalId, nafathCode: mockCode }, ip).expect(200);
    await postVerify(app, { nationalId, nafathCode: mockCode }, ip).expect(200);

    const users = await prisma.user.findMany({ where: { nationalId } });
    expect(users).toHaveLength(1);

    const cards = await prisma.judicialCard.findMany({
      where: { userId: users[0].id },
    });
    expect(cards).toHaveLength(1);
  });

  it('does not create duplicates under concurrent first login', async () => {
    const nationalId = uniqueNationalId();
    const ip = uniqueClientIp();

    const [first, second] = await Promise.all([
      postVerify(app, { nationalId, nafathCode: mockCode }, ip),
      postVerify(app, { nationalId, nafathCode: mockCode }, ip),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const users = await prisma.user.findMany({ where: { nationalId } });
    expect(users).toHaveLength(1);

    const cards = await prisma.judicialCard.findMany({
      where: { userId: users[0].id },
    });
    expect(cards).toHaveLength(1);
  });

  it('resolves /users/me from the JWT subject, not from another user', async () => {
    const firstLogin = await postVerify(app, {
      nationalId: uniqueNationalId(),
      nafathCode: mockCode,
    });
    const secondLogin = await postVerify(app, {
      nationalId: uniqueNationalId(),
      nafathCode: mockCode,
    });

    const firstMe = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${firstLogin.body.data.accessToken}`);
    const secondMe = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${secondLogin.body.data.accessToken}`);

    expect(firstMe.status).toBe(200);
    expect(secondMe.status).toBe(200);
    expect(firstMe.body.data.id).not.toBe(secondMe.body.data.id);
    expect(firstMe.body.data.card.cardNumber).not.toBe(
      secondMe.body.data.card.cardNumber,
    );
  });

  it('records safe auth audit events without National ID or tokens', async () => {
    const nationalId = uniqueNationalId();
    const ip = uniqueClientIp();

    await postVerify(app, { nationalId, nafathCode: 11 }, ip);

    const login = await postVerify(
      app,
      { nationalId, nafathCode: mockCode },
      ip,
    );

    const userId = (
      JSON.parse(
        Buffer.from(
          (login.body.data.accessToken as string).split('.')[1],
          'base64url',
        ).toString('utf8'),
      ) as { sub: string }
    ).sub;

    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [{ resourceId: userId }, { action: 'AUTH_LOGIN_FAILED' }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    expect(logs.some((log) => log.action === 'AUTH_LOGIN_SUCCESS')).toBe(true);
    expect(logs.some((log) => log.action === 'AUTH_LOGIN_FAILED')).toBe(true);
    expect(JSON.stringify(logs)).not.toContain(nationalId);
    expect(JSON.stringify(logs)).not.toContain(login.body.data.accessToken);
  });

  it('rejects unknown fields on the verify body', async () => {
    const response = await postVerify(app, {
      nationalId: uniqueNationalId(),
      nafathCode: mockCode,
      extra: true,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('updates only allowed profile fields on PATCH /users/me', async () => {
    const login = await postVerify(app, {
      nationalId: uniqueNationalId(),
      nafathCode: mockCode,
    });

    const token = login.body.data.accessToken as string;
    const updated = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Citizen', role: 'ADMIN' });

    expect(updated.status).toBe(400);
    expect(updated.body.error.code).toBe('VALIDATION_ERROR');

    const allowed = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Citizen' });

    expect(allowed.status).toBe(200);
    expect(allowed.body.data.name).toBe('Updated Citizen');
    expect(allowed.body.data.role).toBe('CITIZEN');
  });

  it('enforces User and JudicialCard unique constraints', async () => {
    const nationalId = uniqueNationalId();
    const phone = `050${nationalId.slice(-7)}`;

    const user = await prisma.user.create({
      data: {
        nationalId,
        name: 'Constraint User',
        phone,
        role: 'CITIZEN',
      },
    });

    await expect(
      prisma.user.create({
        data: {
          nationalId,
          name: 'Duplicate',
          phone: `051${nationalId.slice(-7)}`,
          role: 'CITIZEN',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.judicialCard.create({
      data: {
        userId: user.id,
        cardNumber: `JC-TEST-${nationalId.slice(-6)}`,
        tier: 'NORMAL',
        discountPct: 0,
        validUntil: new Date('2031-01-01T00:00:00.000Z'),
        qrKeyId: 'qk_test_constraint',
      },
    });

    await expect(
      prisma.judicialCard.create({
        data: {
          userId: user.id,
          cardNumber: `JC-TEST-${nationalId.slice(-5)}X`,
          tier: 'NORMAL',
          discountPct: 0,
          validUntil: new Date('2031-01-01T00:00:00.000Z'),
          qrKeyId: 'qk_test_constraint_2',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rolls back user creation when the transaction fails', async () => {
    const nationalId = uniqueNationalId();

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            nationalId,
            name: 'Rollback User',
            phone: `050${nationalId.slice(-7)}`,
            role: 'CITIZEN',
          },
        });
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');

    await expect(
      prisma.user.findUnique({ where: { nationalId } }),
    ).resolves.toBeNull();
  });
});
