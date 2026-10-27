import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { AlertListQueryDto } from '../src/modules/alerts/dto/alert-list-query.dto';
import { mapAlert, type AlertRecord } from '../src/modules/alerts/mappers/alert.mapper';
import { AlertsService } from '../src/modules/alerts/alerts.service';
import { PrismaService } from '../src/shared/database/prisma.service';

const alertRecord = (overrides: Partial<AlertRecord> = {}): AlertRecord => ({
  id: 'alert-1',
  type: 'DEADLINE',
  severity: 'WARNING',
  title: 'قرب انتهاء مهلة',
  body: 'تذكير بمهلة',
  isRead: false,
  triggeredAt: new Date('2030-01-01T10:00:00.000Z'),
  createdAt: new Date('2030-01-01T10:00:00.000Z'),
  deadline: { dueAt: new Date('2030-01-05T10:00:00.000Z') },
  ...overrides,
});

describe('AlertListQueryDto', () => {
  it('accepts page, limit, and unreadOnly', () => {
    const dto = plainToInstance(AlertListQueryDto, {
      page: '2',
      limit: '10',
      unreadOnly: 'true',
    });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
    expect(dto.unreadOnly).toBe(true);
  });

  it('rejects invalid page and limit', () => {
    const badPage = plainToInstance(AlertListQueryDto, { page: 0 });
    expect(validateSync(badPage).length).toBeGreaterThan(0);

    const badLimit = plainToInstance(AlertListQueryDto, { limit: 99 });
    expect(validateSync(badLimit).length).toBeGreaterThan(0);
  });

  it('rejects unexpected userId', () => {
    const dto = plainToInstance(AlertListQueryDto, { userId: 'u1', page: 1 });
    expect(
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length,
    ).toBeGreaterThan(0);
  });
});

describe('mapAlert', () => {
  it('maps prisma fields without exposing ownership internals', () => {
    const mapped = mapAlert(alertRecord());
    expect(mapped).toEqual({
      id: 'alert-1',
      type: 'DEADLINE',
      severity: 'WARNING',
      title: 'قرب انتهاء مهلة',
      body: 'تذكير بمهلة',
      isRead: false,
      triggeredAt: '2030-01-01T10:00:00.000Z',
      createdAt: '2030-01-01T10:00:00.000Z',
      dueAt: '2030-01-05T10:00:00.000Z',
    });
    expect(mapped).not.toHaveProperty('userId');
    expect(mapped).not.toHaveProperty('caseId');
    expect(mapped).not.toHaveProperty('deadlineId');
  });

  it('sets dueAt null when no deadline is linked', () => {
    expect(mapAlert(alertRecord({ deadline: null })).dueAt).toBeNull();
  });
});

describe('AlertsService', () => {
  const userId = 'user-owner';

  const createService = (prisma: Partial<PrismaService>): AlertsService =>
    new AlertsService(prisma as PrismaService);

  it('lists only the caller alerts sorted by createdAt desc with pagination', async () => {
    const findMany = jest.fn().mockResolvedValue([alertRecord()]);
    const count = jest.fn().mockResolvedValue(1);
    const service = createService({
      alert: { findMany, count },
    } as unknown as PrismaService);

    const result = await service.list(userId, { page: 1, limit: 10 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('applies unreadOnly filter', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = createService({
      alert: { findMany, count },
    } as unknown as PrismaService);

    await service.list(userId, { unreadOnly: true });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, isRead: false },
      }),
    );
  });

  it('returns the same not-found error for missing alerts', async () => {
    const service = createService({
      alert: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(service.getById(userId, 'missing')).rejects.toMatchObject({
      code: 'ALERT_NOT_FOUND',
      getStatus: expect.any(Function),
    });
  });

  it('markRead is idempotent for already-read alerts', async () => {
    const existing = alertRecord({ isRead: true });
    const update = jest.fn();
    const service = createService({
      alert: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update,
      },
    } as unknown as PrismaService);

    const result = await service.markRead(userId, existing.id);
    expect(result.isRead).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('create is idempotent when deadlineId already has an alert', async () => {
    const existing = alertRecord();
    const create = jest.fn();
    const service = createService({
      alert: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create,
      },
    } as unknown as PrismaService);

    const result = await service.create({
      userId,
      type: 'DEADLINE',
      severity: 'WARNING',
      title: 't',
      body: 'b',
      deadlineId: 'dl-1',
    });

    expect(result.id).toBe(existing.id);
    expect(create).not.toHaveBeenCalled();
  });

  it('create stores ownership on the server-supplied userId', async () => {
    const created = alertRecord({ id: 'new-alert' });
    const create = jest.fn().mockResolvedValue(created);
    const service = createService({
      alert: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    } as unknown as PrismaService);

    await service.create({
      userId,
      type: 'LAW_UPDATE',
      severity: 'INFO',
      title: 'تحديث',
      body: 'نص',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          type: 'LAW_UPDATE',
          severity: 'INFO',
        }),
      }),
    );
  });

  it('notifies the alerts gateway after a new alert is stored', async () => {
    const created = alertRecord({ id: 'new-alert' });
    const notify = jest.fn();
    const service = new AlertsService(
      {
        alert: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(created),
        },
      } as unknown as PrismaService,
      { notify } as never,
    );

    await service.create({
      userId,
      type: 'DEADLINE',
      severity: 'WARNING',
      title: 'مهلة اعتراض',
      body: 'ثلاثين يوماً',
    });

    expect(notify).toHaveBeenCalledWith(userId, 'new-alert');
  });
});
