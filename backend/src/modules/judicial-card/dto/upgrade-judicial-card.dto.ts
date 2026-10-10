import { IsEnum } from 'class-validator';
import { CardTier } from '@prisma/client';

export class UpgradeJudicialCardDto {
  @IsEnum(CardTier)
  tier!: CardTier;
}
