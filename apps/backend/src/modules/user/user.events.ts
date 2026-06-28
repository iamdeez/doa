import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserService } from './user.service';

interface ProductViewedEvent {
  userId: string;
  productId: string;
}

/**
 * product.viewed 이벤트 구독 → 최근 본 상품 기록 저장 (FR-009, ADR-002·014).
 * best-effort: 핸들러 예외가 발행 측 응답을 차단하지 않는다.
 */
@Injectable()
export class UserEventsHandler {
  private readonly logger = new Logger(UserEventsHandler.name);

  constructor(private readonly userService: UserService) {}

  @OnEvent('product.viewed')
  async handleProductViewed(event: ProductViewedEvent): Promise<void> {
    try {
      await this.userService.recordProductView(event.userId, event.productId);
    } catch (err) {
      this.logger.error('Failed to record product view', err);
    }
  }
}
