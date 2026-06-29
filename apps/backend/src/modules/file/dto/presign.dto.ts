import { FilePurpose } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

/** POST /files/presign body (006-file) */
export class PresignDto {
  @IsEnum(FilePurpose)
  purpose!: FilePurpose;

  @IsString()
  contentType!: string;
}
