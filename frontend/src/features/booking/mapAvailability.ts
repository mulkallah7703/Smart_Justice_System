import { toArabicNumerals } from '../../shared/utils/arabicNumerals';

import type {
  BackendAvailabilitySlot,
  BookingDay,
  BookingTimeSlot,
} from './booking.types';

/**
 * Slots are stored in UTC and displayed in the lawyer's local time, which the
 * booking screen already announces. Riyadh has no daylight saving, but the time
 * zone is applied through Intl rather than a fixed offset so the labels stay
 * correct regardless of the device's own time zone.
 */
const LAWYER_TIME_ZONE = 'Asia/Riyadh';

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LAWYER_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const weekdayFormatter = new Intl.DateTimeFormat('ar-SA', {
  timeZone: LAWYER_TIME_ZONE,
  calendar: 'gregory',
  weekday: 'long',
});

const dayNumberFormatter = new Intl.DateTimeFormat('ar-SA', {
  timeZone: LAWYER_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'arab',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('ar-SA', {
  timeZone: LAWYER_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'arab',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const parse = (iso: string): Date | null => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Stable `YYYY-MM-DD` key in the lawyer's time zone. */
export const riyadhDayKey = (iso: string): string => {
  const date = parse(iso);
  return date ? dayKeyFormatter.format(date) : '';
};

export const formatSlotTimeAr = (iso: string): string => {
  const date = parse(iso);
  return date ? toArabicNumerals(timeFormatter.format(date)) : '';
};

export const formatSlotWeekdayAr = (iso: string): string => {
  const date = parse(iso);
  return date ? weekdayFormatter.format(date) : '';
};

export const formatSlotDayNumberAr = (iso: string): string => {
  const date = parse(iso);
  return date ? toArabicNumerals(dayNumberFormatter.format(date)) : '';
};

export const mapAvailabilitySlot = (
  slot: BackendAvailabilitySlot,
): BookingTimeSlot => ({
  id: slot.startAt,
  label: formatSlotTimeAr(slot.startAt),
  available: true,
});

/**
 * Groups the bookable blocks the backend returned into the day chips and time
 * slots the existing picker renders. Nothing is generated locally: a day only
 * appears when the backend published at least one block for it.
 */
export const mapBackendAvailability = (
  slots: BackendAvailabilitySlot[],
): BookingDay[] => {
  const days = new Map<string, BookingDay>();

  for (const slot of slots) {
    const key = riyadhDayKey(slot.startAt);
    if (!key) {
      continue;
    }

    const day = days.get(key) ?? {
      id: key,
      dayLabel: formatSlotWeekdayAr(slot.startAt),
      dateLabel: formatSlotDayNumberAr(slot.startAt),
      slots: [],
    };

    day.slots.push(mapAvailabilitySlot(slot));
    days.set(key, day);
  }

  return [...days.values()]
    .map((day) => ({
      ...day,
      slots: [...day.slots].sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
};
