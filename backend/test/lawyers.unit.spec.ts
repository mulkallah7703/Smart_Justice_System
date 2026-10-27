import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import {
  enumerateBlocks,
  filterBookableBlocks,
  isWithinWindow,
  overlaps,
} from '../src/modules/lawyers/availability.rules';
import { AvailabilityQueryDto } from '../src/modules/lawyers/dto/availability-query.dto';
import { LawyerListQueryDto } from '../src/modules/lawyers/dto/lawyer-list-query.dto';
import {
  mapAvailabilitySlot,
  mapLawyerDetail,
  mapLawyerListItem,
  type LawyerDetailRecord,
} from '../src/modules/lawyers/mappers/lawyer.mapper';
import { AvailabilityService } from '../src/modules/lawyers/availability.service';
import { specialtyFromArabicQuery } from '../src/modules/lawyers/specialty-search';
import { PrismaService } from '../src/shared/database/prisma.service';

const at = (iso: string): Date => new Date(iso);

const lawyerRecord = (): LawyerDetailRecord => ({
  id: 'lawyer-1',
  specialties: ['RENTAL'],
  city: 'Riyadh',
  rating: 4.8,
  reviewCount: 12,
  experienceYrs: 10,
  priceFrom: 150,
  isAvailable: true,
  isVerified: true,
  licenseNumber: 'DEV-LIC-0001',
  bio: 'bio',
  user: { name: 'DEV Lawyer' },
});

describe('availability rules', () => {
  it('detects half-open interval overlap', () => {
    const a = { startAt: at('2030-01-01T09:00:00Z'), endAt: at('2030-01-01T09:20:00Z') };
    const touching = {
      startAt: at('2030-01-01T09:20:00Z'),
      endAt: at('2030-01-01T09:40:00Z'),
    };
    const crossing = {
      startAt: at('2030-01-01T09:10:00Z'),
      endAt: at('2030-01-01T09:30:00Z'),
    };

    expect(overlaps(a, touching)).toBe(false);
    expect(overlaps(a, crossing)).toBe(true);
    expect(overlaps(crossing, a)).toBe(true);
  });

  it('requires a block to fit entirely inside the window', () => {
    const window = {
      startAt: at('2030-01-01T09:00:00Z'),
      endAt: at('2030-01-01T13:00:00Z'),
    };

    expect(
      isWithinWindow(
        { startAt: at('2030-01-01T12:40:00Z'), endAt: at('2030-01-01T13:00:00Z') },
        window,
      ),
    ).toBe(true);
    expect(
      isWithinWindow(
        { startAt: at('2030-01-01T12:50:00Z'), endAt: at('2030-01-01T13:10:00Z') },
        window,
      ),
    ).toBe(false);
    expect(
      isWithinWindow(
        { startAt: at('2030-01-01T14:00:00Z'), endAt: at('2030-01-01T14:20:00Z') },
        window,
      ),
    ).toBe(false);
  });

  it('splits a window into aligned blocks and drops the short remainder', () => {
    const blocks = enumerateBlocks({
      startAt: at('2030-01-01T09:00:00Z'),
      endAt: at('2030-01-01T10:05:00Z'),
    });

    expect(blocks).toHaveLength(3);
    expect(blocks[0].startAt.toISOString()).toBe('2030-01-01T09:00:00.000Z');
    expect(blocks[2].endAt.toISOString()).toBe('2030-01-01T10:00:00.000Z');
  });

  it('removes blocks that are busy or already in the past', () => {
    const blocks = enumerateBlocks({
      startAt: at('2030-01-01T09:00:00Z'),
      endAt: at('2030-01-01T10:00:00Z'),
    });

    const bookable = filterBookableBlocks(
      blocks,
      [{ startAt: at('2030-01-01T09:40:00Z'), endAt: at('2030-01-01T10:00:00Z') }],
      at('2030-01-01T09:15:00Z'),
    );

    expect(bookable.map((block) => block.startAt.toISOString())).toEqual([
      '2030-01-01T09:20:00.000Z',
    ]);
  });
});

