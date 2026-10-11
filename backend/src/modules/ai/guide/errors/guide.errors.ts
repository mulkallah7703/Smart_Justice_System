import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../../../shared/exceptions/app-error';

/** Same code for missing and foreign sessions (IDOR-safe). */
export const aiGuideSessionNotFound = (): AppError =>
  new AppError(
    'AI_GUIDE_SESSION_NOT_FOUND',
    'The guide session was not found',
    'جلسة المرشد غير موجودة',
    HttpStatus.NOT_FOUND,
  );

export const aiGuideRateLimited = (): AppError =>
  new AppError(
    'AI_GUIDE_RATE_LIMITED',
    'Too many guide requests. Try again later',
    'طلبات المرشد كثيرة. حاول لاحقاً',
    HttpStatus.TOO_MANY_REQUESTS,
  );

export const aiGuideInvalidMessage = (): AppError =>
  new AppError(
    'AI_GUIDE_INVALID_MESSAGE',
    'The message is not valid',
    'الرسالة غير صالحة',
    HttpStatus.BAD_REQUEST,
  );

export const aiGuideFailed = (): AppError =>
  new AppError(
    'AI_GUIDE_FAILED',
    'The guide could not complete this request',
    'تعذر إكمال طلب المرشد',
    HttpStatus.BAD_GATEWAY,
  );

export const aiGuideSessionExpired = (): AppError =>
  new AppError(
    'AI_GUIDE_SESSION_EXPIRED',
    'The guide session has expired',
    'انتهت صلاحية جلسة المرشد',
    HttpStatus.GONE,
  );

export const aiGuideSummaryNotReady = (): AppError =>
  new AppError(
    'AI_GUIDE_SUMMARY_NOT_READY',
    'No guidance has been produced in this session yet',
    'لم يُقدَّم إرشاد في هذه الجلسة بعد',
    HttpStatus.CONFLICT,
  );

export const aiGuideMessageLimit = (): AppError =>
  new AppError(
    'AI_GUIDE_MESSAGE_LIMIT',
    'This guide session has reached its message limit',
    'وصلت جلسة المرشد إلى الحد الأقصى للرسائل',
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
