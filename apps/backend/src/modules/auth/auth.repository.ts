import { Injectable } from '@nestjs/common';
import { PasswordResetOtp, RefreshToken, User } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: users 스키마(users.users, users.refresh_tokens, users.password_reset_otps)에만 접근. 타 스키마 미접근.

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(data: { email: string; password: string }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await this.prisma.tx.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async createRefreshToken(data: {
    tokenHash: string;
    expiresAt: Date;
    userId: string;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
  }

  async revokeAllRefreshTokensByUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  // ──────────────────────────────────────────────
  // OTP 관련 메서드
  // ──────────────────────────────────────────────

  async createOtp(data: {
    email: string;
    otpHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetOtp> {
    return this.prisma.passwordResetOtp.create({ data });
  }

  async findLatestOtpByEmail(email: string): Promise<PasswordResetOtp | null> {
    return this.prisma.passwordResetOtp.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * OTP 시도 횟수를 1 증가시키고 갱신된 레코드를 반환한다.
   * DB 수준 atomic increment — 동시 호출 시 정확한 카운트 보장.
   */
  async incrementOtpAttempts(id: string): Promise<PasswordResetOtp> {
    return this.prisma.passwordResetOtp.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  /**
   * OTP를 소비 처리한다.
   * options 제공 시: 비밀번호 업데이트 + OTP 소비를 하나의 트랜잭션으로 원자 실행.
   * options 미제공 시: OTP 소비만 처리.
   */
  async markOtpConsumed(
    id: string,
    options?: { userId: string; hashedPassword: string },
  ): Promise<void> {
    if (options) {
      await this.prisma.runInTransaction(async () => {
        await this.prisma.tx.user.update({
          where: { id: options.userId },
          data: { password: options.hashedPassword },
        });
        await this.prisma.tx.passwordResetOtp.update({
          where: { id },
          data: { consumedAt: new Date() },
        });
      });
    } else {
      await this.prisma.tx.passwordResetOtp.update({
        where: { id },
        data: { consumedAt: new Date() },
      });
    }
  }

  // ──────────────────────────────────────────────
  // 전화번호 기반 이메일 조회 (ADR-007: findFirst — phone 비유니크)
  // ──────────────────────────────────────────────

  async findFirstUserByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { phone } });
  }
}
