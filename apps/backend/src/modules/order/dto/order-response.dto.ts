import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

/**
 * 주문 도메인 읽기 응답 DTO (문서 전용 — 런타임 변환 없음).
 * 컨트롤러는 Prisma 엔티티를 반환하며 본 클래스는 OpenAPI 응답 스키마 생성 목적.
 * 금전 필드(totalAmount·discountAmount·unitPrice)는 Decimal → JSON 직렬화상 문자열(P-005).
 */
export class OrderAddressSnapshotResponse {
  @ApiProperty()
  recipientName!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  zipCode!: string;

  @ApiProperty()
  address1!: string;

  @ApiProperty({ required: false, nullable: true })
  address2?: string | null;
}

export class OrderItemResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  variantId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty({ description: 'cross-schema plain String — users.sellers.id (P-001)' })
  sellerId!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ type: String, example: '30000.00', description: '금전 — 주문 시점 단가 스냅샷 (P-005)' })
  unitPrice!: string;

  @ApiProperty()
  optionName!: string;

  @ApiProperty()
  optionValue!: string;

  @ApiProperty()
  productTitle!: string;
}

/** 주문 공통 필드(목록 항목). */
export class OrderResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'cross-schema plain String — users.users.id (P-001)' })
  userId!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ type: String, example: '30000.00', description: '금전 — 총 주문 금액 (P-005)' })
  totalAmount!: string;

  @ApiProperty({ type: String, example: '0', description: '금전 — 할인 금액 (P-005)' })
  discountAmount!: string;

  @ApiProperty({ type: OrderAddressSnapshotResponse, description: '주문 시점 배송지 스냅샷 (FR-016)' })
  shippingAddressSnapshot!: OrderAddressSnapshotResponse;

  @ApiProperty({ type: String, format: 'date-time', required: false, nullable: true })
  deliveredAt?: string | null;

  @ApiProperty({ type: String, format: 'date-time', required: false, nullable: true })
  completedAt?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

/** GET /orders/:id — 주문 상세(items 포함). */
export class OrderDetailResponse extends OrderResponse {
  @ApiProperty({ type: [OrderItemResponse] })
  items!: OrderItemResponse[];
}

/** GET /orders — cursor 페이지네이션 목록. */
export class OrderListResponse {
  @ApiProperty({ type: [OrderResponse] })
  items!: OrderResponse[];

  @ApiProperty({ type: String, required: false, nullable: true, description: '다음 페이지 cursor (없으면 null)' })
  nextCursor!: string | null;
}
