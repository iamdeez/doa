import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { FindEmailDto } from './dto/find-email.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import {
  AuthProfileResponse,
  FindEmailResponse,
  LoginResponse,
  RefreshResponse,
  RegisterResponse,
  SocialLoginResponse,
} from './dto/auth-response.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly socialAuthService: SocialAuthService,
  ) {}

  @Post('register')
  @ApiOkResponse({ type: RegisterResponse })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponse })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SocialLoginResponse })
  async socialLogin(@Body() dto: SocialLoginDto) {
    // JWT 가드 불필요 — 익명 엔드포인트 (plan.md PATCH-001/ADR-001)
    return this.socialAuthService.login(dto.provider, dto.token);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RefreshResponse })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto) {
    // JWT 가드 불필요 — 제출된 refreshToken 해싱 대조로 revoked 처리
    // (만료된 access token 보유 사용자도 logout 가능해야 함, plan.md FR-011)
    await this.authService.logout(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: AuthProfileResponse })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.userId);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return {};
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.email, dto.otp, dto.newPassword);
    return {};
  }

  @Post('find-email')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: FindEmailResponse })
  async findEmail(@Body() dto: FindEmailDto) {
    return this.authService.findEmail(dto.phone);
  }
}
