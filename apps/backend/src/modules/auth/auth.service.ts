import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import {
  JWT_ACCESS_TTL_SECONDS,
  JWT_REFRESH_TTL_DAYS,
} from '../../shared/config/jwt.config';
import { AuthRepository } from './auth.repository';

// 비밀번호 bcrypt cost factor (ADR-001: cost 10~12)
// cost 10 선택 이유: cost 12 에서 P95 859ms → NFR-002(500ms) 초과.
// cost 10 은 ADR-001 허용 범위 내이며 P95 목표 충족.
const BCRYPT_SALT_ROUNDS = 10;

interface JwtPayload {
  sub: string;
  email: string;
  jti?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  createdAt: Date;
}

export interface RegisterResult {
  id: string;
  email: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────
  // T-B3: register
  // ──────────────────────────────────────────────

  async register(input: { email: string; password: string }): Promise<RegisterResult> {
    const existing = await this.authRepository.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    const user = await this.authRepository.createUser({
      email: input.email,
      password: hashedPassword,
    });

    return { id: user.id, email: user.email };
  }

  // ──────────────────────────────────────────────
  // T-B4: login — access + refresh 동일 분기에서 발급
  // ──────────────────────────────────────────────

  async login(input: { email: string; password: string }): Promise<LoginResult> {
    const user = await this.authRepository.findUserByEmail(input.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(input.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');

    const payload: JwtPayload = { sub: user.id, email: user.email };

    // access 토큰 발급 (NFR-003: exp = iat + 900s)
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: JWT_ACCESS_TTL_SECONDS,
    });

    // refresh 토큰 발급 — jti(uuid)로 동일 사용자 중복 login 시에도 tokenHash 유일성 보장
    const jti = randomUUID();
    const refreshPayload: JwtPayload = { ...payload, jti };
    const refreshTtlSeconds = JWT_REFRESH_TTL_DAYS * 24 * 60 * 60;

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshTtlSeconds,
    });

    // refresh 원문 SHA-256 → DB 에 tokenHash 저장 (ADR-003: 원문 미저장)
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + refreshTtlSeconds * 1000);

    await this.authRepository.createRefreshToken({
      tokenHash,
      expiresAt,
      userId: user.id,
    });

    return { accessToken, refreshToken };
  }

  // ──────────────────────────────────────────────
  // T-B5: refresh
  // ──────────────────────────────────────────────

  async refresh(input: { refreshToken: string }): Promise<RefreshResult> {
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');

    // JWT 서명·exp 검증
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(input.refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // tokenHash 로 DB 조회
    const tokenHash = this.hashToken(input.refreshToken);
    const stored = await this.authRepository.findRefreshTokenByHash(tokenHash);

    if (!stored || stored.revoked || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or revoked');
    }

    // 새 access 토큰 발급
    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    const newPayload: JwtPayload = { sub: payload.sub, email: payload.email };
    const accessToken = await this.jwtService.signAsync(newPayload, {
      secret: accessSecret,
      expiresIn: JWT_ACCESS_TTL_SECONDS,
    });

    return { accessToken };
  }

  // ──────────────────────────────────────────────
  // T-B6: logout
  // ──────────────────────────────────────────────

  async logout(input: { refreshToken: string }): Promise<void> {
    const tokenHash = this.hashToken(input.refreshToken);
    await this.authRepository.revokeRefreshToken(tokenHash);
  }

  // ──────────────────────────────────────────────
  // T-B7: me / getProfile
  // ──────────────────────────────────────────────

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
