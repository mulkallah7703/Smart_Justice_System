import { CaseStatus, CaseType, DeadlineType } from '@prisma/client';

import { ExecutionContext } from '@nestjs/common';

import { CasesService } from '../src/modules/cases/cases.service';
import { caseNotFound } from '../src/modules/cases/cases.errors';
import { CaseCreateRateLimitGuard } from '../src/modules/cases/guards/case-create-rate-limit.guard';
import { mapCaseDetail, mapCaseListItem } from '../src/modules/cases/mappers/case.mapper';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('case mapper', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const hearingAt = new Date('2030-01-15T09:00:00.000Z');
  const dueAt = new Date('2030-01-10T21:00:00.000Z');

  it('maps a list record to a safe DTO', () => {
    const mapped = mapCaseListItem({
      id: 'case_1',
      caseNumber: 'DEV-CASE-0001',
      type: CaseType.RENTAL,
      status: CaseStatus.ACTIVE,
      authority: 'DEV Court',
      createdAt,
      hearings: [
        { id: 'h1', scheduledAt: hearingAt, location: 'Room 1' },
      ],
      deadlines: [
        {
          id: 'd1',
          type: DeadlineType.DOCUMENT_SUBMIT,
          dueAt,
          label: 'Submit docs',
        },
      ],
    });

    expect(mapped).toEqual({
      id: 'case_1',
      caseNumber: 'DEV-CASE-0001',
      type: 'RENTAL',
      status: 'ACTIVE',
      authority: 'DEV Court',
      createdAt: '2026-01-01T00:00:00.000Z',
      nextHearing: {
        id: 'h1',
        scheduledAt: '2030-01-15T09:00:00.000Z',
        location: 'Room 1',
      },
      nextDeadline: {
        id: 'd1',
        type: 'DOCUMENT_SUBMIT',
        dueAt: '2030-01-10T21:00:00.000Z',
        label: 'Submit docs',
      },
    });
    expect(JSON.stringify(mapped)).not.toMatch(/userId|lawyerId|deletedAt|nationalId/);
  });

  it('maps detail hearings and deadlines without internal fields', () => {
    const mapped = mapCaseDetail({
      id: 'case_1',
      caseNumber: 'DEV-CASE-0001',
      type: CaseType.RENTAL,
      status: CaseStatus.ACTIVE,
      authority: 'DEV Court',
      notes: 'Seed notes',
      createdAt,
      updatedAt: createdAt,
      hearings: [
        {
          id: 'h1',
          scheduledAt: hearingAt,
          location: 'Room 1',
          notes: 'Bring ID',
        },
      ],
      deadlines: [
        {
          id: 'd1',
          type: DeadlineType.APPEAL,
          dueAt,
          label: 'Appeal',
        },
      ],
    });

    expect(mapped.hearings).toHaveLength(1);
    expect(mapped.deadlines[0]?.type).toBe('APPEAL');
    expect(mapped).not.toHaveProperty('userId');
    expect(mapped).not.toHaveProperty('lawyerId');
    expect(mapped).not.toHaveProperty('documents');
    expect(mapped).not.toHaveProperty('alerts');
  });
});

describe('case errors', () => {
  it('uses a safe not-found code', () => {
    expect(caseNotFound().code).toBe('CASE_NOT_FOUND');
    expect(caseNotFound().getStatus()).toBe(404);
  });
});

