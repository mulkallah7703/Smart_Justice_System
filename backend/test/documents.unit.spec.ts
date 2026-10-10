import { DocumentStatus } from '@prisma/client';

import { DOCUMENT_MAX_BYTES } from '../src/modules/documents/types/documents.types';
import { mapDocument } from '../src/modules/documents/mappers/document.mapper';
import { DocumentsService } from '../src/modules/documents/documents.service';
import { DocumentUploadRateLimitGuard } from '../src/modules/documents/guards/document-upload-rate-limit.guard';
import { PrismaService } from '../src/shared/database/prisma.service';
import { RedisService } from '../src/shared/cache/redis.service';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../src/config/env.validation';
import { ExecutionContext } from '@nestjs/common';
import {
  buildStorageKey,
  createDocumentId,
  detectSignatureMime,
  normalizeOriginalName,
  safeContentDisposition,
  sha256,
  validateUpload,
} from '../src/modules/documents/validators/document-file.validator';

const pdfBytes = (): Buffer =>
  Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n');

export const jpegBytes = (): Buffer =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(24, 1)]);

export const pngBytes = (): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(24, 2),
  ]);

const expectUploadCode = (
  file: Parameters<typeof validateUpload>[0],
  code: string,
): void => {
  try {
    validateUpload(file);
    throw new Error(`expected ${code}`);
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
};

describe('document file validation', () => {
  it('accepts PDF, JPEG, and PNG signatures', () => {
    expect(detectSignatureMime(pdfBytes())).toBe('application/pdf');
    expect(detectSignatureMime(jpegBytes())).toBe('image/jpeg');
    expect(detectSignatureMime(pngBytes())).toBe('image/png');
    expect(
      validateUpload({
        buffer: pdfBytes(),
        mimetype: 'application/pdf',
        originalname: 'lease.pdf',
      }).mimeType,
    ).toBe('application/pdf');
  });

  it('rejects an executable renamed as PDF', () => {
    expectUploadCode(
      {
        buffer: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(32)]),
        mimetype: 'application/pdf',
        originalname: 'malware.pdf',
      },
      'DOCUMENT_FILE_INVALID',
    );
  });

  it('rejects mismatched MIME and signature', () => {
    expectUploadCode(
      {
        buffer: pngBytes(),
        mimetype: 'application/pdf',
        originalname: 'scan.png',
      },
      'DOCUMENT_FILE_INVALID',
    );
  });

  it('rejects an invalid extension', () => {
    expectUploadCode(
      {
        buffer: pdfBytes(),
        mimetype: 'application/pdf',
        originalname: 'lease.exe',
      },
      'DOCUMENT_FILE_TYPE_NOT_ALLOWED',
    );
  });

  it('rejects empty files', () => {
    expectUploadCode(
      {
        buffer: Buffer.alloc(0),
        mimetype: 'application/pdf',
        originalname: 'empty.pdf',
      },
      'DOCUMENT_FILE_REQUIRED',
    );
  });

  it('rejects missing files', () => {
    expectUploadCode(undefined, 'DOCUMENT_FILE_REQUIRED');
  });

  it('rejects oversized files', () => {
    expectUploadCode(
      {
        buffer: Buffer.concat([pdfBytes(), Buffer.alloc(DOCUMENT_MAX_BYTES)]),
        mimetype: 'application/pdf',
        originalname: 'huge.pdf',
      },
      'DOCUMENT_FILE_TOO_LARGE',
    );
  });
});

describe('filename and storage key', () => {
  it('strips path traversal from original names', () => {
    expect(normalizeOriginalName('../../secret.pdf')).toBe('secret.pdf');
    expect(normalizeOriginalName('..\\..\\secret.pdf')).toBe('secret.pdf');
    expect(normalizeOriginalName('/etc/passwd')).toBe('passwd');
  });

  it('does not use the original filename as the storage key', () => {
    const key = buildStorageKey('user-a', 'case-b', 'doc-c');
    expect(key).toBe('users/user-a/cases/case-b/documents/doc-c');
    expect(key).not.toContain('..');
    expect(createDocumentId()).toEqual(expect.any(String));
  });

  it('sanitizes Content-Disposition filenames', () => {
    const header = safeContentDisposition('report\r\n.pdf');
    expect(header).toContain('attachment;');
    expect(header).not.toMatch(/\r|\n/);
  });

  it('computes a SHA-256 checksum', () => {
    const bytes = pdfBytes();
    expect(sha256(bytes)).toHaveLength(64);
    expect(sha256(bytes)).toBe(sha256(bytes));
  });
});

