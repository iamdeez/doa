/**
 * AuthService 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-010, SC-013, SC-014, SC-016, SC-017
 * 검증 방법: Jest mock (AuthRepository·JwtService·ConfigService·bcrypt)
 *
 * 주의 (PROC-001 — Pydantic v2 대응 아님, TS 버전):
 *   - mock 객체의 필드 값은 실제 타입에 맞게 설정한다.
 *   - bcrypt.compare 는 jest.spyOn 으로 module-level mock 처리.
 *   - signAsync 호출 인자(expiresIn)를 정확히 검증한다.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';

// ─────────────────────────────────────────────
// 상수 (plan.md·tasks.md T-B1 상수화 원칙 — 매직넘버 금지)
// ─────────────────────────────────────────────
const JWT_ACCESS_TTL_SECONDS = 900;          // NFR-003: 15분
const JWT_REFRESH_TTL_DAYS = 30;             // NFR-004: 30일
const JWT_REFRESH_TTL_SECONDS = JWT_REFRESH_TTL_DAYS * 24 * 60 * 60; // 2592000

// ─────────────────────────────────────────────
// Mock 팩토리
// ─────────────────────────────────────────────
const mockAuthRepository = {
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
  findUserById: jest.fn(),
  createRefreshToken: jest.fn(),
  findRefreshTokenByHash: jest.fn(),
  revokeRefreshToken: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, unknown> = {
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_ACCESS_TTL: JWT_ACCESS_TTL_SECONDS,
      JWT_REFRESH_TTL: `${JWT_REFRESH_TTL_DAYS}d`,
    };
    return config[key] ?? null;
  }),
};

// 고정 유저 픽스처
const FIXED_USER = {
  id: 'user-fixed-id',
  email: 'test@example.com',
  password: '$2b$10$hashedPassword',   // bcrypt 해시 형태
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─────────────────────────────────────────────
  // SC-010: 중복 이메일 → ConflictException (409)
  // ─────────────────────────────────────────────
  describe('SC-010: 중복 이메일 → ConflictException (409)', () => {
    it('when_duplicate_email_then_conflict_409', async () => {
      /**
       * SC-010 (FR-008 관련):
       * 이미 가입된 이메일로 register 호출 시 ConflictException (HTTP 409) 발생.
       * AuthService.register: findUserByEmail → 존재 시 ConflictException throw.
       */
      mockAuthRepository.findUserByEmail.mockResolvedValue(FIXED_USER);

      await expect(
        service.register({ email: FIXED_USER.email, password: 'anyPassword123' }),
      ).rejects.toThrow(ConflictException);

      expect(mockAuthRepository.findUserByEmail).toHaveBeenCalledWith(FIXED_USER.email);
      // 중복 이메일 감지 후 createUser 호출되지 않아야 함
      expect(mockAuthRepository.createUser).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // SC-013: 잘못된 비밀번호 → UnauthorizedException (401)
  // ─────────────────────────────────────────────
  describe('SC-013: 잘못된 비밀번호 → UnauthorizedException (401)', () => {
    it('when_wrong_password_then_unauthorized_401', async () => {
      /**
       * SC-013 (FR-009 관련):
       * 잘못된 비밀번호로 login 호출 시 UnauthorizedException (HTTP 401) 발생.
       * AuthService.login: findUserByEmail → bcrypt.compare(false) → UnauthorizedException.
       */
      mockAuthRepository.findUserByEmail.mockResolvedValue(FIXED_USER);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      await expect(
        service.login({ email: FIXED_USER.email, password: 'wrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuthRepository.findUserByEmail).toHaveBeenCalledWith(FIXED_USER.email);
    });

    it('when_nonexistent_user_login_then_unauthorized_401', async () => {
      /**
       * SC-013 보조: 존재하지 않는 사용자로 login 시 UnauthorizedException.
       * 사용자 미조회 → 401 (타이밍 공격 완화: 동일 예외 반환).
       */
      mockAuthRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nouser@example.com', password: 'anyPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─────────────────────────────────────────────
  // SC-014: login → access token exp = iat + 900s
  // ─────────────────────────────────────────────
  describe('SC-014: login access token exp = iat + 900s (NFR-003)', () => {
    it('when_login_then_access_exp_iat_plus_900', async () => {
      /**
       * SC-014 (FR-009, NFR-003 관련):
       * login 성공 시 발급하는 Access Token의 expiresIn이 JWT_ACCESS_TTL_SECONDS(900) 과 동일해야 한다.
       * 검증: signAsync 호출 시 options.expiresIn === 900 (또는 '15m' 등 900s 상당값).
       *
       * signAsync 는 두 번 호출됨: 첫 번째 = access token, 두 번째 = refresh token.
       * access token 발급 호출의 expiresIn 이 900(또는 '15m') 인지 확인.
       */
      mockAuthRepository.findUserByEmail.mockResolvedValue(FIXED_USER);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
      mockJwtService.signAsync
        .mockResolvedValueOnce('mock.access.token')
        .mockResolvedValueOnce('mock.refresh.token');
      mockAuthRepository.createRefreshToken.mockResolvedValue(undefined);

      await service.login({ email: FIXED_USER.email, password: 'correctPassword' });

      // signAsync 가 최소 1회 호출되어야 함
      expect(mockJwtService.signAsync).toHaveBeenCalled();

      // Access token 발급 호출: expiresIn 이 JWT_ACCESS_TTL_SECONDS(900) 또는 '15m'
      const signCalls = mockJwtService.signAsync.mock.calls as Array<[unknown, { expiresIn?: number | string }?]>;
      const accessTokenCall = signCalls.find(
        ([, opts]) =>
          opts?.expiresIn === JWT_ACCESS_TTL_SECONDS ||
          opts?.expiresIn === '15m' ||
          opts?.expiresIn === '900s',
      );
      expect(accessTokenCall).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // SC-016: 만료·무효 refresh → UnauthorizedException (401)
  // ─────────────────────────────────────────────
  describe('SC-016: 만료·무효 Refresh Token → UnauthorizedException (401)', () => {
    it('when_expired_or_revoked_refresh_then_401 (JWT signature expired)', async () => {
      /**
       * SC-016 (FR-010 관련):
       * 만료된 Refresh Token JWT (서명 검증 실패) 로 refresh 호출 시 UnauthorizedException 발생.
       * AuthService.refresh: JwtService.verifyAsync throw → catch → UnauthorizedException.
       */
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.refresh({ refreshToken: 'expired.jwt.token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('when_expired_or_revoked_refresh_then_401 (revoked in DB)', async () => {
      /**
       * SC-016 (FR-010 관련):
       * JWT 서명은 유효하나 DB에서 해당 tokenHash가 없거나 revoked=true인 경우 401.
       * AuthService.refresh: verifyAsync 성공 → findRefreshTokenByHash 조회 → null 반환 → 401.
       */
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: FIXED_USER.id,
        email: FIXED_USER.email,
        jti: 'some-uuid',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      // DB에서 토큰을 찾을 수 없음 (revoked 또는 미존재)
      mockAuthRepository.findRefreshTokenByHash.mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken: 'valid.sig.but.revoked.token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('when_expired_or_revoked_refresh_then_401 (revoked=true flag)', async () => {
      /**
       * SC-016 보조: revoked=true 상태인 토큰으로 refresh 시도 → 401.
       */
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: FIXED_USER.id,
        email: FIXED_USER.email,
        jti: 'another-uuid',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      mockAuthRepository.findRefreshTokenByHash.mockResolvedValue({
        id: 'token-row-id',
        userId: FIXED_USER.id,
        tokenHash: 'sha256hashvalue',
        expiresAt: new Date(Date.now() + 86400000),
        revoked: true,  // 무효화됨
        createdAt: new Date(),
      });

      await expect(
        service.refresh({ refreshToken: 'revoked.flag.token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─────────────────────────────────────────────
  // SC-017: login → refresh token 만료 = +30d
  // ─────────────────────────────────────────────
  describe('SC-017: login refresh token 만료 = +30d (NFR-004)', () => {
    it('when_login_then_refresh_expiry_plus_30d', async () => {
      /**
       * SC-017 (FR-009, NFR-004 관련):
       * login 성공 시 DB에 저장되는 RefreshToken의 expiresAt이
       * 발급 시점으로부터 30일(JWT_REFRESH_TTL_DAYS) 후여야 한다.
       *
       * 검증 방법:
       *   - createRefreshToken 호출 인자 중 expiresAt (Date 타입) 확인
       *   - expiresAt ≈ now + 30d (±5초 오차 허용)
       *   OR signAsync 호출 시 expiresIn이 '30d' 또는 JWT_REFRESH_TTL_SECONDS(2592000) 인지 확인
       */
      mockAuthRepository.findUserByEmail.mockResolvedValue(FIXED_USER);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
      mockJwtService.signAsync
        .mockResolvedValueOnce('mock.access.token')
        .mockResolvedValueOnce('mock.refresh.token');
      mockAuthRepository.createRefreshToken.mockResolvedValue(undefined);

      const beforeMs = Date.now();
      await service.login({ email: FIXED_USER.email, password: 'correctPassword' });
      const afterMs = Date.now();

      // Approach 1: signAsync 로 refresh token 발급 시 expiresIn = '30d' 또는 2592000
      const signCalls = mockJwtService.signAsync.mock.calls as Array<[unknown, { expiresIn?: number | string }?]>;
      const refreshTokenCall = signCalls.find(
        ([, opts]) =>
          opts?.expiresIn === '30d' ||
          opts?.expiresIn === JWT_REFRESH_TTL_SECONDS ||
          opts?.expiresIn === `${JWT_REFRESH_TTL_DAYS}d`,
      );

      // Approach 2: createRefreshToken 호출 시 expiresAt ≈ now + 30d
      const expectedMinMs = beforeMs + JWT_REFRESH_TTL_SECONDS * 1000;
      const expectedMaxMs = afterMs + JWT_REFRESH_TTL_SECONDS * 1000;

      if (mockAuthRepository.createRefreshToken.mock.calls.length > 0) {
        // createRefreshToken(tokenHash, expiresAt, userId) 시그니처 기준
        const createRefreshArgs = mockAuthRepository.createRefreshToken.mock.calls[0] as [string, Date, string];
        const expiresAt = createRefreshArgs[1];
        if (expiresAt instanceof Date) {
          const toleranceMs = 10_000; // 10초 오차 허용
          expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinMs - toleranceMs);
          expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxMs + toleranceMs);
        } else {
          // createRefreshToken 인자가 Date 타입이 아니면 signAsync 옵션으로 검증
          expect(refreshTokenCall).toBeDefined();
        }
      } else {
        // createRefreshToken 미호출인 경우 → signAsync 의 expiresIn 으로 검증
        expect(refreshTokenCall).toBeDefined();
      }
    });
  });
});
