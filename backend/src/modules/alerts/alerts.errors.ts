import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';

export const alertNotFound = (): AppError =>
  new AppError(
    'ALERT_NOT_FOUND',
    'The alert was not found',
    'التنبيه غير موجود',
    HttpStatus.NOT_FOUND,
  );

export const alertFailed = (): AppError =>
  new AppError(
    'ALERT_FAILED',
    'The alert operation failed',
    'تعذر إكمال عملية التنبيه',
    HttpStatus.BAD_GATEWAY,
  );
