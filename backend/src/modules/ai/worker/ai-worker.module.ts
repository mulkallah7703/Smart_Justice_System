import { Module } from '@nestjs/common';

import { StorageModule } from '../../documents/storage/storage.module';
import { AlertsCoreModule } from '../../alerts/alerts-core.module';
import { AiModule } from '../ai.module';

import { AiJobProcessor } from './ai-job.processor';

/**
 * Registers the queue consumer. Started by `worker.ts`, and by `main.ts` when
 * `RUN_WORKER_IN_PROCESS=true`. Never imported by `AppModule`.
 * Run only one of those modes: a second worker would consume the same queue.
 */
@Module({
  imports: [AiModule, StorageModule, AlertsCoreModule],
  providers: [AiJobProcessor],
})
export class AiWorkerModule {}
