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

describe('Kiosk (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let ownerId: string;
  let strangerToken: string;
  let strangerId: string;
  let devicePublicId: string;
  let ownDocumentId: string;
  let foreignDocumentId: string;

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);

    devicePublicId = `kiosk-e2e-${Date.now()}`;
    await prisma.kioskDevice.create({
      data: {
        deviceId: devicePublicId,
        name: 'E2E kiosk',
        status: 'ACTIVE',
      },
    });

    const ownerLogin = await login(app, uniqueNationalId());
    const strangerLogin = await login(app, uniqueNationalId());
    ownerToken = ownerLogin.body.data.accessToken as string;
    strangerToken = strangerLogin.body.data.accessToken as string;
    ownerId = JSON.parse(
      Buffer.from(ownerToken.split('.')[1], 'base64url').toString('utf8'),
    ).sub as string;
    strangerId = JSON.parse(
      Buffer.from(strangerToken.split('.')[1], 'base64url').toString('utf8'),
    ).sub as string;

    const ownDoc = await prisma.document.create({
      data: {
        userId: ownerId,
        originalName: 'e2e-kiosk.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 128,
        checksum: 'sha256:e2e-kiosk-own',
        storageKey: `e2e/kiosk/${Date.now()}-own.pdf`,
        status: 'UPLOADED',
      },
    });
    ownDocumentId = ownDoc.id;

    const foreignDoc = await prisma.document.create({
      data: {
        userId: strangerId,
        originalName: 'e2e-kiosk-foreign.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 128,
        checksum: 'sha256:e2e-kiosk-foreign',
        storageKey: `e2e/kiosk/${Date.now()}-foreign.pdf`,
        status: 'UPLOADED',
      },
    });
    foreignDocumentId = foreignDoc.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated session start with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/kiosk/session/start')
      .send({ deviceId: devicePublicId });

    expect(response.status).toBe(401);
  });

  it('starts a session, scans, and prints an owned document', async () => {
    const started = await request(app.getHttpServer())
      .post('/api/v1/kiosk/session/start')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deviceId: devicePublicId });

    expect(started.status).toBe(201);
    expect(started.body.data).toEqual({
      sessionId: expect.any(String),
      deviceId: devicePublicId,
    });
    expect(JSON.stringify(started.body)).not.toMatch(/userId|nationalId/);

    const sessionId = started.body.data.sessionId as string;

    const scanned = await request(app.getHttpServer())
      .post('/api/v1/kiosk/scan')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sessionId, mode: 'qr' });

    expect(scanned.status).toBe(201);
    expect(scanned.body.data.success).toBe(true);
    expect(typeof scanned.body.data.fileId).toBe('string');

    const printed = await request(app.getHttpServer())
      .post('/api/v1/kiosk/print')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sessionId, documentId: ownDocumentId });

    expect(printed.status).toBe(201);
    expect(printed.body.data).toEqual({ success: true });
  });

  it('returns the same 404 for foreign and nonexistent sessions', async () => {
    const ownerSession = await request(app.getHttpServer())
      .post('/api/v1/kiosk/session/start')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deviceId: devicePublicId });

    const sessionId = ownerSession.body.data.sessionId as string;

    const foreign = await request(app.getHttpServer())
      .post('/api/v1/kiosk/scan')
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ sessionId, mode: 'card' });

    const missing = await request(app.getHttpServer())
      .post('/api/v1/kiosk/scan')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sessionId: 'does-not-exist', mode: 'card' });

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body.error.code).toBe('KIOSK_SESSION_NOT_FOUND');
    expect(missing.body.error.code).toBe('KIOSK_SESSION_NOT_FOUND');
  });

  it('rejects printing a foreign document with a safe 404', async () => {
    const started = await request(app.getHttpServer())
      .post('/api/v1/kiosk/session/start')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deviceId: devicePublicId });

    const response = await request(app.getHttpServer())
      .post('/api/v1/kiosk/print')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sessionId: started.body.data.sessionId,
        documentId: foreignDocumentId,
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('KIOSK_DOCUMENT_NOT_FOUND');
  });

  it('rejects invalid payloads and unexpected userId', async () => {
    const badDevice = await request(app.getHttpServer())
      .post('/api/v1/kiosk/session/start')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deviceId: 'bad device!' });

    const withUserId = await request(app.getHttpServer())
      .post('/api/v1/kiosk/session/start')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deviceId: devicePublicId, userId: strangerId });

    expect(badDevice.status).toBe(400);
    expect(withUserId.status).toBe(400);
  });
});
