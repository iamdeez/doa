import { Injectable } from '@nestjs/common';
import { Inventory, InventoryLog, InventoryLogType } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: products 스키마(products.inventory, products.inventory_logs)에만 접근.
// append-only 규칙: inventory_logs 에 대한 update/delete 메서드 미존재 (FR-032, SC-043).

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByVariant(variantId: string): Promise<Inventory | null> {
    return this.prisma.inventory.findUnique({ where: { variantId } });
  }

  async createInventory(data: {
    variantId: string;
    productId: string;
    quantity: number;
  }): Promise<Inventory> {
    return this.prisma.inventory.create({ data });
  }

  async increment(variantId: string, qty: number): Promise<Inventory> {
    return this.prisma.inventory.update({
      where: { variantId },
      data: { quantity: { increment: qty } },
    });
  }

  /**
   * 조건부 원자 감소 (ADR-005, SC-045):
   * WHERE quantity >= qty 조건으로 단일 statement UPDATE.
   * 반환 count=0 → 재고 부족 의미.
   */
  async conditionalDecrement(variantId: string, qty: number): Promise<{ count: number }> {
    return this.prisma.inventory.updateMany({
      where: { variantId, quantity: { gte: qty } },
      data: { quantity: { decrement: qty } },
    });
  }

  async sumQuantityByProduct(productId: string): Promise<number> {
    const result = await this.prisma.inventory.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  /** append-only: 새 로그 행 추가만 허용. 기존 로그 수정/삭제 메서드 없음. */
  async appendLog(data: {
    variantId: string;
    productId: string;
    type: InventoryLogType;
    delta: number;
    orderId?: string;
  }): Promise<InventoryLog> {
    return this.prisma.inventoryLog.create({ data });
  }
}
