import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';

export const caseNotFound = (): AppError =>
  new AppError(
    'CASE_NOT_FOUND',
    'The case was not found',
    'القضية غير موجودة',
    HttpStatus.NOT_FOUND,
  );
