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
import { AdminGuard } from '../../shared/auth/admin.guard';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { RegisterSellerDto } from './dto/register-seller.dto';
import { RejectSellerDto } from './dto/reject-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { SellerService } from './seller.service';

@Controller('sellers')
@UseGuards(JwtAuthGuard)
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  /** 판매자 등록 (FR-011, SC-013) */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterSellerDto,
  ) {
    return this.sellerService.register(user.userId, dto);
  }

  /** 내 판매자 프로필 조회 (FR-012, SC-014) */
  @Get('me')
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.sellerService.getMyProfile(user.userId);
  }

  /** 내 판매자 프로필 수정 (FR-013, SC-015) */
  @Patch('me')
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSellerDto,
  ) {
    return this.sellerService.updateMyProfile(user.userId, dto);
  }

  /** 심사 상태 조회 (FR-014, SC-016) */
  @Get('me/status')
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.sellerService.getStatus(user.userId);
  }

  /**
   * 승인 (FR-015, SC-017) — SEC-001 수정: AdminGuard 적용.
   * ADMIN_USER_IDS 미포함 사용자 → 403. fail-closed(미설정 시 전원 거부).
   */
  @Patch(':id/approve')
  @UseGuards(AdminGuard)
  async approve(@Param('id') sellerId: string) {
    return this.sellerService.approve(sellerId);
  }

  /**
   * 거부 (FR-016, SC-018) — SEC-001 수정: AdminGuard 적용.
   * ADMIN_USER_IDS 미포함 사용자 → 403. fail-closed(미설정 시 전원 거부).
   */
  @Patch(':id/reject')
  @UseGuards(AdminGuard)
  async reject(
    @Param('id') sellerId: string,
    @Body() dto: RejectSellerDto,
  ) {
    return this.sellerService.reject(sellerId, dto.rejectReason);
  }
}
