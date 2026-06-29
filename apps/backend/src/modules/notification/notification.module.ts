import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { OrderModule } from '../order/order.module';
import { SellerModule } from '../seller/seller.module';
import { ProductModule } from '../product/product.module';
import { NotificationController } from './notification.controller';
import { NotificationEventsHandler } from './notification.events';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

/**
 * 사용자 알림 모듈 (006-notification + 009 이벤트 연동).
 * NotificationService 를 export — 타 도메인이 DI 로 알림 생성 직접 호출 가능.
 * NotificationEventsHandler 가 도메인 이벤트(order·shipping·settlement·review)를 구독하여 알림 생성.
 * 수신자 해석은 Order/Seller/Product Service read-only 공개 메서드 DI 경유(P-001). 순환 의존 없음
 * (order·seller·product 어느 것도 notification 을 import 하지 않음).
 */
@Module({
  imports: [AuthSharedModule, OrderModule, SellerModule, ProductModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationRepository, NotificationEventsHandler],
  exports: [NotificationService],
})
export class NotificationModule {}
