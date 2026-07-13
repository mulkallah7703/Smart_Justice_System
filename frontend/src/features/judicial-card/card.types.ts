export type CardTier = 'NORMAL' | 'SILVER' | 'GOLD';

export interface JudicialCardData {
  cardNumber: string;
  holderName: string;
  nationalId: string;
  tier: CardTier;
  tierLabel: string;
  discountPct: number;
  brandName: string;
  qrPayload: string;
}

export interface CardQrData {
  payload: string;
  expiresAt: string;
}

export type TierBadgeKind = 'featured' | 'current' | null;

export interface TierOption {
  id: CardTier;
  title: string;
  description: string;
  priceLabel: string;
  icon: string;
  badge: TierBadgeKind;
  badgeLabel?: string;
}

export interface UpgradeCardPayload {
  tier: CardTier;
}

export interface UpgradeCardResponse {
  tier: CardTier;
  success: boolean;
}
