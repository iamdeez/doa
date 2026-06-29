import { Prisma } from '@prisma/client';

/** PG 연동 인터페이스 — P-002: AWS SDK 미사용. P-004: cloud neutral. */
export interface ChargeResult {
  success: boolean;
  pgTransactionId?: string;
  failureReason?: string;
}

export interface RefundResult {
  success: boolean;
  pgRefundId?: string;
}

export interface PaymentGatewayPort {
  charge(params: {
    orderId: string;
    amount: Prisma.Decimal;
    idempotencyKey: string;
  }): Promise<ChargeResult>;

  refund(params: {
    paymentId: string;
    amount: Prisma.Decimal;
    idempotencyKey: string;
  }): Promise<RefundResult>;
}

/** DI 토큰 */
export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY' as const;
