import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DocumentUploadDto {
  @IsString()
  @IsNotEmpty()
  caseId: string;
}

export class DocumentListQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  caseId?: string;
}
