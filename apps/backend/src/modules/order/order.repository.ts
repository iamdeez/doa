import { Injectable } from '@nestjs/common';
import { ActorType, Order, OrderEvent, OrderItem, OrderStatus, Prisma } from '@prisma/client';
// OrderItemWithOrder: review 모듈이 getOrderItemForReview DI 경유로 소비 (P-001 경계 준수)
export type OrderItemWithOrder = OrderItem & { order: Order };
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: orders 스키마(orders.orders, orders.order_items, orders.order_events)에만 접근.
// variantId·productId·sellerId·orderId(payments) 는 cross-schema plain String — FK 미선언.

export type PaymentSummary = { id: string; status: string };
export type OrderWithItems = Order & { items: OrderItem[] };
export type OrderWithDetails = Order & {
  items: OrderItem[];
  events: OrderEvent[];
  /** 결제 내역 — cross-schema plain String 기반으로 서비스 레이어에서 보강. findById 기본값 [] */
  payments: PaymentSummary[];
};

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(data: {
    id: string;
    userId: string;
    totalAmount: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    shippingAddressSnapshot: object;
  }): Promise<Order> {
    return this.prisma.tx.order.create({
      data: {
        id: data.id,
        userId: data.userId,
        totalAmount: data.totalAmount,
        discountAmount: data.discountAmount,
        shippingAddressSnapshot: data.shippingAddressSnapshot,
        status: OrderStatus.pending,
      },
    });
  }

  async createItems(
    items: Array<{
      orderId: string;
      variantId: string;
      productId: string;
      sellerId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      optionName: string;
      optionValue: string;
      productTitle: string;
      sku: string;
    }>,
  ): Promise<void> {
    await this.prisma.tx.orderItem.createMany({ data: items });
  }

  async appendEvent(data: {
    orderId: string;
    fromStatus: string | null;
    toStatus: string;
    actorType: ActorType;
    actorId?: string;
  }): Promise<OrderEvent> {
    return this.prisma.tx.orderEvent.create({ data });
  }

  async findById(id: string): Promise<OrderWithDetails | null> {
    const order = await this.prisma.tx.order.findUnique({
      where: { id },
      include: { items: true, events: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) return null;
    // payments 는 cross-schema — plain String FK 로 별도 조회 없이 빈 배열 기본값.
    // 실결제 연동은 PaymentService.findByOrderId 경유 또는 SC-024 테스트 목업 참조.
    return { ...order, payments: [] };
  }

  /** 구매자 주문 목록 — cursor 기반 페이지네이션. nextCursor 포함하여 반환. */
  async listByUser(
    userId: string,
    cursor: string | undefined,
    take: number,
  ): Promise<{ items: Order[]; nextCursor: string | null }> {
    const items = await this.prisma.tx.order.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take,
    });
    const nextCursor = items.length === take ? items[items.length - 1].id : null;
    return { items, nextCursor };
  }

  /** 판매자 주문 목록 — sellerId 기준 items 에서 orderId 조회 후 orders 반환 */
  async listBySeller(sellerId: string): Promise<Order[]> {
    const orderIds = await this.prisma.tx.orderItem.findMany({
      where: { sellerId },
      select: { orderId: true },
      distinct: ['orderId'],
    });
    const ids = orderIds.map((r) => r.orderId);

    return this.prisma.tx.order.findMany({
      where: { id: { in: ids } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    extra?: { deliveredAt?: Date },
  ): Promise<Order> {
    return this.prisma.tx.order.update({
      where: { id: orderId },
      data: { status, ...extra },
    });
  }

  /** 자동확정 대상 조회: delivered 상태 + deliveredAt < cutoff */
  async findDeliveredBefore(cutoff: Date): Promise<Order[]> {
    return this.prisma.tx.order.findMany({
      where: {
        status: OrderStatus.delivered,
        deliveredAt: { lt: cutoff },
      },
    });
  }

  /**
   * orderItem + 상위 order 조회 — review 생성 시 completed 상태 검증 용도 (FR-021).
   * P-001: orders 스키마 내 join — cross-schema 참조 없음.
   */
  async findOrderItemWithOrder(orderItemId: string): Promise<OrderItemWithOrder | null> {
    return this.prisma.tx.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    });
  }

  /**
   * 정산 집계용 — 특정 판매자의 completed 주문항목을 기간 내(주문 생성일 기준) 조회.
   * P-001: orders 스키마 내 join (order + order_items). settlement 모듈이 OrderService DI 경유로 소비.
   */
  async findCompletedItemsBySellerInPeriod(
    sellerId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<Array<{ orderId: string; orderItemId: string; unitPrice: Prisma.Decimal; quantity: number }>> {
    const orders = await this.prisma.tx.order.findMany({
      where: {
        status: OrderStatus.completed,
        createdAt: { gte: periodStart, lte: periodEnd },
        items: { some: { sellerId } },
      },
      include: { items: { where: { sellerId } } },
    });

    return orders.flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.id,
        orderItemId: item.id,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
    );
  }
}
