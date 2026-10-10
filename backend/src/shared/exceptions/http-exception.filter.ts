import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { MulterError } from 'multer';

import { wrapError } from '../http/envelope';
import { AppError } from './app-error';

interface ValidationResponseBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, code, message, messageAr } = this.normalize(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          code,
          status,
          name: exception instanceof Error ? exception.name : 'UnknownError',
        },
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(wrapError(code, message, messageAr, status));
  }

  private normalize(exception: unknown): {
    status: number;
    code: string;
    message: string;
    messageAr: string;
  } {
    if (exception instanceof AppError) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.clientMessage,
        messageAr: exception.messageAr,
      };
    }

    if (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE') {
      return this.documentTooLarge();
    }

    if (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      (exception as { code?: string }).code === 'LIMIT_FILE_SIZE'
    ) {
      return this.documentTooLarge();
    }

    if (
      exception instanceof Error &&
      /file too large/i.test(exception.message)
    ) {
      return this.documentTooLarge();
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (
        status === HttpStatus.PAYLOAD_TOO_LARGE ||
        this.isFileTooLargeMessage(payload)
      ) {
        return this.documentTooLarge();
      }

      if (status === HttpStatus.BAD_REQUEST) {
        const validationMessage = this.extractValidationMessage(payload);
        if (validationMessage) {
          return {
            status,
            code: 'VALIDATION_ERROR',
            message: validationMessage,
            messageAr: 'البيانات المرسلة غير صالحة',
          };
        }
      }

      if (status === HttpStatus.NOT_FOUND) {
        return {
          status,
          code: 'NOT_FOUND',
          message: 'The requested resource was not found',
          messageAr: 'المورد المطلوب غير موجود',
        };
      }

      return {
        status,
        code: this.codeFromStatus(status),
        message: this.safeHttpMessage(payload, status),
        messageAr: 'تعذر إكمال الطلب',
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.normalizePrisma(exception);
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable',
        messageAr: 'قاعدة البيانات غير متاحة',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: isProduction()
        ? 'An unexpected error occurred'
        : exception instanceof Error
          ? exception.message
          : 'An unexpected error occurred',
      messageAr: 'حدث خطأ غير متوقع',
    };
  }

  private normalizePrisma(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
    messageAr: string;
  } {
    if (exception.code === 'P2002') {
      return {
        status: HttpStatus.CONFLICT,
        code: 'CONFLICT',
        message: 'A record with this value already exists',
        messageAr: 'يوجد سجل بهذه القيمة مسبقاً',
      };
    }

    if (exception.code === 'P2025') {
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
        messageAr: 'المورد المطلوب غير موجود',
      };
    }

    return {
      status: HttpStatus.BAD_REQUEST,
      code: 'DATABASE_ERROR',
      message: 'The request could not be completed',
      messageAr: 'تعذر إكمال الطلب',
    };
  }

  private extractValidationMessage(payload: string | object): string | null {
    if (typeof payload === 'string') {
      return payload;
    }
    const body = payload as ValidationResponseBody;
    if (Array.isArray(body.message)) {
      return body.message.join('; ');
    }
    if (typeof body.message === 'string' && body.error === 'Bad Request') {
      return body.message;
    }
    return null;
  }

  private safeHttpMessage(
    payload: string | object,
    status: number,
  ): string {
    if (isProduction() && status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'An unexpected error occurred';
    }
    if (typeof payload === 'string') {
      return payload;
    }
    const body = payload as ValidationResponseBody;
    if (typeof body.message === 'string') {
      return body.message;
    }
    return 'Request failed';
  }

  private codeFromStatus(status: number): string {
    if (status === HttpStatus.UNAUTHORIZED) return 'AUTH_UNAUTHORIZED';
    if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    if (status === HttpStatus.TOO_MANY_REQUESTS) return 'AUTH_RATE_LIMITED';
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) return 'DOCUMENT_FILE_TOO_LARGE';
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) return 'INTERNAL_ERROR';
    return 'REQUEST_FAILED';
  }

  private documentTooLarge(): {
    status: number;
    code: string;
    message: string;
    messageAr: string;
  } {
    return {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      code: 'DOCUMENT_FILE_TOO_LARGE',
      message: 'The file exceeds the maximum allowed size',
      messageAr: 'حجم الملف أكبر من الحد المسموح',
    };
  }

  private isFileTooLargeMessage(payload: string | object): boolean {
    const text =
      typeof payload === 'string'
        ? payload
        : Array.isArray((payload as ValidationResponseBody).message)
          ? ((payload as ValidationResponseBody).message as string[]).join(' ')
          : String((payload as ValidationResponseBody).message ?? '');
    return /file too large/i.test(text);
  }
}
