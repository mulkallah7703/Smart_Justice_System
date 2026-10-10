import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../src/config/env.validation';
import { PrintKioskDto } from '../src/modules/kiosk/dto/print-kiosk.dto';
import { ScanKioskDto } from '../src/modules/kiosk/dto/scan-kiosk.dto';
import { StartKioskSessionDto } from '../src/modules/kiosk/dto/start-kiosk-session.dto';
import {
  mapKioskPrint,
  mapKioskScan,
  mapKioskSession,
} from '../src/modules/kiosk/mappers/kiosk.mapper';
import { KioskService } from '../src/modules/kiosk/kiosk.service';
import { KioskSessionService } from '../src/modules/kiosk/kiosk-session.service';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('Kiosk DTOs', () => {
  it('accepts a valid session start payload', () => {
    const dto = plainToInstance(StartKioskSessionDto, {
      deviceId: 'kiosk-lobby-01',
    });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects unexpected userId on start', () => {
    const dto = plainToInstance(StartKioskSessionDto, {
      deviceId: 'kiosk-lobby-01',
      userId: 'u1',
    });
    expect(
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects invalid scan mode and unexpected userId', () => {
    const badMode = plainToInstance(ScanKioskDto, {
      sessionId: 's1',
      mode: 'nfc',
    });
    expect(validateSync(badMode).length).toBeGreaterThan(0);

    const withUser = plainToInstance(ScanKioskDto, {
      sessionId: 's1',
      mode: 'qr',
      userId: 'u1',
    });
    expect(
      validateSync(withUser, { whitelist: true, forbidNonWhitelisted: true })
        .length,
    ).toBeGreaterThan(0);
  });

  it('requires sessionId and documentId for print', () => {
    const dto = plainToInstance(PrintKioskDto, { sessionId: 's1' });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});

describe('kiosk mappers', () => {
  it('maps session, scan, and print without ownership fields', () => {
    expect(mapKioskSession({ sessionId: 's1', deviceId: 'd1' })).toEqual({
      sessionId: 's1',
      deviceId: 'd1',
    });
    expect(mapKioskScan({ success: true, fileId: 'f1' })).toEqual({
      success: true,
      fileId: 'f1',
    });
    expect(mapKioskPrint(true)).toEqual({ success: true });
    expect(mapKioskSession({ sessionId: 's1', deviceId: 'd1' })).not.toHaveProperty(
      'userId',
    );
  });
});

describe('KioskService', () => {
  const userId = 'user-1';

  it('starts a session via the session service', async () => {
    const sessions = {
      createOwnedSession: jest.fn().mockResolvedValue({
        id: 'sess-1',
        userId,
        deviceId: 'kiosk-lobby-01',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      }),
    } as unknown as KioskSessionService;

    const service = new KioskService({} as PrismaService, sessions);
    const result = await service.startSession(userId, {
      deviceId: 'kiosk-lobby-01',
    });

    expect(result).toEqual({
      sessionId: 'sess-1',
      deviceId: 'kiosk-lobby-01',
    });
    expect(sessions.createOwnedSession).toHaveBeenCalledWith(
      userId,
      'kiosk-lobby-01',
    );
  });

  it('scan returns judicial card id as fileId when present', async () => {
    const sessions = {
      requireOwnedActiveSession: jest.fn().mockResolvedValue({
        id: 'sess-1',
        userId,
        deviceId: 'kiosk-lobby-01',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      }),
    } as unknown as KioskSessionService;

    const prisma = {
      judicialCard: {
        findUnique: jest.fn().mockResolvedValue({ id: 'card-1' }),
      },
    } as unknown as PrismaService;

    const service = new KioskService(prisma, sessions);
    const result = await service.scan(userId, {
      sessionId: 'sess-1',
      mode: 'qr',
    });

    expect(result).toEqual({ success: true, fileId: 'card-1' });
  });

  it('print rejects foreign documents with the safe not-found error', async () => {
    const sessions = {
      requireOwnedActiveSession: jest.fn().mockResolvedValue({
        id: 'sess-1',
        userId,
        deviceId: 'kiosk-lobby-01',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      }),
    } as unknown as KioskSessionService;

    const prisma = {
      document: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    const service = new KioskService(prisma, sessions);
    await expect(
      service.print(userId, { sessionId: 'sess-1', documentId: 'doc-x' }),
    ).rejects.toMatchObject({ code: 'KIOSK_DOCUMENT_NOT_FOUND' });
  });
});

describe('KioskSessionService', () => {
  it('rejects missing devices', async () => {
    const prisma = {
      kioskDevice: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn().mockReturnValue(900),
    } as unknown as ConfigService<AppConfig, true>;

    const service = new KioskSessionService(prisma, config);
    await expect(
      service.createOwnedSession('u1', 'missing'),
    ).rejects.toMatchObject({ code: 'KIOSK_DEVICE_NOT_FOUND' });
  });

  it('rejects foreign or expired sessions with the same not-found code', async () => {
    const prisma = {
      kioskSession: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn().mockReturnValue(900),
    } as unknown as ConfigService<AppConfig, true>;

    const service = new KioskSessionService(prisma, config);
    await expect(
      service.requireOwnedActiveSession('u1', 'sess-foreign'),
    ).rejects.toMatchObject({ code: 'KIOSK_SESSION_NOT_FOUND' });
  });
});
