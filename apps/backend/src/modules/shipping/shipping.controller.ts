import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ShippingService } from './shipping.service';

@Controller('shipments')
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  /** POST /shipments — 송장 등록 (APPROVED 판매자) */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createShipment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShipmentDto,
  ) {
    return this.shippingService.createShipment(user.userId, {
      orderId: dto.orderId,
      carrier: dto.carrier,
      trackingNumber: dto.trackingNumber,
    });
  }

  /** PATCH /shipments/:id/status — 배송 상태 업데이트 (판매자) */
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateShipmentStatusDto,
  ) {
    return this.shippingService.updateStatus(
      user.userId,
      id,
      dto.status,
      dto.description,
    );
  }

  /** GET /shipments/:id/tracking — 배송 추적 조회 (구매자 본인 또는 판매자) */
  @Get(':id/tracking')
  async getTracking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.shippingService.getTracking(user.userId, id);
  }
}
