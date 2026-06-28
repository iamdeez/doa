import { Module } from '@nestjs/common';
import { SellerController } from './seller.controller';
import { SellerRepository } from './seller.repository';
import { SellerService } from './seller.service';

@Module({
  controllers: [SellerController],
  providers: [SellerService, SellerRepository],
})
export class SellerModule {}
