import { Module } from '@nestjs/common';

import { StorageModule } from '../../documents/storage/storage.module';
import { AiModule } from '../ai.module';

import { AiJobProcessor } from './ai-job.processor';

/**
 * Registers the queue consumer. Imported only by the worker entrypoint, never
 * by `AppModule`, which is what keeps AI execution out of the API process.
 */
@Module({
  imports: [AiModule, StorageModule],
  providers: [AiJobProcessor],
})
export class AiWorkerModule {}
