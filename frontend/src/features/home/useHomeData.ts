import { useMemo } from 'react';

import { ar } from '../../core/i18n/ar';

import type { HomeData } from './home.types';

export const useHomeData = (): HomeData => {
  return useMemo(
    () => ({
      user: {
        greeting: ar.home.greeting,
        name: ar.home.userName,
      },
      card: {
        cardNumber: ar.home.card.number,
        tier: 'silver',
        tierLabel: ar.home.card.tierLabel,
        discountPct: ar.home.card.discountPct,
      },
      alert: {
        title: ar.home.alert.title,
        subtitle: ar.home.alert.subtitle,
      },
      services: ar.home.services.map((service, index) => ({
        ...service,
        iconTone: (['primary', 'blue', 'warm', 'neutral'] as const)[index],
        route: ['/guide', '/advisor', '/lawyers', '/card'][index],
      })),
      cases: [
        {
          id: 'case-1',
          title: ar.home.cases.sample.title,
          caseNumber: ar.home.cases.sample.number,
          status: ar.home.cases.sample.status,
          statusVariant: 'pending',
          icon: 'domain',
        },
      ],
      isLoading: false,
    }),
    [],
  );
};
