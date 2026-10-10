import type { CardTier } from '@prisma/client';

import type {
  JudicialCardQrResponseDto,
  JudicialCardResponseDto,
} from '../dto/judicial-card-response.dto';

export interface JudicialCardRecord {
  cardNumber: string;
  tier: CardTier;
  discountPct: number;
  validUntil: Date;
  issuedAt: Date;
  user: { name: string };
}

const toIso = (value: Date): string => value.toISOString();

export const mapJudicialCard = (
  record: JudicialCardRecord,
): JudicialCardResponseDto => ({
  cardNumber: record.cardNumber,
  holderName: record.user.name,
  tier: record.tier,
  discountPct: record.discountPct,
  validUntil: toIso(record.validUntil),
  issuedAt: toIso(record.issuedAt),
});

export const mapJudicialCardQr = (input: {
  payload: string;
  expiresAt: Date;
}): JudicialCardQrResponseDto => ({
  payload: input.payload,
  expiresAt: toIso(input.expiresAt),
});
