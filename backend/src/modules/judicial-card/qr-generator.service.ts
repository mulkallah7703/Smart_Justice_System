import { createHash, randomBytes } from 'crypto';

import { Injectable } from '@nestjs/common';
import type { CardTier } from '@prisma/client';

const QR_TTL_MS = 5 * 60 * 1000;

/**
 * Builds a short-lived, opaque QR payload for the in-app faux QR pattern.
 * Not a government-signed credential. Contains no JWT, national ID, or secrets.
 */
@Injectable()
export class QrGeneratorService {
  buildPayload(input: {
    cardNumber: string;
    tier: CardTier;
  }): { payload: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + QR_TTL_MS);
    const nonce = randomBytes(8).toString('hex');
    const digest = createHash('sha256')
      .update(`${input.cardNumber}|${input.tier}|${expiresAt.toISOString()}|${nonce}`)
      .digest('hex')
      .slice(0, 16);

    // Versioned opaque token. cardNumber is already shown on the card face.
    const payload = `sjc:v1:${input.cardNumber}:${input.tier}:${expiresAt.getTime()}:${digest}`;

    return { payload, expiresAt };
  }
}
