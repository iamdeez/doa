/**
 * ADMIN_USER_IDS 환경변수를 파싱하여 특정 userId 가 관리자인지 판별하는 순수 헬퍼.
 *
 * AdminGuard 와 AuthService 가 동일 로직을 공유하도록 추출 (ADR-001).
 * rawEnv 를 인자로 받아 테스트 시 process.env 없이 단위 검증 가능.
 *
 * fail-closed: adminIds 가 비어 있으면(env 미설정·빈값) false 반환.
 */
export function isAdminUserId(userId: string, rawEnv: string | undefined): boolean {
  const adminIds = (rawEnv ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (adminIds.length === 0) return false;
  return adminIds.includes(userId);
}
