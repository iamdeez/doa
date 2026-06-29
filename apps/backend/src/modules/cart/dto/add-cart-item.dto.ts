import { IsInt, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
