import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import {
  AdminBannerController,
  BannerController,
} from './banner.controller';
import { BannerRepository } from './banner.repository';
import { BannerService } from './banner.service';

@Module({
  imports: [AuthSharedModule],
  controllers: [AdminBannerController, BannerController],
  providers: [BannerService, BannerRepository],
  exports: [BannerService],
})
export class BannerModule {}
