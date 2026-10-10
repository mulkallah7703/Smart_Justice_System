import { describe, expect, it } from 'vitest';

import { ar } from '../../core/i18n/ar';
import {
  ApiError,
  getUserFacingAuthError,
  getUserFacingCaseError,
  getUserFacingDocumentError,
} from './errors';

describe('auth error mapping', () => {
  it('maps known backend codes to Arabic UI messages', () => {
    expect(
      getUserFacingAuthError(new ApiError('AUTH_INVALID_NATIONAL_ID', 'x', 400)),
    ).toBe(ar.nafath.errors.invalidNationalId);
    expect(
      getUserFacingAuthError(
        new ApiError('AUTH_NAFATH_VERIFICATION_FAILED', 'x', 401),
      ),
    ).toBe(ar.nafath.errors.verificationFailed);
    expect(
      getUserFacingAuthError(new ApiError('AUTH_RATE_LIMITED', 'x', 429)),
    ).toBe(ar.auth.errors.rateLimited);
    expect(
      getUserFacingAuthError(new ApiError('AUTH_INVALID_CREDENTIALS', 'x', 401)),
    ).toBe(ar.auth.errors.invalidCredentials);
  });

  it('falls back to the generic auth message', () => {
    expect(getUserFacingAuthError(new Error('nope'))).toBe(ar.auth.errors.generic);
  });
});

describe('case error mapping', () => {
  it('maps CASE_NOT_FOUND without revealing ownership', () => {
    expect(
      getUserFacingCaseError(new ApiError('CASE_NOT_FOUND', 'The case was not found', 404)),
    ).toBe(ar.legalFile.notFound.title);
    expect(
      getUserFacingCaseError(new ApiError('CASE_NOT_FOUND', 'The case was not found', 404)),
    ).not.toMatch(/another user|belongs/i);
  });

  it('maps validation and unauthorized case errors', () => {
    expect(
      getUserFacingCaseError(new ApiError('VALIDATION_ERROR', 'x', 400)),
    ).toBe(ar.legalFile.createCase.validation);
    expect(
      getUserFacingCaseError(new ApiError('AUTH_UNAUTHORIZED', 'x', 401)),
    ).toBe(ar.nafath.errors.unauthorized);
  });
});

describe('document error mapping', () => {
  it('maps document backend codes to Arabic messages', () => {
    expect(
      getUserFacingDocumentError(
        new ApiError('DOCUMENT_FILE_TYPE_NOT_ALLOWED', 'x', 400),
      ),
    ).toBe(ar.documents.errors.typeNotAllowed);
    expect(
      getUserFacingDocumentError(new ApiError('DOCUMENT_FILE_TOO_LARGE', 'x', 413)),
    ).toBe(ar.documents.errors.tooLarge);
    expect(
      getUserFacingDocumentError(new ApiError('DOCUMENT_FILE_INVALID', 'x', 400)),
    ).toBe(ar.documents.errors.invalid);
    expect(
      getUserFacingDocumentError(new ApiError('DOCUMENT_STORAGE_ERROR', 'x', 503)),
    ).toBe(ar.documents.errors.storage);
    expect(
      getUserFacingDocumentError(new ApiError('DOCUMENT_RATE_LIMITED', 'x', 429)),
    ).toBe(ar.documents.errors.rateLimited);
  });

  it('does not reveal ownership for a missing document or case', () => {
    const notFound = getUserFacingDocumentError(
      new ApiError('DOCUMENT_NOT_FOUND', 'x', 404),
    );
    const caseNotFound = getUserFacingDocumentError(
      new ApiError('DOCUMENT_CASE_NOT_FOUND', 'x', 404),
    );

    expect(notFound).toBe(ar.documents.errors.notFound);
    expect(caseNotFound).toBe(ar.documents.errors.caseNotFound);
    expect(`${notFound} ${caseNotFound}`).not.toMatch(/مستخدم آخر/);
  });

  it('never leaks storage internals in the fallback message', () => {
    const message = getUserFacingDocumentError(new Error('minio://bucket/key'));
    expect(message).toBe(ar.documents.errors.generic);
    expect(message).not.toMatch(/minio|s3|bucket/i);
  });
});
