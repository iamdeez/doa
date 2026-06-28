import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { ShippingRepository } from './shipping.repository';
import { ShippingService } from './shipping.service';

@Module({
  controllers: [ShippingController],
  providers: [ShippingService, ShippingRepository],
})
export class ShippingModule {}
