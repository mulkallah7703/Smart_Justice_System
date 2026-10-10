import { describe, expect, it } from 'vitest';

import { ar } from '../../core/i18n/ar';

import {
  mapAvatarTone,
  mapAvailabilityBadge,
  mapBackendLawyer,
  mapBackendLawyerDetail,
  specialtyLabels,
} from './mapLawyer';
import type { BackendLawyerDetail } from './lawyers.types';

const backendLawyer = (
  overrides: Partial<BackendLawyerDetail> = {},
): BackendLawyerDetail => ({
  id: 'lawyer_1',
  name: 'أ. سارة المطيري',
  specialties: ['RENTAL', 'COMMERCIAL'],
  city: 'Riyadh',
  rating: 4.9,
  reviewCount: 142,
  experienceYrs: 12,
  priceFrom: 150,
  isAvailable: true,
  isVerified: true,
  licenseNumber: 'DEV-LIC-0001',
  bio: 'نبذة حقيقية',
  ...overrides,
});

describe('mapBackendLawyer', () => {
  it('maps the backend contract onto the existing card model', () => {
    const lawyer = mapBackendLawyer(backendLawyer());

    expect(lawyer).toMatchObject({
      id: 'lawyer_1',
      name: 'أ. سارة المطيري',
      specialties: ['RENTAL', 'COMMERCIAL'],
      specialtyLabel: ar.lawyers.filters.rental,
      rating: 4.9,
      reviewCount: 142,
      experienceYrs: 12,
      priceFrom: 150,
      isVerified: true,
      availabilityLabel: ar.lawyers.availability.now,
      availabilityTone: 'available',
    });
    expect(lawyer.title).toContain(ar.lawyers.filters.commercial);
  });

  it('never leaks backend-only fields into the UI model', () => {
    const lawyer = mapBackendLawyer(backendLawyer());

    expect(lawyer).not.toHaveProperty('licenseNumber');
    expect(lawyer).not.toHaveProperty('city');
    expect(lawyer).not.toHaveProperty('isAvailable');
  });

  it('falls back to the role label when the lawyer has no linked user', () => {
    expect(mapBackendLawyer(backendLawyer({ name: null })).name).toBe(
      ar.lawyers.roleLabel,
    );
  });

  it('marks an unavailable lawyer without claiming a later opening', () => {
    expect(mapAvailabilityBadge(false)).toEqual({
      availabilityLabel: ar.lawyers.availability.unavailable,
      availabilityTone: 'soon',
    });
  });

  it('drops specialties the UI does not know about', () => {
    const lawyer = mapBackendLawyer(
      backendLawyer({ specialties: ['RENTAL', 'TRAFFIC'] }),
    );

    expect(lawyer.specialties).toEqual(['RENTAL']);
    expect(specialtyLabels(['TRAFFIC'])).toEqual([]);
  });

  it('derives a stable avatar tone', () => {
    expect(mapAvatarTone({ isVerified: true, rating: 4.9 })).toBe('gold');
    expect(mapAvatarTone({ isVerified: true, rating: 4.2 })).toBe('primary');
    expect(mapAvatarTone({ isVerified: false, rating: 4.9 })).toBe('neutral');
  });
});

describe('mapBackendLawyerDetail', () => {
  it('builds the profile from real backend values only', () => {
    const profile = mapBackendLawyerDetail(backendLawyer());

    expect(profile.bio).toBe('نبذة حقيقية');
    expect(profile.expertiseTags).toEqual([
      ar.lawyers.filters.rental,
      ar.lawyers.filters.commercial,
    ]);
    expect(profile.stats.map((stat) => stat.value)).toEqual([
      '١٢',
      '٤.٩',
      '١٤٢',
    ]);
    expect(profile).not.toHaveProperty('licenseNumber');
  });

  it('uses the shared fallback bio when the backend has none', () => {
    expect(mapBackendLawyerDetail(backendLawyer({ bio: null })).bio).toBe(
      ar.lawyers.profile.fallbackBio,
    );
  });
});
