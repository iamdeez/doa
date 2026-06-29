import { forwardRef, Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SellerModule } from '../seller/seller.module';
import {
  CategoriesController,
  ProductController,
  SellerProductController,
} from './product.controller';
import { ProductEventsHandler } from './product.events';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';

@Module({
  imports: [SellerModule, forwardRef(() => InventoryModule), AuthSharedModule],
  controllers: [ProductController, CategoriesController, SellerProductController],
  providers: [ProductService, ProductRepository, ProductEventsHandler],
  exports: [ProductService],
})
export class ProductModule {}
