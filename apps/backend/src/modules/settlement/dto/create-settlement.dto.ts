import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateSettlementDto {
  /** 정산 대상 판매자 ID (users.sellers.id) */
  @IsString()
  @IsNotEmpty()
  sellerId!: string;

  /** 정산 기간 시작 (ISO 8601) */
  @IsDateString()
  periodStart!: string;

  /** 정산 기간 종료 (ISO 8601) */
  @IsDateString()
  periodEnd!: string;
}
