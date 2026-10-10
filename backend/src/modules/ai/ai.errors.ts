import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';

/** Also returned for another citizen's job so existence stays hidden. */
export const aiJobNotFound = (): AppError =>
  new AppError(
    'AI_JOB_NOT_FOUND',
    'The AI job was not found',
    'مهمة الذكاء الاصطناعي غير موجودة',
    HttpStatus.NOT_FOUND,
  );

/**
 * Returned when any requested document is missing, soft-deleted, or owned by
 * another citizen. The three cases are deliberately indistinguishable so the
 * endpoint cannot be used to probe for other users' documents.
 */
export const aiDocumentNotFound = (): AppError =>
  new AppError(
    'AI_DOCUMENT_NOT_FOUND',
    'One or more documents were not found',
    'تعذر العثور على أحد المستندات المطلوبة',
    HttpStatus.NOT_FOUND,
  );

export const aiRateLimited = (): AppError =>
  new AppError(
    'AI_RATE_LIMITED',
    'Too many analysis requests. Try again later',
    'طلبات تحليل كثيرة. حاول لاحقاً',
    HttpStatus.TOO_MANY_REQUESTS,
  );

export const aiJobEnqueueFailed = (): AppError =>
  new AppError(
    'AI_JOB_ENQUEUE_FAILED',
    'The AI job could not be queued',
    'تعذر إضافة المهمة إلى قائمة المعالجة',
    HttpStatus.SERVICE_UNAVAILABLE,
  );

/**
 * Terminal worker failure. Provider messages and stack traces are never
 * surfaced verbatim; only this stable code reaches the client.
 */
export const AI_JOB_PROCESSING_FAILED = 'AI_JOB_PROCESSING_FAILED';

/** Raised by a provider adapter when the underlying call does not succeed. */
export const AI_PROVIDER_ERROR = 'AI_PROVIDER_ERROR';

/**
 * The worker re-checks that every linked document still belongs to the job's
 * owner. A mismatch means the row set changed underneath the job, so it is
 * refused rather than processed.
 */
export const AI_JOB_OWNERSHIP_MISMATCH = 'AI_JOB_OWNERSHIP_MISMATCH';

/** Storage returned an object with no content for a document that claims bytes. */
export const AI_DOCUMENT_EMPTY = 'AI_DOCUMENT_EMPTY';

/**
 * Text-extraction failures. Every one is a stable code: the underlying parser
 * message is discarded at the boundary so no library detail, byte offset, or
 * document content can reach the job record or an API response.
 */
export const documentFormatUnsupported = (): AppError =>
  new AppError(
    'DOCUMENT_FORMAT_UNSUPPORTED',
    'This document format cannot be processed',
    'صيغة المستند غير مدعومة للمعالجة',
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  );

export const pdfInvalid = (): AppError =>
  new AppError(
    'PDF_INVALID',
    'The document could not be read as a valid PDF',
    'تعذر قراءة الملف كمستند PDF صالح',
    HttpStatus.UNPROCESSABLE_ENTITY,
  );

export const pdfEncrypted = (): AppError =>
  new AppError(
    'PDF_ENCRYPTED',
    'The document is password protected',
    'المستند محمي بكلمة مرور',
    HttpStatus.UNPROCESSABLE_ENTITY,
  );

export const pdfPageLimitExceeded = (): AppError =>
  new AppError(
    'PDF_PAGE_LIMIT_EXCEEDED',
    'The document has more pages than can be processed',
    'عدد صفحات المستند يتجاوز الحد المسموح للمعالجة',
    HttpStatus.PAYLOAD_TOO_LARGE,
  );

export const pdfExtractionFailed = (): AppError =>
  new AppError(
    'PDF_EXTRACTION_FAILED',
    'Text could not be extracted from the document',
    'تعذر استخراج النص من المستند',
    HttpStatus.UNPROCESSABLE_ENTITY,
  );

export const pdfRenderFailed = (): AppError =>
  new AppError(
    'PDF_RENDER_FAILED',
    'The document page could not be rendered',
    'تعذر تحويل صفحة المستند إلى صورة',
    HttpStatus.UNPROCESSABLE_ENTITY,
  );

export const pdfRenderLimitExceeded = (): AppError =>
  new AppError(
    'PDF_RENDER_LIMIT_EXCEEDED',
    'The document page is too large to render safely',
    'صفحة المستند أكبر من الحد الآمن للمعالجة',
    HttpStatus.PAYLOAD_TOO_LARGE,
  );

