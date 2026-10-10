import { ar } from '../../core/i18n/ar';

import type { CardQrData, CardTier, JudicialCardData } from './card.types';

export interface BackendJudicialCard {
  cardNumber: string;
  holderName: string;
  tier: CardTier;
  discountPct: number;
  validUntil: string;
  issuedAt: string;
}

export interface BackendJudicialCardQr {
  payload: string;
  expiresAt: string;
}

const TIER_LABELS: Record<CardTier, string> = {
  NORMAL: 'عادية',
  SILVER: 'فضية',
  GOLD: 'ذهبية',
};

export const mapJudicialCard = (
  dto: BackendJudicialCard,
  qrPayload = '',
): JudicialCardData => ({
  cardNumber: dto.cardNumber,
  holderName: dto.holderName,
  // National ID is never returned by the backend; keep the UI type stable.
  nationalId: '',
  tier: dto.tier,
  tierLabel: TIER_LABELS[dto.tier] ?? dto.tier,
  discountPct: dto.discountPct,
  brandName: ar.judicialCard.brandName,
  qrPayload,
});

export const mapJudicialCardQr = (dto: BackendJudicialCardQr): CardQrData => ({
  payload: dto.payload,
  expiresAt: dto.expiresAt,
});
