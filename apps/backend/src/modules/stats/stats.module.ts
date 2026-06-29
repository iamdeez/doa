import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { OrderModule } from '../order/order.module';
import { SellerModule } from '../seller/seller.module';
import { UserModule } from '../user/user.module';
import {
  AdminStatsController,
  SellerStatsController,
} from './stats.controller';
import { StatsRepository } from './stats.repository';
import { StatsService } from './stats.service';

@Module({
  imports: [AuthSharedModule, OrderModule, UserModule, SellerModule],
  controllers: [AdminStatsController, SellerStatsController],
  providers: [StatsService, StatsRepository],
})
export class StatsModule {}
