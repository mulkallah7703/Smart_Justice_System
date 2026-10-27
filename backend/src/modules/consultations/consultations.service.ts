import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConsultationStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/database/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { overlaps, type Interval } from '../lawyers/availability.rules';
import { AvailabilityService } from '../lawyers/availability.service';
import { lawyerNotFound } from '../lawyers/lawyers.errors';
import {
  CONSULTATION_DURATION_MIN,
  CONSULTATION_DURATION_MS,
  MINUTE_MS,
} from '../lawyers/types/lawyers.types';
import {
  consultationConflict,
  consultationInPast,
  consultationAlreadyCancelled,
  consultationNotCancellable,
  consultationNotFound,
  consultationSlotUnavailable,
} from './consultations.errors';
import type { ConsultationListQueryDto } from './dto/consultation-list-query.dto';
import type {
  ConsultationDto,
  ConsultationListResult,
} from './dto/consultation-response.dto';
import type { CreateConsultationDto } from './dto/create-consultation.dto';
import { mapConsultation } from './mappers/consultation.mapper';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

/** Bounded lookback when checking the citizen's own overlapping bookings. */
const OWN_BOOKING_LOOKBACK_MS = 24 * 60 * MINUTE_MS;

const UNIQUE_VIOLATION = 'P2002';

const CONSULTATION_SELECT = {
  id: true,
  type: true,
  status: true,
  scheduledAt: true,
  durationMin: true,
  notes: true,
  createdAt: true,
  lawyer: {
    select: {
      id: true,
      city: true,
      specialties: true,
      user: { select: { name: true } },
    },
  },
} satisfies Prisma.ConsultationSelect;

@Injectable()
export class ConsultationsService {
  private readonly logger = new Logger(ConsultationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    @Optional() private readonly alerts?: AlertsService,
  ) {}

  /**
   * Books a consultation for the authenticated citizen.
   *
   * Concurrency: the whole check-then-insert runs in one transaction that first
   * takes a row lock on the lawyer, so competing bookings for the same lawyer
   * are serialized. A partial unique index on (lawyerId, scheduledAt) for
   * non-cancelled rows is the database-level backstop.
   */
  async create(
    userId: string,
    dto: CreateConsultationDto,
    now: Date = new Date(),
  ): Promise<ConsultationDto> {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt.getTime() <= now.getTime()) {
      throw consultationInPast();
    }

    const requested: Interval = {
      startAt: scheduledAt,
      endAt: new Date(scheduledAt.getTime() + CONSULTATION_DURATION_MS),
    };

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.lockLawyer(tx, dto.lawyerId);
        await this.assertInsideAvailability(tx, dto.lawyerId, requested);
        await this.assertLawyerFree(tx, dto.lawyerId, requested);
        await this.assertCitizenFree(tx, userId, requested);

        const consultation = await tx.consultation.create({
          data: {
            userId,
            lawyerId: dto.lawyerId,
            type: dto.type,
            scheduledAt,
            durationMin: CONSULTATION_DURATION_MIN,
            notes: dto.notes ?? null,
            status: ConsultationStatus.PENDING,
          },
          select: CONSULTATION_SELECT,
        });

        await tx.auditLog.create({
          data: {
            actorType: 'USER',
            actorUserId: userId,
            action: 'CONSULTATION_BOOKED',
            resourceType: 'Consultation',
            resourceId: consultation.id,
            metadata: {
              lawyerId: dto.lawyerId,
              scheduledAt: scheduledAt.toISOString(),
              type: dto.type,
              status: consultation.status,
            },
          },
        });

