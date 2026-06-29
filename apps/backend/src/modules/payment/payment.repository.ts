import { Injectable } from '@nestjs/common';
import { Payment, PaymentOutbox, PaymentStatus, Prisma, Refund } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: payments 스키마(payments.payments, payments.refunds, payments.payment_outbox)에만 접근.
// orderId 는 cross-schema plain String (P-001 경계).

@Injectable()
export class PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Payment ───────────────────────────────────────────────────────

  async createPayment(data: {
    orderId: string;
    userId: string;
    amount: Prisma.Decimal;
    idempotencyKey: string;
    status: PaymentStatus;
    pgTransactionId?: string;
    failureReason?: string;
  }): Promise<Payment> {
    return this.prisma.tx.payment.create({ data });
  }

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    return this.prisma.tx.payment.findUnique({ where: { idempotencyKey: key } });
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    return this.prisma.tx.payment.findUnique({ where: { orderId } });
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    extra?: { pgTransactionId?: string; failureReason?: string },
  ): Promise<Payment> {
    return this.prisma.tx.payment.update({
      where: { id },
      data: { status, ...extra },
    });
  }

  // ── Refund ────────────────────────────────────────────────────────

  async createRefund(data: {
    paymentId: string;
    amount: Prisma.Decimal;
    idempotencyKey: string;
    status: string;
    pgRefundId?: string;
  }): Promise<Refund> {
    return this.prisma.tx.refund.create({ data });
  }

  async findRefundByKey(idempotencyKey: string): Promise<Refund | null> {
    return this.prisma.tx.refund.findUnique({ where: { idempotencyKey } });
  }

  // ── Outbox ────────────────────────────────────────────────────────

  async createOutbox(data: {
    paymentId: string;
    eventType: string;
    payload: object;
  }): Promise<PaymentOutbox> {
    return this.prisma.tx.paymentOutbox.create({
      data: { ...data, status: 'pending' },
    });
  }

  async findPendingOutbox(take: number): Promise<PaymentOutbox[]> {
    return this.prisma.paymentOutbox.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  async markOutboxProcessed(id: string): Promise<void> {
    await this.prisma.paymentOutbox.update({
      where: { id },
      data: { status: 'processed', processedAt: new Date() },
    });
  }
}
