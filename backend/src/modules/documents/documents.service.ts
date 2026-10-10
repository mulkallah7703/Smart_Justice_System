import { Inject, Injectable, Logger } from '@nestjs/common';

import { AppError } from '../../shared/exceptions/app-error';
import { PrismaService } from '../../shared/database/prisma.service';
import type { DocumentListQueryDto } from './dto/document-list-query.dto';
import {
  documentCaseNotFound,
  documentNotFound,
  documentStorageError,
} from './errors/documents.errors';
import { mapDocument } from './mappers/document.mapper';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from './storage/object-storage.interface';
import { DOCUMENT_LIST_MAX } from './types/documents.types';
import type { DocumentResponseDto } from './types/documents.types';
import {
  buildStorageKey,
  createDocumentId,
  safeContentDisposition,
  validateUpload,
} from './validators/document-file.validator';

export interface DocumentDownload {
  body: Buffer;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  contentDisposition: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async upload(
    userId: string,
    caseId: string,
    file: { buffer?: Buffer; size?: number; mimetype?: string; originalname?: string } | undefined,
  ): Promise<DocumentResponseDto> {
    const validated = validateUpload(file);
    await this.requireOwnedCase(userId, caseId);

    const documentId = createDocumentId();
    const storageKey = buildStorageKey(userId, caseId, documentId);

    try {
      await this.storage.putObject(storageKey, validated.buffer, validated.mimeType);
    } catch (error) {
      this.logger.error(`Document storage put failed documentId=${documentId}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw documentStorageError();
    }

    try {
      const created = await this.prisma.document.create({
        data: {
          id: documentId,
          userId,
          caseId,
          originalName: validated.originalName,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          checksum: validated.checksum,
          storageKey,
          status: 'UPLOADED',
          isAnalyzed: false,
        },
      });
      return mapDocument(created);
    } catch (error) {
      try {
        await this.storage.deleteObject(storageKey);
      } catch {
        this.logger.error(
          `Failed to delete orphaned storage object documentId=${documentId}`,
        );
      }
      this.logger.error(`Document metadata create failed documentId=${documentId}`);
      throw documentStorageError();
    }
  }

  async list(userId: string, query: DocumentListQueryDto): Promise<DocumentResponseDto[]> {
    if (query.caseId) {
      await this.requireOwnedCase(userId, query.caseId);
    }

    const rows = await this.prisma.document.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(query.caseId ? { caseId: query.caseId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: DOCUMENT_LIST_MAX,
      select: {
        id: true,
        caseId: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        isAnalyzed: true,
        createdAt: true,
      },
    });

    return rows.map(mapDocument);
  }

  async getById(userId: string, documentId: string): Promise<DocumentResponseDto> {
    const record = await this.findOwned(userId, documentId);
    return mapDocument(record);
  }

  async download(userId: string, documentId: string): Promise<DocumentDownload> {
    const record = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        mimeType: true,
        originalName: true,
        sizeBytes: true,
        storageKey: true,
      },
    });

    if (!record) {
      throw documentNotFound();
    }

    const object = await this.storage.getObject(record.storageKey);
    return {
      body: object.body,
      mimeType: record.mimeType,
      originalName: record.originalName,
      sizeBytes: record.sizeBytes,
      contentDisposition: safeContentDisposition(record.originalName),
    };
  }

  private async requireOwnedCase(userId: string, caseId: string): Promise<void> {
    const owned = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!owned) {
      throw documentCaseNotFound();
    }
  }

  private async findOwned(userId: string, documentId: string) {
    const record = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        caseId: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        isAnalyzed: true,
        createdAt: true,
      },
    });
    if (!record) {
      throw documentNotFound();
    }
    return record;
  }
}
