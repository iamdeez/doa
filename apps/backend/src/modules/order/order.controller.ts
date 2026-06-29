import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService } from './order.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /** POST /orders — 주문 생성 */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ) {
    return this.orderService.createOrder(user.userId, {
      items: dto.items,
      shippingAddress: dto.shippingAddress,
      userCouponId: dto.userCouponId,
    });
  }

  /** GET /orders — 내 주문 목록 */
  @Get()
  async listMyOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orderService.listMyOrders(
      user.userId,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  /** GET /orders/:orderId — 주문 상세 */
  @Get(':orderId')
  async getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    return this.orderService.getDetail(user.userId, orderId);
  }

  /** POST /orders/:orderId/cancel — 주문 취소 (구매자) */
  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    await this.orderService.cancel(user.userId, orderId);
  }

  /** POST /orders/:orderId/complete — 구매 확정 (구매자) */
  @Post(':orderId/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    await this.orderService.complete(user.userId, orderId);
  }
}
