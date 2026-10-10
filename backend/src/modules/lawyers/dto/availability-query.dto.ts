import { IsISO8601, IsOptional } from 'class-validator';

export class AvailabilityQueryDto {
  /** Inclusive lower bound, ISO 8601. Defaults to now. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Exclusive upper bound, ISO 8601. Defaults to `from` + 14 days. */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
