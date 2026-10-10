import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/env.validation';
import { AI_JOB_QUEUE } from '../ai.constants';

import { redisConnectionFromUrl } from './redis-connection';

/**
 * Queue wiring shared by the API (which only enqueues) and the worker (which
 * only consumes). Retention keeps a bounded window of finished jobs so a failed
 * job stays inspectable without growing Redis without limit.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const redisUrl = configService.get('redisUrl', { infer: true });
        const { queuePrefix } = configService.get('ai', { infer: true });

        return {
          connection: redisConnectionFromUrl(redisUrl),
          prefix: queuePrefix,
        };
      },
    }),
    BullModule.registerQueueAsync({
      name: AI_JOB_QUEUE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const { jobAttempts, jobBackoffMs } = configService.get('ai', {
          infer: true,
        });

        return {
          defaultJobOptions: {
            attempts: jobAttempts,
            backoff: { type: 'exponential', delay: jobBackoffMs },
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 86400, count: 1000 },
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class AiQueueModule {}
