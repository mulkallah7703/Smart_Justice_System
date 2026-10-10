import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';

export const kioskDeviceNotFound = (): AppError =>
  new AppError(
    'KIOSK_DEVICE_NOT_FOUND',
    'The kiosk device was not found',
    'جهاز الخدمة الذاتية غير موجود',
    HttpStatus.NOT_FOUND,
  );

export const kioskDeviceUnavailable = (): AppError =>
  new AppError(
    'KIOSK_DEVICE_UNAVAILABLE',
    'The kiosk device is unavailable',
    'جهاز الخدمة الذاتية غير متاح',
    HttpStatus.BAD_REQUEST,
  );

export const kioskSessionNotFound = (): AppError =>
  new AppError(
    'KIOSK_SESSION_NOT_FOUND',
    'The kiosk session was not found',
    'جلسة الجهاز غير موجودة',
    HttpStatus.NOT_FOUND,
  );

export const kioskDocumentNotFound = (): AppError =>
  new AppError(
    'KIOSK_DOCUMENT_NOT_FOUND',
    'The document was not found',
    'المستند غير موجود',
    HttpStatus.NOT_FOUND,
  );

export const kioskFailed = (): AppError =>
  new AppError(
    'KIOSK_FAILED',
    'The kiosk operation failed',
    'تعذر إكمال عملية جهاز الخدمة الذاتية',
    HttpStatus.BAD_GATEWAY,
  );

export const kioskRateLimited = (): AppError =>
  new AppError(
    'KIOSK_RATE_LIMITED',
    'Too many kiosk requests',
    'محاولات كثيرة على جهاز الخدمة الذاتية. حاول لاحقاً',
    HttpStatus.TOO_MANY_REQUESTS,
  );
