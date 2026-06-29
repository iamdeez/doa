// Notification 도메인 이벤트 구독 핸들러 (009 — GAP-006-01 알림 이벤트 연동)
//
// 책임: 타 도메인의 인-프로세스 이벤트를 구독하여 알림을 생성한다.
//   - 알림 생성 로직을 publisher(order·shipping·settlement·review) 에 끼워넣지 않고
//     본 핸들러가 구독(@OnEvent)하여 결합도·회귀 위험을 최소화한다.
//   - 수신자(users.users.id) 해석은 타 도메인 Service 의 read-only 공개 메서드 DI 로만 수행(P-001).
//   - 알림은 부가 기능이므로 생성·해석 실패가 원 흐름에 전파되지 않도록 격리(try/catch + 로깅).

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { OrderService } from '../order/order.service';
import { ProductService } from '../product/product.service';
import { SellerService } from '../seller/seller.service';
import { ORDER_EVENTS, OrderCreatedPayload } from '../order/order.events';
import { SHIPPING_EVENTS } from '../shipping/shipping.events';
import {
  SETTLEMENT_EVENTS,
  SettlementCreatedPayload,
} from '../settlement/settlement.events';
import { ReviewCreatedPayload } from '../review/review.events';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationEventsHandler {
  private readonly logger = new Logger(NotificationEventsHandler.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly orderService: OrderService,
    private readonly sellerService: SellerService,
    private readonly productService: ProductService,
  ) {}

  /** ORDER_PLACED → 구매자(order.userId 직접). */
  @OnEvent(ORDER_EVENTS.CREATED)
  async onOrderCreated(payload: OrderCreatedPayload): Promise<void> {
    await this.safeNotify('order.created', () =>
      this.notificationService.create(
        payload.userId,
        NotificationType.ORDER_PLACED,
        '주문이 접수되었습니다',
        `주문 ${payload.orderId} 가 정상 접수되었습니다.`,
      ),
    );
  }

  /** ORDER_SHIPPED → 구매자(order.userId, OrderService 해석). */
  @OnEvent(SHIPPING_EVENTS.SHIPPED)
  async onShipmentShipped(payload: {
    orderId: string;
    sellerId: string;
  }): Promise<void> {
    await this.safeNotify('shipping.shipped', async () => {
      const ownership = await this.orderService.getOrderOwnership(payload.orderId);
      await this.notificationService.create(
        ownership.userId,
        NotificationType.ORDER_SHIPPED,
        '상품이 발송되었습니다',
        `주문 ${payload.orderId} 의 상품이 발송되었습니다.`,
      );
    });
  }

  /** SETTLEMENT_CREATED → 판매자(sellerId → SellerService 로 userId 해석). */
  @OnEvent(SETTLEMENT_EVENTS.CREATED)
  async onSettlementCreated(payload: SettlementCreatedPayload): Promise<void> {
    await this.safeNotify('settlement.created', async () => {
      const userId = await this.sellerService.getUserIdBySellerId(payload.sellerId);
      if (!userId) return; // 수신자 해석 실패 → 알림 생략(원 흐름 영향 없음)
      await this.notificationService.create(
        userId,
        NotificationType.SETTLEMENT_CREATED,
        '정산이 생성되었습니다',
        `정산 ${payload.settlementId} 가 생성되었습니다.`,
      );
    });
  }

  /** REVIEW_RECEIVED → 판매자(productId → ProductService → sellerId → SellerService userId). */
  @OnEvent('review.created')
  async onReviewCreated(payload: ReviewCreatedPayload): Promise<void> {
    await this.safeNotify('review.created', async () => {
      const sellerId = await this.productService.getSellerIdByProductId(
        payload.productId,
      );
      if (!sellerId) return;
      const userId = await this.sellerService.getUserIdBySellerId(sellerId);
      if (!userId) return;
      await this.notificationService.create(
        userId,
        NotificationType.REVIEW_RECEIVED,
        '상품에 리뷰가 등록되었습니다',
        `상품 ${payload.productId} 에 새 리뷰(평점 ${payload.rating})가 등록되었습니다.`,
      );
    });
  }

  /**
   * 알림 생성 격리 래퍼 — 실패가 이벤트 발행 측(주문·배송·정산·리뷰)으로 전파되지 않도록 catch.
   * 알림은 부가 기능이므로 실패해도 원 트랜잭션·흐름은 정상 완료되어야 한다.
   */
  private async safeNotify(
    event: string,
    fn: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(
        `알림 생성 실패 (event=${event}): ${(err as Error).message}`,
      );
    }
  }
}
