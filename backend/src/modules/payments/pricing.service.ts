import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/database/prisma.service';

import {
  applyDiscount,
  DEFAULT_CURRENCY,
  isValidDiscountPct,
  majorToMinor,
} from './money';
import { paymentConsultationNotFound, paymentPricingUnavailable } from './payments.errors';

export interface ConsultationQuote {
  consultationId: string;
  consultationType: string;
  scheduledAt: Date;
  lawyerName: string | null;
  currency: string;
  originalMinor: number;
  discountPct: number;
  discountMinor: number;
  payableMinor: number;
}

/**
 * Authoritative pricing for a consultation.
 *
 * The rule comes from the existing product contract: the base price is the
 * lawyer's `priceFrom`, the discount is the citizen's judicial card
 * `discountPct`, and the payable amount is the discounted result. The client
 * never contributes any part of this calculation.
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async quoteConsultation(
    userId: string,
    consultationId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<ConsultationQuote> {
    // Scoping by userId means another citizen's consultation is indistinguishable
    // from one that does not exist.
    const consultation = await tx.consultation.findFirst({
      where: { id: consultationId, userId, deletedAt: null },
      select: {
        id: true,
        type: true,
        scheduledAt: true,
        lawyer: {
          select: { priceFrom: true, user: { select: { name: true } } },
        },
      },
    });

    if (!consultation) {
      throw paymentConsultationNotFound();
    }

    const originalMinor = majorToMinor(consultation.lawyer.priceFrom);
    if (originalMinor <= 0) {
      throw paymentPricingUnavailable();
    }

    const card = await tx.judicialCard.findUnique({
      where: { userId },
      select: { discountPct: true },
    });

    const discountPct = card?.discountPct ?? 0;
    if (!isValidDiscountPct(discountPct)) {
      throw paymentPricingUnavailable();
    }

    const { payableMinor, discountMinor } = applyDiscount(
      originalMinor,
      discountPct,
    );

    return {
      consultationId: consultation.id,
      consultationType: consultation.type,
      scheduledAt: consultation.scheduledAt,
      lawyerName: consultation.lawyer.user?.name ?? null,
      currency: DEFAULT_CURRENCY,
      originalMinor,
      discountPct,
      discountMinor,
      payableMinor,
    };
  }
}
