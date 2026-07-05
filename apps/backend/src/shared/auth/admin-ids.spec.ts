/**
 * isAdminUserId 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-002
 * 검증 방법: 순수 함수 직접 호출 (외부 의존 없음)
 *
 * Canonical 심볼:
 *   isAdminUserId(userId: string, rawEnv: string | undefined) => boolean
 *   위치: apps/backend/src/shared/auth/admin-ids.ts
 */

import { isAdminUserId } from './admin-ids';

describe('isAdminUserId', () => {
  // ─────────────────────────────────────────────
  // SC-002: ADMIN_USER_IDS 포함 → true
  // ─────────────────────────────────────────────
  describe('SC-002: env 포함 → isAdmin: true', () => {
    it('when_admin_user_id_in_env_then_isAdmin_true', () => {
      /**
       * SC-002 (FR-001 관련):
       * ADMIN_USER_IDS 환경변수에 userId가 포함된 경우 true를 반환한다.
       */
      const userId = 'admin-user-001';
      const rawEnv = 'admin-user-001,admin-user-002';

      expect(isAdminUserId(userId, rawEnv)).toBe(true);
    });

    it('when_admin_user_id_in_env_with_spaces_then_isAdmin_true', () => {
      /**
       * SC-002 edge: 콤마 구분값에 공백이 있어도 trim 후 일치하면 true.
       * AdminGuard 기존 로직 동일 패턴 — fail-safe.
       */
      const userId = 'admin-user-001';
      const rawEnv = ' admin-user-001 , admin-user-002 ';

      expect(isAdminUserId(userId, rawEnv)).toBe(true);
    });

    it('when_single_admin_user_in_env_then_isAdmin_true', () => {
      /**
       * SC-002: 단일 ID만 있는 경우 일치하면 true.
       */
      const userId = 'sole-admin';
      const rawEnv = 'sole-admin';

      expect(isAdminUserId(userId, rawEnv)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // SC-002: ADMIN_USER_IDS 미포함 → false
  // ─────────────────────────────────────────────
  describe('SC-002: 미포함 → isAdmin: false', () => {
    it('when_user_not_in_env_then_isAdmin_false', () => {
      /**
       * SC-002 (FR-001 관련):
       * ADMIN_USER_IDS에 포함되지 않은 userId는 false를 반환한다.
       */
      const userId = 'regular-user-999';
      const rawEnv = 'admin-user-001,admin-user-002';

      expect(isAdminUserId(userId, rawEnv)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // SC-002: ADMIN_USER_IDS 미설정(undefined) → false (fail-closed)
  // ─────────────────────────────────────────────
  describe('SC-002: env 미설정 → isAdmin: false (fail-closed)', () => {
    it('when_env_unset_then_isAdmin_false', () => {
      /**
       * SC-002 (FR-001 관련):
       * ADMIN_USER_IDS 환경변수가 undefined인 경우 fail-closed: 모든 사용자 false.
       * AdminGuard 기존 동작과 동일 — 미설정 시 전원 거부.
       */
      const userId = 'any-user';

      expect(isAdminUserId(userId, undefined)).toBe(false);
    });

    it('when_env_empty_string_then_isAdmin_false', () => {
      /**
       * SC-002 edge: 빈 문자열 환경변수도 fail-closed → false.
       */
      const userId = 'any-user';

      expect(isAdminUserId(userId, '')).toBe(false);
    });

    it('when_env_only_commas_then_isAdmin_false', () => {
      /**
       * SC-002 edge: 콤마만 있는 값도 빈 ID 배열 → false.
       */
      const userId = 'any-user';

      expect(isAdminUserId(userId, ',,,,')).toBe(false);
    });
  });
});
