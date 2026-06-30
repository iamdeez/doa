/**
 * 판매자 E2E 테스트 — [env:e2e-docker]
 *
 * 대상 SC: SC-022
 * 전제: Docker Compose 환경에서 APPROVED 판매자 계정 시드 데이터 필요
 *
 * Option A — defer to user local:
 * 이 파일은 5a AUTHORING 단계에서 작성되었으나 실행은 5b EXECUTION에서
 * 사용자가 로컬 Docker 환경에서 직접 수행한다.
 */

import { test, expect, type Page } from '@playwright/test';

const TEST_SELLER_USER = {
  email: process.env['E2E_SELLER_EMAIL'] ?? 'test-seller@example.com',
  password: process.env['E2E_SELLER_PASSWORD'] ?? 'test-seller-password-001',
};

/** 로그인 헬퍼 */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/이메일/i).fill(email);
  await page.getByLabel(/비밀번호/i).fill(password);
  await page.getByRole('button', { name: /로그인/i }).click();
  // 로그인 완료 대기
  await page.waitForURL(/\/dashboard|\/seller|\/admin/, { timeout: 10_000 });
}

// ─────────────────────────────────────────────
// SC-022: 판매자 로그인 → /seller/products 접근 가능
// ─────────────────────────────────────────────
test.describe('SC-022: 승인된 판매자 /seller/* 접근 (FR-007)', () => {
  /**
   * SC-022 (FR-007 관련):
   * APPROVED 판매자가 로그인하면 /seller/products 경로에 접근할 수 있다.
   * seller 네비게이션 항목(내 상품, 주문·배송 등)이 표시된다.
   */

  test('when_seller_logged_in_then_can_access_seller_products', async ({ page }: { page: Page }) => {
    await loginAs(page, TEST_SELLER_USER.email, TEST_SELLER_USER.password);

    // /seller/products 접근
    await page.goto('/seller/products');
    await expect(page).toHaveURL(/\/seller\/products/);
    // 판매자 콘텐츠 확인
    await expect(page.getByText(/내 상품|상품 목록|상품 관리/i)).toBeVisible({ timeout: 5_000 });
  });

  test('when_seller_logged_in_then_seller_nav_items_visible', async ({ page }: { page: Page }) => {
    await loginAs(page, TEST_SELLER_USER.email, TEST_SELLER_USER.password);

    await page.goto('/dashboard');
    // 판매자 네비게이션 항목 확인
    await expect(page.getByText('내 상품')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('주문·배송')).toBeVisible({ timeout: 5_000 });
  });
});
