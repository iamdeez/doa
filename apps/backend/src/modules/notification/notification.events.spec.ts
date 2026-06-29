/**
 * NotificationEventsHandler 단위 테스트 — 009 알림 이벤트 연동 [env:unit]
 *
 * 검증:
 *   - 각 이벤트 수신 시 올바른 수신자 userId·NotificationType 으로 create 호출
 *   - 수신자 해석 실패(seller/product 미존재) 시 create 미호출 (안전 생략)
 *   - create 실패가 핸들러 밖으로 전파되지 않음 (원 흐름 격리)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { NotificationEventsHandler } from './notification.events';
import { NotificationService } from './notification.service';
import { OrderService } from '../order/order.service';
import { SellerService } from '../seller/seller.service';
import { ProductService } from '../product/product.service';

const mockNotificationService = { create: jest.fn() };
const mockOrderService = { getOrderOwnership: jest.fn() };
const mockSellerService = { getUserIdBySellerId: jest.fn() };
const mockProductService = { getSellerIdByProductId: jest.fn() };

describe('NotificationEventsHandler', () => {
  let handler: NotificationEventsHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventsHandler,
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: OrderService, useValue: mockOrderService },
        { provide: SellerService, useValue: mockSellerService },
        { provide: ProductService, useValue: mockProductService },
      ],
    }).compile();
    handler = module.get(NotificationEventsHandler);
  });

  describe('onOrderCreated', () => {
    it('when_order_created_then_notify_buyer_ORDER_PLACED', async () => {
      await handler.onOrderCreated({ orderId: 'o1', userId: 'buyer-1' });
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'buyer-1',
        NotificationType.ORDER_PLACED,
        expect.any(String),
        expect.stringContaining('o1'),
      );
    });
  });

  describe('onShipmentShipped', () => {
    it('when_shipped_then_resolve_buyer_and_notify_ORDER_SHIPPED', async () => {
      mockOrderService.getOrderOwnership.mockResolvedValue({
        userId: 'buyer-2',
        sellerIds: ['s1'],
      });
      await handler.onShipmentShipped({ orderId: 'o2', sellerId: 's1' });
      expect(mockOrderService.getOrderOwnership).toHaveBeenCalledWith('o2');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'buyer-2',
        NotificationType.ORDER_SHIPPED,
        expect.any(String),
        expect.stringContaining('o2'),
      );
    });

    it('when_ownership_resolution_throws_then_no_create_and_no_throw', async () => {
      mockOrderService.getOrderOwnership.mockRejectedValue(new Error('not found'));
      await expect(
        handler.onShipmentShipped({ orderId: 'oX', sellerId: 's1' }),
      ).resolves.toBeUndefined();
      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });
  });

  describe('onSettlementCreated', () => {
    it('when_settlement_created_then_resolve_seller_user_and_notify', async () => {
      mockSellerService.getUserIdBySellerId.mockResolvedValue('seller-user-1');
      await handler.onSettlementCreated({ settlementId: 'st1', sellerId: 's1' });
      expect(mockSellerService.getUserIdBySellerId).toHaveBeenCalledWith('s1');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'seller-user-1',
        NotificationType.SETTLEMENT_CREATED,
        expect.any(String),
        expect.stringContaining('st1'),
      );
    });

    it('when_seller_userId_unresolved_then_no_create', async () => {
      mockSellerService.getUserIdBySellerId.mockResolvedValue(null);
      await handler.onSettlementCreated({ settlementId: 'st2', sellerId: 'sX' });
      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });
  });

  describe('onReviewCreated', () => {
    it('when_review_created_then_resolve_seller_via_product_and_notify', async () => {
      mockProductService.getSellerIdByProductId.mockResolvedValue('s9');
      mockSellerService.getUserIdBySellerId.mockResolvedValue('seller-user-9');
      await handler.onReviewCreated({
        reviewId: 'r1',
        orderItemId: 'oi1',
        orderId: 'o1',
        productId: 'p9',
        userId: 'reviewer-1',
        rating: 5,
      });
      expect(mockProductService.getSellerIdByProductId).toHaveBeenCalledWith('p9');
      expect(mockSellerService.getUserIdBySellerId).toHaveBeenCalledWith('s9');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        'seller-user-9',
        NotificationType.REVIEW_RECEIVED,
        expect.any(String),
        expect.stringContaining('p9'),
      );
    });

    it('when_product_has_no_seller_then_no_create', async () => {
      mockProductService.getSellerIdByProductId.mockResolvedValue(null);
      await handler.onReviewCreated({
        reviewId: 'r2',
        orderItemId: 'oi2',
        orderId: 'o2',
        productId: 'pX',
        userId: 'reviewer-2',
        rating: 3,
      });
      expect(mockSellerService.getUserIdBySellerId).not.toHaveBeenCalled();
      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });
  });

  it('create 실패가 핸들러 밖으로 전파되지 않는다 (격리)', async () => {
    mockNotificationService.create.mockRejectedValue(new Error('db down'));
    await expect(
      handler.onOrderCreated({ orderId: 'o1', userId: 'buyer-1' }),
    ).resolves.toBeUndefined();
  });
});
