import { Injectable } from '@nestjs/common';
import { Prisma, Review } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: commerce 스키마(commerce.reviews)에만 접근.
// orderItemId·orderId·userId·productId·sellerId 는 cross-schema plain String — FK 미선언.

@Injectable()
export class ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(data: {
    orderItemId: string;
    orderId: string;
    userId: string;
    productId: string;
    sellerId: string;
    rating: number;
    content: string;
  }): Promise<Review> {
    return this.prisma.tx.review.create({ data });
  }

  async findReviewById(id: string): Promise<Review | null> {
    return this.prisma.tx.review.findUnique({ where: { id } });
  }

  async updateReview(
    id: string,
    data: { rating?: number; content?: string },
  ): Promise<Review> {
    return this.prisma.tx.review.update({ where: { id }, data });
  }

  async deleteReview(id: string): Promise<void> {
    await this.prisma.tx.review.delete({ where: { id } });
  }

  /** 상품별 리뷰 cursor 페이지네이션 — 최신순 (FR-025) */
  async listByProduct(
    productId: string,
    cursor?: string,
    take = 20,
  ): Promise<{ items: Review[]; nextCursor: string | null }> {
    const limit = take + 1;
    const items = await this.prisma.tx.review.findMany({
      where: { productId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
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

  /** 내 리뷰 cursor 페이지네이션 — 최신순 (FR-026) */
  async listByUser(
    userId: string,
    cursor?: string,
    take = 20,
  ): Promise<{ items: Review[]; nextCursor: string | null }> {
    const limit = take + 1;
    const items = await this.prisma.tx.review.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
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
}
