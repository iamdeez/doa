import { IsOptional, IsString } from 'class-validator';

export class RegisterSellerDto {
  @IsString()
  businessName!: string;

  @IsString()
  businessNumber!: string;

  @IsString()
  representativeName!: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  businessAddress?: string;
}
