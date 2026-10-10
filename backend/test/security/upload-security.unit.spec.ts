/**
 * Phase V — file upload hardening (path traversal, MIME spoof, size).
 */

import {
  buildStorageKey,
  normalizeOriginalName,
  validateUpload,
} from '../../src/modules/documents/validators/document-file.validator';
import { DOCUMENT_MAX_BYTES } from '../../src/modules/documents/types/documents.types';

const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8');

describe('Phase V security — upload filename hardening', () => {
  it('strips path traversal and null bytes from original names', () => {
    expect(normalizeOriginalName('../../etc/passwd')).toBe('passwd');
    expect(normalizeOriginalName('..\\..\\windows\\system32\\config')).toBe('config');
    expect(normalizeOriginalName('evil\0.pdf')).toBe('evil.pdf');
    expect(normalizeOriginalName('a/b/c/report.pdf')).toBe('report.pdf');
  });

  it('builds storage keys from server UUIDs only (not client paths)', () => {
    const key = buildStorageKey('user-a', 'case-b', 'doc-c');
    expect(key).toBe('users/user-a/cases/case-b/documents/doc-c');
    expect(key).not.toContain('..');
  });
});

describe('Phase V security — upload content validation', () => {
  it('rejects MIME spoofing (PDF bytes declared as image/png)', () => {
    expect(() =>
      validateUpload({
        buffer: minimalPdf,
        size: minimalPdf.length,
        mimetype: 'image/png',
        originalname: 'scan.pdf',
      }),
    ).toThrow();
  });

  it('rejects extension mismatch (PDF bytes named .png)', () => {
    expect(() =>
      validateUpload({
        buffer: minimalPdf,
        size: minimalPdf.length,
        mimetype: 'application/pdf',
        originalname: 'scan.png',
      }),
    ).toThrow();
  });

  it('rejects oversized uploads', () => {
    const oversized = Buffer.alloc(DOCUMENT_MAX_BYTES + 1, 0x20);
    oversized.write('%PDF-', 0);
    expect(() =>
      validateUpload({
        buffer: oversized,
        size: oversized.length,
        mimetype: 'application/pdf',
        originalname: 'huge.pdf',
      }),
    ).toThrow();
  });

  it('accepts a valid small PDF', () => {
    const result = validateUpload({
      buffer: minimalPdf,
      size: minimalPdf.length,
      mimetype: 'application/pdf',
      originalname: 'ok.pdf',
    });
    expect(result.mimeType).toBe('application/pdf');
    expect(result.originalName).toBe('ok.pdf');
  });
});
