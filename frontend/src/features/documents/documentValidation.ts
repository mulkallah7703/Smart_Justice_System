/**
 * Client-side mirror of the backend allowlist. This is UX only: the backend
 * re-validates extension, MIME type, magic bytes, and size, and stays
 * authoritative.
 */
export const MAX_DOCUMENT_SIZE_MB = 10;
export const MAX_DOCUMENT_BYTES = MAX_DOCUMENT_SIZE_MB * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
] as const;

export const DOCUMENT_ACCEPT_ATTRIBUTE = [
  ...ALLOWED_DOCUMENT_EXTENSIONS,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
].join(',');

export type DocumentValidationCode =
  | 'DOCUMENT_FILE_REQUIRED'
  | 'DOCUMENT_FILE_TYPE_NOT_ALLOWED'
  | 'DOCUMENT_FILE_TOO_LARGE';

const extensionOf = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
};

const isAllowedExtension = (fileName: string): boolean =>
  (ALLOWED_DOCUMENT_EXTENSIONS as readonly string[]).includes(
    extensionOf(fileName),
  );

const isAllowedMimeType = (mimeType: string): boolean =>
  (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(
    mimeType.toLowerCase(),
  );

export const validateDocumentFile = (
  file: File | null | undefined,
): DocumentValidationCode | null => {
  if (!file || file.size === 0) {
    return 'DOCUMENT_FILE_REQUIRED';
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return 'DOCUMENT_FILE_TOO_LARGE';
  }

  if (!isAllowedExtension(file.name)) {
    return 'DOCUMENT_FILE_TYPE_NOT_ALLOWED';
  }

  // Browser-reported MIME is a hint only; an empty value is left to the backend.
  if (file.type && !isAllowedMimeType(file.type)) {
    return 'DOCUMENT_FILE_TYPE_NOT_ALLOWED';
  }

  return null;
};
