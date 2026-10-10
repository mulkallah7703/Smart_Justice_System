import { Module } from '@nestjs/common';

import { MinioStorageService } from './minio.storage.service';
import { OBJECT_STORAGE } from './object-storage.interface';

/**
 * Object storage is shared by the API (upload/download) and the AI worker
 * (retrieval during processing), so the binding lives in its own module rather
 * than being duplicated or reached through the documents module's controller.
 */
@Module({
  providers: [
    MinioStorageService,
    {
      provide: OBJECT_STORAGE,
      useExisting: MinioStorageService,
    },
  ],
  exports: [OBJECT_STORAGE, MinioStorageService],
})
export class StorageModule {}
