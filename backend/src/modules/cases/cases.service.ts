import { randomBytes } from 'crypto';

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/database/prisma.service';
import { caseNotFound } from './cases.errors';
import type { CaseListQueryDto } from './dto/case-list-query.dto';
import type { CreateCaseDto } from './dto/create-case.dto';
import type { CaseDetailDto, CaseListResult } from './dto/case-response.dto';
import { mapCaseDetail, mapCaseListItem } from './mappers/case.mapper';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

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
    const authority = dto.authority?.trim() || null;
    const notes = dto.notes?.trim() || null;

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
          },
          select: { id: true },
        });
        return this.getById(userId, created.id);
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

    throw new Error('Unable to allocate a unique case number');
  }

  private allocateCaseNumber(): string {
    const year = new Date().getUTCFullYear();
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return `SJS-${year}-${suffix}`;
  }
}
