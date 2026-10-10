import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configuration } from './config/env.validation';
import { AiWorkerModule } from './modules/ai/worker/ai-worker.module';
import { DatabaseModule } from './shared/database/database.module';
import { LoggingModule } from './shared/logging/logging.module';

/**
 * Root module of the worker process.
 *
 * It deliberately registers no controllers and no HTTP surface: the worker has
 * no inbound network exposure and reaches the outside world only through Redis,
 * PostgreSQL, and (in later phases) object storage and AI providers.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env',
      ],
      load: [configuration],
    }),
    LoggingModule,
    DatabaseModule,
    AiWorkerModule,
  ],
})
export class WorkerModule {}
