import { IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddImageDto {
  @IsString()
  @IsUrl()
  url!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
