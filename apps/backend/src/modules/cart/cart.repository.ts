import { Injectable } from '@nestjs/common';
import { Cart } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CartItem } from './cart.types';

// P-001: commerce 스키마(commerce.carts)에만 접근.
// cart.items 는 JSONB — 스냅샷 배열로 관리.

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string): Promise<Cart | null> {
    return this.prisma.tx.cart.findUnique({ where: { userId } });
  }

  /**
   * 장바구니 items 배열 통째로 교체(upsert).
   * 트랜잭션 내에서 호출되면 this.prisma.tx 가 tx client 를 사용.
   */
  async upsertItems(userId: string, items: CartItem[]): Promise<Cart> {
    return this.prisma.tx.cart.upsert({
      where: { userId },
      create: { userId, items: items as unknown as object[] },
      update: { items: items as unknown as object[] },
    });
  }
}
