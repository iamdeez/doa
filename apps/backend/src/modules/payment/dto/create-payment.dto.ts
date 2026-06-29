import { IsString, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  orderId!: string;

  /** 클라이언트 생성 UUID v4 — 멱등성 보장 (ADR-006). 헤더 미전달 시 body 값 사용. */
  @IsUUID(4)
  idempotencyKey!: string;
}
