import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 설정 — [env:e2e-docker]
 *
 * 실행 환경: Docker Compose (backend + console 동시 기동)
 * baseURL: http://localhost:3100 (console dev server)
 * 테스트 경로: ./e2e/
 * 실행 타임아웃: 2분 이내 (SC-020 NFR-005)
 *
 * 실행 방법 (로컬 — Docker Compose 필요):
 *   docker-compose up -d   # backend + DB 기동
 *   pnpm --filter console dev &  # console 기동
 *   pnpm --filter console e2e    # Playwright 실행
 *
 * E2E SC 목록 (Option A — user local defer):
 *   SC-015: 미인증 접근 → /login 리다이렉트
 *   SC-016: 비관리자 /admin/* 접근 → /login 리다이렉트
 *   SC-021: 로그인 → 대시보드 진입
 *   SC-022: 판매자 로그인 → /seller/products 접근
 *   SC-023: 관리자 로그인 → /admin/banners 접근
 *   SC-024: 로그인 후 /admin/* 직접 접근 시 비관리자 차단
 *   SC-025: 이미지 업로드 후 상품 목록 갱신 (2분 이내)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000, // SC-020: 2분 이내
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false, // E2E 순서 의존성 방지
  retries: 0,
  workers: 1, // Docker 환경에서 단일 워커
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
