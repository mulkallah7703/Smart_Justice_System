import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';

import type {
  Lawyer,
  LawyerProfileData,
  LawyersQuery,
  LawyerSpecialty,
} from './lawyers.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const mockLawyers = (): Lawyer[] => [
  {
    id: 'lawyer-1',
    name: ar.lawyers.mock.sarah.name,
    title: ar.lawyers.mock.sarah.title,
    specialties: ['RENTAL'],
    specialtyLabel: ar.lawyers.filters.rental,
    rating: 4.9,
    reviewCount: 142,
    experienceYrs: 12,
    priceFrom: 150,
    isVerified: true,
    availabilityLabel: ar.lawyers.availability.now,
    availabilityTone: 'available',
    avatarTone: 'primary',
  },
  {
    id: 'lawyer-2',
    name: ar.lawyers.mock.khalid.name,
    title: ar.lawyers.mock.khalid.title,
    specialties: ['PERSONAL', 'RENTAL'],
    specialtyLabel: ar.lawyers.filters.personal,
    rating: 4.7,
    reviewCount: 96,
    experienceYrs: 9,
    priceFrom: 120,
    isVerified: true,
    availabilityLabel: ar.lawyers.availability.withinHour,
    availabilityTone: 'soon',
    avatarTone: 'neutral',
  },
  {
    id: 'lawyer-3',
    name: ar.lawyers.mock.noura.name,
    title: ar.lawyers.mock.noura.title,
    specialties: ['COMMERCIAL'],
    specialtyLabel: ar.lawyers.filters.commercial,
    rating: 4.8,
    reviewCount: 210,
    experienceYrs: 15,
    priceFrom: 180,
    isVerified: true,
    availabilityLabel: ar.lawyers.availability.now,
    availabilityTone: 'available',
    avatarTone: 'gold',
  },
];

const toProfile = (lawyer: Lawyer): LawyerProfileData => {
  if (lawyer.id === 'lawyer-1') {
    return {
      ...lawyer,
      title: ar.lawyers.profile.sarah.licensedTitle,
      profileTitle: ar.lawyers.profile.headerTitle,
      bio: ar.lawyers.profile.sarah.bio,
      expertiseTags: [...ar.lawyers.profile.sarah.tags],
      stats: [
        {
          value: ar.lawyers.profile.sarah.stats.experience,
          label: ar.lawyers.profile.statsLabels.experience,
        },
        {
          value: ar.lawyers.profile.sarah.stats.cases,
          label: ar.lawyers.profile.statsLabels.cases,
        },
        {
          value: ar.lawyers.profile.sarah.stats.satisfaction,
          label: ar.lawyers.profile.statsLabels.satisfaction,
        },
      ],
      discount: {
        title: ar.lawyers.profile.discount.title,
        subtitle: ar.lawyers.profile.discount.subtitle,
      },
      cta: ar.lawyers.profile.cta,
    };
  }

  return {
    ...lawyer,
    profileTitle: ar.lawyers.profile.headerTitle,
    bio: ar.lawyers.profile.fallbackBio,
    expertiseTags: [lawyer.specialtyLabel],
    stats: [
      {
        value: String(lawyer.experienceYrs),
        label: ar.lawyers.profile.statsLabels.experience,
      },
      {
        value: `+${lawyer.reviewCount}`,
        label: ar.lawyers.profile.statsLabels.cases,
      },
      {
        value: '90%',
        label: ar.lawyers.profile.statsLabels.satisfaction,
      },
    ],
    discount: {
      title: ar.lawyers.profile.discount.title,
      subtitle: ar.lawyers.profile.discount.subtitle,
    },
    cta: ar.lawyers.profile.cta,
  };
};

const matchesSpecialty = (
  lawyer: Lawyer,
  specialty?: LawyerSpecialty | 'all',
): boolean => {
  if (!specialty || specialty === 'all') {
    return true;
  }
  return lawyer.specialties.includes(specialty);
};

const matchesQuery = (lawyer: Lawyer, q?: string): boolean => {
  if (!q?.trim()) {
    return true;
  }
  const needle = q.trim().toLowerCase();
  return (
    lawyer.name.toLowerCase().includes(needle) ||
    lawyer.title.toLowerCase().includes(needle) ||
    lawyer.specialtyLabel.toLowerCase().includes(needle)
  );
};

export const fetchLawyers = async (
  query: LawyersQuery = {},
): Promise<Lawyer[]> => {
  if (!API_BASE_URL) {
    await wait(280);
    return mockLawyers().filter(
      (lawyer) =>
        matchesSpecialty(lawyer, query.specialty) &&
        matchesQuery(lawyer, query.q),
    );
  }

  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.specialty && query.specialty !== 'all') {
    params.set('specialty', query.specialty);
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoints.lawyers.list}?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error('LAWYERS_FETCH_FAILED');
  }

  const json = (await response.json()) as { data: Lawyer[] };
  return json.data;
};

export const fetchLawyerById = async (
  id: string,
): Promise<LawyerProfileData> => {
  if (!API_BASE_URL) {
    await wait(250);
    const lawyer =
      mockLawyers().find((item) => item.id === id) ?? mockLawyers()[0];
    return toProfile(lawyer);
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoints.lawyers.detail(id)}`,
  );

  if (!response.ok) {
    throw new Error('LAWYER_DETAIL_FAILED');
  }

  const json = (await response.json()) as { data: LawyerProfileData };
  return json.data;
};
