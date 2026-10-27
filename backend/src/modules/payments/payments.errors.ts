import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';

export const paymentNotFound = (): AppError =>
  new AppError(
    'PAYMENT_NOT_FOUND',
    'The payment was not found',
    'عملية الدفع غير موجودة',
    HttpStatus.NOT_FOUND,
  );

/** Also returned for another citizen's consultation so existence stays hidden. */
export const paymentConsultationNotPayable = (): AppError =>
  new AppError(
    'PAYMENT_CONSULTATION_NOT_PAYABLE',
    'This consultation cannot be paid in its current state',
    'لا يمكن الدفع لهذه الاستشارة في حالتها الحالية',
    HttpStatus.CONFLICT,
  );

export const paymentConsultationNotFound = (): AppError =>
  new AppError(
    'PAYMENT_CONSULTATION_NOT_FOUND',
    'The consultation was not found',
    'الاستشارة غير موجودة',
    HttpStatus.NOT_FOUND,
  );

export const paymentAlreadyExists = (): AppError =>
  new AppError(
    'PAYMENT_ALREADY_EXISTS',
    'An active payment already exists for this consultation',
    'توجد عملية دفع قائمة لهذه الاستشارة',
    HttpStatus.CONFLICT,
  );

export const paymentInvalidState = (): AppError =>
  new AppError(
    'PAYMENT_INVALID_STATE',
    'The payment is not in a state that allows this operation',
    'حالة عملية الدفع لا تسمح بهذا الإجراء',
    HttpStatus.CONFLICT,
  );

export const paymentIdempotencyConflict = (): AppError =>
  new AppError(
    'PAYMENT_IDEMPOTENCY_CONFLICT',
    'The idempotency key was already used with a different request',
    'مفتاح الطلب مستخدم مسبقاً ببيانات مختلفة',
    HttpStatus.CONFLICT,
  );

export const paymentPricingUnavailable = (): AppError =>
  new AppError(
    'PAYMENT_PRICING_UNAVAILABLE',
    'The payable amount could not be determined',
    'تعذر تحديد المبلغ المستحق',
    HttpStatus.CONFLICT,
  );

/** Provider failures are never surfaced verbatim to the client. */
/** Payment gateway integration is deferred — not a silent mock success. */
export const paymentDeferred = (): AppError =>
  new AppError(
    'PAYMENT_DEFERRED',
    'Payment integration is deferred and is not available in this deployment.',
    'تكامل الدفع مؤجل وغير متاح في هذا النشر',
    HttpStatus.SERVICE_UNAVAILABLE,
  );

export const paymentProviderError = (): AppError =>
  new AppError(
    'PAYMENT_PROVIDER_ERROR',
    'The payment provider could not process the request',
    'تعذر إتمام العملية لدى مزود الدفع',
    HttpStatus.BAD_GATEWAY,
  );

export const paymentVerificationFailed = (): AppError =>
  new AppError(
    'PAYMENT_VERIFICATION_FAILED',
    'The webhook could not be verified',
    'تعذر التحقق من صحة الإشعار',
    HttpStatus.UNAUTHORIZED,
  );

export const paymentAmountMismatch = (): AppError =>
  new AppError(
    'PAYMENT_AMOUNT_MISMATCH',
    'The reported amount does not match the payment',
    'المبلغ المُبلغ عنه لا يطابق عملية الدفع',
    HttpStatus.BAD_REQUEST,
  );

export const paymentRateLimited = (): AppError =>
  new AppError(
    'PAYMENT_RATE_LIMITED',
    'Too many payment attempts. Try again later',
    'محاولات دفع كثيرة. حاول لاحقاً',
    HttpStatus.TOO_MANY_REQUESTS,
  );
