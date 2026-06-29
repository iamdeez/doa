import { Injectable } from '@nestjs/common';
import { Prisma, Settlement, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { SellerService } from '../seller/seller.service';
import { SettlementRepository, SettlementWithItems } from './settlement.repository';
import { COMMISSION_RATE } from './settlement.constants';

@Injectable()
export class SettlementService {
  constructor(
    private readonly settlementRepository: SettlementRepository,
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly sellerService: SellerService,
  ) {}

  // ── 정산 생성 (관리자/배치) ───────────────────────────────────────

  /**
   * 판매자별 정산 생성 — 해당 기간 completed 주문항목을 집계한다.
   * P-001: orders 스키마 데이터는 OrderService.getCompletedItemsForSettlement DI 경유로 획득.
   * P-005: 금전 계산은 Prisma Decimal 만 사용 (부동소수점 금지).
   *   - saleAmount = unitPrice × quantity (항목 단위)
   *   - totalSales = Σ saleAmount
   *   - commission = totalSales × COMMISSION_RATE (소수점 2자리 반올림)
   *   - payoutAmount = totalSales − commission
   * settlement + settlement_items 를 단일 트랜잭션으로 생성.
   */
  async createSettlement(
    sellerId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<SettlementWithItems> {
    const rate = new Prisma.Decimal(COMMISSION_RATE);

    const items = await this.orderService.getCompletedItemsForSettlement(
      sellerId,
      periodStart,
      periodEnd,
    );

    const totalSales = items.reduce(
      (acc, item) => acc.add(item.saleAmount),
      new Prisma.Decimal(0),
    );
    const commission = totalSales
      .mul(rate)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const payoutAmount = totalSales.minus(commission);

    const settlement = await this.prisma.runInTransaction(async () => {
      const created = await this.settlementRepository.createSettlement({
        sellerId,
        periodStart,
        periodEnd,
        totalSales,
        commission,
        payoutAmount,
        status: SettlementStatus.pending,
      });

      if (items.length > 0) {
        await this.settlementRepository.createItems(
          items.map((item) => ({
            settlementId: created.id,
            orderId: item.orderId,
            orderItemId: item.orderItemId,
            saleAmount: item.saleAmount,
            commissionAmount: item.saleAmount
              .mul(rate)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          })),
        );
      }

      return created;
    });

    const result = await this.settlementRepository.findById(settlement.id);
    return result!;
  }

  // ── 정산 조회 ─────────────────────────────────────────────────────

  /** 판매자 본인 정산 내역 조회 (본인만). */
  async listMySettlements(userId: string): Promise<Settlement[]> {
    const seller = await this.sellerService.getApprovedSeller(userId);
    return this.settlementRepository.listBySeller(seller.id);
  }

  /** 관리자 전체 정산 내역 조회. */
  async listAll(): Promise<Settlement[]> {
    return this.settlementRepository.listAll();
  }
}
