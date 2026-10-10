import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';
import { apiRequest } from '../../shared/api/httpClient';
import { isMockApiMode } from '../../shared/api/mode';

import {
  mapJudicialCard,
  mapJudicialCardQr,
  type BackendJudicialCard,
  type BackendJudicialCardQr,
} from './mapJudicialCard';

import type {
  CardQrData,
  CardTier,
  JudicialCardData,
  TierOption,
  UpgradeCardPayload,
  UpgradeCardResponse,
} from './card.types';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const mockCard = (): JudicialCardData => ({
  cardNumber: ar.judicialCard.mock.cardNumber,
  holderName: ar.judicialCard.mock.holderName,
  nationalId: ar.judicialCard.mock.nationalId,
  tier: 'SILVER',
  tierLabel: ar.judicialCard.mock.tierLabel,
  discountPct: 25,
  brandName: ar.judicialCard.brandName,
  qrPayload: ar.judicialCard.mock.qrPayload,
});

export const getJudicialCard = async (): Promise<JudicialCardData> => {
  if (isMockApiMode()) {
    await wait(200);
    return mockCard();
  }

  const data = await apiRequest<BackendJudicialCard>(
    endpoints.judicialCard.detail,
  );
  return mapJudicialCard(data);
};

export const getCardQr = async (): Promise<CardQrData> => {
  if (isMockApiMode()) {
    await wait(150);
    return {
      payload: ar.judicialCard.mock.qrPayload,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  }

  const data = await apiRequest<BackendJudicialCardQr>(
    endpoints.judicialCard.qr,
  );
  return mapJudicialCardQr(data);
};

export const getTierOptions = (currentTier: CardTier): TierOption[] => [
  {
    id: 'GOLD',
    title: ar.judicialCard.upgrade.tiers.gold.title,
    description: ar.judicialCard.upgrade.tiers.gold.description,
    priceLabel: ar.judicialCard.upgrade.tiers.gold.price,
    icon: 'workspace_premium',
    badge: 'featured',
    badgeLabel: ar.judicialCard.upgrade.tiers.gold.badge,
  },
  {
    id: 'SILVER',
    title: ar.judicialCard.upgrade.tiers.silver.title,
    description: ar.judicialCard.upgrade.tiers.silver.description,
    priceLabel: ar.judicialCard.upgrade.tiers.silver.price,
    icon: 'military_tech',
    badge: currentTier === 'SILVER' ? 'current' : null,
    badgeLabel:
      currentTier === 'SILVER'
        ? ar.judicialCard.upgrade.currentBadge
        : undefined,
  },
  {
    id: 'NORMAL',
    title: ar.judicialCard.upgrade.tiers.normal.title,
    description: ar.judicialCard.upgrade.tiers.normal.description,
    priceLabel: ar.judicialCard.upgrade.tiers.normal.price,
    icon: 'badge',
    badge: currentTier === 'NORMAL' ? 'current' : null,
    badgeLabel:
      currentTier === 'NORMAL'
        ? ar.judicialCard.upgrade.currentBadge
        : undefined,
  },
];

export const upgradeJudicialCard = async (
  payload: UpgradeCardPayload,
): Promise<UpgradeCardResponse> => {
  if (isMockApiMode()) {
    await wait(500);
    return { tier: payload.tier, success: true };
  }

  const data = await apiRequest<UpgradeCardResponse>(
    endpoints.judicialCard.upgrade,
    {
      method: 'POST',
      body: { tier: payload.tier },
    },
  );
  return data;
};