export const ocrUnavailable = (): AppError =>
  new AppError(
    'OCR_UNAVAILABLE',
    'The OCR engine is not available',
    'محرك التعرف الضوئي غير متاح',
    HttpStatus.SERVICE_UNAVAILABLE,
  );

export const ocrLanguageDataMissing = (): AppError =>
  new AppError(
    'OCR_LANGUAGE_DATA_MISSING',
    'Required OCR language data is not installed',
    'بيانات لغة التعرف الضوئي غير مثبتة',
    HttpStatus.SERVICE_UNAVAILABLE,
  );

export const ocrTimeout = (): AppError =>
  new AppError(
    'OCR_TIMEOUT',
    'OCR exceeded the allowed time for a page',
    'تجاوز التعرف الضوئي الوقت المسموح للصفحة',
    HttpStatus.GATEWAY_TIMEOUT,
  );

export const ocrFailed = (): AppError =>
  new AppError(
    'OCR_FAILED',
    'OCR could not process the page',
    'تعذر إتمام التعرف الضوئي على الصفحة',
    HttpStatus.UNPROCESSABLE_ENTITY,
  );

export const aiProviderError = (): AppError =>
  new AppError(
    AI_PROVIDER_ERROR,
    'The AI provider could not process the request',
    'تعذر إتمام المعالجة لدى مزود الذكاء الاصطناعي',
    HttpStatus.BAD_GATEWAY,
  );

export const aiEmbeddingError = (): AppError =>
  new AppError(
    'AI_EMBEDDING_ERROR',
    'The embedding provider could not process the request',
    'تعذر إنشاء التضمين',
    HttpStatus.BAD_GATEWAY,
  );

export const aiEmbeddingAuthFailed = (): AppError =>
  new AppError(
    'AI_EMBEDDING_AUTH_FAILED',
    'The embedding provider rejected the credentials',
    'رفض مزود التضمين بيانات الاعتماد',
    HttpStatus.BAD_GATEWAY,
  );

export const aiEmbeddingRateLimited = (): AppError =>
  new AppError(
    'AI_EMBEDDING_RATE_LIMITED',
    'The embedding provider rate limit was exceeded',
    'تم تجاوز حد معدل مزود التضمين',
    HttpStatus.TOO_MANY_REQUESTS,
  );

export const aiEmbeddingDimensionMismatch = (): AppError =>
  new AppError(
    'AI_EMBEDDING_DIMENSION_MISMATCH',
    'Embedding dimensions do not match the vector collection',
    'أبعاد التضمين لا تطابق مجموعة المتجهات',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );

export const aiVectorStoreError = (): AppError =>
  new AppError(
    'AI_VECTOR_STORE_ERROR',
    'The vector store is unavailable',
    'مخزن المتجهات غير متاح',
    HttpStatus.SERVICE_UNAVAILABLE,
  );

export const aiRetrievalConfigMismatch = (): AppError =>
  new AppError(
    'AI_RETRIEVAL_CONFIG_MISMATCH',
    'Retrieval configuration does not match the embedding collection',
    'إعدادات الاسترجاع لا تطابق مجموعة التضمين',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );

export const aiRetrievalFailed = (): AppError =>
  new AppError(
    'AI_RETRIEVAL_FAILED',
    'Evidence retrieval could not be completed',
    'تعذر إتمام استرجاع الأدلة',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );

export const aiLlmError = (): AppError =>
  new AppError(
    'AI_LLM_ERROR',
    'The language model could not complete the request',
    'تعذر إتمام الطلب لدى نموذج اللغة',
    HttpStatus.BAD_GATEWAY,
  );

export const aiLlmAuthFailed = (): AppError =>
  new AppError(
    'AI_LLM_AUTH_FAILED',
    'The language model rejected the credentials',
    'رفض نموذج اللغة بيانات الاعتماد',
    HttpStatus.BAD_GATEWAY,
  );

export const aiLlmRateLimited = (): AppError =>
  new AppError(
    'AI_LLM_RATE_LIMITED',
    'The language model rate limit was exceeded',
    'تم تجاوز حد معدل نموذج اللغة',
    HttpStatus.TOO_MANY_REQUESTS,
  );

export const aiLlmTimeout = (): AppError =>
  new AppError(
    'AI_LLM_TIMEOUT',
    'The language model did not respond in time',
    'لم يستجب نموذج اللغة في الوقت المحدد',
    HttpStatus.GATEWAY_TIMEOUT,
  );

export const aiAnswerInvalid = (): AppError =>
  new AppError(
    'AI_ANSWER_INVALID',
    'The generated answer did not pass validation',
    'الإجابة المُنشأة لم تجتز التحقق',
    HttpStatus.BAD_GATEWAY,
  );
