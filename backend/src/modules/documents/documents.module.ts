import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentUploadRateLimitGuard } from './guards/document-upload-rate-limit.guard';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentUploadRateLimitGuard],
})
export class DocumentsModule {}
