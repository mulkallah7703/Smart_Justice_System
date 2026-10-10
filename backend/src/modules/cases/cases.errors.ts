import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';

export const caseNotFound = (): AppError =>
  new AppError(
    'CASE_NOT_FOUND',
    'The case was not found',
    'القضية غير موجودة',
    HttpStatus.NOT_FOUND,
  );

export const caseRateLimited = (): AppError =>
  new AppError(
    'CASE_RATE_LIMITED',
    'Too many case creation attempts. Try again later',
    'محاولات كثيرة لإضافة القضايا. حاول لاحقاً',
    HttpStatus.TOO_MANY_REQUESTS,
  );
