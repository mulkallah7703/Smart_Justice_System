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

export interface BookingTimeSlot {
  id: string;
  label: string;
  available: boolean;
}

export interface BookConsultationPayload {
  lawyerId: string;
  type: ConsultationTypeId;
  dateId: string;
  timeId: string;
}

export interface BookConsultationResponse {
  consultationId: string;
}
