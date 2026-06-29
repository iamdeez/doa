import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../shared/auth/admin.guard';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { AdminService } from './admin.service';

// ── 관리자 운영 API (운영 조회/조치) ─────────────────────────────────

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /admin/sellers/pending — 승인 대기 판매자 목록 */
  @Get('sellers/pending')
  async listPendingSellers() {
    return this.adminService.listPendingSellers();
  }

  /** POST /admin/sellers/:id/approve — 판매자 승인 (seller 도메인 승인 로직 재사용) */
  @Post('sellers/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveSeller(@Param('id') sellerId: string) {
    return this.adminService.approveSeller(sellerId);
  }

  /** GET /admin/users — 사용자 목록 (cursor 페이지네이션) */
  @Get('users')
  async listUsers(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listUsers(
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
