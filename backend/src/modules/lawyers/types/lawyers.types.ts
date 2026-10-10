/**
 * A consultation occupies a fixed block that matches the `durationMin` default
 * on the Consultation model. Availability is published, and booking validated,
 * in blocks of this size.
 */
export const CONSULTATION_DURATION_MIN = 20;

export const MINUTE_MS = 60_000;

export const CONSULTATION_DURATION_MS = CONSULTATION_DURATION_MIN * MINUTE_MS;

/** Availability lookahead used when the caller does not supply `to`. */
export const AVAILABILITY_DEFAULT_WINDOW_DAYS = 14;

/** Hard cap on the availability range a caller may request. */
export const AVAILABILITY_MAX_WINDOW_DAYS = 30;

export const DAY_MS = 24 * 60 * MINUTE_MS;

export type { LawyerDetailDto, LawyerListItemDto, LawyerListResult } from '../dto/lawyer-response.dto';
export type { AvailabilitySlotDto } from '../dto/availability-response.dto';
