import type { CardTier, Role } from '@prisma/client';

export interface JudicialCardSummaryDto {
  cardNumber: string;
  tier: CardTier;
  discountPct: number;
}

export interface UserMeDto {
  id: string;
  name: string;
  role: Role;
  card: JudicialCardSummaryDto | null;
}
