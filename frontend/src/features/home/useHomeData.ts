import { useEffect, useMemo, useState } from 'react';

import { ar } from '../../core/i18n/ar';
import { isDomainLive, isRealApiMode } from '../../shared/api/mode';
import { authStore } from '../auth/authStore';
import { getLegalCases } from '../legal-file/legalFileApi';
import { mapFrontendCaseToHome } from '../legal-file/mapCase';
import { getCurrentUser } from '../profile/profileApi';
import type { FrontendUser } from '../../shared/api/types';

import type { HomeCase, HomeData, HomeJudicialCard } from './home.types';

const tierToHome = (
  tier: FrontendUser['tier'],
): HomeJudicialCard['tier'] => {
  if (tier === 'GOLD') return 'gold';
  if (tier === 'NORMAL') return 'normal';
  return 'silver';
};

const tierLabel = (tier: FrontendUser['tier']): string => {
  if (tier === 'GOLD') return 'ذهبية';
  if (tier === 'NORMAL') return 'عادية';
  return ar.home.card.tierLabel;
};

export const useHomeData = (): HomeData => {
  const [user, setUser] = useState<FrontendUser | null>(null);
  const [liveCases, setLiveCases] = useState<HomeCase[] | null>(null);

  const staticData = useMemo(
    () => ({
      user: {
        greeting: ar.home.greeting,
        name: ar.home.userName,
      },
      card: {
        cardNumber: ar.home.card.number,
        tier: 'silver' as const,
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
          statusVariant: 'pending' as const,
          icon: 'domain',
        },
      ],
    }),
    [],
  );

  useEffect(() => {
    if (!isRealApiMode() || !authStore.getState().accessToken) {
      return;
    }

    let active = true;
    void getCurrentUser()
      .then((data) => {
        if (active) {
          setUser(data);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isDomainLive('legal-file')) {
      return;
    }

    if (!authStore.getState().accessToken) {
      setLiveCases([]);
      return;
    }

    let active = true;
    void getLegalCases()
      .then((data) => {
        if (!active) {
          return;
        }
        setLiveCases(
          data
            .filter((item) => item.statusVariant !== 'closed')
            .map(mapFrontendCaseToHome),
        );
      })
      .catch(() => {
        if (active) {
          setLiveCases([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    ...staticData,
    user: user
      ? { greeting: staticData.user.greeting, name: user.name }
      : staticData.user,
    card: user
      ? {
          cardNumber: user.cardNumber || staticData.card.cardNumber,
          tier: tierToHome(user.tier),
          tierLabel: tierLabel(user.tier),
          discountPct: user.discountPct,
        }
      : staticData.card,
    cases: liveCases ?? staticData.cases,
    isLoading: false,
  };
};
