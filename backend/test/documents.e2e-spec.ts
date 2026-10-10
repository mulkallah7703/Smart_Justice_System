import { createHash } from 'crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/shared/database/prisma.service';
import { OBJECT_STORAGE } from '../src/modules/documents/storage/object-storage.interface';
import type { ObjectStorage } from '../src/modules/documents/storage/object-storage.interface';
import { createTestingApp } from './create-app';

const mockCode = Number(process.env.MOCK_NAFATH_CODE ?? '72');

const pdfBytes = (): Buffer =>
  Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n');

const jpegBytes = (): Buffer =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(24, 1)]);

const pngBytes = (): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(24, 2),
  ]);

const uniqueNationalId = (): string => {
  const tail = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
  return `1${tail}`;
};

const login = (app: INestApplication, nationalId: string) =>
  request(app.getHttpServer())
    .post('/api/v1/auth/nafath/verify')
    .set('X-Forwarded-For', `198.51.100.${Math.floor(Math.random() * 200) + 1}`)
    .send({ nationalId, nafathCode: mockCode });

describe('Documents (e2e)', () => {
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
        caseNumber: `DOC-E2E-${Date.now()}-A`,
        type: 'RENTAL',
        status: 'ACTIVE',
        userId: ownerId,
      },
    });
    ownCaseId = ownCase.id;

    const otherCase = await prisma.case.create({
      data: {
        caseNumber: `DOC-E2E-${Date.now()}-B`,
        type: 'COMMERCIAL',
        status: 'ACTIVE',
        userId: strangerId,
      },
    });
    otherCaseId = otherCase.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('uploads a PDF, lists it, returns detail, and downloads the same bytes', async () => {
    const bytes = pdfBytes();
    const upload = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('caseId', ownCaseId)
      .attach('file', bytes, { filename: 'lease.pdf', contentType: 'application/pdf' });

    expect(upload.status).toBe(201);
    expect(upload.body.data.id).toEqual(expect.any(String));
    expect(upload.body.data.caseId).toBe(ownCaseId);
    expect(upload.body.data.mimeType).toBe('application/pdf');
    expect(upload.body.data.isAnalyzed).toBe(false);
    expect(upload.body.data.status).toBe('UPLOADED');
    expect(upload.body.data).not.toHaveProperty('storageKey');
    expect(upload.body.data).not.toHaveProperty('userId');
    expect(upload.body.data).not.toHaveProperty('checksum');

    const documentId = upload.body.data.id as string;
    const stored = await prisma.document.findUnique({ where: { id: documentId } });
    expect(stored?.checksum).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(stored?.userId).toBe(ownerId);

    const list = await request(app.getHttpServer())
      .get('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((item: { id: string }) => item.id === documentId)).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/documents/${documentId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.originalName).toBe('lease.pdf');

    const download = await request(app.getHttpServer())
      .get(`/api/v1/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toMatch(/application\/pdf/);
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(download.body)).toEqual(bytes);
  });

  it('uploads JPEG and PNG', async () => {
    const jpeg = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('caseId', ownCaseId)
      .attach('file', jpegBytes(), { filename: 'scan.jpg', contentType: 'image/jpeg' });
    expect(jpeg.status).toBe(201);

    const png = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('caseId', ownCaseId)
      .attach('file', pngBytes(), { filename: 'scan.png', contentType: 'image/png' });
    expect(png.status).toBe(201);
  });

  it('keeps a path-traversal filename off the storage key', async () => {
    const upload = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('caseId', ownCaseId)
      .attach('file', pdfBytes(), {
        filename: '../../secret.pdf',
        contentType: 'application/pdf',
      });
    expect(upload.status).toBe(201);
    const stored = await prisma.document.findUnique({
      where: { id: upload.body.data.id as string },
    });
    expect(stored?.originalName).toBe('secret.pdf');
    expect(stored?.storageKey).toContain(`users/${ownerId}/cases/${ownCaseId}/documents/`);
    expect(stored?.storageKey).not.toContain('..');
  });

  it('does not list or download another user document (IDOR)', async () => {
    const strangerUpload = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${strangerToken}`)
      .field('caseId', otherCaseId)
      .attach('file', pdfBytes(), { filename: 'other.pdf', contentType: 'application/pdf' });
    expect(strangerUpload.status).toBe(201);
    const otherDocId = strangerUpload.body.data.id as string;

    const list = await request(app.getHttpServer())
      .get('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.body.data.some((item: { id: string }) => item.id === otherDocId)).toBe(false);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/documents/${otherDocId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe('DOCUMENT_NOT_FOUND');

    const download = await request(app.getHttpServer())
      .get(`/api/v1/documents/${otherDocId}/download`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(download.status).toBe(404);
    expect(download.body.error.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it('rejects upload to another user case', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('caseId', otherCaseId)
      .attach('file', pdfBytes(), { filename: 'lease.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('DOCUMENT_CASE_NOT_FOUND');
  });

  it('rejects an unexpected userId field', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('caseId', ownCaseId)
      .field('userId', ownerId)
      .attach('file', pdfBytes(), { filename: 'lease.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(400);
  });

  it('rejects an invalid file', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('caseId', ownCaseId)
      .attach('file', Buffer.from('MZ executable'), {
        filename: 'malware.pdf',
        contentType: 'application/pdf',
      });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('DOCUMENT_FILE_INVALID');
  });

  it('rejects an oversized file', async () => {
    const huge = Buffer.concat([pdfBytes(), Buffer.alloc(10 * 1024 * 1024)]);
    const response = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('caseId', ownCaseId)
      .attach('file', huge, { filename: 'huge.pdf', contentType: 'application/pdf' });
    expect([400, 413]).toContain(response.status);
    expect(response.body.error.code).toBe('DOCUMENT_FILE_TOO_LARGE');
  });

  it('requires a JWT', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/documents');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('returns a controlled error when object storage fails', async () => {
    const storage = app.get<ObjectStorage>(OBJECT_STORAGE);
    const original = storage.putObject.bind(storage);
    storage.putObject = async () => {
      throw Object.assign(new Error('minio down'), { name: 'TimeoutError' });
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('caseId', ownCaseId)
      .attach('file', pdfBytes(), { filename: 'lease.pdf', contentType: 'application/pdf' });

    storage.putObject = original;
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DOCUMENT_STORAGE_ERROR');
    expect(JSON.stringify(response.body)).not.toMatch(/minio|s3_minio|9000/i);
  });
});
