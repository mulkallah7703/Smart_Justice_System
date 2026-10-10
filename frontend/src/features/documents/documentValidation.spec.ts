import { describe, expect, it } from 'vitest';

import {
  MAX_DOCUMENT_BYTES,
  validateDocumentFile,
} from './documentValidation';

const fileOf = (name: string, type: string, size: number): File => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('validateDocumentFile', () => {
  it('uses the backend limit of 10 binary megabytes', () => {
    expect(MAX_DOCUMENT_BYTES).toBe(10 * 1024 * 1024);
  });

  it('accepts PDF, JPEG, and PNG within the limit', () => {
    expect(
      validateDocumentFile(fileOf('lease.pdf', 'application/pdf', 1024)),
    ).toBeNull();
    expect(
      validateDocumentFile(fileOf('scan.jpg', 'image/jpeg', 1024)),
    ).toBeNull();
    expect(
      validateDocumentFile(fileOf('scan.jpeg', 'image/jpeg', 1024)),
    ).toBeNull();
    expect(
      validateDocumentFile(fileOf('scan.png', 'image/png', MAX_DOCUMENT_BYTES)),
    ).toBeNull();
  });

  it('rejects files above the limit', () => {
    expect(
      validateDocumentFile(
        fileOf('huge.pdf', 'application/pdf', MAX_DOCUMENT_BYTES + 1),
      ),
    ).toBe('DOCUMENT_FILE_TOO_LARGE');
  });

  it('rejects unsupported extensions and MIME types', () => {
    expect(
      validateDocumentFile(fileOf('notes.docx', 'application/pdf', 1024)),
    ).toBe('DOCUMENT_FILE_TYPE_NOT_ALLOWED');
    expect(
      validateDocumentFile(fileOf('lease.pdf', 'application/x-msdownload', 1024)),
    ).toBe('DOCUMENT_FILE_TYPE_NOT_ALLOWED');
  });

  it('rejects missing and empty files', () => {
    expect(validateDocumentFile(undefined)).toBe('DOCUMENT_FILE_REQUIRED');
    expect(
      validateDocumentFile(fileOf('empty.pdf', 'application/pdf', 0)),
    ).toBe('DOCUMENT_FILE_REQUIRED');
  });

  it('lets the backend decide when the browser reports no MIME type', () => {
    expect(validateDocumentFile(fileOf('lease.pdf', '', 1024))).toBeNull();
  });
});
