import { IsOptional, IsString } from 'class-validator';

export class UpdateSellerDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  businessNumber?: string;

  @IsOptional()
  @IsString()
  representativeName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  businessAddress?: string | null;
}
