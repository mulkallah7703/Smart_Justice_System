import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/shared/database/prisma.service';
import { createTestingApp } from './create-app';

describe('Password auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const unique = `pw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `${unique}-a@example.com`;
  const emailB = `${unique}-b@example.com`;
  const password = 'password12';
  const caseNumber = `PW-CASE-${unique}`;

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: [emailA, emailB] } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    if (ids.length > 0) {
      await prisma.case.deleteMany({ where: { userId: { in: ids } } });
      await prisma.judicialCard.deleteMany({ where: { userId: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app.close();
  });

  it('registers, logs in, and scopes cases to the JWT subject', async () => {
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Citizen A', email: emailA, password })
      .expect(201);

    expect(register.body.data).toEqual(
      expect.objectContaining({
        name: 'Citizen A',
        email: emailA,
      }),
    );
    expect(register.body.data).not.toHaveProperty('password');
    expect(register.body.data).not.toHaveProperty('passwordHash');
    expect(register.body.data).not.toHaveProperty('nationalId');

    const dbUser = await prisma.user.findUnique({ where: { email: emailA } });
    expect(dbUser?.passwordHash).toBeTruthy();
    expect(dbUser?.role).toBe('CITIZEN');
    expect(dbUser?.nationalId).toBeNull();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailA, password })
      .expect(200);

    const token = login.body.data.accessToken as string;
    expect(token).toEqual(expect.any(String));

    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(me.body.data.id).toBe(register.body.data.id);
    expect(me.body.data).not.toHaveProperty('nationalId');
    expect(me.body.data).not.toHaveProperty('passwordHash');

    await prisma.case.create({
      data: {
        caseNumber,
        type: 'RENTAL',
        status: 'ACTIVE',
        authority: 'E2E Court',
        userId: register.body.data.id,
      },
    });

    const cases = await request(app.getHttpServer())
      .get('/api/v1/cases')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      cases.body.data.some(
        (row: { caseNumber?: string }) => row.caseNumber === caseNumber,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Citizen B', email: emailB, password })
      .expect(201);

    const loginB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailB, password })
      .expect(200);

    const casesB = await request(app.getHttpServer())
      .get('/api/v1/cases')
      .set('Authorization', `Bearer ${loginB.body.data.accessToken}`)
      .expect(200);

    const foreignCase = casesB.body.data.find(
      (row: { caseNumber?: string }) => row.caseNumber === caseNumber,
    );
    expect(foreignCase).toBeUndefined();
  });

  it('rejects duplicate email, weak password, and forged registration fields', async () => {
    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Dup', email: emailA, password })
      .expect(201);

    expect(duplicate.body.data.email).toBe(emailA);
    expect(duplicate.body.data.id).toEqual(expect.any(String));
    // Anti-enumeration: success shape must not reveal AUTH_EMAIL_ALREADY_EXISTS.
    expect(duplicate.body.error).toBeUndefined();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Weak',
        email: `${unique}-weak@example.com`,
        password: 'short',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Forge',
        email: `${unique}-forge@example.com`,
        password,
        role: 'ADMIN',
        userId: 'forged',
        nationalId: '1999999991',
      })
      .expect(400);
  });

  it('rejects invalid credentials without revealing which field failed', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailA, password: 'wrong-password' })
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `${unique}-missing@example.com`, password })
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
      });
  });

  it('rejects missing JWT on protected routes', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });
});
