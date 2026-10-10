import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../../shared/exceptions/app-error';

export const documentFileRequired = (): AppError =>
  new AppError(
    'DOCUMENT_FILE_REQUIRED',
    'A file is required',
    'يلزم إرفاق ملف',
    HttpStatus.BAD_REQUEST,
  );

export const documentFileTypeNotAllowed = (): AppError =>
  new AppError(
    'DOCUMENT_FILE_TYPE_NOT_ALLOWED',
    'This file type is not allowed',
    'نوع الملف غير مسموح',
    HttpStatus.BAD_REQUEST,
  );

export const documentFileTooLarge = (): AppError =>
  new AppError(
    'DOCUMENT_FILE_TOO_LARGE',
    'The file exceeds the maximum allowed size',
    'حجم الملف أكبر من الحد المسموح',
    HttpStatus.PAYLOAD_TOO_LARGE,
  );

export const documentFileInvalid = (): AppError =>
  new AppError(
    'DOCUMENT_FILE_INVALID',
    'The file contents are invalid',
    'محتوى الملف غير صالح',
    HttpStatus.BAD_REQUEST,
  );

export const documentCaseNotFound = (): AppError =>
  new AppError(
    'DOCUMENT_CASE_NOT_FOUND',
    'The case was not found',
    'القضية غير موجودة',
    HttpStatus.NOT_FOUND,
  );

export const documentNotFound = (): AppError =>
  new AppError(
    'DOCUMENT_NOT_FOUND',
    'The document was not found',
    'المستند غير موجود',
    HttpStatus.NOT_FOUND,
  );

export const documentStorageError = (): AppError =>
  new AppError(
    'DOCUMENT_STORAGE_ERROR',
    'Document storage is unavailable',
    'تعذر حفظ المستند',
    HttpStatus.SERVICE_UNAVAILABLE,
  );

export const documentRateLimited = (): AppError =>
  new AppError(
    'DOCUMENT_RATE_LIMITED',
    'Too many document uploads. Try again later',
    'محاولات رفع كثيرة. حاول لاحقاً',
    HttpStatus.TOO_MANY_REQUESTS,
  );
