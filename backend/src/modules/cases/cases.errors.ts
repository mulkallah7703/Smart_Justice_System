import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';

export const caseForbidden = (): AppError =>
  new AppError(
    'CASE_FORBIDDEN',
    'Only a citizen can create a case',
    'إنشاء القضية متاح لصاحب الملف العدلي',
    HttpStatus.FORBIDDEN,
  );

export const caseRateLimited = (): AppError =>
  new AppError(
    'CASE_RATE_LIMITED',
    'Too many case creation attempts. Try again later',
    'محاولات إنشاء القضايا كثيرة. حاول لاحقاً',
    HttpStatus.TOO_MANY_REQUESTS,
  );

export const caseNotFound = (): AppError =>
  new AppError(
    'CASE_NOT_FOUND',
    'The case was not found',
    'القضية غير موجودة',
    HttpStatus.NOT_FOUND,
  );
