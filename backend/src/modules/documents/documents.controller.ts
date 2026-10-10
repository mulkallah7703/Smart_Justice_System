import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { DocumentListQueryDto, DocumentUploadDto } from './dto/document-list-query.dto';
import { DocumentsService } from './documents.service';
import { DocumentUploadRateLimitGuard } from './guards/document-upload-rate-limit.guard';
import { DOCUMENT_MAX_BYTES } from './types/documents.types';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DocumentListQueryDto,
  ) {
    return this.documentsService.list(user.sub, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(DocumentUploadRateLimitGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: DocumentUploadDto,
  ) {
    return this.documentsService.upload(user.sub, body.caseId, file);
  }

  @Get(':id/download')
  @Header('X-Content-Type-Options', 'nosniff')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') documentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.documentsService.download(user.sub, documentId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', String(file.sizeBytes));
    response.setHeader('Content-Disposition', file.contentDisposition);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.status(HttpStatus.OK).send(file.body);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') documentId: string,
  ) {
    return this.documentsService.getById(user.sub, documentId);
  }
}
