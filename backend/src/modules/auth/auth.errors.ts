import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';

export const authInvalidNationalId = (): AppError =>
  new AppError(
    'AUTH_INVALID_NATIONAL_ID',
    'National ID format is invalid',
    'رقم الهوية الوطنية غير صالح',
    HttpStatus.BAD_REQUEST,
  );

export const authNafathFailed = (): AppError =>
  new AppError(
    'AUTH_NAFATH_VERIFICATION_FAILED',
    'Identity verification failed',
    'فشل التحقق من الهوية',
    HttpStatus.UNAUTHORIZED,
  );

/**
 * Real Nafath mode is selected, but the official government client/contract is
 * not wired. Fail closed — never silently use Mock Nafath.
 */
export const authNafathProviderUnavailable = (): AppError =>
  new AppError(
    'AUTH_NAFATH_PROVIDER_UNAVAILABLE',
    'Government identity verification is not available',
    'التحقق الحكومي من الهوية غير متاح حالياً',
    HttpStatus.SERVICE_UNAVAILABLE,
  );

/**
 * Legacy conflict code — public register no longer returns this (anti-enumeration).
 * Kept for clients that may still map the code; do not throw from register().
 */
export const authEmailAlreadyExists = (): AppError =>
  new AppError(
    'AUTH_EMAIL_ALREADY_EXISTS',
    'Unable to complete registration with the provided details',
    'تعذر إكمال التسجيل بالمعلومات المقدمة',
    HttpStatus.CONFLICT,
  );

export const authInvalidCredentials = (): AppError =>
  new AppError(
    'AUTH_INVALID_CREDENTIALS',
    'Invalid email or password',
    'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    HttpStatus.UNAUTHORIZED,
  );

export const authWeakPassword = (): AppError =>
  new AppError(
    'AUTH_WEAK_PASSWORD',
    'Password does not meet minimum requirements',
    'كلمة المرور لا تستوفي الحد الأدنى من المتطلبات',
    HttpStatus.BAD_REQUEST,
  );

export const authUnauthorized = (): AppError =>
  new AppError(
    'AUTH_UNAUTHORIZED',
    'Authentication is required',
    'يلزم تسجيل الدخول',
    HttpStatus.UNAUTHORIZED,
  );

export const authInvalidToken = (): AppError =>
  new AppError(
    'AUTH_INVALID_TOKEN',
    'The access token is invalid or expired',
    'رمز الدخول غير صالح أو منتهٍ',
    HttpStatus.UNAUTHORIZED,
  );

export const authRateLimited = (): AppError =>
  new AppError(
    'AUTH_RATE_LIMITED',
    'Too many authentication attempts. Try again later',
    'محاولات تحقق كثيرة. حاول لاحقاً',
    HttpStatus.TOO_MANY_REQUESTS,
  );

export const userNotFound = (): AppError =>
  new AppError(
    'USER_NOT_FOUND',
    'The user was not found',
    'المستخدم غير موجود',
    HttpStatus.NOT_FOUND,
  );
