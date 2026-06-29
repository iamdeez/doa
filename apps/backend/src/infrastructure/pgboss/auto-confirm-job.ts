import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import PgBoss = require('pg-boss');
import { OrderService } from '../../modules/order/order.service';
import { AUTO_CONFIRM_CRON, AUTO_CONFIRM_QUEUE } from './pgboss.constants';
import { PgBossService } from './pgboss.service';

/**
 * AutoConfirmJob — 배송완료 7일 경과 주문 자동 구매확정.
 * pg-boss schedule로 매일 새벽 2시 실행.
 * pg-boss v10: work handler는 jobs 배열 수신.
 */
@Injectable()
export class AutoConfirmJob implements OnModuleInit {
  private readonly logger = new Logger(AutoConfirmJob.name);
  private boss!: PgBoss;

  constructor(
    private readonly pgBossService: PgBossService,
    private readonly orderService: OrderService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.boss = this.pgBossService.getBoss();

    await this.boss.work(AUTO_CONFIRM_QUEUE, async (jobs) => {
      for (const _job of jobs) {
        this.logger.log('AutoConfirmJob triggered');
        const count = await this.orderService.autoConfirmDelivered(new Date());
        this.logger.log(`AutoConfirmJob: confirmed ${count} orders`);
      }
    });

    // 매일 새벽 2시 실행
    await this.boss.schedule(AUTO_CONFIRM_QUEUE, AUTO_CONFIRM_CRON);

    this.logger.log(`AutoConfirmJob scheduled: ${AUTO_CONFIRM_CRON}`);
  }
}
