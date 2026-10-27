import 'reflect-metadata';

import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import type { AppConfig } from '../src/config/env.validation';
import { ConsultationsService } from '../src/modules/consultations/consultations.service';
import { ConsultationListQueryDto } from '../src/modules/consultations/dto/consultation-list-query.dto';
import { CreateConsultationDto } from '../src/modules/consultations/dto/create-consultation.dto';
import { ConsultationBookingRateLimitGuard } from '../src/modules/consultations/guards/consultation-booking-rate-limit.guard';
import {
  mapConsultation,
  type ConsultationRecord,
} from '../src/modules/consultations/mappers/consultation.mapper';
import { AvailabilityService } from '../src/modules/lawyers/availability.service';
import { PrismaService } from '../src/shared/database/prisma.service';
import { RedisService } from '../src/shared/cache/redis.service';
import { createValidationPipe } from '../src/shared/validation/validation.config';

const consultationRecord = (): ConsultationRecord => ({
  id: 'consult-1',
  type: 'INSTANT',
  status: 'PENDING',
  scheduledAt: new Date('2030-02-03T06:00:00Z'),
  durationMin: 20,
  notes: 'private note',
  createdAt: new Date('2030-01-01T00:00:00Z'),
  lawyer: {
    id: 'lawyer-1',
    city: 'Riyadh',
    specialties: ['RENTAL'],
    user: { name: 'DEV Lawyer' },
  },
});

const executionContext = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const rateLimitConfig = {
  get: () => ({ maxAttempts: 2, windowSeconds: 3600 }),
} as unknown as ConfigService<AppConfig, true>;

describe('consultation mapper', () => {
  it('maps to a stable DTO with UTC timestamps and a safe lawyer summary', () => {
    expect(mapConsultation(consultationRecord())).toEqual({
      id: 'consult-1',
      type: 'INSTANT',
      status: 'PENDING',
      scheduledAt: '2030-02-03T06:00:00.000Z',
      durationMin: 20,
      notes: 'private note',
      createdAt: '2030-01-01T00:00:00.000Z',
      lawyer: {
        id: 'lawyer-1',
        name: 'DEV Lawyer',
        city: 'Riyadh',
        specialties: ['RENTAL'],
      },
    });
  });

  it('never exposes the lawyer user record', () => {
    const dto = mapConsultation(consultationRecord());

    expect(dto.lawyer).not.toHaveProperty('user');
    expect(dto).not.toHaveProperty('userId');
  });
});

