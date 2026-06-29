import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrderService } from '../order/order.service';
import { SellerService } from '../seller/seller.service';
import { UserService } from '../user/user.service';

/** 플랫폼 요약 통계 — 관리자 대시보드 (007-stats). totalSales 는 Decimal (P-005). */
export interface PlatformOverview {
  totalOrders: number;
  completedOrders: number;
  totalSales: Prisma.Decimal;
  totalUsers: number;
  totalSellers: number;
}

/** 판매자 본인 요약 통계 — completed 매출 합계(Decimal) + 주문 건수. */
export interface SellerStatsSummary {
  salesTotal: Prisma.Decimal;
  orderCount: number;
}

/**
 * 집계 조회 전용 서비스. 자체 테이블 없이 각 도메인 Service 의 공개 집계 메서드를
 * DI 경유로 호출하여 조합한다 (P-001 모듈 경계 — 타 스키마 직접 접근 금지).
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly orderService: OrderService,
    private readonly userService: UserService,
    private readonly sellerService: SellerService,
  ) {}

  /** 플랫폼 요약: 총 주문수·완료 주문수·총 매출(completed)·총 사용자수·총 판매자수. */
  async getOverview(): Promise<PlatformOverview> {
    const [totalOrders, completedOrders, totalSales, totalUsers, totalSellers] =
      await Promise.all([
        this.orderService.countAllOrders(),
        this.orderService.countCompletedOrders(),
        this.orderService.sumCompletedSales(),
        this.userService.countAllUsers(),
        this.sellerService.countAllSellers(),
      ]);

    return { totalOrders, completedOrders, totalSales, totalUsers, totalSellers };
  }

  /**
   * 판매자 본인 요약 — APPROVED 판매자만.
   * SellerService.getApprovedSeller 로 본인 확인(미승인 시 ForbiddenException) 후
   * 본인 sellerId 기준 completed 매출/건수를 OrderService DI 경유로 집계.
   */
  async getSellerStats(userId: string): Promise<SellerStatsSummary> {
    const seller = await this.sellerService.getApprovedSeller(userId);
    return this.orderService.getSellerSalesSummary(seller.id);
  }
}
