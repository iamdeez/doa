import { Injectable } from '@nestjs/common';
import { Notification, NotificationType } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: users 스키마(users.notifications)에만 접근.
// userId 는 cross-schema plain String — users.users.id 참조하지만 FK 미선언.
// tx-aware 접근(this.prisma.tx) — 도메인 이벤트 트랜잭션 내부 호출 전파 지원.

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
  }): Promise<Notification> {
    return this.prisma.tx.notification.create({ data });
  }

  async findById(id: string): Promise<Notification | null> {
    return this.prisma.tx.notification.findUnique({ where: { id } });
  }

  /**
   * 본인 알림 목록 (offset 페이지네이션):
   * 미읽음 우선(isRead asc) → 최신순(createdAt desc). items + total 동시 반환.
   */
  async listByUser(
    userId: string,
    skip: number,
    take: number,
  ): Promise<{ items: Notification[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.tx.notification.findMany({
        where: { userId },
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.tx.notification.count({ where: { userId } }),
    ]);
    return { items, total };
  }

  async markRead(id: string): Promise<Notification> {
    return this.prisma.tx.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /** 본인 미읽음 알림 일괄 읽음 처리 — 변경 건수 반환 */
  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.tx.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return result.count;
  }
}
