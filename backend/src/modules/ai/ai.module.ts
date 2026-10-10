import { Module } from '@nestjs/common';

import { AiJobsService } from './ai-jobs.service';
import { DocumentChunksService } from './document-chunks.service';
import { DocumentPagesService } from './document-pages.service';
import { EmbeddingIngestService } from './embedding-ingest.service';
import { AiProvidersModule } from './providers/ai-providers.module';
import { AiQueueModule } from './queue/ai-queue.module';

@Module({
  imports: [AiQueueModule, AiProvidersModule],
  providers: [
    AiJobsService,
    DocumentPagesService,
    DocumentChunksService,
    EmbeddingIngestService,
  ],
  exports: [
    AiJobsService,
    DocumentPagesService,
    DocumentChunksService,
    EmbeddingIngestService,
    AiQueueModule,
    AiProvidersModule,
  ],
})
export class AiModule {}
