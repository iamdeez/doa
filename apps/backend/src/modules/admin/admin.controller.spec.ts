/**
 * AdminController 단위 테스트 — [env:unit] (v1.1.0/017 spec 신규)
 *
 * 대상 SC: SC-020 (NFR-003 관련) — 비관리자 admin 판매자 목록 조회 시도 → 403 회귀 방어
 *          SC-001~005 query 파라미터 배선 보조 확인 (admin.service.spec.ts 가 로직 본체 검증)
 *
 * 검증 방법:
 *   (1) Reflect 메타데이터로 AdminController 클래스 레벨 @UseGuards(JwtAuthGuard, AdminGuard) 유지 확인
 *       — T011 이 listPendingSellers 라우트에 query 파라미터를 추가하며 클래스 데코레이터를
 *         실수로 제거/변경하지 않았음을 회귀 방어(SC-020, AdminGuard fail-closed).
 *       AdminGuard 자체의 fail-closed 동작(ADMIN_USER_IDS 화이트리스트)은 admin.guard.spec.ts 가
 *       이미 단위 테스트로 커버 — 본 파일은 "이 컨트롤러/라우트에 그 가드가 실제로 걸려있는가"만 검증한다.
 *   (2) 컨트롤러 메서드 호출 시 query(status·cursor·limit·q) 가 AdminService.listSellers 로
 *       올바르게 전달되는지 확인 (admin.service.spec.ts 와 상호 보완 — 파싱 경계는 서비스 책임).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { AdminGuard } from '../../shared/auth/admin.guard';

const mockAdminService = {
  listSellers: jest.fn(),
  approveSeller: jest.fn(),
  listUsers: jest.fn(),
  listAuditLogs: jest.fn(),
};

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
    })
      // AdminController 생성자가 AdminGuard 등 실제 가드 클래스를 의존하지 않으므로(데코레이터만 참조)
      // 별도 override 없이 컴파일 가능.
      .compile();

    controller = module.get<AdminController>(AdminController);
  });

  // ─────────────────────────────────────────────
  // SC-020 (v1.1.0/017 spec): 클래스 레벨 가드 유지(회귀 방어)
  // ─────────────────────────────────────────────
  describe('SC-020: AdminController — JwtAuthGuard+AdminGuard 클래스 레벨 유지', () => {
    it('when_inspect_guards_metadata_then_jwt_and_admin_guard_present', () => {
      /**
       * SC-020 (NFR-003 관련, v1.1.0/017 spec):
       * listPendingSellers 라우트에 query 파라미터(status·cursor·limit·q)가 추가되어도
       * 클래스 레벨 @UseGuards(JwtAuthGuard, AdminGuard) 는 변경되지 않아야 한다
       * (ADMIN_USER_IDS 외 사용자는 여전히 403).
       */
      const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController) as unknown[] | undefined;

      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(AdminGuard);
    });
  });

  // ─────────────────────────────────────────────
  // SC-001~005 보조: query 파라미터 배선 확인
  // ─────────────────────────────────────────────
  describe('listPendingSellers — query 파라미터 배선', () => {
    it('when_query_params_present_then_forwarded_to_service(SC-001~005 보조)', async () => {
      /**
       * (v1.1.0/017 spec) 보조:
       * status·cursor·limit·q 쿼리 파라미터가 AdminService.listSellers 호출 인자로 그대로 전달된다.
       * limit 은 컨트롤러에서 문자열 → 숫자로 파싱(parseInt)됨 — 클램프 자체는 서비스 책임.
       */
      const envelope = { items: [], nextCursor: null };
      mockAdminService.listSellers.mockResolvedValue(envelope);

      const result = await controller.listPendingSellers('APPROVED', 'cursor-1', '10', '마켓');

      expect(mockAdminService.listSellers).toHaveBeenCalledWith('APPROVED', 'cursor-1', 10, '마켓');
      expect(result).toBe(envelope);
    });

    it('when_query_params_absent_then_undefined_forwarded(SC-003 보조)', async () => {
      /**
       * (v1.1.0/017 spec) 보조 — SC-003 하위호환:
       * 쿼리 파라미터가 전혀 없으면 undefined 그대로 서비스에 전달(서비스가 PENDING 기본값 결정).
       */
      const envelope = { items: [], nextCursor: null };
      mockAdminService.listSellers.mockResolvedValue(envelope);

      await controller.listPendingSellers(undefined, undefined, undefined, undefined);

      expect(mockAdminService.listSellers).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });
  });
});
