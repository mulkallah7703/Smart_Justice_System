import { ar } from '../../core/i18n/ar';

import type { ApiErrorEnvelope } from './types';

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const AUTH_MESSAGES: Record<string, string> = {
  AUTH_INVALID_NATIONAL_ID: ar.nafath.errors.invalidNationalId,
  AUTH_NAFATH_VERIFICATION_FAILED: ar.nafath.errors.verificationFailed,
  AUTH_NAFATH_PROVIDER_UNAVAILABLE: ar.nafath.errors.verificationFailed,
  AUTH_EMAIL_ALREADY_EXISTS: ar.auth.errors.emailExists,
  AUTH_INVALID_CREDENTIALS: ar.auth.errors.invalidCredentials,
  AUTH_WEAK_PASSWORD: ar.auth.errors.weakPassword,
  AUTH_RATE_LIMITED: ar.auth.errors.rateLimited,
  AUTH_UNAUTHORIZED: ar.auth.errors.unauthorized,
  AUTH_INVALID_TOKEN: ar.auth.errors.invalidToken,
  USER_NOT_FOUND: ar.nafath.errors.userNotFound,
  VALIDATION_ERROR: ar.auth.errors.validation,
  TIMEOUT: ar.auth.errors.timeout,
  NETWORK_ERROR: ar.auth.errors.network,
};

const CASE_MESSAGES: Record<string, string> = {
  CASE_NOT_FOUND: ar.legalFile.notFound.title,
  CASE_RATE_LIMITED: ar.legalFile.createCase.rateLimited,
  VALIDATION_ERROR: ar.legalFile.createCase.validation,
  AUTH_UNAUTHORIZED: ar.nafath.errors.unauthorized,
  AUTH_INVALID_TOKEN: ar.nafath.errors.invalidToken,
};

const DOCUMENT_MESSAGES: Record<string, string> = {
  DOCUMENT_FILE_REQUIRED: ar.documents.errors.required,
  DOCUMENT_FILE_TYPE_NOT_ALLOWED: ar.documents.errors.typeNotAllowed,
  DOCUMENT_FILE_TOO_LARGE: ar.documents.errors.tooLarge,
  DOCUMENT_FILE_INVALID: ar.documents.errors.invalid,
  DOCUMENT_CASE_NOT_FOUND: ar.documents.errors.caseNotFound,
  DOCUMENT_NOT_FOUND: ar.documents.errors.notFound,
  DOCUMENT_STORAGE_ERROR: ar.documents.errors.storage,
  DOCUMENT_RATE_LIMITED: ar.documents.errors.rateLimited,
  AUTH_UNAUTHORIZED: ar.nafath.errors.unauthorized,
  AUTH_INVALID_TOKEN: ar.nafath.errors.invalidToken,
  VALIDATION_ERROR: ar.nafath.errors.validation,
  TIMEOUT: ar.nafath.errors.timeout,
  NETWORK_ERROR: ar.nafath.errors.network,
};

const LAWYER_MESSAGES: Record<string, string> = {
  LAWYER_NOT_FOUND: ar.lawyers.errors.notFound,
  AUTH_UNAUTHORIZED: ar.lawyers.errors.unauthorized,
  AUTH_INVALID_TOKEN: ar.lawyers.errors.unauthorized,
  VALIDATION_ERROR: ar.nafath.errors.validation,
  TIMEOUT: ar.nafath.errors.timeout,
  NETWORK_ERROR: ar.nafath.errors.network,
};

const BOOKING_MESSAGES: Record<string, string> = {
  LAWYER_NOT_FOUND: ar.booking.errors.lawyerNotFound,
  AVAILABILITY_RANGE_INVALID: ar.booking.errors.availability,
  CONSULTATION_SLOT_UNAVAILABLE: ar.booking.errors.slotUnavailable,
  CONSULTATION_CONFLICT: ar.booking.errors.conflict,
  CONSULTATION_IN_PAST: ar.booking.errors.inPast,
  CONSULTATION_NOT_FOUND: ar.booking.errors.generic,
  CONSULTATION_RATE_LIMITED: ar.booking.errors.rateLimited,
  AUTH_UNAUTHORIZED: ar.booking.errors.unauthorized,
  AUTH_INVALID_TOKEN: ar.booking.errors.unauthorized,
  VALIDATION_ERROR: ar.booking.errors.validation,
  TIMEOUT: ar.nafath.errors.timeout,
  NETWORK_ERROR: ar.nafath.errors.network,
};

