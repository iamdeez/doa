import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { OrderModule } from '../order/order.module';
import { SellerModule } from '../seller/seller.module';
import { ShippingController } from './shipping.controller';
import { ShippingRepository } from './shipping.repository';
import { ShippingService } from './shipping.service';

@Module({
  imports: [AuthSharedModule, OrderModule, SellerModule],
  controllers: [ShippingController],
  providers: [ShippingService, ShippingRepository],
  exports: [ShippingService],
})
export class ShippingModule {}
