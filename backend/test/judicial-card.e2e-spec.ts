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

describe('Judicial Card (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let strangerToken: string;
  let ownerCardNumber: string;

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);

    const ownerLogin = await login(app, uniqueNationalId());
    const strangerLogin = await login(app, uniqueNationalId());
    ownerToken = ownerLogin.body.data.accessToken as string;
    strangerToken = strangerLogin.body.data.accessToken as string;

    const ownerId = JSON.parse(
      Buffer.from(ownerToken.split('.')[1], 'base64url').toString('utf8'),
    ).sub as string;

    const card = await prisma.judicialCard.findUnique({
      where: { userId: ownerId },
      select: { cardNumber: true },
    });
    ownerCardNumber = card?.cardNumber ?? '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access with 401', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/judicial-card',
    );
    expect(response.status).toBe(401);
  });

  it('returns the authenticated user card without sensitive fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/judicial-card')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.cardNumber).toBe(ownerCardNumber);
    expect(response.body.data.holderName).toEqual(expect.any(String));
    expect(response.body.data.tier).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toMatch(
      /userId|nationalId|qrKeyId|accessToken/,
    );
  });

  it('returns an opaque QR payload without JWT or nationalId', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/judicial-card/qr')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.payload).toMatch(/^sjc:v1:/);
    expect(response.body.data.expiresAt).toEqual(expect.any(String));
    expect(String(response.body.data.payload).toLowerCase()).not.toContain(
      'bearer',
    );
    expect(String(response.body.data.payload)).not.toMatch(/national/i);
  });

  it('does not expose another user card through the owner-scoped endpoint', async () => {
    const owner = await request(app.getHttpServer())
      .get('/api/v1/judicial-card')
      .set('Authorization', `Bearer ${ownerToken}`);
    const stranger = await request(app.getHttpServer())
      .get('/api/v1/judicial-card')
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(owner.status).toBe(200);
    expect(stranger.status).toBe(200);
    expect(owner.body.data.cardNumber).not.toBe(stranger.body.data.cardNumber);
  });

  it('rejects upgrade with payment-deferred unavailable code', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/judicial-card/upgrade')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ tier: 'GOLD' });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe(
      'JUDICIAL_CARD_UPGRADE_UNAVAILABLE',
    );
  });

  it('rejects unexpected userId on upgrade', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/judicial-card/upgrade')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ tier: 'GOLD', userId: 'someone-else' });

    expect(response.status).toBe(400);
  });
});
