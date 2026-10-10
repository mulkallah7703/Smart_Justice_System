import type { AvailabilitySlotDto } from '../dto/availability-response.dto';
import type { LawyerDetailDto, LawyerListItemDto } from '../dto/lawyer-response.dto';
import { CONSULTATION_DURATION_MIN } from '../types/lawyers.types';

export interface LawyerListRecord {
  id: string;
  specialties: string[];
  city: string;
  rating: number;
  reviewCount: number;
  experienceYrs: number;
  priceFrom: number;
  isAvailable: boolean;
  isVerified: boolean;
  user: { name: string } | null;
}

export interface LawyerDetailRecord extends LawyerListRecord {
  licenseNumber: string;
  bio: string | null;
}

export const mapLawyerListItem = (record: LawyerListRecord): LawyerListItemDto => ({
  id: record.id,
  name: record.user?.name ?? null,
  specialties: record.specialties,
  city: record.city,
  rating: record.rating,
  reviewCount: record.reviewCount,
  experienceYrs: record.experienceYrs,
  priceFrom: record.priceFrom,
  isAvailable: record.isAvailable,
  isVerified: record.isVerified,
});

export const mapLawyerDetail = (record: LawyerDetailRecord): LawyerDetailDto => ({
  ...mapLawyerListItem(record),
  licenseNumber: record.licenseNumber,
  bio: record.bio,
});

export const mapAvailabilitySlot = (block: {
  slotId: string;
  startAt: Date;
  endAt: Date;
}): AvailabilitySlotDto => ({
  slotId: block.slotId,
  startAt: block.startAt.toISOString(),
  endAt: block.endAt.toISOString(),
  durationMin: CONSULTATION_DURATION_MIN,
});
