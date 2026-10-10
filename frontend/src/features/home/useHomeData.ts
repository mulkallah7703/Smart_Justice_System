import { useEffect, useMemo, useState } from 'react';

import { ar } from '../../core/i18n/ar';
import { isDomainLive, isRealApiMode } from '../../shared/api/mode';
import { fetchAlerts } from '../alerts/alertsApi';
import { alertsStore } from '../alerts/alertsStore';
import { authStore } from '../auth/authStore';
import { getLegalCases } from '../legal-file/legalFileApi';
import { mapFrontendCaseToHome } from '../legal-file/mapCase';
import { getCurrentUser } from '../profile/profileApi';
import type { FrontendUser } from '../../shared/api/types';

import type { HomeAlert, HomeCase, HomeData, HomeJudicialCard } from './home.types';

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
  const real = isRealApiMode();
  const [user, setUser] = useState<FrontendUser | null>(null);
  const [userReady, setUserReady] = useState(!real);
  const [liveCases, setLiveCases] = useState<HomeCase[] | null>(real ? [] : null);
  const [casesReady, setCasesReady] = useState(!real);
  const [alert, setAlert] = useState<HomeAlert | null>(
    real
      ? null
      : {
          title: ar.home.alert.title,
          subtitle: ar.home.alert.subtitle,
        },
  );
  const [alertsReady, setAlertsReady] = useState(!real);

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
    if (!real || !authStore.getState().accessToken) {
      setUserReady(true);
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
      })
      .finally(() => {
        if (active) {
          setUserReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [real]);

  useEffect(() => {
    if (!isDomainLive('legal-file')) {
      setCasesReady(true);
      return;
    }

    if (!authStore.getState().accessToken) {
      setLiveCases([]);
      setCasesReady(true);
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
      })
      .finally(() => {
        if (active) {
          setCasesReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!real || !authStore.getState().accessToken) {
      setAlertsReady(true);
      return;
    }

    let active = true;
    void fetchAlerts()
      .then((data) => {
        if (!active) {
          return;
        }
        alertsStore.getState().setUnreadCount(
          data.filter((item) => !item.isRead).length,
        );
        const first = data.find((item) => !item.isRead) ?? null;
        setAlert(
          first
            ? { title: first.titleAr, subtitle: first.bodyAr }
            : null,
        );
      })
      .catch(() => {
        if (active) {
          setAlert(null);
          alertsStore.getState().setUnreadCount(0);
        }
      })
      .finally(() => {
        if (active) {
          setAlertsReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [real]);

  const card: HomeJudicialCard | null = real
    ? user
      ? {
          cardNumber: user.cardNumber || '—',
          tier: tierToHome(user.tier),
          tierLabel: tierLabel(user.tier),
          discountPct: user.discountPct,
        }
      : null
    : staticData.card;

  return {
    user: user
      ? { greeting: staticData.user.greeting, name: user.name }
      : real
        ? { greeting: staticData.user.greeting, name: '' }
        : staticData.user,
    card,
    alert,
    services: staticData.services,
    cases: real ? (liveCases ?? []) : staticData.cases,
    isLoading: real && (!userReady || !casesReady || !alertsReady),
  };
};
