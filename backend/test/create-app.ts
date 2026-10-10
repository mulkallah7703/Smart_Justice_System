import { RequestMethod, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/shared/exceptions/http-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';
import { createValidationPipe } from '../src/shared/validation/validation.config';

export const createTestingApp = async (): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  // Match production: Express derives client IP for auth rate limits from a
  // single trusted proxy hop (e2e sets X-Forwarded-For per unique national ID).
  const httpApp = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: number) => void;
  };
  httpApp.set?.('trust proxy', 1);
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
      { path: 'readyz', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.init();
  return app;
};