        return consultation;
      });

      this.logger.log(
        `consultation booked id=${created.id} lawyerId=${dto.lawyerId} status=${created.status}`,
      );
      await this.remind(userId, created.id, scheduledAt);
      return mapConsultation(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        this.logger.warn(
          `consultation booking rejected by unique constraint lawyerId=${dto.lawyerId}`,
        );
        throw consultationConflict();
      }
      throw error;
    }
  }

  async list(
    userId: string,
    query: ConsultationListQueryDto,
  ): Promise<ConsultationListResult> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: Prisma.ConsultationWhereInput = {
      userId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.consultation.findMany({
        where,
        orderBy: [{ scheduledAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: CONSULTATION_SELECT,
      }),
      this.prisma.consultation.count({ where }),
    ]);

    return {
      items: rows.map(mapConsultation),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async cancel(userId: string, consultationId: string): Promise<ConsultationDto> {
    const existing = await this.prisma.consultation.findFirst({
      where: { id: consultationId, userId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw consultationNotFound();
    }
    if (existing.status === ConsultationStatus.CANCELLED) {
      throw consultationAlreadyCancelled();
    }
    if (
      existing.status !== ConsultationStatus.PENDING &&
      existing.status !== ConsultationStatus.CONFIRMED
    ) {
      throw consultationNotCancellable();
    }

    await this.prisma.consultation.update({
      where: { id: consultationId },
      data: { status: ConsultationStatus.CANCELLED },
    });
    this.logger.log(`consultation cancelled id=${consultationId}`);
    return this.getById(userId, consultationId);
  }

  async getById(userId: string, consultationId: string): Promise<ConsultationDto> {
    const record = await this.prisma.consultation.findFirst({
      where: { id: consultationId, userId, deletedAt: null },
      select: CONSULTATION_SELECT,
    });

    if (!record) {
      throw consultationNotFound();
    }

    return mapConsultation(record);
  }

  /** Serializes concurrent bookings for the same lawyer. */
  private async lockLawyer(
    tx: Prisma.TransactionClient,
    lawyerId: string,
  ): Promise<void> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Lawyer" WHERE "id" = ${lawyerId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw lawyerNotFound();
    }
  }

  private async assertInsideAvailability(
    tx: Prisma.TransactionClient,
    lawyerId: string,
    requested: Interval,
  ): Promise<void> {
    const window = await tx.lawyerAvailabilitySlot.findFirst({
      where: {
        lawyerId,
        status: 'AVAILABLE',
        startAt: { lte: requested.startAt },
        endAt: { gte: requested.endAt },
      },
      orderBy: { startAt: 'asc' },
      select: { startAt: true },
    });

    if (!window) {
      throw consultationSlotUnavailable();
    }

    // Bookable blocks are aligned to the start of the availability window, so
    // the published slots and an arbitrary client timestamp cannot disagree.
    const offset = requested.startAt.getTime() - window.startAt.getTime();
    if (offset % CONSULTATION_DURATION_MS !== 0) {
      throw consultationSlotUnavailable();
    }
  }

  private async assertLawyerFree(
    tx: Prisma.TransactionClient,
    lawyerId: string,
    requested: Interval,
  ): Promise<void> {
    const busy = await this.availability.findBusyIntervals(
      lawyerId,
      { from: requested.startAt, to: requested.endAt },
      tx,
    );

    if (busy.some((taken) => overlaps(requested, taken))) {
      throw consultationConflict();
    }
  }

  private async assertCitizenFree(
    tx: Prisma.TransactionClient,
    userId: string,
    requested: Interval,
  ): Promise<void> {
    const rows = await tx.consultation.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { not: ConsultationStatus.CANCELLED },
        scheduledAt: {
          gte: new Date(requested.startAt.getTime() - OWN_BOOKING_LOOKBACK_MS),
          lt: requested.endAt,
        },
      },
      select: { scheduledAt: true, durationMin: true },
    });

    const clash = rows.some((row) =>
      overlaps(requested, {
        startAt: row.scheduledAt,
        endAt: new Date(row.scheduledAt.getTime() + row.durationMin * MINUTE_MS),
      }),
    );

    if (clash) {
      throw consultationConflict();
    }
  }

  private async remind(
    userId: string,
    consultationId: string,
    scheduledAt: Date,
  ): Promise<void> {
    if (!this.alerts) {
      return;
    }
    try {
      await this.alerts.create({
        userId,
        type: 'HEARING_REMINDER',
        severity: 'INFO',
        title: 'تذكير بموعد الاستشارة',
        body: `موعد استشارتك في ${scheduledAt.toISOString()}.`,
      });
    } catch {
      this.logger.warn(`consultation reminder failed id=${consultationId}`);
    }
  }
}
