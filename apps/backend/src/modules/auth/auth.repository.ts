import { Injectable } from '@nestjs/common';
import { RefreshToken, User } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

// P-001: users 스키마(users.users, users.refresh_tokens)에만 접근. 타 스키마 미접근.

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
}
