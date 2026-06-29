import { Injectable } from '@nestjs/common';
import { Prisma, Settlement, SettlementItem, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: settlement 모듈은 자신의 소유 테이블(settlements.settlements, settlements.settlement_items)에만 접근.
// orders 스키마 데이터(completed 주문항목 집계)는 OrderService DI 경유로만 획득.
// sellerId/orderId/orderItemId 는 cross-schema plain String (P-001 경계).

export type SettlementWithItems = Settlement & { items: SettlementItem[] };

@Injectable()
export class SettlementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSettlement(data: {
    sellerId: string;
    periodStart: Date;
    periodEnd: Date;
    totalSales: Prisma.Decimal;
    commission: Prisma.Decimal;
    payoutAmount: Prisma.Decimal;
    status: SettlementStatus;
  }): Promise<Settlement> {
    return this.prisma.tx.settlement.create({ data });
  }

  async createItems(
    items: Array<{
      settlementId: string;
      orderId: string;
      orderItemId: string;
      saleAmount: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
    }>,
  ): Promise<void> {
    await this.prisma.tx.settlementItem.createMany({ data: items });
  }

  async findById(id: string): Promise<SettlementWithItems | null> {
    return this.prisma.tx.settlement.findUnique({
      where: { id },
      include: { items: true },
    });
  }

  /** 판매자 본인 정산 내역 — 최신순 */
  async listBySeller(sellerId: string): Promise<Settlement[]> {
    return this.prisma.tx.settlement.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 관리자 전체 정산 내역 — 최신순 */
  async listAll(): Promise<Settlement[]> {
    return this.prisma.tx.settlement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
