import { ConsultationType } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * The authenticated citizen is taken from the JWT. `userId`, `status`,
 * `durationMin`, and any payment field are deliberately absent and are
 * rejected by the global whitelist validation pipe.
 */
export class CreateConsultationDto {
  @IsString()
  @MaxLength(64)
  lawyerId!: string;

  /** UTC ISO 8601 instant, taken from the availability endpoint. */
  @IsISO8601()
  scheduledAt!: string;

  @IsEnum(ConsultationType)
  type!: ConsultationType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
