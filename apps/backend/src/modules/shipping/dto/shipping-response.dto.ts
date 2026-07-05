import { ApiProperty } from '@nestjs/swagger';
import { ShipmentStatus } from '@prisma/client';

/**
 * 배송 도메인 읽기 응답 DTO (문서 전용 — 런타임 변환 없음).
 * GET /shipments?orderId= 는 송장 미존재 시 null 을 반환할 수 있다(문서상 단일 객체로 표기).
 */
export class ShipmentTrackingResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shipmentId!: string;

  @ApiProperty({ enum: ShipmentStatus })
  status!: ShipmentStatus;

  @ApiProperty()
  description!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  occurredAt!: string;
}

export class ShipmentResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'cross-module plain String — orders.orders.id (P-001)' })
  orderId!: string;

  @ApiProperty({ enum: ShipmentStatus })
  status!: ShipmentStatus;

  @ApiProperty()
  carrier!: string;

  @ApiProperty()
  trackingNumber!: string;

  @ApiProperty({ type: String, format: 'date-time', required: false, nullable: true })
  shippedAt?: string | null;

  @ApiProperty({ type: String, format: 'date-time', required: false, nullable: true })
  deliveredAt?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
