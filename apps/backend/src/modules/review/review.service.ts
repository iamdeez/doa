import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderService } from '../order/order.service';
import { ReviewRepository } from './review.repository';

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly orderService: OrderService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── 리뷰 생성 (FR-021~FR-023) ─────────────────────────────────────────

  async createReview(
    userId: string,
    data: {
      orderItemId: string;
      rating: number;
      content: string;
    },
  ) {
    // orderItem + 상위 order 조회 — P-001: DI 경유 (cross-schema 직접 접근 금지)
    const orderItem = await this.orderService.getOrderItemForReview(data.orderItemId);
    if (!orderItem) {
      throw new NotFoundException('OrderItem not found');
    }

    // 소유권 검증 (FR-021b)
    if (orderItem.order.userId !== userId) {
      throw new ForbiddenException('Not your order item');
    }

    // 구매 완료 상태 검증 (FR-021a)
    if (orderItem.order.status !== OrderStatus.completed) {
      throw new UnprocessableEntityException(
        `Order is not completed (status: ${orderItem.order.status})`,
      );
    }

    try {
      const review = await this.reviewRepository.createReview({
        orderItemId: data.orderItemId,
        orderId: orderItem.order.id,
        userId,
        productId: orderItem.productId,
        sellerId: orderItem.sellerId,
        rating: data.rating,
        content: data.content,
      });

      // 리뷰 생성 도메인 이벤트 (FR-023)
      this.eventEmitter.emit('review.created', {
        reviewId: review.id,
        orderItemId: review.orderItemId,
        orderId: review.orderId,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
      });

      return review;
    } catch (err) {
      // reviews.orderItemId @unique 위반 → 중복 리뷰 409 (ADR-009, FR-021c)
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Review already exists for this order item');
      }
      throw err;
    }
  }

  // ── 리뷰 수정 (FR-024) ────────────────────────────────────────────────

  async updateReview(
    userId: string,
    reviewId: string,
    data: { rating?: number; content?: string },
  ) {
    const review = await this.reviewRepository.findReviewById(reviewId);
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('Not your review');

    return this.reviewRepository.updateReview(reviewId, data);
  }

  // ── 리뷰 삭제 (FR-024) ────────────────────────────────────────────────

  async deleteReview(userId: string, reviewId: string): Promise<void> {
    const review = await this.reviewRepository.findReviewById(reviewId);
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('Not your review');

    await this.reviewRepository.deleteReview(reviewId);
  }

  // ── 상품별 리뷰 목록 (FR-025) ────────────────────────────────────────

  async listProductReviews(productId: string, cursor?: string, take?: number) {
    return this.reviewRepository.listByProduct(productId, cursor, take);
  }

  // ── 내 리뷰 목록 (FR-026) ─────────────────────────────────────────────

  async listMyReviews(userId: string, cursor?: string, take?: number) {
    return this.reviewRepository.listByUser(userId, cursor, take);
  }
}
