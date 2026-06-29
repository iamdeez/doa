import { ApiProperty } from '@nestjs/swagger';
import { SettlementStatus } from '@prisma/client';

/**
 * 정산 도메인 읽기 응답 DTO (문서 전용 — 런타임 변환 없음).
 * 금전 필드(totalSales·commission·payoutAmount)는 Decimal → 문자열(P-005).
 */
export class SettlementResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'cross-schema plain String — users.sellers.id (P-001)' })
  sellerId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  periodStart!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  periodEnd!: string;

  @ApiProperty({ type: String, example: '1000000.00', description: '금전 — 정산 기간 총 매출 (P-005)' })
  totalSales!: string;

  @ApiProperty({ type: String, example: '100000.00', description: '금전 — 플랫폼 수수료 (P-005)' })
  commission!: string;

  @ApiProperty({ type: String, example: '900000.00', description: '금전 — 실 지급액 (P-005)' })
  payoutAmount!: string;

  @ApiProperty({ enum: SettlementStatus })
  status!: SettlementStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
