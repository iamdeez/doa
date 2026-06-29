import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UserCouponStatus } from '@prisma/client';

export class ListUserCouponsDto {
  @IsOptional()
  @IsEnum(UserCouponStatus)
  status?: UserCouponStatus;
}

export class ListCouponsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  take?: number;
}
