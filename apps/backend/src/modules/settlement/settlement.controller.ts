import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { AdminGuard } from '../../shared/auth/admin.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { SettlementService } from './settlement.service';

// ── 판매자/관리자 정산 API ──────────────────────────────────────────

@Controller('settlements')
@UseGuards(JwtAuthGuard)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  /** POST /settlements — 정산 생성 (관리자 전용) */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AdminGuard)
  async createSettlement(@Body() dto: CreateSettlementDto) {
    return this.settlementService.createSettlement(
      dto.sellerId,
      new Date(dto.periodStart),
      new Date(dto.periodEnd),
    );
  }

  /** GET /settlements — 판매자 본인 정산 내역 (본인만) */
  @Get()
  async listMySettlements(@CurrentUser() user: AuthenticatedUser) {
    return this.settlementService.listMySettlements(user.userId);
  }
}

// ── 관리자 전체 조회 API ────────────────────────────────────────────

@Controller('admin/settlements')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  /** GET /admin/settlements — 전체 정산 내역 (관리자) */
  @Get()
  async listAll() {
    return this.settlementService.listAll();
  }
}
