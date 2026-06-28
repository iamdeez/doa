import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  optionName?: string;

  @IsOptional()
  @IsString()
  optionValue?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;
}
