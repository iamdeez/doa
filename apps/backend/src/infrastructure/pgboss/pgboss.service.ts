import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss = require('pg-boss');
import { AUTO_CONFIRM_QUEUE, OUTBOX_QUEUE } from './pgboss.constants';

@Injectable()
export class PgBossService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgBossService.name);
  private boss!: PgBoss;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const connectionString = this.config.get<string>('DATABASE_URL');
    this.boss = new PgBoss({ connectionString });
    await this.boss.start();

    // v10 API: work/schedule 등록 전에 createQueue 필수
    await this.boss.createQueue(OUTBOX_QUEUE);
    await this.boss.createQueue(AUTO_CONFIRM_QUEUE);

    this.logger.log('PgBoss started and queues created');
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss?.stop();
    this.logger.log('PgBoss stopped');
  }

  getBoss(): PgBoss {
    return this.boss;
  }
}
