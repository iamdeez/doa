import { ApiProperty } from '@nestjs/swagger';

/**
 * 장바구니 응답 DTO (문서 전용). 장바구니는 Redis/JSON 스냅샷 기반이라 엔티티가 없고
 * CartItem 평면 객체를 반환한다. 금전 unitPrice 는 Decimal → 문자열(P-005).
 */
export class CartItemResponse {
  @ApiProperty()
  variantId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty({ description: 'cross-schema plain String — users.sellers.id (P-001)' })
  sellerId!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ type: String, example: '30000.00', description: '금전 — 단가 스냅샷 (P-005)' })
  unitPrice!: string;

  @ApiProperty()
  optionName!: string;

  @ApiProperty()
  optionValue!: string;

  @ApiProperty()
  productTitle!: string;

  @ApiProperty()
  sku!: string;
}

/** GET /cart — 장바구니 조회. */
export class CartResponse {
  @ApiProperty({ type: [CartItemResponse] })
  items!: CartItemResponse[];
}