describe('lawyer mapper', () => {
  it('exposes only public fields on the list item', () => {
    const item = mapLawyerListItem(lawyerRecord());

    expect(item).toEqual({
      id: 'lawyer-1',
      name: 'DEV Lawyer',
      specialties: ['RENTAL'],
      city: 'Riyadh',
      rating: 4.8,
      reviewCount: 12,
      experienceYrs: 10,
      priceFrom: 150,
      isAvailable: true,
      isVerified: true,
    });
    expect(item).not.toHaveProperty('licenseNumber');
    expect(item).not.toHaveProperty('bio');
    expect(item).not.toHaveProperty('userId');
  });

  it('adds the licence and bio on the detail projection only', () => {
    const detail = mapLawyerDetail(lawyerRecord());

    expect(detail.licenseNumber).toBe('DEV-LIC-0001');
    expect(detail.bio).toBe('bio');
    expect(Object.keys(detail)).not.toContain('user');
  });

  it('returns a null name when the lawyer has no linked user', () => {
    expect(mapLawyerListItem({ ...lawyerRecord(), user: null }).name).toBeNull();
  });

  it('serialises availability blocks as UTC ISO strings', () => {
    expect(
      mapAvailabilitySlot({
        slotId: 'slot-1',
        startAt: at('2030-01-01T09:00:00Z'),
        endAt: at('2030-01-01T09:20:00Z'),
      }),
    ).toEqual({
      slotId: 'slot-1',
      startAt: '2030-01-01T09:00:00.000Z',
      endAt: '2030-01-01T09:20:00.000Z',
      durationMin: 20,
    });
  });
});

describe('lawyer DTO validation', () => {
  it('rejects an unknown specialty and an over-sized limit', () => {
    const invalid = plainToInstance(LawyerListQueryDto, {
      specialty: 'TRAFFIC',
      limit: 500,
    });
    const errors = validateSync(invalid, { whitelist: true });

    expect(errors.map((error) => error.property).sort()).toEqual([
      'limit',
      'specialty',
    ]);
  });

  it('accepts the frontend filter contract', () => {
    const valid = plainToInstance(LawyerListQueryDto, {
      specialty: 'RENTAL',
      q: 'DEV',
      page: 2,
      limit: 10,
    });

    expect(validateSync(valid)).toHaveLength(0);
  });

  it('rejects a non ISO availability range', () => {
    const invalid = plainToInstance(AvailabilityQueryDto, { from: '2030-13-45' });

    expect(validateSync(invalid).map((error) => error.property)).toEqual(['from']);
  });
});

describe('availability range guards', () => {
  const service = new AvailabilityService({
    lawyer: { findUnique: async () => ({ id: 'lawyer-1' }) },
  } as unknown as PrismaService);

  const now = at('2030-01-01T00:00:00Z');

  const expectRangeRejected = async (
    query: { from?: string; to?: string },
  ): Promise<void> => {
    await expect(
      service.listBookableSlots('lawyer-1', query, now),
    ).rejects.toMatchObject({ code: 'AVAILABILITY_RANGE_INVALID' });
  };

  it('rejects an inverted range', async () => {
    await expectRangeRejected({
      from: '2030-01-02T00:00:00Z',
      to: '2030-01-01T00:00:00Z',
    });
  });

  it('maps Arabic specialty words onto case-type enums', () => {
    expect(specialtyFromArabicQuery('تجاري')).toBe('COMMERCIAL');
    expect(specialtyFromArabicQuery('جزائي')).toBe('CRIMINAL');
    expect(specialtyFromArabicQuery('الرياض')).toBeNull();
  });

  it('rejects a range wider than the maximum window', async () => {
    await expectRangeRejected({
      from: '2030-01-01T00:00:00Z',
      to: '2030-03-01T00:00:00Z',
    });
  });
});
