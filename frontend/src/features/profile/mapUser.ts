import { ar } from '../../core/i18n/ar';

import type { BackendUser, FrontendUser } from '../../shared/api/types';

import type { UserProfile } from './profile.types';

const CARD_LABELS = ar.profile.cardLabels;

export const mapUserToProfile = (user: BackendUser): UserProfile => {
  const mapped = mapBackendUser(user);
  return {
    name: mapped.name,
    cardLabel: mapped.cardLabel,
    cardNumber: mapped.cardNumber,
  };
};

export const mapBackendUser = (user: BackendUser): FrontendUser => {
  const tier = user.card?.tier ?? null;

  return {
    name: user.name,
    cardLabel: tier ? CARD_LABELS[tier] : ar.profile.mock.cardLabel,
    cardNumber: user.card?.cardNumber ?? '',
    tier,
    discountPct: user.card?.discountPct ?? 0,
  };
};
