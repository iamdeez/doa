/**
 * 상품 목록 조회 P95 성능 테스트 — [env:integration]
 *
 * 대상 SC: SC-047 (NFR-001 관련)
 * 검증 방법: Docker Compose PostgreSQL 기동 후 실제 HTTP 요청 × 100회 → P95 측정
 *
 * 실행 조건 (옵션 A — plan.md SC-047):
 *   1. docker compose up -d (또는 로컬 PostgreSQL 기동)
 *   2. 테스트 데이터: ACTIVE/OUT_OF_STOCK 상품 1,000개 미만 시드
 *   3. DATABASE_URL 환경 변수 설정
 *   4. pnpm --filter backend test:e2e
 *
 * P95 기준: 500ms 이하 (NFR-001)
 *
 * ─────────────────────────────────────────────
 * [env:integration] 분류:
 *   이 테스트는 단위/정적 테스트로 커버 불가.
 *   실제 NestJS 앱 기동 + PostgreSQL 연결이 필요.
 *   CI 환경에서는 docker-compose 서비스 기동 후 실행.
 *   로컬 환경: 직접 실행 또는 Test Agent(EXECUTION) 지시에 따라 결과를 수동 보고.
 * ─────────────────────────────────────────────
 */

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// P95 응답시간 기준 (ms)
const P95_THRESHOLD_MS = 500;
// 반복 횟수
const REPEAT_COUNT = 100;
// P95 계산: 상위 5% 제외 기준 인덱스
const P95_INDEX = Math.floor(REPEAT_COUNT * 0.95);

/**
 * 배열을 오름차순 정렬한 후 P95 인덱스의 값을 반환한다.
 */
function calcP95(durations: number[]): number {
  const sorted = [...durations].sort((a, b) => a - b);
  return sorted[P95_INDEX - 1] ?? sorted[sorted.length - 1];
}

describe('SC-047: GET /products P95 응답시간 ≤ 500ms', () => {
  let app: INestApplication;

  beforeAll(async () => {
    /**
     * SC-047 (NFR-001 관련):
     * Docker Compose 환경에서 앱 기동.
     * DATABASE_URL 미설정 시 연결 실패로 테스트 건너뜀.
     */
    if (!process.env.DATABASE_URL) {
      // integration 환경 미구성 — 이 describe 블록 전체 스킵
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('when_get_products_100_times_then_p95_under_500ms', async () => {
    /**
     * SC-047 (NFR-001 관련):
     * GET /products?limit=20 를 100회 반복 호출하여 P95 응답시간 측정.
     * P95 ≤ 500ms 여야 한다.
     * 조건: 로컬 docker-compose PostgreSQL, 상품 1,000개 미만.
     *
     * DATABASE_URL 미설정 → 통합 테스트 환경 미구성으로 판단, 스킵.
     */
    if (!process.env.DATABASE_URL || !app) {
      console.warn(
        'SC-047 SKIP: DATABASE_URL 미설정 또는 앱 기동 실패.\n' +
          '통합 테스트 환경을 구성하고 재실행하세요:\n' +
          '  docker compose up -d\n' +
          '  DATABASE_URL=... pnpm --filter backend test:e2e',
      );
      return;
    }

    const durations: number[] = [];

    for (let i = 0; i < REPEAT_COUNT; i++) {
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/products?limit=20')
        .expect(200);
      const elapsed = Date.now() - start;
      durations.push(elapsed);
    }

    const p95 = calcP95(durations);
    const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    const max = Math.max(...durations);
    const min = Math.min(...durations);

    console.log(`SC-047 성능 결과: P95=${p95}ms, avg=${avg}ms, max=${max}ms, min=${min}ms`);

    expect(p95).toBeLessThanOrEqual(P95_THRESHOLD_MS);
  }, 60_000); // 60초 타임아웃

  it('when_get_products_then_only_active_and_oos_returned', async () => {
    /**
     * SC-047 기능 전제 검증:
     * GET /products 응답에 DRAFT/INACTIVE 상품이 포함되지 않아야 함.
     * (성능 테스트 전제 기능 확인)
     */
    if (!process.env.DATABASE_URL || !app) {
      return;
    }

    const response = await request(app.getHttpServer())
      .get('/products?limit=20')
      .expect(200);

    const items: Array<{ status: string }> = response.body.items ?? response.body;
    for (const item of items) {
      expect(['ACTIVE', 'OUT_OF_STOCK']).toContain(item.status);
    }
  });
});
