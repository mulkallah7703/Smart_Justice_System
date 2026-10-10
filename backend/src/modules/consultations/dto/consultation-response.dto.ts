import type { ConsultationStatus, ConsultationType } from '@prisma/client';

import type { PaginationMeta } from '../../../shared/http/envelope';

export interface ConsultationLawyerDto {
  id: string;
  name: string | null;
  city: string;
  specialties: string[];
}

export interface ConsultationDto {
  id: string;
  type: ConsultationType;
  status: ConsultationStatus;
  /** UTC ISO 8601. */
  scheduledAt: string;
  durationMin: number;
  notes: string | null;
  createdAt: string;
  lawyer: ConsultationLawyerDto;
}

export interface ConsultationListResult {
  items: ConsultationDto[];
  pagination: PaginationMeta;
}
