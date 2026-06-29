import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { OrderModule } from '../order/order.module';
import { SellerModule } from '../seller/seller.module';
import {
  AdminSettlementController,
  SettlementController,
} from './settlement.controller';
import { SettlementRepository } from './settlement.repository';
import { SettlementService } from './settlement.service';

@Module({
  imports: [AuthSharedModule, OrderModule, SellerModule],
  controllers: [SettlementController, AdminSettlementController],
  providers: [SettlementService, SettlementRepository],
  exports: [SettlementService],
})
export class SettlementModule {}