describe('CasesService', () => {
  it('scopes list queries to the authenticated user and default pagination', async () => {
    const prisma = {
      case: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new CasesService(prisma as unknown as PrismaService);

    const result = await service.list('user-a', {});

    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-a', deletedAt: null }),
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('looks up detail with userId and case id together', async () => {
    const prisma = {
      case: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new CasesService(prisma as unknown as PrismaService);

    await expect(service.getById('user-a', 'case-b')).rejects.toMatchObject({
      code: 'CASE_NOT_FOUND',
    });
    expect(prisma.case.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-b', userId: 'user-a', deletedAt: null },
      }),
    );
  });

  it('creates a pending case owned by the caller and trims authority', async () => {
    const createdAt = new Date('2026-10-10T00:00:00.000Z');
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-a', role: 'CITIZEN' }),
      },
      case: {
        create: jest.fn().mockResolvedValue({ id: 'case_new' }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'case_new',
          caseNumber: 'SJS-2026-ABCDEF01',
          type: CaseType.LABOR,
          status: CaseStatus.PENDING,
          authority: 'Labor court',
          notes: 'First filing',
          createdAt,
          updatedAt: createdAt,
          hearings: [],
          deadlines: [],
        }),
      },
    };
    const service = new CasesService(prisma as unknown as PrismaService);

    const created = await service.create('user-a', {
      type: CaseType.LABOR,
      authority: '  Labor court  ',
      notes: '  First filing  ',
    });

    expect(created.id).toBe('case_new');
    expect(created.status).toBe('PENDING');
    expect(created.type).toBe('LABOR');
    expect(created).not.toHaveProperty('userId');
    expect(prisma.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-a',
          type: 'LABOR',
          status: 'PENDING',
          authority: 'Labor court',
          notes: 'First filing',
          caseNumber: expect.stringMatching(/^SJS-\d{4}-[A-F0-9]{8}$/),
        }),
      }),
    );
    expect(prisma.case.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case_new', userId: 'user-a', deletedAt: null },
      }),
    );
  });

  it('creates a criminal case for a citizen and a deadline alert', async () => {
    const alerts = { create: jest.fn().mockResolvedValue({ id: 'alert-1' }) };
    const createdAt = new Date('2026-10-27T00:00:00.000Z');
    const dueAt = new Date('2026-11-26T00:00:00.000Z');
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-a', role: 'CITIZEN' }),
      },
      case: {
        create: jest.fn().mockResolvedValue({ id: 'case-new' }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'case-new',
          caseNumber: 'SJS-2026-ABCDEF01',
          type: CaseType.CRIMINAL,
          status: CaseStatus.PENDING,
          authority: null,
          notes: null,
          createdAt,
          updatedAt: createdAt,
          hearings: [],
          deadlines: [
            {
              id: 'dl-1',
              type: DeadlineType.APPEAL,
              dueAt,
              label: 'مهلة اعتراض 30 يوماً',
            },
          ],
        }),
      },
      deadline: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dl-1' }),
      },
    };
    const service = new CasesService(
      prisma as unknown as PrismaService,
      alerts as never,
    );

    const detail = await service.create('user-a', {
      type: CaseType.CRIMINAL,
      objectionDays: 30,
    });

    expect(prisma.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-a',
          type: 'CRIMINAL',
          status: 'PENDING',
        }),
      }),
    );
    expect(alerts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-a',
        caseId: 'case-new',
        deadlineId: 'dl-1',
        type: 'DEADLINE',
      }),
    );
    expect(detail.type).toBe('CRIMINAL');
    expect(detail.deadlines[0]?.type).toBe('APPEAL');
  });

  it('refuses case creation for a non-citizen', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'lawyer-1', role: 'LAWYER' }),
      },
      case: { create: jest.fn() },
    };
    const service = new CasesService(prisma as unknown as PrismaService);

    await expect(
      service.create('lawyer-1', { type: CaseType.CRIMINAL }),
    ).rejects.toMatchObject({ code: 'CASE_FORBIDDEN' });
    expect(prisma.case.create).not.toHaveBeenCalled();
  });
});

describe('case create rate limit', () => {
  const context = (sub?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user: sub ? { sub } : undefined }) }),
    }) as unknown as ExecutionContext;

  it('allows twenty creates in the window and rejects the twenty-first', async () => {
    const redis = {
      incrementWithTtl: jest.fn().mockResolvedValueOnce(20).mockResolvedValueOnce(21),
    };
    const guard = new CaseCreateRateLimitGuard(redis as never);

    await expect(guard.canActivate(context('user-a'))).resolves.toBe(true);
    await expect(guard.canActivate(context('user-a'))).rejects.toMatchObject({
      code: 'CASE_RATE_LIMITED',
    });
    expect(redis.incrementWithTtl).toHaveBeenCalledWith(
      'cases:create:user:user-a',
      60,
    );
  });
});
