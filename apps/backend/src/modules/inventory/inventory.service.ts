import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InventoryLogType } from '@prisma/client';
import { InsufficientStockException } from './inventory.exception';
import { InventoryRepository } from './inventory.repository';

export interface StockChangedEvent {
  productId: string;
  totalStock: number;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * variant 생성 시 재고 행 초기화 (FR-030, plan 인터페이스 계약).
   * quantity 음수 금지.
   */
  async initStock(variantId: string, productId: string, quantity: number): Promise<void> {
    if (quantity < 0) {
      throw new BadRequestException('Initial quantity must not be negative');
    }
    await this.inventoryRepository.createInventory({ variantId, productId, quantity });
    await this.inventoryRepository.appendLog({
      variantId,
      productId,
      type: InventoryLogType.INIT,
      delta: quantity,
    });
  }

  /** 재고 입고 + 이벤트 발행 (FR-030, SC-041) */
  async stockIn(variantId: string, quantity: number): Promise<void> {
    const inv = await this.inventoryRepository.findByVariant(variantId);
    if (!inv) throw new BadRequestException('Inventory not found for variant');

    await this.inventoryRepository.increment(variantId, quantity);
    await this.inventoryRepository.appendLog({
      variantId,
      productId: inv.productId,
      type: InventoryLogType.STOCK_IN,
      delta: quantity,
    });
    await this.emitStockChanged(inv.productId);
  }

  /** 현재 재고 수량 조회 (FR-031, SC-042) */
  async getStock(variantId: string): Promise<number> {
    const inv = await this.inventoryRepository.findByVariant(variantId);
    if (!inv) return 0;
    return inv.quantity;
  }

  /**
   * 가용 재고 확인 (FR-033, SC-044). 부수효과 없음.
   * plan 인터페이스 계약: checkAvailability(variantId: string, quantity: number): Promise<boolean>
   */
  async checkAvailability(variantId: string, quantity: number): Promise<boolean> {
    const inv = await this.inventoryRepository.findByVariant(variantId);
    if (!inv) return false;
    return inv.quantity >= quantity;
  }

  /**
   * 원자적 재고 차감 (FR-034·035, SC-045·046).
   * plan 인터페이스 계약: decreaseStock(variantId: string, quantity: number, orderId: string): Promise<void>
   * count=0 → InsufficientStockException.
   */
  async decreaseStock(variantId: string, quantity: number, orderId: string): Promise<void> {
    const inv = await this.inventoryRepository.findByVariant(variantId);
    if (!inv) throw new InsufficientStockException();

    const result = await this.inventoryRepository.conditionalDecrement(variantId, quantity);
    if (result.count === 0) {
      throw new InsufficientStockException();
    }

    await this.inventoryRepository.appendLog({
      variantId,
      productId: inv.productId,
      type: InventoryLogType.DECREASE,
      delta: -quantity,
      orderId,
    });
    await this.emitStockChanged(inv.productId);
  }

  private async emitStockChanged(productId: string): Promise<void> {
    const totalStock = await this.inventoryRepository.sumQuantityByProduct(productId);
    const event: StockChangedEvent = { productId, totalStock };
    this.eventEmitter.emit('inventory.stock-changed', event);
  }
}
