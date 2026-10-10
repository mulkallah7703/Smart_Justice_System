import { describe, expect, it } from 'vitest';

import {
  formatSlotTimeAr,
  mapBackendAvailability,
  riyadhDayKey,
} from './mapAvailability';
import type { BackendAvailabilitySlot } from './booking.types';

const slot = (startAt: string): BackendAvailabilitySlot => ({
  slotId: `slot-${startAt}`,
  startAt,
  endAt: new Date(new Date(startAt).getTime() + 20 * 60 * 1000).toISOString(),
  durationMin: 20,
});

describe('mapBackendAvailability', () => {
  it('groups UTC blocks into days using the lawyer time zone', () => {
    const days = mapBackendAvailability([
      slot('2030-03-01T13:00:00.000Z'),
      slot('2030-03-01T06:00:00.000Z'),
      slot('2030-03-02T06:00:00.000Z'),
    ]);

    expect(days.map((day) => day.id)).toEqual(['2030-03-01', '2030-03-02']);
    expect(days[0].slots.map((entry) => entry.id)).toEqual([
      '2030-03-01T06:00:00.000Z',
      '2030-03-01T13:00:00.000Z',
    ]);
  });

  it('keeps the ISO instant as the slot id so scheduledAt needs no parsing', () => {
    const [day] = mapBackendAvailability([slot('2030-03-01T06:20:00.000Z')]);

    expect(day.slots[0].id).toBe('2030-03-01T06:20:00.000Z');
    expect(day.slots[0].available).toBe(true);
    expect(day.slots[0].label).not.toBe(day.slots[0].id);
  });

  it('shifts a late UTC block into the next Riyadh day', () => {
    // 22:00 UTC is 01:00 the following day in Riyadh (UTC+3).
    expect(riyadhDayKey('2030-03-01T22:00:00.000Z')).toBe('2030-03-02');
  });

  it('renders Arabic time labels', () => {
    expect(formatSlotTimeAr('2030-03-01T08:00:00.000Z')).toMatch(/[٠-٩]/);
  });

  it('returns nothing when the backend published no blocks', () => {
    expect(mapBackendAvailability([])).toEqual([]);
  });

  it('ignores a malformed timestamp instead of inventing a day', () => {
    expect(
      mapBackendAvailability([
        {
          slotId: 'slot_broken',
          startAt: 'not-a-date',
          endAt: 'not-a-date',
          durationMin: 20,
        },
      ]),
    ).toEqual([]);
  });
});
