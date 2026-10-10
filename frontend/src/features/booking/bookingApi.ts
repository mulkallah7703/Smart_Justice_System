import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';
import { apiRequest } from '../../shared/api/httpClient';
import { isMockApiMode } from '../../shared/api/mode';

import { mapBackendAvailability } from './mapAvailability';
import type {
  BackendAvailabilitySlot,
  BackendConsultation,
  BookConsultationPayload,
  BookConsultationResponse,
  BookingDay,
  ConsultationTypeOption,
} from './booking.types';

/** Matches the backend availability lookahead default. */
const AVAILABILITY_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const getConsultationTypes = (): ConsultationTypeOption[] => [
  {
    id: 'INSTANT',
    title: ar.booking.types.instant.title,
    subtitle: ar.booking.types.instant.subtitle,
    icon: 'bolt',
    iconTone: 'primary',
    priceOriginal: 250,
    priceDiscounted: 112,
  },
  {
    id: 'WRITTEN',
    title: ar.booking.types.written.title,
    subtitle: ar.booking.types.written.subtitle,
    icon: 'chat_bubble',
    iconTone: 'blue',
    priceOriginal: 200,
    priceDiscounted: 90,
  },
  {
    id: 'IN_PERSON',
    title: ar.booking.types.inPerson.title,
    subtitle: ar.booking.types.inPerson.subtitle,
    icon: 'meeting_room',
    iconTone: 'warm',
    priceOriginal: 300,
    priceDiscounted: 140,
  },
  {
    id: 'REPRESENTATION',
    title: ar.booking.types.representation.title,
    subtitle: ar.booking.types.representation.subtitle,
    icon: 'gavel',
    iconTone: 'gold',
    priceOriginal: 800,
    priceDiscounted: 450,
  },
];

/**
 * Offline stand-in for the availability endpoint. It keeps the four upcoming
 * days and the three times the mock booking screen has always shown, expressed
 * as UTC instants (Riyadh is UTC+3) so mock and real mode share one mapper.
 */
const mockAvailabilitySlots = (now: Date): BackendAvailabilitySlot[] => {
  const utcHours = [8, 10.5, 13];
  const midnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  return Array.from({ length: 4 }, (_, dayOffset) =>
    utcHours.map((hour) => {
      const startAt = new Date(
        midnightUtc + (dayOffset + 1) * DAY_MS + hour * 60 * 60 * 1000,
      );
      return {
        slotId: `mock-slot-${dayOffset}-${hour}`,
        startAt: startAt.toISOString(),
        endAt: new Date(startAt.getTime() + 20 * 60 * 1000).toISOString(),
        durationMin: 20,
      };
    }),
  ).flat();
};

export const getLawyerAvailability = async (
  lawyerId: string,
  now: Date = new Date(),
): Promise<BookingDay[]> => {
  if (isMockApiMode()) {
    await wait(280);
    return mapBackendAvailability(mockAvailabilitySlots(now));
  }

  const params = new URLSearchParams({
    from: now.toISOString(),
    to: new Date(now.getTime() + AVAILABILITY_WINDOW_DAYS * DAY_MS).toISOString(),
  });

  const slots = await apiRequest<BackendAvailabilitySlot[]>(
    `${endpoints.lawyers.availability(lawyerId)}?${params.toString()}`,
  );

  return mapBackendAvailability(slots);
};

export const bookConsultation = async (
  payload: BookConsultationPayload,
): Promise<BookConsultationResponse> => {
  if (isMockApiMode()) {
    await wait(400);
    return {
      consultationId: `consult-${payload.lawyerId}-${Date.now()}`,
    };
  }

  const consultation = await apiRequest<BackendConsultation>(
    endpoints.booking.create,
    {
      method: 'POST',
      body: {
        lawyerId: payload.lawyerId,
        scheduledAt: payload.scheduledAt,
        type: payload.type,
      },
    },
  );

  return { consultationId: consultation.id };
};
