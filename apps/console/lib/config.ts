/** 런타임 설정. NEXT_PUBLIC_API_URL 미설정 시 로컬 백엔드(포트 3000) 기본값. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export const STORAGE_KEYS = {
  accessToken: 'doa.console.accessToken',
  refreshToken: 'doa.console.refreshToken',
} as const;

/**
 * Next.js middleware 라우트 가드용 쿠키 키 (ADR-003).
 * localStorage 토큰 → 비-HttpOnly 쿠키로 미러링하여 서버 컴포넌트·middleware 에서 읽을 수 있게 한다.
 * 실제 인가 강제는 백엔드 JWT/AdminGuard 가 담당. 미들웨어는 UX 계층.
 */
export const COOKIE_KEYS = {
  auth: 'doa_console_auth',
  admin: 'doa_console_admin',
} as const;