describe('document mapper', () => {
  it('maps metadata without storage internals', () => {
    const mapped = mapDocument({
      id: 'doc_1',
      caseId: 'case_1',
      originalName: 'lease.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 128,
      status: DocumentStatus.UPLOADED,
      isAnalyzed: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(mapped).toEqual({
      id: 'doc_1',
      caseId: 'case_1',
      originalName: 'lease.pdf',
      mimeType: 'application/pdf',
      size: 128,
      status: 'UPLOADED',
      isAnalyzed: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(mapped).not.toHaveProperty('storageKey');
    expect(mapped).not.toHaveProperty('userId');
    expect(mapped).not.toHaveProperty('checksum');
    expect(mapped).not.toHaveProperty('deletedAt');
  });
});

describe('DocumentsService', () => {
  const storage = {
    putObject: jest.fn(),
    getObject: jest.fn(),
    deleteObject: jest.fn(),
    ping: jest.fn().mockResolvedValue(true),
  };

  const prisma = {
    case: { findFirst: jest.fn() },
    document: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const service = new DocumentsService(
    prisma as unknown as PrismaService,
    storage,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('uploads after ownership check and stores metadata', async () => {
    prisma.case.findFirst.mockResolvedValue({ id: 'case-a' });
    storage.putObject.mockResolvedValue(undefined);
    prisma.document.create.mockImplementation(({ data }) =>
      Promise.resolve({
        ...data,
        isAnalyzed: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );

    const result = await service.upload('user-a', 'case-a', {
      buffer: pdfBytes(),
      mimetype: 'application/pdf',
      originalname: 'lease.pdf',
    });

    expect(prisma.case.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-a', userId: 'user-a', deletedAt: null },
      }),
    );
    expect(storage.putObject).toHaveBeenCalled();
    expect(result.mimeType).toBe('application/pdf');
    expect(result.isAnalyzed).toBe(false);
    expect(result.status).toBe('UPLOADED');
    expect(result).not.toHaveProperty('storageKey');
  });

  it('rejects upload to another user case', async () => {
    prisma.case.findFirst.mockResolvedValue(null);
    await expect(
      service.upload('user-a', 'case-b', {
        buffer: pdfBytes(),
        mimetype: 'application/pdf',
        originalname: 'lease.pdf',
      }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_CASE_NOT_FOUND' });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('cleans up storage when metadata creation fails', async () => {
    prisma.case.findFirst.mockResolvedValue({ id: 'case-a' });
    storage.putObject.mockResolvedValue(undefined);
    prisma.document.create.mockRejectedValue(new Error('db down'));
    storage.deleteObject.mockResolvedValue(undefined);

    await expect(
      service.upload('user-a', 'case-a', {
        buffer: pdfBytes(),
        mimetype: 'application/pdf',
        originalname: 'lease.pdf',
      }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_STORAGE_ERROR' });
    expect(storage.deleteObject).toHaveBeenCalled();
  });

  it('looks up detail with ownership in the query', async () => {
    prisma.document.findFirst.mockResolvedValue(null);
    await expect(service.getById('user-a', 'doc-b')).rejects.toMatchObject({
      code: 'DOCUMENT_NOT_FOUND',
    });
    expect(prisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-b', userId: 'user-a', deletedAt: null },
      }),
    );
  });

  it('does not download until ownership is confirmed', async () => {
    prisma.document.findFirst.mockResolvedValue(null);
    await expect(service.download('user-a', 'doc-b')).rejects.toMatchObject({
      code: 'DOCUMENT_NOT_FOUND',
    });
    expect(storage.getObject).not.toHaveBeenCalled();
  });
});

describe('DocumentUploadRateLimitGuard', () => {
  const redis = { incrementWithTtl: jest.fn() };
  const config = {
    get: () => ({ maxAttempts: 20, windowSeconds: 900 }),
  } as unknown as ConfigService<AppConfig, true>;
  const guard = new DocumentUploadRateLimitGuard(
    redis as unknown as RedisService,
    config,
  );

  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'user-a' } }),
    }),
  } as unknown as ExecutionContext;

  it('allows uploads under the limit', async () => {
    redis.incrementWithTtl.mockResolvedValue(1);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('blocks uploads over the limit', async () => {
    redis.incrementWithTtl.mockResolvedValue(21);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'DOCUMENT_RATE_LIMITED',
    });
  });

  it('fails closed when Redis is unavailable', async () => {
    redis.incrementWithTtl.mockRejectedValue(new Error('redis down'));
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'DOCUMENT_RATE_LIMITED',
    });
  });
});
