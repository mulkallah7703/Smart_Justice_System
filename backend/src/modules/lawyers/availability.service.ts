import { Injectable } from '@nestjs/common';
import { ConsultationStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/database/prisma.service';
import {
  enumerateBlocks,
  filterBookableBlocks,
  type Interval,
} from './availability.rules';
import type { AvailabilityQueryDto } from './dto/availability-query.dto';
import type { AvailabilitySlotDto } from './dto/availability-response.dto';
import { availabilityRangeInvalid, lawyerNotFound } from './lawyers.errors';
import { mapAvailabilitySlot } from './mappers/lawyer.mapper';
import {
  AVAILABILITY_DEFAULT_WINDOW_DAYS,
  AVAILABILITY_MAX_WINDOW_DAYS,
  DAY_MS,
  MINUTE_MS,
} from './types/lawyers.types';

/** Upper bound on blocks returned in a single response. */
const MAX_BLOCKS = 200;

/**
 * Consultations are looked up from slightly before the requested window so that
 * a booking starting just before `from` still counts as busy.
 */
const BUSY_LOOKBACK_MS = DAY_MS;

interface ResolvedRange {
  from: Date;
  to: Date;
}

/**
 * Reads bookable consultation blocks. All timestamps are UTC; the API accepts
 * and returns ISO 8601 strings and never uses server local time.
 */
@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async listBookableSlots(
    lawyerId: string,
    query: AvailabilityQueryDto,
    now: Date = new Date(),
  ): Promise<AvailabilitySlotDto[]> {
    const lawyer = await this.prisma.lawyer.findUnique({
      where: { id: lawyerId },
      select: { id: true },
    });
    if (!lawyer) {
      throw lawyerNotFound();
    }

    const range = resolveRange(query, now);
    const notBefore = new Date(Math.max(range.from.getTime(), now.getTime()));

    const [windows, busy] = await Promise.all([
      this.prisma.lawyerAvailabilitySlot.findMany({
        where: {
          lawyerId,
          status: 'AVAILABLE',
          startAt: { lt: range.to },
          endAt: { gt: notBefore },
        },
        orderBy: { startAt: 'asc' },
        select: { id: true, startAt: true, endAt: true },
      }),
      this.findBusyIntervals(lawyerId, range),
    ]);

    const blocks = windows.flatMap((window) =>
      filterBookableBlocks(enumerateBlocks(window), busy, notBefore)
        .filter((block) => block.startAt.getTime() < range.to.getTime())
        .map((block) => ({ slotId: window.id, ...block })),
    );

    return blocks
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .slice(0, MAX_BLOCKS)
      .map(mapAvailabilitySlot);
  }

  /** Intervals occupied by consultations that still hold the lawyer's time. */
  async findBusyIntervals(
    lawyerId: string,
    range: ResolvedRange,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Interval[]> {
    const rows = await client.consultation.findMany({
      where: {
        lawyerId,
        deletedAt: null,
        status: { not: ConsultationStatus.CANCELLED },
        scheduledAt: {
          gte: new Date(range.from.getTime() - BUSY_LOOKBACK_MS),
          lt: range.to,
        },
      },
      select: { scheduledAt: true, durationMin: true },
    });

    return rows.map((row) => ({
      startAt: row.scheduledAt,
      endAt: new Date(row.scheduledAt.getTime() + row.durationMin * MINUTE_MS),
    }));
  }
}

const resolveRange = (query: AvailabilityQueryDto, now: Date): ResolvedRange => {
  const from = query.from ? new Date(query.from) : now;
  const to = query.to
    ? new Date(query.to)
    : new Date(from.getTime() + AVAILABILITY_DEFAULT_WINDOW_DAYS * DAY_MS);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw availabilityRangeInvalid();
  }
  if (to.getTime() <= from.getTime()) {
    throw availabilityRangeInvalid();
  }
  if (to.getTime() - from.getTime() > AVAILABILITY_MAX_WINDOW_DAYS * DAY_MS) {
    throw availabilityRangeInvalid();
  }

  return { from, to };
};
