import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';

export const consultationNotCancellable = (): AppError =>
  new AppError(
    'CONSULTATION_NOT_CANCELLABLE',
    'This consultation can no longer be cancelled',
    'لا يمكن إلغاء هذه الاستشارة',
    HttpStatus.CONFLICT,
  );

export const consultationNotFound = (): AppError =>
  new AppError(
    'CONSULTATION_NOT_FOUND',
    'The consultation was not found',
    'الاستشارة غير موجودة',
    HttpStatus.NOT_FOUND,
  );

export const consultationInPast = (): AppError =>
  new AppError(
    'CONSULTATION_IN_PAST',
    'The requested time is in the past',
    'لا يمكن الحجز في وقت مضى',
    HttpStatus.BAD_REQUEST,
  );

export const consultationSlotUnavailable = (): AppError =>
  new AppError(
    'CONSULTATION_SLOT_UNAVAILABLE',
    'The requested time is not available for this lawyer',
    'الموعد المطلوب غير متاح لدى هذا المحامي',
    HttpStatus.CONFLICT,
  );

export const consultationConflict = (): AppError =>
  new AppError(
    'CONSULTATION_CONFLICT',
    'The requested time is already booked',
    'الموعد المطلوب محجوز بالفعل',
    HttpStatus.CONFLICT,
  );

export const consultationRateLimited = (): AppError =>
  new AppError(
    'CONSULTATION_RATE_LIMITED',
    'Too many booking attempts. Try again later',
    'محاولات حجز كثيرة. حاول لاحقاً',
    HttpStatus.TOO_MANY_REQUESTS,
  );
