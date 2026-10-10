import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Matches AI_GUIDE_MAX_MESSAGE_CHARS default / DTO ceiling. */
export const GUIDE_MESSAGE_MAX_CHARS = 2000;

export class StartGuideDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(GUIDE_MESSAGE_MAX_CHARS)
  initialMessage?: string;
}
