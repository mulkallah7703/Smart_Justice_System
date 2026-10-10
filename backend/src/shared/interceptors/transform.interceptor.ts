import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

import { isSuccessEnvelope, wrapSuccess } from '../http/envelope';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (isSuccessEnvelope(payload)) {
          return payload;
        }
        return wrapSuccess(payload === undefined ? null : payload);
      }),
    );
  }
}
