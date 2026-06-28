import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { SellerController } from './seller.controller';
import { SellerRepository } from './seller.repository';
import { SellerService } from './seller.service';

@Module({
  imports: [AuthSharedModule],
  controllers: [SellerController],
  providers: [SellerService, SellerRepository],
  exports: [SellerService],
})
export class SellerModule {}
