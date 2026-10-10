export type ConsultationTypeId =
  | 'INSTANT'
  | 'WRITTEN'
  | 'IN_PERSON'
  | 'REPRESENTATION';

export type IconTone = 'primary' | 'blue' | 'warm' | 'gold';

export interface ConsultationTypeOption {
  id: ConsultationTypeId;
  title: string;
  subtitle: string;
  icon: string;
  iconTone: IconTone;
  priceOriginal: number;
  priceDiscounted: number;
}

export interface BookingDateOption {
  id: string;
  dayLabel: string;
  dateLabel: string;
}

/**
 * The slot id is the UTC ISO instant sent back as `scheduledAt`, so the display
 * label and the API value never have to be reconstructed from one another.
 */
export interface BookingTimeSlot {
  id: string;
  label: string;
  available: boolean;
}

export interface BookingDay extends BookingDateOption {
  slots: BookingTimeSlot[];
}

/** Shape returned by GET /lawyers/:id/availability. */
export interface BackendAvailabilitySlot {
  slotId: string;
  startAt: string;
  endAt: string;
  durationMin: number;
}

/** Shape returned by POST /consultations and GET /consultations/:id. */
export interface BackendConsultation {
  id: string;
  type: ConsultationTypeId;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  scheduledAt: string;
  durationMin: number;
  notes: string | null;
  createdAt: string;
  lawyer: {
    id: string;
    name: string | null;
    city: string;
    specialties: string[];
  };
}

export interface BookConsultationPayload {
  lawyerId: string;
  type: ConsultationTypeId;
  /** UTC ISO instant taken straight from the availability response. */
  scheduledAt: string;
}

export interface BookConsultationResponse {
  consultationId: string;
}
