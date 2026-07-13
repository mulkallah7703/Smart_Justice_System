import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';

import type {
  BookConsultationPayload,
  BookConsultationResponse,
  BookingDateOption,
  BookingTimeSlot,
  ConsultationTypeOption,
} from './booking.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

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

export const getBookingDates = (): BookingDateOption[] => [
  { id: 'd-28', dayLabel: ar.booking.dates.sun, dateLabel: '٢٨' },
  { id: 'd-29', dayLabel: ar.booking.dates.mon, dateLabel: '٢٩' },
  { id: 'd-30', dayLabel: ar.booking.dates.tue, dateLabel: '٣٠' },
  { id: 'd-01', dayLabel: ar.booking.dates.wed, dateLabel: '٠١' },
];

export const getBookingTimeSlots = (): BookingTimeSlot[] => [
  { id: 't-1100', label: ar.booking.times.t1100, available: true },
  { id: 't-1330', label: ar.booking.times.t1330, available: true },
  { id: 't-1600', label: ar.booking.times.t1600, available: true },
];

export const bookConsultation = async (
  payload: BookConsultationPayload,
): Promise<BookConsultationResponse> => {
  if (!API_BASE_URL) {
    await wait(400);
    return {
      consultationId: `consult-${payload.lawyerId}-${Date.now()}`,
    };
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.booking.create}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('BOOKING_FAILED');
  }

  const json = (await response.json()) as { data: BookConsultationResponse };
  return json.data;
};
