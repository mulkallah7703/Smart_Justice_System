import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class NafathVerifyDto {
  @IsString()
  @IsNotEmpty()
  nationalId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  nafathCode: number;
}
