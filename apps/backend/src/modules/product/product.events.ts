import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProductStatus } from '@prisma/client';
import { ProductRepository } from './product.repository';

interface StockChangedEvent {
  productId: string;
  totalStock: number;
}

/**
 * inventory.stock-changed 이벤트 구독 → 상품 상태 자동 전이 (FR-023·024, ADR-004·014).
 * ACTIVE ↔ OUT_OF_STOCK 전이. DRAFT/INACTIVE 는 전이 없음.
 * best-effort: 핸들러 예외가 발행 측 응답을 차단하지 않는다.
 */
@Injectable()
export class ProductEventsHandler {
  private readonly logger = new Logger(ProductEventsHandler.name);

  constructor(private readonly productRepository: ProductRepository) {}

  @OnEvent('inventory.stock-changed')
  async handleStockChanged(event: StockChangedEvent): Promise<void> {
    try {
      const product = await this.productRepository.findById(event.productId);
      if (!product) return;

      const { status } = product;
      const { totalStock } = event;

      if (totalStock === 0 && status === ProductStatus.ACTIVE) {
        await this.productRepository.updateStatus(event.productId, ProductStatus.OUT_OF_STOCK);
      } else if (totalStock > 0 && status === ProductStatus.OUT_OF_STOCK) {
        await this.productRepository.updateStatus(event.productId, ProductStatus.ACTIVE);
      }
      // DRAFT / INACTIVE — 전이 없음 (멱등)
    } catch (err) {
      this.logger.error('Failed to handle stock-changed event', err);
    }
  }
}
