import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { OrderService } from './order.service';

@Controller('seller/orders')
@UseGuards(JwtAuthGuard)
export class SellerOrderController {
  constructor(private readonly orderService: OrderService) {}

  /** GET /seller/orders — 판매자 수주 목록 */
  @Get()
  async listSellerOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.orderService.listSellerOrders(user.userId);
  }

  /** POST /seller/orders/:orderId/confirm — 판매자 주문 확인 (pending → preparing) */
  @Post(':orderId/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    await this.orderService.confirmBySeller(user.userId, orderId);
  }
}
