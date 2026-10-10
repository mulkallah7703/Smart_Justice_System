import { CaseType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * The owner is the authenticated user. `userId`, `status`, `caseNumber`, and
 * `lawyerId` are intentionally absent and rejected by the whitelist pipe.
 */
export class CreateCaseDto {
  @IsEnum(CaseType)
  type!: CaseType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  authority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
