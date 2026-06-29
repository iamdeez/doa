import { forwardRef, Module } from '@nestjs/common';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { OrderModule } from '../order/order.module';
import { PaymentController } from './payment.controller';
import { PAYMENT_GATEWAY } from './payment-gateway.port';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';
import { StubPaymentGateway } from './stub-payment-gateway';

@Module({
  imports: [
    AuthSharedModule,
    // Order↔Payment 순환 참조 → forwardRef 해소 (ADR-007)
    forwardRef(() => OrderModule),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentRepository,
    { provide: PAYMENT_GATEWAY, useClass: StubPaymentGateway },
  ],
  exports: [PaymentService, PaymentRepository],
})
export class PaymentModule {}
