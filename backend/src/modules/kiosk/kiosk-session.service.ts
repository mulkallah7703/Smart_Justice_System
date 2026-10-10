import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/env.validation';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  kioskDeviceNotFound,
  kioskDeviceUnavailable,
  kioskFailed,
  kioskSessionNotFound,
} from './kiosk.errors';

export interface ActiveKioskSession {
  id: string;
  userId: string;
  deviceId: string;
  expiresAt: Date;
}

@Injectable()
export class KioskSessionService {
  private readonly logger = new Logger(KioskSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async createOwnedSession(
    userId: string,
    publicDeviceId: string,
  ): Promise<ActiveKioskSession> {
    const device = await this.prisma.kioskDevice.findUnique({
      where: { deviceId: publicDeviceId },
      select: { id: true, deviceId: true, status: true },
    });

    if (!device) {
      throw kioskDeviceNotFound();
    }

    if (device.status === 'DISABLED') {
      throw kioskDeviceUnavailable();
    }

    const ttlSeconds = this.configService.get('kioskSessionTtlSeconds', {
      infer: true,
    });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    try {
      const session = await this.prisma.kioskSession.create({
        data: {
          kioskDeviceId: device.id,
          userId,
          expiresAt,
        },
        select: { id: true, userId: true, expiresAt: true },
      });

      this.logger.log({
        operation: 'kioskSessionCreate',
        status: 'ok',
        sessionId: session.id,
      });

      return {
        id: session.id,
        userId: session.userId ?? userId,
        deviceId: device.deviceId,
        expiresAt: session.expiresAt,
      };
    } catch {
      throw kioskFailed();
    }
  }

  /**
   * Loads an active session owned by the caller. Foreign/missing/expired →
   * the same safe 404.
   */
  async requireOwnedActiveSession(
    userId: string,
    sessionId: string,
  ): Promise<ActiveKioskSession> {
    const session = await this.prisma.kioskSession.findFirst({
      where: {
        id: sessionId,
        userId,
        endedAt: null,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        device: { select: { deviceId: true, status: true } },
      },
    });

    if (!session || !session.userId || session.expiresAt.getTime() <= Date.now()) {
      throw kioskSessionNotFound();
    }

    if (session.device.status === 'DISABLED') {
      throw kioskDeviceUnavailable();
    }

    return {
      id: session.id,
      userId: session.userId,
      deviceId: session.device.deviceId,
      expiresAt: session.expiresAt,
    };
  }
}
