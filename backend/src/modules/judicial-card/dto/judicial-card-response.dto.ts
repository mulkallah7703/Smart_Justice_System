import type { CardTier } from '@prisma/client';

export interface JudicialCardResponseDto {
  cardNumber: string;
  holderName: string;
  tier: CardTier;
  discountPct: number;
  validUntil: string;
  issuedAt: string;
}

export interface JudicialCardQrResponseDto {
  payload: string;
  expiresAt: string;
}
