import { IsIn, IsString, Length } from 'class-validator';

export class ScanKioskDto {
  @IsString()
  @Length(1, 64)
  sessionId!: string;

  @IsIn(['qr', 'card'])
  mode!: 'qr' | 'card';
}
