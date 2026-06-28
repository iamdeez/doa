/**
 * AdminGuard 단위 테스트 — SEC-001 회귀 방지
 *
 * SEC-001 (CVSS 7.7, High): approve/reject 자가 승인 가능 취약점 수정 검증.
 * ADMIN_USER_IDS 기반 환경변수 admin 가드 동작 확인.
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function makeCtx(userId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId ? { userId, email: `${userId}@test.com` } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard — SEC-001 회귀', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  afterEach(() => {
    delete process.env['ADMIN_USER_IDS'];
  });

  it('SEC-001 regression: when_non_admin_user_calls_approve_then_403', () => {
    /**
     * SEC-001: ADMIN_USER_IDS 에 포함되지 않은 사용자가
     * approve/reject 엔드포인트 호출 시 ForbiddenException(403).
     * 자가 승인 공격 차단 확인.
     */
    process.env['ADMIN_USER_IDS'] = 'admin-user-id-001';

    const ctx = makeCtx('attacker-user-id');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('when_admin_user_calls_approve_then_pass', () => {
    /**
     * ADMIN_USER_IDS 에 포함된 사용자 → 통과.
     */
    const adminId = 'admin-user-id-001';
    process.env['ADMIN_USER_IDS'] = adminId;

    const ctx = makeCtx(adminId);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('when_admin_user_ids_empty_then_all_403', () => {
    /**
     * ADMIN_USER_IDS 미설정(빈 값) 시 모든 사용자 거부 — fail-closed.
     */
    process.env['ADMIN_USER_IDS'] = '';

    const ctx = makeCtx('any-user-id');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
