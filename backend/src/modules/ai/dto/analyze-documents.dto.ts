import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

/** Upper bound on documents per analysis, so one request cannot fan out without limit. */
export const ANALYZE_MAX_DOCUMENTS = 10;

/**
 * The only accepted body. Global validation runs with `forbidNonWhitelisted`,
 * so a client-supplied `userId` is rejected outright rather than ignored:
 * identity comes exclusively from the access token.
 */
export class AnalyzeDocumentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(ANALYZE_MAX_DOCUMENTS)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(64, { each: true })
  documentIds: string[];
}
