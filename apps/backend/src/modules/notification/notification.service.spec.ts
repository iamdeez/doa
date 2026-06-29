/**
 * NotificationService 단위 테스트 — [env:unit]
 *
 * 검증 대상 (006-notification):
 *   - create(): 공개 진입점 — repository.create 위임
 *   - list(): page/size 정규화 → skip/take, page/size 메타 포함
 *   - markRead(): 미존재 404, 타인 소유 403, 본인 소유 읽음 처리
 *   - markAllRead(): updateMany 위임, 변경 건수 반환
 */

import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

const mockRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  listByUser: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
};

const USER_ID = 'user-001';
const OTHER_USER_ID = 'user-002';
const NOTI_ID = 'noti-001';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: NotificationRepository, useValue: mockRepo },
      ],
    }).compile();
    service = moduleRef.get<NotificationService>(NotificationService);
  });

  describe('create', () => {
    it('when_create_then_delegates_to_repository', async () => {
      const created = { id: NOTI_ID, userId: USER_ID };
      mockRepo.create.mockResolvedValue(created);

      const result = await service.create(
        USER_ID,
        NotificationType.ORDER_PLACED,
        '주문 완료',
        '주문이 접수되었습니다.',
      );

      expect(mockRepo.create).toHaveBeenCalledWith({
        userId: USER_ID,
        type: NotificationType.ORDER_PLACED,
        title: '주문 완료',
        body: '주문이 접수되었습니다.',
      });
      expect(result).toBe(created);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      mockRepo.listByUser.mockResolvedValue({ items: [], total: 0 });
    });

    it('when_no_params_then_default_page1_size20_skip0', async () => {
      const result = await service.list(USER_ID);

      expect(mockRepo.listByUser).toHaveBeenCalledWith(USER_ID, 0, 20);
      expect(result).toMatchObject({ page: 1, size: 20, total: 0 });
    });

    it('when_page2_size10_then_skip_is_10', async () => {
      await service.list(USER_ID, 2, 10);
      expect(mockRepo.listByUser).toHaveBeenCalledWith(USER_ID, 10, 10);
    });

    it('when_size_exceeds_max_then_clamped_to_100', async () => {
      await service.list(USER_ID, 1, 9999);
      expect(mockRepo.listByUser).toHaveBeenCalledWith(USER_ID, 0, 100);
    });
  });

  describe('markRead', () => {
    it('when_notification_missing_then_NotFound', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.markRead(USER_ID, NOTI_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockRepo.markRead).not.toHaveBeenCalled();
    });

    it('when_owned_by_other_user_then_Forbidden', async () => {
      mockRepo.findById.mockResolvedValue({
        id: NOTI_ID,
        userId: OTHER_USER_ID,
      });

      await expect(service.markRead(USER_ID, NOTI_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mockRepo.markRead).not.toHaveBeenCalled();
    });

    it('when_owned_by_user_then_marks_read', async () => {
      mockRepo.findById.mockResolvedValue({ id: NOTI_ID, userId: USER_ID });
      mockRepo.markRead.mockResolvedValue({
        id: NOTI_ID,
        userId: USER_ID,
        isRead: true,
      });

      const result = await service.markRead(USER_ID, NOTI_ID);

      expect(mockRepo.markRead).toHaveBeenCalledWith(NOTI_ID);
      expect(result).toMatchObject({ isRead: true });
    });
  });

  describe('markAllRead', () => {
    it('when_called_then_returns_updated_count', async () => {
      mockRepo.markAllRead.mockResolvedValue(3);

      const result = await service.markAllRead(USER_ID);

      expect(mockRepo.markAllRead).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ updated: 3 });
    });
  });
});
