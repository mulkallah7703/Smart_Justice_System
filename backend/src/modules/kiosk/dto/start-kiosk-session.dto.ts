import { IsString, Length, Matches } from 'class-validator';

/** Public device identifier. Not a secret. */
export class StartKioskSessionDto {
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  deviceId!: string;
}
