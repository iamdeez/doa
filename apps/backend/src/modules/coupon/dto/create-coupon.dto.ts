import {
  IsDateString,
  IsDecimal,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CouponType } from '@prisma/client';

export class CreateCouponDto {
  @IsEnum(CouponType)
  type!: CouponType;

  /** 정액(원) 또는 비율(1~100, 정수). Decimal 문자열로 전달 */
  @IsDecimal()
  discountValue!: string;

  /** PERCENTAGE 전용 최대 할인 금액 상한 */
  @IsOptional()
  @IsDecimal()
  maxDiscountAmount?: string;

  /** 최소 주문 금액 조건 */
  @IsOptional()
  @IsDecimal()
  minOrderAmount?: string;

  @IsDateString()
  expiresAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalQuantity?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
