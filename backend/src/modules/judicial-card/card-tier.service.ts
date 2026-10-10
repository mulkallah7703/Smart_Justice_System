import { Injectable } from '@nestjs/common';
import type { CardTier } from '@prisma/client';

import { judicialCardUpgradeUnavailable } from './judicial-card.errors';

const TIER_RANK: Record<CardTier, number> = {
  NORMAL: 0,
  SILVER: 1,
  GOLD: 2,
};

/**
 * Tier upgrade is intentionally blocked until the Payment phase.
 * Validates the request shape/rank only, then rejects without mutating data.
 */
@Injectable()
export class CardTierService {
  assertUpgradeAllowed(current: CardTier, requested: CardTier): void {
    if (TIER_RANK[requested] <= TIER_RANK[current]) {
      throw judicialCardUpgradeUnavailable();
    }
    throw judicialCardUpgradeUnavailable();
  }
}
