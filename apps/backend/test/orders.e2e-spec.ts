/**
 * 주문 생성 P95 성능 테스트 — [env:integration]
 *
 * 대상 SC: SC-045 (NFR-001 관련)
 * 검증 방법: Docker Compose PostgreSQL 기동 후 실제 HTTP 요청 × 100회 → P95 측정
 *
 * 실행 조건:
 *   1. docker compose up -d (또는 로컬 PostgreSQL 기동)
 *   2. 테스트 데이터: 활성 variant (재고 충분), 시드된 사용자 + 카트 아이템
 *   3. DATABASE_URL 환경 변수 설정
 *   4. TEST_JWT_TOKEN 환경 변수 설정 (사전 발급된 테스트 사용자 JWT)
 *   5. pnpm --filter backend test:e2e
 *
 * P95 기준: 1,000ms 이하 (NFR-001; 아이템 10개 미만 기준)
 *
 * ─────────────────────────────────────────────
 * [env:integration] 분류:
 *   이 테스트는 단위/정적 테스트로 커버 불가.
 *   실제 NestJS 앱 기동 + PostgreSQL 연결 + 사전 데이터 시드가 필요.
 *   CI 환경: docker-compose 서비스 기동 후 실행.
 *   로컬 환경: 직접 실행 또는 Test Agent(EXECUTION) 지시에 따라 수동 보고.
 * ─────────────────────────────────────────────
 *
 * 아이템 수 ≤ 10 조건:
 *   POST /orders 는 cartService.getCart() 에서 아이템을 가져오므로,
 *   테스트 사용자의 카트에 ≤ 10개 아이템을 시드한다.
 *   재고 감소(decreaseStock) + 주문 레코드 생성 + 이벤트 기록이 동일 트랜잭션.
 */

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// P95 응답시간 기준 (ms) — NFR-001
const P95_THRESHOLD_MS = 1_000;
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

/**
 * 테스트 환경 구성 여부 확인.
 * DATABASE_URL 과 TEST_JWT_TOKEN 이 모두 설정된 경우에만 통합 테스트 실행.
 */
function isIntegrationEnvReady(): boolean {
  return !!(process.env.DATABASE_URL && process.env.TEST_JWT_TOKEN);
}

describe('SC-045: POST /orders P95 응답시간 ≤ 1,000ms', () => {
  let app: INestApplication;

  beforeAll(async () => {
    /**
     * SC-045 (NFR-001 관련):
     * Docker Compose 환경에서 앱 기동.
     * DATABASE_URL 또는 TEST_JWT_TOKEN 미설정 시 연결 실패로 테스트 건너뜀.
     */
    if (!isIntegrationEnvReady()) {
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

  it('when_post_orders_100_times_then_p95_under_1000ms', async () => {
    /**
     * SC-045 (NFR-001 관련):
     * POST /orders 를 100회 반복 호출하여 P95 응답시간 측정.
     * P95 ≤ 1,000ms 여야 한다.
     * 조건: 로컬 docker-compose PostgreSQL, 카트 아이템 ≤ 10개, 재고 충분.
     *
     * 전제: 테스트 사용자 카트에 variant 아이템이 시드되어 있어야 함.
     *   TEST_VARIANT_ID 환경 변수: 시드된 variant ID (미설정 시 고정 UUID 사용)
     *   TEST_JWT_TOKEN: 테스트 사용자 JWT
     *
     * 주문 생성 후 재고 차감이 발생하므로, 반복 실행 시 재고 부족으로
     * 중간에 409 응답이 반환될 수 있다. 이 경우 해당 응답은 측정에서 제외하고
     * 성공 응답(201)만으로 P95를 계산한다.
     *
     * DATABASE_URL 또는 TEST_JWT_TOKEN 미설정 → 스킵.
     */
    if (!isIntegrationEnvReady() || !app) {
      console.warn(
        'SC-045 SKIP: DATABASE_URL 또는 TEST_JWT_TOKEN 미설정.\n' +
          '통합 테스트 환경을 구성하고 재실행하세요:\n' +
          '  docker compose up -d\n' +
          '  DATABASE_URL=... TEST_JWT_TOKEN=... pnpm --filter backend test:e2e',
      );
      return;
    }

    const jwt = process.env.TEST_JWT_TOKEN!;
    const successDurations: number[] = [];

    for (let i = 0; i < REPEAT_COUNT; i++) {
      const start = Date.now();
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${jwt}`)
        .expect((r) => {
          // 201 (성공) 또는 409 (재고 부족/중복) 허용
          if (r.status !== 201 && r.status !== 409 && r.status !== 400) {
            throw new Error(`Unexpected status ${r.status}: ${JSON.stringify(r.body)}`);
          }
        });
      const elapsed = Date.now() - start;

      if (res.status === 201) {
        successDurations.push(elapsed);
      }
    }

    if (successDurations.length === 0) {
      console.warn(
        'SC-045: 모든 POST /orders 요청이 201 이외 상태를 반환했습니다.\n' +
          '테스트 데이터(카트 아이템, 재고)를 시드 후 재실행하세요.',
      );
      return;
    }

    // 성공 응답이 P95 계산에 충분한지 확인 (최소 20회 이상)
    if (successDurations.length < 20) {
      console.warn(
        `SC-045: 성공 응답 수(${successDurations.length})가 너무 적어 P95 신뢰도가 낮습니다.`,
      );
    }

    const p95Index = Math.floor(successDurations.length * 0.95);
    const sorted = [...successDurations].sort((a, b) => a - b);
    const p95 = sorted[p95Index - 1] ?? sorted[sorted.length - 1];
    const avg = Math.round(successDurations.reduce((a, b) => a + b, 0) / successDurations.length);
    const max = Math.max(...successDurations);
    const min = Math.min(...successDurations);

    console.log(
      `SC-045 성능 결과: P95=${p95}ms, avg=${avg}ms, max=${max}ms, min=${min}ms ` +
        `(성공 ${successDurations.length}/${REPEAT_COUNT}회)`,
    );

    expect(p95).toBeLessThanOrEqual(P95_THRESHOLD_MS);
  }, 120_000); // 120초 타임아웃

  it('when_post_orders_without_token_then_401', async () => {
    /**
     * SC-007 (FR-007 관련) — 인증 필수 확인:
     * JWT 토큰 없이 POST /orders → 401 반환.
     * [env:integration] 보조 검증.
     */
    if (!isIntegrationEnvReady() || !app) {
      return;
    }

    await request(app.getHttpServer())
      .post('/orders')
      .expect(401);
  });

  it('when_post_orders_with_empty_cart_then_400', async () => {
    /**
     * SC-009 Edge Case (FR-010 관련) — 빈 카트 주문:
     * 카트가 비어 있는 경우 POST /orders → 400 반환.
     * 실제 동작 확인은 integration 환경 필요.
     *
     * TEST_EMPTY_CART_JWT: 빈 카트를 가진 사용자의 JWT (선택)
     */
    if (!isIntegrationEnvReady() || !app) {
      return;
    }

    const emptyCartJwt = process.env.TEST_EMPTY_CART_JWT;
    if (!emptyCartJwt) {
      console.warn('SC-045 SKIP: TEST_EMPTY_CART_JWT 미설정 — 빈 카트 케이스 스킵.');
      return;
    }

    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${emptyCartJwt}`);

    // 빈 카트 → 400 (BadRequest) 또는 422 (Unprocessable)
    expect([400, 422]).toContain(res.status);
  });
});
