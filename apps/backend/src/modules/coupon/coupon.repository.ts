import { Injectable } from '@nestjs/common';
import { Coupon, Prisma, UserCoupon, UserCouponStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: commerce 스키마(commerce.coupons, commerce.user_coupons)에만 접근.
// userId·issuerId·orderId 는 cross-schema plain String — FK 미선언.

export type UserCouponWithCoupon = UserCoupon & { coupon: Coupon };

@Injectable()
export class CouponRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createCoupon(data: {
    issuerType: Coupon['issuerType'];
    issuerId: string;
    type: Coupon['type'];
    discountValue: Prisma.Decimal;
    maxDiscountAmount?: Prisma.Decimal | null;
    minOrderAmount?: Prisma.Decimal | null;
    expiresAt: Date;
    totalQuantity?: number | null;
    description?: string | null;
  }): Promise<Coupon> {
    return this.prisma.tx.coupon.create({ data });
  }

  async findCouponById(couponId: string): Promise<Coupon | null> {
    return this.prisma.tx.coupon.findUnique({ where: { id: couponId } });
  }

  /**
   * 발급 건수 조건부 increment.
   * `UPDATE commerce.coupons SET issued_count = issued_count + 1
   *  WHERE id = ? AND (total_quantity IS NULL OR issued_count < total_quantity)`
   * 영향 행 수 반환: 0 → 한도 초과(FR-009·SC-016), ADR-004
   */
  async incrementIssuedCountConditional(couponId: string): Promise<number> {
    const result = await this.prisma.tx.$executeRaw`
      UPDATE commerce.coupons
      SET issued_count = issued_count + 1
      WHERE id = ${couponId}
        AND (total_quantity IS NULL OR issued_count < total_quantity)
    `;
    return result;
  }

  async createUserCoupon(data: {
    couponId: string;
    userId: string;
  }): Promise<UserCoupon> {
    return this.prisma.tx.userCoupon.create({ data });
  }

  async findUserCouponWithCoupon(
    userCouponId: string,
  ): Promise<UserCouponWithCoupon | null> {
    return this.prisma.tx.userCoupon.findUnique({
      where: { id: userCouponId },
      include: { coupon: true },
    });
  }

  async listUserCoupons(
    userId: string,
    status?: UserCouponStatus,
  ): Promise<UserCouponWithCoupon[]> {
    return this.prisma.tx.userCoupon.findMany({
      where: { userId, ...(status ? { status } : {}) },
      include: { coupon: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listCouponsByIssuer(
    issuerId: string,
    cursor?: string,
    take = 20,
  ): Promise<{ items: Coupon[]; nextCursor: string | null }> {
    const limit = take + 1;
    const items = await this.prisma.tx.coupon.findMany({
      where: { issuerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      take: limit,
    });

    const hasMore = items.length === limit;
    const slice = hasMore ? items.slice(0, take) : items;
    return {
      items: slice,
      nextCursor: hasMore ? (slice[slice.length - 1]?.id ?? null) : null,
    };
  }

  /**
   * 쿠폰 이중사용 방지 조건부 UPDATE.
   * `WHERE id = ? AND status = 'unused'` — count === 0 이면 이미 사용됨(ADR-002).
   */
  async markUserCouponUsed(
    userCouponId: string,
    orderId: string,
  ): Promise<number> {
    const result = await this.prisma.tx.userCoupon.updateMany({
      where: { id: userCouponId, status: UserCouponStatus.unused },
      data: { status: UserCouponStatus.used, usedOrderId: orderId },
    });
    return result.count;
  }

  /**
   * 주문 취소 시 쿠폰 복원.
   * `WHERE usedOrderId = ? AND status = 'used'` → unused 복원.
   */
  async restoreUserCouponsByOrder(orderId: string): Promise<number> {
    const result = await this.prisma.tx.userCoupon.updateMany({
      where: { usedOrderId: orderId, status: UserCouponStatus.used },
      data: { status: UserCouponStatus.unused, usedOrderId: null },
    });
    return result.count;
  }
}
