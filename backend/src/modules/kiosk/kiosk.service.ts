import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../shared/database/prisma.service';
import type { PrintKioskDto } from './dto/print-kiosk.dto';
import type { ScanKioskDto } from './dto/scan-kiosk.dto';
import type { StartKioskSessionDto } from './dto/start-kiosk-session.dto';
import type {
  KioskPrintResponseDto,
  KioskScanResponseDto,
  KioskSessionResponseDto,
} from './dto/kiosk-response.dto';
import { kioskDocumentNotFound, kioskFailed } from './kiosk.errors';
import { KioskSessionService } from './kiosk-session.service';
import {
  mapKioskPrint,
  mapKioskScan,
  mapKioskSession,
} from './mappers/kiosk.mapper';

@Injectable()
export class KioskService {
  private readonly logger = new Logger(KioskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: KioskSessionService,
  ) {}

  async startSession(
    userId: string,
    dto: StartKioskSessionDto,
  ): Promise<KioskSessionResponseDto> {
    const session = await this.sessions.createOwnedSession(userId, dto.deviceId);
    return mapKioskSession({
      sessionId: session.id,
      deviceId: session.deviceId,
    });
  }

  /**
   * Confirms QR/card identity for an owned active session and returns a
   * non-sensitive legal-file handle (judicial card id when present).
   */
  async scan(
    userId: string,
    dto: ScanKioskDto,
  ): Promise<KioskScanResponseDto> {
    const session = await this.sessions.requireOwnedActiveSession(
      userId,
      dto.sessionId,
    );

    const card = await this.prisma.judicialCard.findUnique({
      where: { userId },
      select: { id: true },
    });

    const fileId = card?.id ?? session.id;

    this.logger.log({
      operation: 'kioskScan',
      status: 'ok',
      sessionId: session.id,
      mode: dto.mode,
    });

    return mapKioskScan({ success: true, fileId });
  }

  /**
   * Validates that the caller's active kiosk session may print an owned
   * document. Does not stream bytes — print hardware integration is deferred.
   */
  async print(
    userId: string,
    dto: PrintKioskDto,
  ): Promise<KioskPrintResponseDto> {
    await this.sessions.requireOwnedActiveSession(userId, dto.sessionId);

    const document = await this.prisma.document.findFirst({
      where: {
        id: dto.documentId,
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!document) {
      throw kioskDocumentNotFound();
    }

    try {
      this.logger.log({
        operation: 'kioskPrint',
        status: 'ok',
        sessionId: dto.sessionId,
        documentId: document.id,
      });
      return mapKioskPrint(true);
    } catch {
      throw kioskFailed();
    }
  }
}
