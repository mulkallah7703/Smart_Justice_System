import { IsString, Length } from 'class-validator';

export class PrintKioskDto {
  @IsString()
  @Length(1, 64)
  sessionId!: string;

  @IsString()
  @Length(1, 64)
  documentId!: string;
}
