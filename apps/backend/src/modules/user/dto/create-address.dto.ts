import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  recipientName!: string;

  @IsString()
  phone!: string;

  @IsString()
  zipCode!: string;

  @IsString()
  address1!: string;

  @IsOptional()
  @IsString()
  address2?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
