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

  async create(userId: string, input: CreateCaseDto): Promise<CaseDetailDto> {
    const owner = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!owner || owner.role !== 'CITIZEN') {
      throw caseForbidden();
    }

    const caseNumber = `SJ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await this.prisma.case.create({
      data: {
        userId,
        caseNumber,
        type: input.type,
        authority: input.authority ?? null,
        notes: input.notes ?? null,
        status: 'PENDING',
        ...(input.objectionDays
          ? {
              deadlines: {
                create: {
                  type: 'APPEAL',
                  dueAt: new Date(Date.now() + input.objectionDays * 24 * 60 * 60 * 1000),
                  label: `مهلة اعتراض ${input.objectionDays} يوماً`,
                },
              },
            }
          : {}),
      },
      select: { id: true },
    });

    if (input.objectionDays && this.alerts) {
      const deadline = await this.prisma.deadline.findFirst({
        where: { caseId: created.id },
        select: { id: true },
      });
      if (deadline) {
        await this.alerts.create({
          userId,
          caseId: created.id,
          deadlineId: deadline.id,
          type: 'DEADLINE',
          severity: 'WARNING',
          title: 'مهلة اعتراض',
          body: `أُنشئت مهلة اعتراض مدتها ${input.objectionDays} يوماً.`,
        });
      }
    }

    this.logger.log(`case created id=${created.id} type=${input.type}`);
    return this.getById(userId, created.id);
  }

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
}
