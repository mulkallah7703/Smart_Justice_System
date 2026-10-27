import { randomBytes } from 'crypto';

import { Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/database/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { caseForbidden, caseNotFound } from './cases.errors';
import type { CaseListQueryDto } from './dto/case-list-query.dto';
import type { CreateCaseDto } from './dto/create-case.dto';
import type { CaseDetailDto, CaseListResult } from './dto/case-response.dto';
import { mapCaseDetail, mapCaseListItem } from './mappers/case.mapper';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly alerts?: AlertsService,
  ) {}

  async list(userId: string, query: CaseListQueryDto): Promise<CaseListResult> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: Prisma.CaseWhereInput = {
      userId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const now = new Date();

    const [rows, total] = await Promise.all([
      this.prisma.case.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          caseNumber: true,
          type: true,
          status: true,
          authority: true,
          createdAt: true,
          hearings: {
            where: { scheduledAt: { gte: now } },
            orderBy: { scheduledAt: 'asc' },
            take: 1,
            select: {
              id: true,
              scheduledAt: true,
              location: true,
            },
          },
          deadlines: {
            where: { dueAt: { gte: now } },
            orderBy: { dueAt: 'asc' },
            take: 1,
            select: {
              id: true,
              type: true,
              dueAt: true,
              label: true,
            },
          },
        },
      }),
      this.prisma.case.count({ where }),
    ]);

    return {
      items: rows.map(mapCaseListItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(userId: string, caseId: string): Promise<CaseDetailDto> {
    const record = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        caseNumber: true,
        type: true,
        status: true,
        authority: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        hearings: {
          orderBy: { scheduledAt: 'asc' },
          select: {
            id: true,
            scheduledAt: true,
            location: true,
            notes: true,
          },
        },
        deadlines: {
          orderBy: { dueAt: 'asc' },
          select: {
            id: true,
            type: true,
            dueAt: true,
            label: true,
          },
        },
      },
    });

    if (!record) {
      throw caseNotFound();
    }

    return mapCaseDetail(record);
  }

  async create(userId: string, dto: CreateCaseDto): Promise<CaseDetailDto> {
    const owner = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!owner || owner.role !== 'CITIZEN') {
      throw caseForbidden();
    }

    const authority = dto.authority?.trim() || null;
    const notes = dto.notes?.trim() || null;
    let createdId = '';

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await this.prisma.case.create({
          data: {
            caseNumber: this.allocateCaseNumber(),
            type: dto.type,
            status: 'PENDING',
            authority,
            notes,
            userId,
            ...(dto.objectionDays
              ? {
                  deadlines: {
                    create: {
                      type: 'APPEAL',
                      dueAt: new Date(Date.now() + dto.objectionDays * 24 * 60 * 60 * 1000),
                      label: `مهلة اعتراض ${dto.objectionDays} يوماً`,
                    },
                  },
                }
              : {}),
          },
          select: { id: true },
        });
        createdId = created.id;
        break;
      } catch (error) {
        const duplicate =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (duplicate && attempt < 2) {
          continue;
        }
        throw error;
      }
    }

    if (!createdId) {
      throw new Error('Unable to allocate a unique case number');
    }

    if (dto.objectionDays && this.alerts) {
      const deadline = await this.prisma.deadline.findFirst({
        where: { caseId: createdId },
        select: { id: true },
      });
      if (deadline) {
        await this.alerts.create({
          userId,
          caseId: createdId,
          deadlineId: deadline.id,
          type: 'DEADLINE',
          severity: 'WARNING',
          title: 'مهلة اعتراض',
          body: `أُنشئت مهلة اعتراض مدتها ${dto.objectionDays} يوماً.`,
        });
      }
    }

    this.logger.log(`case created id=${createdId} type=${dto.type}`);
    return this.getById(userId, createdId);
  }

  private allocateCaseNumber(): string {
    const year = new Date().getUTCFullYear();
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return `SJS-${year}-${suffix}`;
  }
}
