import type { ConsultationStatus, ConsultationType } from '@prisma/client';

import type { ConsultationDto } from '../dto/consultation-response.dto';

export interface ConsultationRecord {
  id: string;
  type: ConsultationType;
  status: ConsultationStatus;
  scheduledAt: Date;
  durationMin: number;
  notes: string | null;
  createdAt: Date;
  lawyer: {
    id: string;
    city: string;
    specialties: string[];
    user: { name: string } | null;
  };
}

export const mapConsultation = (record: ConsultationRecord): ConsultationDto => ({
  id: record.id,
  type: record.type,
  status: record.status,
  scheduledAt: record.scheduledAt.toISOString(),
  durationMin: record.durationMin,
  notes: record.notes,
  createdAt: record.createdAt.toISOString(),
  lawyer: {
    id: record.lawyer.id,
    name: record.lawyer.user?.name ?? null,
    city: record.lawyer.city,
    specialties: record.lawyer.specialties,
  },
});
