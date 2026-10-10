import { createHash, randomUUID } from 'crypto';
import { basename, extname } from 'path';

import {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_NAME_MAX_LENGTH,
  type AllowedMimeType,
} from '../types/documents.types';
import {
  documentFileInvalid,
  documentFileRequired,
  documentFileTooLarge,
  documentFileTypeNotAllowed,
} from '../errors/documents.errors';

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const MIME_BY_EXTENSION: Record<string, AllowedMimeType> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

export interface ValidatedUpload {
  buffer: Buffer;
  mimeType: AllowedMimeType;
  originalName: string;
  sizeBytes: number;
  checksum: string;
}

const startsWith = (buffer: Buffer, signature: Buffer): boolean =>
  buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);

export const detectSignatureMime = (buffer: Buffer): AllowedMimeType | null => {
  if (startsWith(buffer, PDF_SIGNATURE)) {
    return 'application/pdf';
  }
  if (startsWith(buffer, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  if (startsWith(buffer, PNG_SIGNATURE)) {
    return 'image/png';
  }
  return null;
};

export const normalizeOriginalName = (raw: string | undefined): string => {
  const base = basename((raw ?? '').replace(/\\/g, '/'))
    .replace(/[\r\n\0]/g, '')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .trim();
  const clipped = base.slice(0, DOCUMENT_NAME_MAX_LENGTH);
  return clipped.length > 0 ? clipped : 'document';
};

export const sha256 = (buffer: Buffer): string =>
  createHash('sha256').update(buffer).digest('hex');

export const createDocumentId = (): string => randomUUID();

export const buildStorageKey = (
  userId: string,
  caseId: string,
  documentId: string,
): string => `users/${userId}/cases/${caseId}/documents/${documentId}`;

export const validateUpload = (
  file: { buffer?: Buffer; size?: number; mimetype?: string; originalname?: string } | undefined,
): ValidatedUpload => {
  if (!file || !file.buffer) {
    throw documentFileRequired();
  }

  const buffer = file.buffer;
  if (buffer.length === 0) {
    throw documentFileRequired();
  }
  if (buffer.length > DOCUMENT_MAX_BYTES || (file.size ?? buffer.length) > DOCUMENT_MAX_BYTES) {
    throw documentFileTooLarge();
  }

  const originalName = normalizeOriginalName(file.originalname);
  const extension = extname(originalName).toLowerCase();
  const declaredMime = (file.mimetype ?? '').toLowerCase();
  const signatureMime = detectSignatureMime(buffer);

  if (!signatureMime) {
    throw documentFileInvalid();
  }

  const allowedExtensions: readonly string[] = ALLOWED_DOCUMENT_TYPES[signatureMime];
  if (!allowedExtensions.includes(extension)) {
    throw documentFileTypeNotAllowed();
  }

  const expectedFromExtension = MIME_BY_EXTENSION[extension];
  if (!expectedFromExtension || expectedFromExtension !== signatureMime) {
    throw documentFileTypeNotAllowed();
  }

  if (declaredMime && declaredMime !== signatureMime) {
    throw documentFileInvalid();
  }

  return {
    buffer,
    mimeType: signatureMime,
    originalName,
    sizeBytes: buffer.length,
    checksum: sha256(buffer),
  };
};

export const safeContentDisposition = (originalName: string): string => {
  const normalized = normalizeOriginalName(originalName);
  const ascii = normalized.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(normalized)}`;
};
