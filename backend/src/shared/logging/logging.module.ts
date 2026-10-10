import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import type { AppConfig } from '../../config/env.validation';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const nodeEnv = configService.get('nodeEnv', { infer: true });
        const logLevel = configService.get('logLevel', { infer: true });

        return {
          pinoHttp: {
            level: logLevel,
            autoLogging: true,
            quietReqLogger: true,
            transport:
              nodeEnv === 'development'
                ? {
                    target: 'pino-pretty',
                    options: {
                      colorize: true,
                      singleLine: true,
                      translateTime: 'SYS:standard',
                    },
                  }
                : undefined,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'nationalId',
                '*.nationalId',
                'nafathCode',
                '*.nafathCode',
                'password',
                '*.password',
                'passwordHash',
                '*.passwordHash',
                'email',
                '*.email',
                'req.body.email',
                'req.body.password',
                'accessToken',
                '*.accessToken',
                'refreshToken',
                '*.refreshToken',
                'S3_SECRET',
                'MINIO_SECRET_KEY',
                'MINIO_ROOT_PASSWORD',
                'DATABASE_URL',
                'REDIS_URL',
                'JWT_ACCESS_SECRET',
                'JWT_SECRET',
                'OPENAI_API_KEY',
                'AI_LLM_API_KEY',
                'AI_EMBEDDING_API_KEY',
                'AI_QDRANT_API_KEY',
                'QDRANT_API_KEY',
                'PAYMENT_WEBHOOK_SECRET',
                'req.body.nationalId',
                'req.body.nafathCode',
              ],
              censor: '[REDACTED]',
            },
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggingModule {}
