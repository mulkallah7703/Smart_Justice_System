import { RequestMethod, type INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { originAllowed, type AppConfig } from './config/env.validation';
import { AlertsGateway } from './modules/alerts/alerts.gateway';
import { GlobalExceptionFilter } from './shared/exceptions/http-exception.filter';
import { crossSiteCookieMiddleware } from './shared/http/cross-site-cookie';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { createValidationPipe } from './shared/validation/validation.config';
import { WorkerModule } from './worker.module';

loadEnv();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // The payment webhook signature covers the exact bytes the provider sent,
    // so the unparsed body must stay available.
    rawBody: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);
  app.enableShutdownHooks();
  app.use(
    helmet({
      // Default CORP is same-origin, which blocks a Vercel page from reading
      // this Render API. The SPA is a different site and sends credentials.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
    }),
  );

  const configService = app.get(ConfigService<AppConfig, true>);
  const corsOrigins = configService.get('corsOrigins', { infer: true });
  const port = configService.get('port', { infer: true });
  const trustProxyHops = configService.get('trustProxyHops', { infer: true });

  // Required so `request.ip` reflects the client behind Nginx. Do not publish
  // the API port publicly when trustProxyHops > 0.
  if (trustProxyHops > 0) {
    const httpApp = app.getHttpAdapter().getInstance() as {
      set?: (key: string, value: number) => void;
    };
    httpApp.set?.('trust proxy', trustProxyHops);
  }

  const nodeEnv = configService.get('nodeEnv', { infer: true });
  if (nodeEnv === 'production') {
    app.use(crossSiteCookieMiddleware);
  }

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Health checks and curl send no Origin. A matching browser origin is
      // reflected; credentials cannot use a bare "*".
      if (!origin || originAllowed(origin, corsOrigins)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'Cache-Control',
    ],
  });

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

  await app.listen(port, '0.0.0.0');
  app.get(AlertsGateway).bind(
    app.getHttpServer(),
    configService.get('jwt', { infer: true }).accessSecret,
    corsOrigins,
  );

  let workerContext: INestApplicationContext | null = null;
  if (configService.get('runWorkerInProcess', { infer: true })) {
    workerContext = await NestFactory.createApplicationContext(WorkerModule, {
      bufferLogs: true,
    });
    workerContext.useLogger(logger);
    logger.log('BullMQ AI worker is running inside the API process');
  }

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`API received ${signal}; closing HTTP and Nest context`);
    try {
      if (workerContext) {
        await workerContext.close();
        workerContext = null;
      }
      await app.close();
      process.exit(0);
    } catch (error) {
      logger.error(
        `API shutdown failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

void bootstrap();
