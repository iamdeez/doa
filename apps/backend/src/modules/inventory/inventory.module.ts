import { forwardRef, Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { ProductModule } from '../product/product.module';
import { SellerModule } from '../seller/seller.module';
import { InventoryController } from './inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    SellerModule,
    AuthSharedModule,
    // SEC-002: ProductService.assertSellerOwnsVariant DI 필요.
    // ProductModule ↔ InventoryModule 순환 참조 → forwardRef 해소.
    forwardRef(() => ProductModule),
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRepository],
  exports: [InventoryService],
})
export class InventoryModule {}
