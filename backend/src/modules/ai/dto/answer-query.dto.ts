import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { RETRIEVE_QUERY_MAX_CHARS } from './retrieve-query.dto';

/**
 * Answer body. Server owns retrieval, model, and prompts.
 * `forbidNonWhitelisted` rejects userId, model, evidence, etc.
 */
export class AnswerQueryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(RETRIEVE_QUERY_MAX_CHARS)
  query!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  caseId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  documentIds?: string[];
}
