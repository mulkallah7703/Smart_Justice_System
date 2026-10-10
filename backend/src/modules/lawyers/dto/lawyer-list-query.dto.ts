import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CaseType } from '@prisma/client';

export class LawyerListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  /**
   * Specialty values reuse the CaseType enum, which is what the frontend
   * specialty filter already sends.
   */
  @IsOptional()
  @IsEnum(CaseType)
  specialty?: CaseType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