describe('consultation DTO validation', () => {
  it('accepts the booking contract', () => {
    const dto = plainToInstance(CreateConsultationDto, {
      lawyerId: 'lawyer-1',
      scheduledAt: '2030-02-03T06:00:00.000Z',
      type: 'INSTANT',
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects an unknown consultation type', () => {
    const dto = plainToInstance(CreateConsultationDto, {
      lawyerId: 'lawyer-1',
      scheduledAt: '2030-02-03T06:00:00.000Z',
      type: 'VIDEO',
    });

    expect(validateSync(dto).map((error) => error.property)).toEqual(['type']);
  });

  it('rejects a non ISO scheduledAt', () => {
    const dto = plainToInstance(CreateConsultationDto, {
      lawyerId: 'lawyer-1',
      scheduledAt: 'next tuesday',
      type: 'INSTANT',
    });

    expect(validateSync(dto).map((error) => error.property)).toEqual([
      'scheduledAt',
    ]);
  });

  it('rejects a client supplied userId through the global validation pipe', async () => {
    const pipe = createValidationPipe();

    await expect(
      pipe.transform(
        {
          lawyerId: 'lawyer-1',
          scheduledAt: '2030-02-03T06:00:00.000Z',
          type: 'INSTANT',
          userId: 'someone-else',
        },
        { type: 'body', metatype: CreateConsultationDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an unknown consultation status filter', () => {
    const dto = plainToInstance(ConsultationListQueryDto, { status: 'ARCHIVED' });

    expect(validateSync(dto).map((error) => error.property)).toEqual(['status']);
  });
});

describe('booking business rules', () => {
  const service = new ConsultationsService(
    {} as PrismaService,
    {} as AvailabilityService,
  );

  it('rejects a time in the past before touching the database', async () => {
    await expect(
      service.create(
        'user-1',
        {
          lawyerId: 'lawyer-1',
          scheduledAt: '2029-12-31T23:00:00.000Z',
          type: 'INSTANT',
        },
        new Date('2030-01-01T00:00:00Z'),
      ),
    ).rejects.toMatchObject({ code: 'CONSULTATION_IN_PAST' });
  });

  it('rejects the current instant', async () => {
    await expect(
      service.create(
        'user-1',
        {
          lawyerId: 'lawyer-1',
          scheduledAt: '2030-01-01T00:00:00.000Z',
          type: 'INSTANT',
        },
        new Date('2030-01-01T00:00:00Z'),
      ),
    ).rejects.toMatchObject({ code: 'CONSULTATION_IN_PAST' });
  });
});

describe('booking rate limit guard', () => {
  it('allows attempts up to the configured maximum', async () => {
    let count = 0;
    const guard = new ConsultationBookingRateLimitGuard(
      { incrementWithTtl: async () => ++count } as unknown as RedisService,
      rateLimitConfig,
    );
    const context = executionContext({ sub: 'user-1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'CONSULTATION_RATE_LIMITED',
    });
  });

  it('fails closed when Redis is unavailable', async () => {
    const guard = new ConsultationBookingRateLimitGuard(
      {
        incrementWithTtl: async () => {
          throw new Error('redis down');
        },
      } as unknown as RedisService,
      rateLimitConfig,
    );

    await expect(
      guard.canActivate(executionContext({ sub: 'user-1' })),
    ).rejects.toMatchObject({ code: 'CONSULTATION_RATE_LIMITED' });
  });

  it('cancels a pending consultation owned by the caller', async () => {
    const cancelled = { ...consultationRecord(), status: 'CANCELLED' as const };
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 'consult-1', status: 'PENDING' })
      .mockResolvedValueOnce(cancelled);
    const update = jest.fn().mockResolvedValue({ id: 'consult-1' });
    const service = new ConsultationsService(
      { consultation: { findFirst, update } } as unknown as PrismaService,
      {} as AvailabilityService,
    );

    const result = await service.cancel('user-1', 'consult-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'consult-1' },
      data: { status: 'CANCELLED' },
    });
    expect(result.status).toBe('CANCELLED');
  });

  it('returns 409 when the consultation is already cancelled', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'consult-1', status: 'CANCELLED' });
    const update = jest.fn();
    const service = new ConsultationsService(
      { consultation: { findFirst, update } } as unknown as PrismaService,
      {} as AvailabilityService,
    );

    await expect(service.cancel('user-1', 'consult-1')).rejects.toMatchObject({
      code: 'CONSULTATION_ALREADY_CANCELLED',
    });
    try {
      await service.cancel('user-1', 'consult-1');
    } catch (error) {
      expect((error as { getStatus: () => number }).getStatus()).toBe(409);
    }
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses to cancel a completed consultation', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'consult-1', status: 'COMPLETED' });
    const update = jest.fn();
    const service = new ConsultationsService(
      { consultation: { findFirst, update } } as unknown as PrismaService,
      {} as AvailabilityService,
    );

    await expect(service.cancel('user-1', 'consult-1')).rejects.toMatchObject({
      code: 'CONSULTATION_NOT_CANCELLABLE',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request', async () => {
    const guard = new ConsultationBookingRateLimitGuard(
      { incrementWithTtl: async () => 1 } as unknown as RedisService,
      rateLimitConfig,
    );

    await expect(
      guard.canActivate(executionContext(undefined)),
    ).rejects.toMatchObject({ code: 'CONSULTATION_RATE_LIMITED' });
  });
});
