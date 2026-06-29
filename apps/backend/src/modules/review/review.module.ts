import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { OrderModule } from '../order/order.module';
import { ProductReviewController, ReviewController } from './review.controller';
import { ReviewRepository } from './review.repository';
import { ReviewService } from './review.service';

@Module({
  imports: [
    AuthSharedModule,
    OrderModule,
    // EventEmitter2: AppModule의 EventEmitterModule.forRoot()로 전역 제공됨
  ],
  controllers: [ReviewController, ProductReviewController],
  providers: [ReviewService, ReviewRepository],
})
export class ReviewModule {}