const PAYMENT_MESSAGES: Record<string, string> = {
  PAYMENT_NOT_FOUND: ar.payment.errors.notFound,
  PAYMENT_CONSULTATION_NOT_FOUND: ar.payment.errors.consultationNotFound,
  PAYMENT_ALREADY_EXISTS: ar.payment.errors.alreadyExists,
  PAYMENT_IDEMPOTENCY_CONFLICT: ar.payment.errors.idempotencyConflict,
  PAYMENT_INVALID_STATE: ar.payment.errors.invalidState,
  PAYMENT_AMOUNT_MISMATCH: ar.payment.errors.amountMismatch,
  PAYMENT_PROVIDER_ERROR: ar.payment.errors.provider,
  PAYMENT_PRICING_UNAVAILABLE: ar.payment.errors.generic,
  PAYMENT_VERIFICATION_FAILED: ar.payment.errors.generic,
  PAYMENT_RATE_LIMITED: ar.payment.errors.rateLimited,
  AUTH_UNAUTHORIZED: ar.payment.errors.unauthorized,
  AUTH_INVALID_TOKEN: ar.payment.errors.unauthorized,
  VALIDATION_ERROR: ar.payment.errors.validation,
  TIMEOUT: ar.nafath.errors.timeout,
  NETWORK_ERROR: ar.nafath.errors.network,
};

export const isApiErrorEnvelope = (value: unknown): value is ApiErrorEnvelope => {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const body = (value as ApiErrorEnvelope).error;
  return Boolean(body && typeof body.code === 'string');
};

export const toApiError = (statusCode: number, payload: unknown): ApiError => {
  if (isApiErrorEnvelope(payload)) {
    return new ApiError(
      payload.error.code,
      payload.error.message,
      payload.error.statusCode || statusCode,
    );
  }

  return new ApiError('REQUEST_FAILED', 'Request failed', statusCode);
};

export const getUserFacingAuthError = (error: unknown): string => {
  if (error instanceof ApiError && AUTH_MESSAGES[error.code]) {
    return AUTH_MESSAGES[error.code];
  }

  return ar.auth.errors.generic;
};

export const getUserFacingDocumentError = (error: unknown): string => {
  if (error instanceof ApiError && DOCUMENT_MESSAGES[error.code]) {
    return DOCUMENT_MESSAGES[error.code];
  }

  return ar.documents.errors.generic;
};

export const getUserFacingLawyerError = (error: unknown): string => {
  if (error instanceof ApiError && LAWYER_MESSAGES[error.code]) {
    return LAWYER_MESSAGES[error.code];
  }

  return ar.lawyers.errors.generic;
};

export const getUserFacingBookingError = (error: unknown): string => {
  if (error instanceof ApiError && BOOKING_MESSAGES[error.code]) {
    return BOOKING_MESSAGES[error.code];
  }

  return ar.booking.errors.generic;
};

export const getUserFacingPaymentError = (error: unknown): string => {
  if (error instanceof ApiError && PAYMENT_MESSAGES[error.code]) {
    return PAYMENT_MESSAGES[error.code];
  }

  return ar.payment.errors.generic;
};

export const getUserFacingCaseError = (error: unknown): string => {
  if (error instanceof ApiError && CASE_MESSAGES[error.code]) {
    return CASE_MESSAGES[error.code];
  }

  return ar.legalFile.notFound.title;
};

const ADVISOR_MESSAGES: Record<string, string> = {
  AI_RATE_LIMITED: ar.advisor.errors.rateLimited,
  AI_JOB_NOT_FOUND: ar.advisor.errors.jobNotFound,
  AI_DOCUMENT_NOT_FOUND: ar.advisor.errors.documentNotFound,
  AI_RETRIEVAL_FAILED: ar.advisor.errors.generic,
  AI_ANSWER_INVALID: ar.advisor.errors.generic,
  AI_LLM_ERROR: ar.advisor.errors.generic,
  AI_LLM_RATE_LIMITED: ar.advisor.errors.rateLimited,
  AI_LLM_TIMEOUT: ar.advisor.errors.timeout,
  AI_JOB_PROCESSING_FAILED: ar.advisor.errors.failed,
  VALIDATION_ERROR: ar.advisor.errors.validation,
  AUTH_UNAUTHORIZED: ar.advisor.errors.unauthorized,
  AUTH_INVALID_TOKEN: ar.advisor.errors.unauthorized,
  TIMEOUT: ar.advisor.errors.timeout,
  NETWORK_ERROR: ar.advisor.errors.network,
};

export const getUserFacingAdvisorError = (error: unknown): string => {
  if (error instanceof ApiError && ADVISOR_MESSAGES[error.code]) {
    return ADVISOR_MESSAGES[error.code];
  }

  return ar.advisor.errors.generic;
};

