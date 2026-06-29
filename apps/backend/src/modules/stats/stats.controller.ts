import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../shared/auth/admin.guard';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { StatsService } from './stats.service';

// ── 관리자 통계 API ─────────────────────────────────────────────────

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminStatsController {
  constructor(private readonly statsService: StatsService) {}

  /** GET /admin/stats/overview — 플랫폼 요약 통계 (관리자) */
  @Get('overview')
  async getOverview() {
    return this.statsService.getOverview();
  }
}

// ── 판매자 통계 API ─────────────────────────────────────────────────

@Controller('seller/stats')
@UseGuards(JwtAuthGuard)
export class SellerStatsController {
  constructor(private readonly statsService: StatsService) {}

  /** GET /seller/stats — 본인 판매 요약 (APPROVED 판매자 본인) */
  @Get()
  async getMyStats(@CurrentUser() user: AuthenticatedUser) {
    return this.statsService.getSellerStats(user.userId);
  }
}
