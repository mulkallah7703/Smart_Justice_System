import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';

export const judicialCardNotFound = (): AppError =>
  new AppError(
    'JUDICIAL_CARD_NOT_FOUND',
    'The judicial card was not found',
    'البطاقة العدلية غير موجودة',
    HttpStatus.NOT_FOUND,
  );

export const judicialCardUpgradeUnavailable = (): AppError =>
  new AppError(
    'JUDICIAL_CARD_UPGRADE_UNAVAILABLE',
    'Card tier upgrade requires payment and is not available yet',
    'ترقية البطاقة تتطلب الدفع وستُتاح لاحقاً',
    HttpStatus.SERVICE_UNAVAILABLE,
  );

export const judicialCardFailed = (): AppError =>
  new AppError(
    'JUDICIAL_CARD_FAILED',
    'The judicial card operation failed',
    'تعذر إكمال عملية البطاقة العدلية',
    HttpStatus.BAD_GATEWAY,
  );
