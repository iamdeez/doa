import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { SellerModule } from '../seller/seller.module';
import { InventoryController } from './inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

@Module({
  imports: [SellerModule, AuthSharedModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRepository],
  exports: [InventoryService],
})
export class InventoryModule {}
