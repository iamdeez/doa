import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemInput {
  @IsString()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items!: OrderItemInput[];

  @IsObject()
  shippingAddress!: Record<string, unknown>;

  /** 쿠폰 적용 시 userCoupon ID. 미전달 시 할인 없음 (SEC-FIND-004: 금액 직접 지정 금지) */
  @IsOptional()
  @IsString()
  userCouponId?: string;
}
