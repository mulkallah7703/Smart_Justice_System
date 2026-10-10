import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import { Logger } from 'nestjs-pino';

import { WorkerModule } from './worker.module';

loadEnv();

/**
 * Independent entrypoint for AI processing. Started with `npm run worker`
 * (or `node dist/worker.js`) alongside, and scaled separately from, the API.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);
  app.enableShutdownHooks();

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Worker received ${signal}; closing queue workers and connections`);
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      logger.error(
        `Worker shutdown failed: ${error instanceof Error ? error.message : 'unknown'}`,
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
