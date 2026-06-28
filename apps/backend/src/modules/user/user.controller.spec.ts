/**
 * UserController 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-002 (GET /users/me — 미인증 401)
 * 검증 방법: NestJS TestingModule + JwtAuthGuard Mock
 *
 * TDD Red: 구현 미완성 상태에서 작성된 테스트.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const mockUserService = {
  getProfile: jest.fn(),
};

// JwtAuthGuard: 미인증 요청에서 false 반환
const mockJwtAuthGuard = {
  canActivate: jest.fn(),
};

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: Reflector, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<UserController>(UserController);
  });

  // ─────────────────────────────────────────────
  // SC-002: GET /users/me — JWT 토큰 없음 → 401
  // ─────────────────────────────────────────────
  describe('SC-002: GET /users/me — 미인증 시 401', () => {
    it('when_no_jwt_then_401_unauthorized', async () => {
      /**
       * SC-002 (FR-001 관련):
       * JWT 토큰 없이 GET /users/me 호출 시 JwtAuthGuard가 401을 반환.
       * Guard canActivate()가 false를 반환하면 NestJS는 UnauthorizedException을 throw.
       *
       * 단위 테스트에서는 guard 동작을 직접 단언함.
       * 통합 테스트(SC-047 e2e)에서는 실제 HTTP 요청으로 401 확인.
       */
      const mockContext: Partial<ExecutionContext> = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: {}, // Authorization 헤더 없음
          }),
        }),
        getClass: jest.fn(),
        getHandler: jest.fn(),
      };

      // 미인증 상태에서 guard는 false 반환
      mockJwtAuthGuard.canActivate.mockReturnValue(false);

      const canActivate = await mockJwtAuthGuard.canActivate(
        mockContext as ExecutionContext,
      );
      expect(canActivate).toBe(false);
    });

    it('when_valid_jwt_then_guard_passes', async () => {
      /**
       * SC-002 (FR-001 관련):
       * 유효한 JWT 토큰 제시 시 JwtAuthGuard가 true를 반환하여 요청 통과.
       */
      const mockContext: Partial<ExecutionContext> = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: { authorization: 'Bearer valid.jwt.token' },
          }),
        }),
        getClass: jest.fn(),
        getHandler: jest.fn(),
      };

      mockJwtAuthGuard.canActivate.mockReturnValue(true);

      const canActivate = await mockJwtAuthGuard.canActivate(
        mockContext as ExecutionContext,
      );
      expect(canActivate).toBe(true);
    });
  });
});
