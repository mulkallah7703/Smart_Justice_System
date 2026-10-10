import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { GUIDE_MESSAGE_MAX_CHARS } from './start-guide.dto';

export class AnswerGuideDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(GUIDE_MESSAGE_MAX_CHARS)
  answer!: string;
}
