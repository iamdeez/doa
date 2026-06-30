import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_KEYS } from '@/lib/config';

/**
 * 라우트 가드 middleware (ADR-006, FR-006).
 *
 * middleware = UX 계층. 쿠키 부재 시 로그인 페이지로 리다이렉트하여 불필요한 백엔드 왕복을 줄인다.
 * 실제 인가 강제는 백엔드 JWT·AdminGuard 가 담당(L2 보안). 쿠키 조작으로 화면 진입 가능하더라도
 * API 호출 시 백엔드가 401/403 을 반환하므로 실질적 보호는 유지된다.
 */
export function middleware(req: NextRequest) {
  const auth = req.cookies.get(COOKIE_KEYS.auth)?.value;
  const admin = req.cookies.get(COOKIE_KEYS.admin)?.value;
  const loginUrl = new URL('/login', req.url);

  // 인증 쿠키 없음 → 로그인으로 리다이렉트 (SC-015)
  if (!auth) {
    return NextResponse.redirect(loginUrl);
  }

  // /admin/* 경로 + 비관리자 → 로그인으로 리다이렉트 (SC-016, ADR-006: 403 대신 /login)
  if (req.nextUrl.pathname.startsWith('/admin') && admin !== 'true') {
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/account/:path*',
    '/seller/:path*',
    '/admin/:path*',
  ],
};
