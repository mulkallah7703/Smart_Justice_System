import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Matches AI_CHUNK_MAX_CHARS default — query must fit a single embedding input. */
export const RETRIEVE_QUERY_MAX_CHARS = 2000;

/** Hard API ceiling; env AI_RETRIEVAL_MAX_LIMIT must not exceed this DTO Max. */
export const RETRIEVE_LIMIT_MAX = 20;

/**
 * Evidence retrieval body. Identity comes only from the JWT.
 * `forbidNonWhitelisted` rejects a client-supplied `userId`.
 */
export class RetrieveQueryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(RETRIEVE_QUERY_MAX_CHARS)
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RETRIEVE_LIMIT_MAX)
  limit?: number;

  /** Optional cosine similarity floor (0..1). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;

  /** Limits retrieval to one case owned by the caller. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  caseId?: string;

  /** Limits retrieval to these documents after an ownership check. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  documentIds?: string[];
}
