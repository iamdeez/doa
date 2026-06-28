import { Module } from '@nestjs/common';
import { CouponController } from './coupon.controller';
import { CouponRepository } from './coupon.repository';
import { CouponService } from './coupon.service';

@Module({
  controllers: [CouponController],
  providers: [CouponService, CouponRepository],
})
export class CouponModule {}
