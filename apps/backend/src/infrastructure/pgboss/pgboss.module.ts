import { Global, Module } from '@nestjs/common';
import { OrderModule } from '../../modules/order/order.module';
import { PaymentModule } from '../../modules/payment/payment.module';
import { AutoConfirmJob } from './auto-confirm-job';
import { OutboxRelay } from './outbox-relay';
import { PgBossService } from './pgboss.service';

@Global()
@Module({
  imports: [OrderModule, PaymentModule],
  providers: [PgBossService, OutboxRelay, AutoConfirmJob],
  exports: [PgBossService],
})
export class PgBossModule {}
