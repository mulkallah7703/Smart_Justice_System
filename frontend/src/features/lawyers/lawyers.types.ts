export type LawyerSpecialty =
  | 'RENTAL'
  | 'PERSONAL'
  | 'COMMERCIAL'
  | 'LABOR';

export type AvailabilityTone = 'available' | 'soon';

/** Shape returned by GET /lawyers. Never rendered directly. */
export interface BackendLawyer {
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

/** Shape returned by GET /lawyers/:id. */
export interface BackendLawyerDetail extends BackendLawyer {
  licenseNumber: string;
  bio: string | null;
}

export interface Lawyer {
  id: string;
  name: string;
  title: string;
  specialties: LawyerSpecialty[];
  specialtyLabel: string;
  rating: number;
  reviewCount: number;
  experienceYrs: number;
  priceFrom: number;
  isVerified: boolean;
  availabilityLabel: string;
  availabilityTone: AvailabilityTone;
  avatarTone: 'primary' | 'neutral' | 'gold';
}

export interface LawyersQuery {
  q?: string;
  specialty?: LawyerSpecialty | 'all';
}

export interface LawyerProfileStat {
  value: string;
  label: string;
}

export interface LawyerProfileDiscount {
  title: string;
  subtitle: string;
}

export interface LawyerProfileData extends Lawyer {
  profileTitle: string;
  bio: string;
  expertiseTags: string[];
  stats: LawyerProfileStat[];
  discount: LawyerProfileDiscount;
  cta: string;
}
