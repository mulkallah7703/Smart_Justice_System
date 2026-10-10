import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../shared/database/prisma.service';
import type { UpgradeJudicialCardDto } from './dto/upgrade-judicial-card.dto';
import type {
  JudicialCardQrResponseDto,
  JudicialCardResponseDto,
} from './dto/judicial-card-response.dto';
import { CardTierService } from './card-tier.service';
import { judicialCardNotFound } from './judicial-card.errors';
import {
  mapJudicialCard,
  mapJudicialCardQr,
} from './mappers/judicial-card.mapper';
import { QrGeneratorService } from './qr-generator.service';

const CARD_SELECT = {
  cardNumber: true,
  tier: true,
  discountPct: true,
  validUntil: true,
  issuedAt: true,
  user: { select: { name: true } },
} as const;

@Injectable()
export class JudicialCardService {
  private readonly logger = new Logger(JudicialCardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qrGenerator: QrGeneratorService,
    private readonly cardTierService: CardTierService,
  ) {}

  async getMine(userId: string): Promise<JudicialCardResponseDto> {
    const card = await this.prisma.judicialCard.findUnique({
      where: { userId },
      select: CARD_SELECT,
    });

    if (!card) {
      throw judicialCardNotFound();
    }

    return mapJudicialCard(card);
  }

  async getQr(userId: string): Promise<JudicialCardQrResponseDto> {
    const card = await this.prisma.judicialCard.findUnique({
      where: { userId },
      select: { cardNumber: true, tier: true },
    });

    if (!card) {
      throw judicialCardNotFound();
    }

    const generated = this.qrGenerator.buildPayload({
      cardNumber: card.cardNumber,
      tier: card.tier,
    });

    this.logger.log({ operation: 'judicialCardQr', status: 'ok' });
    return mapJudicialCardQr(generated);
  }

  async upgrade(
    userId: string,
    dto: UpgradeJudicialCardDto,
  ): Promise<never> {
    const card = await this.prisma.judicialCard.findUnique({
      where: { userId },
      select: { tier: true },
    });

    if (!card) {
      throw judicialCardNotFound();
    }

    this.cardTierService.assertUpgradeAllowed(card.tier, dto.tier);
    // Unreachable: assertUpgradeAllowed always throws until Payment phase.
    throw judicialCardNotFound();
  }
}