const GUIDE_MESSAGES: Record<string, string> = {
  AI_GUIDE_SESSION_NOT_FOUND: ar.guide.errors.sessionNotFound,
  AI_GUIDE_RATE_LIMITED: ar.guide.errors.rateLimited,
  AI_GUIDE_FAILED: ar.guide.errors.failed,
  AI_GUIDE_INVALID_MESSAGE: ar.guide.errors.validation,
  AI_GUIDE_SESSION_EXPIRED: ar.guide.errors.sessionNotFound,
  AI_GUIDE_MESSAGE_LIMIT: ar.guide.errors.generic,
  AI_GUIDE_SUMMARY_NOT_READY: ar.guide.errors.summaryNotReady,
  AI_GUIDE_INVALID_RESPONSE: ar.guide.errors.failed,
  AI_LLM_TIMEOUT: ar.guide.errors.timeout,
  AI_LLM_RATE_LIMITED: ar.guide.errors.rateLimited,
  VALIDATION_ERROR: ar.guide.errors.validation,
  AUTH_UNAUTHORIZED: ar.guide.errors.unauthorized,
  AUTH_INVALID_TOKEN: ar.guide.errors.unauthorized,
  TIMEOUT: ar.guide.errors.timeout,
  NETWORK_ERROR: ar.guide.errors.network,
};

export const getUserFacingGuideError = (error: unknown): string => {
  if (error instanceof ApiError && GUIDE_MESSAGES[error.code]) {
    return GUIDE_MESSAGES[error.code];
  }

  return ar.guide.errors.generic;
};

const ALERT_MESSAGES: Record<string, string> = {
  ALERT_NOT_FOUND: ar.alerts.errors.notFound,
  ALERT_FAILED: ar.alerts.errors.failed,
  VALIDATION_ERROR: ar.alerts.errors.validation,
  AUTH_UNAUTHORIZED: ar.alerts.errors.unauthorized,
  AUTH_INVALID_TOKEN: ar.alerts.errors.unauthorized,
  TIMEOUT: ar.alerts.errors.timeout,
  NETWORK_ERROR: ar.alerts.errors.network,
};

export const getUserFacingAlertError = (error: unknown): string => {
  if (error instanceof ApiError && ALERT_MESSAGES[error.code]) {
    return ALERT_MESSAGES[error.code];
  }

  return ar.alerts.errors.generic;
};

const KIOSK_MESSAGES: Record<string, string> = {
  KIOSK_DEVICE_NOT_FOUND: ar.kiosk.errors.deviceNotFound,
  KIOSK_DEVICE_UNAVAILABLE: ar.kiosk.errors.deviceUnavailable,
  KIOSK_SESSION_NOT_FOUND: ar.kiosk.errors.sessionNotFound,
  KIOSK_DOCUMENT_NOT_FOUND: ar.kiosk.errors.documentNotFound,
  KIOSK_FAILED: ar.kiosk.errors.failed,
  KIOSK_RATE_LIMITED: ar.kiosk.errors.rateLimited,
  VALIDATION_ERROR: ar.kiosk.errors.validation,
  AUTH_UNAUTHORIZED: ar.kiosk.errors.unauthorized,
  AUTH_INVALID_TOKEN: ar.kiosk.errors.unauthorized,
  TIMEOUT: ar.kiosk.errors.timeout,
  NETWORK_ERROR: ar.kiosk.errors.network,
};

export const getUserFacingKioskError = (error: unknown): string => {
  if (error instanceof ApiError && KIOSK_MESSAGES[error.code]) {
    return KIOSK_MESSAGES[error.code];
  }

  return ar.kiosk.errors.generic;
};

const JUDICIAL_CARD_MESSAGES: Record<string, string> = {
  JUDICIAL_CARD_NOT_FOUND: ar.judicialCard.errors.notFound,
  JUDICIAL_CARD_UPGRADE_UNAVAILABLE: ar.judicialCard.errors.upgradeUnavailable,
  JUDICIAL_CARD_FAILED: ar.judicialCard.errors.failed,
  VALIDATION_ERROR: ar.judicialCard.errors.validation,
  AUTH_UNAUTHORIZED: ar.judicialCard.errors.unauthorized,
  AUTH_INVALID_TOKEN: ar.judicialCard.errors.unauthorized,
  TIMEOUT: ar.judicialCard.errors.timeout,
  NETWORK_ERROR: ar.judicialCard.errors.network,
};

export const getUserFacingJudicialCardError = (error: unknown): string => {
  if (error instanceof ApiError && JUDICIAL_CARD_MESSAGES[error.code]) {
    return JUDICIAL_CARD_MESSAGES[error.code];
  }

  return ar.judicialCard.errors.generic;
};
