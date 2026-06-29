import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductService } from '../product/product.service';
import { CartRepository } from './cart.repository';
import { CartItem, decimalToString } from './cart.types';

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly productService: ProductService,
  ) {}

  /** 장바구니 조회 — { items } 반환. 없으면 빈 배열. */
  async getCart(userId: string): Promise<{ items: CartItem[] }> {
    const cart = await this.cartRepository.findByUser(userId);
    const items = (cart?.items as unknown as CartItem[]) ?? [];
    return { items };
  }

  /** 내부용: 장바구니 items 배열만 반환 */
  private async getCartItems(userId: string): Promise<CartItem[]> {
    const cart = await this.cartRepository.findByUser(userId);
    return (cart?.items as unknown as CartItem[]) ?? [];
  }

  /**
   * 장바구니 항목 추가.
   * 동일 variantId 가 이미 있으면 수량 합산.
   * 스냅샷(price·옵션명 등)은 현재 시점 variant 정보 사용.
   */
  async addItem(
    userId: string,
    dto: { variantId: string; quantity: number },
  ): Promise<CartItem[]> {
    const { variantId, quantity } = dto;
    if (quantity <= 0) throw new BadRequestException('Quantity must be positive');

    const snapshot = await this.productService.getVariantSnapshot(variantId);
    const items = await this.getCartItems(userId);

    const existing = items.find((i) => i.variantId === variantId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        variantId: snapshot.variantId,
        productId: snapshot.productId,
        sellerId: snapshot.sellerId,
        quantity,
        unitPrice: decimalToString(snapshot.unitPrice),
        optionName: snapshot.optionName,
        optionValue: snapshot.optionValue,
        productTitle: snapshot.productTitle,
        sku: snapshot.sku,
      });
    }

    const cart = await this.cartRepository.upsertItems(userId, items);
    return cart.items as unknown as CartItem[];
  }

  /**
   * 장바구니 항목 수량 변경.
   * quantity=0 이면 항목 제거.
   */
  async updateQuantity(
    userId: string,
    variantId: string,
    quantity: number,
  ): Promise<CartItem[]> {
    if (quantity < 0) throw new BadRequestException('Quantity must not be negative');

    const items = await this.getCartItems(userId);
    const index = items.findIndex((i) => i.variantId === variantId);
    if (index === -1) throw new NotFoundException(`Cart item not found: ${variantId}`);

    if (quantity === 0) {
      items.splice(index, 1);
    } else {
      items[index].quantity = quantity;
    }

    const cart = await this.cartRepository.upsertItems(userId, items);
    return cart.items as unknown as CartItem[];
  }

  /** 장바구니 항목 개별 제거 */
  async removeItem(userId: string, variantId: string): Promise<CartItem[]> {
    const items = await this.getCartItems(userId);
    const filtered = items.filter((i) => i.variantId !== variantId);
    const cart = await this.cartRepository.upsertItems(userId, filtered);
    return cart.items as unknown as CartItem[];
  }

  /**
   * 주문 완료 후 장바구니에서 주문된 항목 제거.
   * OrderService.createOrder 트랜잭션 내에서 호출 — this.prisma.tx 를 통해 동일 tx 참여.
   */
  async removeItems(userId: string, variantIds: string[]): Promise<void> {
    const items = await this.getCartItems(userId);
    const filtered = items.filter((i) => !variantIds.includes(i.variantId));
    await this.cartRepository.upsertItems(userId, filtered);
  }
}
