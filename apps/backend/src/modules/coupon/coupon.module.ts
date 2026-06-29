import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { SellerModule } from '../seller/seller.module';
import {
  AdminCouponController,
  SellerCouponController,
  UserCouponController,
} from './coupon.controller';
import { CouponRepository } from './coupon.repository';
import { CouponService } from './coupon.service';

@Module({
  imports: [
    AuthSharedModule,
    SellerModule,
    // EventEmitter2: AppModule의 EventEmitterModule.forRoot()로 전역 제공됨 — 개별 import 불필요
  ],
  controllers: [
    AdminCouponController,
    SellerCouponController,
    UserCouponController,
  ],
  providers: [CouponService, CouponRepository],
  exports: [CouponService],
})
export class CouponModule {}
