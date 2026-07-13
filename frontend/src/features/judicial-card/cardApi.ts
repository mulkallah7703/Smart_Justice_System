import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';

import type {
  CardQrData,
  CardTier,
  JudicialCardData,
  TierOption,
  UpgradeCardPayload,
  UpgradeCardResponse,
} from './card.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const getJudicialCard = async (): Promise<JudicialCardData> => {
  if (!API_BASE_URL) {
    await wait(200);
    return {
      cardNumber: ar.judicialCard.mock.cardNumber,
      holderName: ar.judicialCard.mock.holderName,
      nationalId: ar.judicialCard.mock.nationalId,
      tier: 'SILVER',
      tierLabel: ar.judicialCard.mock.tierLabel,
      discountPct: 25,
      brandName: ar.judicialCard.brandName,
      qrPayload: ar.judicialCard.mock.qrPayload,
    };
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoints.judicialCard.detail}`,
  );

  if (!response.ok) {
    throw new Error('JUDICIAL_CARD_FAILED');
  }

  const json = (await response.json()) as { data: JudicialCardData };
  return json.data;
};

export const getCardQr = async (): Promise<CardQrData> => {
  if (!API_BASE_URL) {
    await wait(150);
    return {
      payload: ar.judicialCard.mock.qrPayload,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.judicialCard.qr}`);

  if (!response.ok) {
    throw new Error('JUDICIAL_CARD_QR_FAILED');
  }

  const json = (await response.json()) as { data: CardQrData };
  return json.data;
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
  if (!API_BASE_URL) {
    await wait(500);
    return { tier: payload.tier, success: true };
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoints.judicialCard.upgrade}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error('JUDICIAL_CARD_UPGRADE_FAILED');
  }

  const json = (await response.json()) as { data: UpgradeCardResponse };
  return json.data;
};
