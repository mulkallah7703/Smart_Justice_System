export type LawyerSpecialty =
  | 'RENTAL'
  | 'PERSONAL'
  | 'COMMERCIAL'
  | 'LABOR';

export type AvailabilityTone = 'available' | 'soon';

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
