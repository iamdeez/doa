/**
 * 인증 E2E 테스트 — [env:e2e-docker]
 *
 * 대상 SC: SC-015, SC-021
 * 전제: Docker Compose로 backend + DB가 기동되어 있어야 함
 *
 * Option A — defer to user local:
 * 이 파일은 5a AUTHORING 단계에서 작성되었으나 실행은 5b EXECUTION에서
 * 사용자가 로컬 Docker 환경에서 직접 수행한다.
 */

import { test, expect, type Page } from '@playwright/test';

// 테스트용 계정 (Docker Compose 환경의 시드 데이터 기준)
const TEST_REGULAR_USER = {
  email: process.env['E2E_REGULAR_EMAIL'] ?? 'test-user@example.com',
  password: process.env['E2E_REGULAR_PASSWORD'] ?? 'test-password-001',
};

// ─────────────────────────────────────────────
// SC-015: 미인증 접근 → /login 리다이렉트
// ─────────────────────────────────────────────
test.describe('SC-015: 미인증 접근 → /login 리다이렉트 (FR-005)', () => {
  /**
   * SC-015 (FR-005 관련):
   * 인증 쿠키(doa_console_auth) 없이 /dashboard, /seller/*, /admin/* 접근 시
   * middleware.ts가 /login으로 리다이렉트한다 (ADR-006).
   */

  test('when_unauthenticated_dashboard_then_redirected_to_login', async ({ page }: { page: Page }) => {
    // 쿠키 없는 상태에서 /dashboard 직접 접근
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    // /login으로 리다이렉트 확인
    await expect(page).toHaveURL(/\/login/);
  });

  test('when_unauthenticated_seller_products_then_redirected_to_login', async ({ page }: { page: Page }) => {
    await page.goto('/seller/products', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('when_unauthenticated_admin_banners_then_redirected_to_login', async ({ page }: { page: Page }) => {
    await page.goto('/admin/banners', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─────────────────────────────────────────────
// SC-021: 로그인 → 대시보드 진입
// ─────────────────────────────────────────────
test.describe('SC-021: 로그인 성공 후 대시보드 진입 (FR-007)', () => {
  /**
   * SC-021 (FR-007 관련):
   * 올바른 이메일·비밀번호로 로그인하면 /dashboard로 이동한다.
   */

  test('when_valid_credentials_then_navigate_to_dashboard', async ({ page }: { page: Page }) => {
    await page.goto('/login');

    // 로그인 폼 입력
    await page.getByLabel(/이메일/i).fill(TEST_REGULAR_USER.email);
    await page.getByLabel(/비밀번호/i).fill(TEST_REGULAR_USER.password);
    await page.getByRole('button', { name: /로그인/i }).click();

    // 대시보드 진입 확인
    await expect(page).toHaveURL(/\/dashboard/);
    // 대시보드 콘텐츠 확인 (네비게이션 항목)
    await expect(page.getByText('대시보드')).toBeVisible();
  });

  test('when_invalid_credentials_then_error_shown', async ({ page }: { page: Page }) => {
    await page.goto('/login');

    await page.getByLabel(/이메일/i).fill('wrong@example.com');
    await page.getByLabel(/비밀번호/i).fill('wrong-password');
    await page.getByRole('button', { name: /로그인/i }).click();

    // 오류 메시지 표시 확인
    await expect(page.getByText(/로그인|인증|오류|실패/i)).toBeVisible({ timeout: 5_000 });
    // 로그인 페이지에 유지
    await expect(page).toHaveURL(/\/login/);
  });
});
