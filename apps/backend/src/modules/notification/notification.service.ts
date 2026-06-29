import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Notification, NotificationType } from '@prisma/client';
import {
  DEFAULT_NOTIFICATION_SIZE,
  MAX_NOTIFICATION_SIZE,
} from './notification.constants';
import { NotificationRepository } from './notification.repository';

export interface NotificationListResult {
  items: Notification[];
  total: number;
  page: number;
  size: number;
}

/**
 * 사용자 알림 도메인 (006-notification).
 * create() 는 도메인 이벤트(주문·배송·정산·리뷰)에서 호출 가능한 공개 진입점이며,
 * NotificationModule 이 export 한다.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  /**
   * 알림 생성 공개 진입점.
   * 타 도메인 서비스가 DI 로 주입받아 호출한다 (예: 주문 생성 시 ORDER_PLACED).
   */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
  ): Promise<Notification> {
    return this.notificationRepository.create({ userId, type, title, body });
  }

  /** 본인 알림 목록 — 미읽음 우선/최신순, offset 페이지네이션 */
  async list(
    userId: string,
    page?: number,
    size?: number,
  ): Promise<NotificationListResult> {
    const normalizedPage = Math.max(page ?? 1, 1);
    const normalizedSize = Math.min(
      Math.max(size ?? DEFAULT_NOTIFICATION_SIZE, 1),
      MAX_NOTIFICATION_SIZE,
    );
    const { items, total } = await this.notificationRepository.listByUser(
      userId,
      (normalizedPage - 1) * normalizedSize,
      normalizedSize,
    );
    return { items, total, page: normalizedPage, size: normalizedSize };
  }

  /** 본인 알림 읽음 처리. 미존재 → 404, 타인 소유 → 403 */
  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notificationRepository.findById(id);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('Not your notification');
    }
    return this.notificationRepository.markRead(id);
  }

  /** 본인 전체 알림 읽음 처리 — 변경 건수 반환 */
  async markAllRead(userId: string): Promise<{ updated: number }> {
    const updated = await this.notificationRepository.markAllRead(userId);
    return { updated };
  }
}
