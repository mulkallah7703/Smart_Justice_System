import { CaseType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Citizen-owned case. The owner id comes from the token, never the body. */
export class CreateCaseDto {
  @IsEnum(CaseType)
  type!: CaseType;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  authority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** When set, an appeal deadline and alert are created for this many days. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  objectionDays?: number;
}
