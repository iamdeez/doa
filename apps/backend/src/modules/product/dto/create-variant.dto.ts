import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVariantDto {
  @IsString()
  optionName!: string;

  @IsString()
  optionValue!: string;

  @IsString()
  sku!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  initialStock?: number;
}
