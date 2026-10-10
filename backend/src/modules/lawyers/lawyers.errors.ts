import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';

export const lawyerNotFound = (): AppError =>
  new AppError(
    'LAWYER_NOT_FOUND',
    'The lawyer was not found',
    'المحامي غير موجود',
    HttpStatus.NOT_FOUND,
  );

export const availabilityRangeInvalid = (): AppError =>
  new AppError(
    'AVAILABILITY_RANGE_INVALID',
    'The requested availability range is invalid',
    'نطاق المواعيد المطلوب غير صالح',
    HttpStatus.BAD_REQUEST,
  );
