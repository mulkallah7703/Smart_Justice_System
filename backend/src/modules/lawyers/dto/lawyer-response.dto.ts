import type { PaginationMeta } from '../../../shared/http/envelope';

export interface LawyerListItemDto {
  id: string;
  name: string | null;
  specialties: string[];
  city: string;
  rating: number;
  reviewCount: number;
  experienceYrs: number;
  priceFrom: number;
  isAvailable: boolean;
  isVerified: boolean;
}

export interface LawyerDetailDto extends LawyerListItemDto {
  /** Public professional credential. Exposed on detail only. */
  licenseNumber: string;
  bio: string | null;
}

export interface LawyerListResult {
  items: LawyerListItemDto[];
  pagination: PaginationMeta;
}
