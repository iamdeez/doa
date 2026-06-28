import {
  Body,
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
import { SellerService } from '../seller/seller.service';
import { StockInDto } from './dto/stock-in.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly sellerService: SellerService,
  ) {}

  /** POST /inventory/:variantId/stock-in — 재고 입고 (APPROVED 판매자만, FR-030, SC-041) */
  @Post(':variantId/stock-in')
  @HttpCode(HttpStatus.OK)
  async stockIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId') variantId: string,
    @Body() dto: StockInDto,
  ) {
    // APPROVED 판매자 검증 — 비승인 시 ForbiddenException
    await this.sellerService.getApprovedSeller(user.userId);
    return this.inventoryService.stockIn(variantId, dto.quantity);
  }

  /** GET /inventory/:variantId/stock — 재고 수량 조회 (APPROVED 판매자만, FR-031, SC-042) */
  @Get(':variantId/stock')
  async getStock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId') variantId: string,
  ) {
    await this.sellerService.getApprovedSeller(user.userId);
    return this.inventoryService.getStock(variantId);
  }
}
