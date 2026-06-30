/**
 * 관리자 E2E 테스트 — [env:e2e-docker]
 *
 * 대상 SC: SC-023
 * 전제: Docker Compose 환경에서 ADMIN_USER_IDS에 등록된 관리자 계정 시드 데이터 필요
 *
 * Option A — defer to user local:
 * 이 파일은 5a AUTHORING 단계에서 작성되었으나 실행은 5b EXECUTION에서
 * 사용자가 로컬 Docker 환경에서 직접 수행한다.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const TEST_ADMIN_USER = {
  email: process.env['E2E_ADMIN_EMAIL'] ?? 'test-admin@example.com',
  password: process.env['E2E_ADMIN_PASSWORD'] ?? 'test-admin-password-001',
};

/** 로그인 헬퍼 */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/이메일/i).fill(email);
  await page.getByLabel(/비밀번호/i).fill(password);
  await page.getByRole('button', { name: /로그인/i }).click();
  await page.waitForURL(/\/dashboard|\/seller|\/admin/, { timeout: 10_000 });
}

// ─────────────────────────────────────────────
// SC-023: 관리자 로그인 → /admin/banners 접근 가능
// ─────────────────────────────────────────────
test.describe('SC-023: 관리자 /admin/* 접근 (FR-007, FR-006)', () => {
  /**
   * SC-023 (FR-007, FR-006 관련):
   * ADMIN_USER_IDS에 등록된 관리자가 로그인하면 /admin/banners 경로에 접근할 수 있다.
   * 관리자 네비게이션 항목(판매자 승인, 배너 등)이 표시된다.
   * hydrate() 후 doa_console_admin=true 쿠키가 설정되어 middleware를 통과한다.
   */

  test('when_admin_logged_in_then_can_access_admin_banners', async ({ page }: { page: Page }) => {
    await loginAs(page, TEST_ADMIN_USER.email, TEST_ADMIN_USER.password);

    // /admin/banners 접근
    await page.goto('/admin/banners');
    await expect(page).toHaveURL(/\/admin\/banners/);
    // 배너 관리 콘텐츠 확인 (페이지 heading — nav 링크 등 중복 매칭 방지)
    await expect(page.getByRole('heading', { name: /배너/ })).toBeVisible({ timeout: 5_000 });
  });

  test('when_admin_logged_in_then_admin_nav_items_visible', async ({ page }: { page: Page }) => {
    await loginAs(page, TEST_ADMIN_USER.email, TEST_ADMIN_USER.password);

    await page.goto('/dashboard');
    // 관리자 네비게이션 항목 확인
    await expect(page.getByText('배너')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('판매자 승인')).toBeVisible({ timeout: 5_000 });
  });

  test('when_admin_logged_in_then_admin_cookie_is_set', async ({ page, context }: { page: Page; context: BrowserContext }) => {
    /**
     * ADR-003 (쿠키 미러링): 관리자 로그인 후 doa_console_admin=true 쿠키 확인.
     */
    await loginAs(page, TEST_ADMIN_USER.email, TEST_ADMIN_USER.password);

    const cookies = await context.cookies();
    const adminCookie = cookies.find((c: { name: string; value: string }) => c.name === 'doa_console_admin');
    expect(adminCookie?.value).toBe('true');
  });
});
