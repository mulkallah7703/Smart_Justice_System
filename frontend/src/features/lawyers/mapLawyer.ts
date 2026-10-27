import { ar } from '../../core/i18n/ar';
import { toArabicNumerals } from '../../shared/utils/arabicNumerals';

import type {
  AvailabilityTone,
  BackendLawyer,
  BackendLawyerDetail,
  Lawyer,
  LawyerProfileData,
  LawyerSpecialty,
} from './lawyers.types';

const SPECIALTY_LABELS: Record<LawyerSpecialty, string> = {
  RENTAL: ar.lawyers.filters.rental,
  PERSONAL: ar.lawyers.filters.personal,
  COMMERCIAL: ar.lawyers.filters.commercial,
  LABOR: ar.lawyers.filters.labor,
  CRIMINAL: ar.lawyers.filters.criminal,
};

const isKnownSpecialty = (value: string): value is LawyerSpecialty =>
  value in SPECIALTY_LABELS;

export const toSpecialties = (values: string[]): LawyerSpecialty[] =>
  values.filter(isKnownSpecialty);

export const specialtyLabels = (values: string[]): string[] =>
  toSpecialties(values).map((specialty) => SPECIALTY_LABELS[specialty]);

/** The backend name is optional because a lawyer need not have a linked user. */
export const lawyerDisplayName = (name: string | null): string =>
  name?.trim() || ar.lawyers.roleLabel;

export const lawyerTitle = (specialties: string[]): string => {
  const labels = specialtyLabels(specialties);
  return labels.length > 0
    ? `${ar.lawyers.roleLabel} • ${labels.join('، ')}`
    : ar.lawyers.roleLabel;
};

export const mapAvailabilityBadge = (
  isAvailable: boolean,
): { availabilityLabel: string; availabilityTone: AvailabilityTone } =>
  isAvailable
    ? {
        availabilityLabel: ar.lawyers.availability.now,
        availabilityTone: 'available',
      }
    : {
        availabilityLabel: ar.lawyers.availability.unavailable,
        availabilityTone: 'soon',
      };

/** Presentation only, derived deterministically so a lawyer keeps one tone. */
export const mapAvatarTone = (
  record: Pick<BackendLawyer, 'isVerified' | 'rating'>,
): Lawyer['avatarTone'] => {
  if (record.isVerified && record.rating >= 4.8) {
    return 'gold';
  }
  return record.isVerified ? 'primary' : 'neutral';
};

export const mapBackendLawyer = (record: BackendLawyer): Lawyer => {
  const labels = specialtyLabels(record.specialties);

  return {
    id: record.id,
    name: lawyerDisplayName(record.name),
    title: lawyerTitle(record.specialties),
    specialties: toSpecialties(record.specialties),
    specialtyLabel: labels[0] ?? ar.lawyers.roleLabel,
    rating: record.rating,
    reviewCount: record.reviewCount,
    experienceYrs: record.experienceYrs,
    priceFrom: record.priceFrom,
    isVerified: record.isVerified,
    avatarTone: mapAvatarTone(record),
    ...mapAvailabilityBadge(record.isAvailable),
  };
};

/**
 * Every stat comes from a real backend field. The mock profile's satisfaction
 * figure has no server-side source, so it is not reproduced here.
 */
export const mapBackendLawyerDetail = (
  record: BackendLawyerDetail,
): LawyerProfileData => {
  const lawyer = mapBackendLawyer(record);
  const labels = specialtyLabels(record.specialties);

  return {
    ...lawyer,
    profileTitle: ar.lawyers.profile.headerTitle,
    bio: record.bio?.trim() || ar.lawyers.profile.fallbackBio,
    expertiseTags: labels.length > 0 ? labels : [lawyer.specialtyLabel],
    stats: [
      {
        value: toArabicNumerals(record.experienceYrs),
        label: ar.lawyers.profile.statsLabels.experience,
      },
      {
        value: toArabicNumerals(record.rating.toFixed(1)),
        label: ar.lawyers.profile.statsLabels.rating,
      },
      {
        value: toArabicNumerals(record.reviewCount),
        label: ar.lawyers.profile.statsLabels.reviews,
      },
    ],
    discount: {
      title: ar.lawyers.profile.discount.title,
      subtitle: ar.lawyers.profile.discount.subtitle,
    },
    cta: ar.lawyers.profile.cta,
  };
};
