import { Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { NotificationController } from './notification.controller';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

/**
 * 사용자 알림 모듈 (006-notification).
 * NotificationService 를 export — 타 도메인(주문·배송·정산 등)이 DI 로 알림 생성 호출.
 */
@Module({
  imports: [AuthSharedModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationRepository],
  exports: [NotificationService],
})
export class NotificationModule {}
