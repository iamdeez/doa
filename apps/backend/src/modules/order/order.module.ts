import { forwardRef, Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { CartModule } from '../cart/cart.module';
import { CouponModule } from '../coupon/coupon.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentModule } from '../payment/payment.module';
import { ProductModule } from '../product/product.module';
import { SellerModule } from '../seller/seller.module';
import { OrderController } from './order.controller';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';
import { SellerOrderController } from './seller-order.controller';

@Module({
  imports: [
    AuthSharedModule,
    SellerModule,
    ProductModule,
    InventoryModule,
    CartModule,
    CouponModule,
    // Order↔Payment 순환 참조 → forwardRef 해소 (ADR-007)
    forwardRef(() => PaymentModule),
  ],
  controllers: [OrderController, SellerOrderController],
  providers: [OrderService, OrderRepository],
  exports: [OrderService, OrderRepository],
})
export class OrderModule {}
