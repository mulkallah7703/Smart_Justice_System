import { CaseStatus, CaseType, DeadlineType } from '@prisma/client';

import { CasesService } from '../src/modules/cases/cases.service';
import { caseNotFound } from '../src/modules/cases/cases.errors';
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

  it('creates a pending case owned by the caller and ignores client identity fields', async () => {
    const createdAt = new Date('2026-10-10T00:00:00.000Z');
    const prisma = {
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
});
