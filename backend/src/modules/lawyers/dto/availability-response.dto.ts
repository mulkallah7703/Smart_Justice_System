export interface AvailabilitySlotDto {
  /** The availability window this bookable block belongs to. */
  slotId: string;
  /** UTC ISO 8601. Send this value back as `scheduledAt` when booking. */
  startAt: string;
  /** UTC ISO 8601. `startAt` plus the fixed consultation duration. */
  endAt: string;
  durationMin: number;
}
