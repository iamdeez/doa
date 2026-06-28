/**
 * Health 엔드포인트 통합 테스트 — [env:integration]
 *
 * 대상 SC: SC-002, SC-007, SC-008
 * 검증 방법: NestJS TestingModule + supertest (앱 기동 + PostgreSQL 필요)
 *
 * 실행 전제 (옵션 A — plan.md 확정):
 *   1. `docker compose up -d` (PostgreSQL 16)
 *   2. `pnpm --filter backend exec prisma migrate dev` (또는 deploy)
 *   3. `.env` 파일 환경변수 설정 (DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET)
 *   4. 본 테스트 실행: `pnpm --filter backend test:e2e`
 *
 * 주의 (AUTHORING — TDD Red):
 *   - AppModule 이 아직 미존재 → import error 허용 (TDD Red 상태).
 *   - 프로덕션 코드 구현 완료 후 Green 됨.
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

// AppModule: apps/backend/src/app.module.ts (구현 완료 시 존재)
import { AppModule } from '../src/app.module';

// ─────────────────────────────────────────────
// P95 계산 헬퍼
// ─────────────────────────────────────────────
function calculateP95(responseTimes: number[]): number {
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─────────────────────────────────────────────
// 테스트 스위트
// ─────────────────────────────────────────────
describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────
  // SC-002: NestJS 기동 + pino 로그 출력
  // ─────────────────────────────────────────────
  describe('SC-002: NestJS 기동 + pino stdout 로그', () => {
    it('when_app_boots_then_no_error_and_pino_stdout', async () => {
      /**
       * SC-002 (FR-002 관련):
       * `pnpm --filter backend dev` 로 앱 기동 시 에러 없이 기동되고
       * pino 포맷의 구조적 로그가 stdout에 출력된다.
       *
       * 자동화 검증: beforeAll 에서 app.init() 성공 = 앱 기동 성공.
       * pino stdout 출력은 실행 환경에서 직접 확인 (옵션 A).
       *
       * 이 테스트는 app.init() 가 에러 없이 완료되었음을 간접 검증한다.
       */
      // app이 정상 기동되면 이 단계에 도달함
      expect(app).toBeDefined();
      // GET /health 로 앱 응답 확인 (기동 성공의 간접 증거)
      const response = await request(app.getHttpServer()).get('/health');
      expect(response.status).toBe(200);
    });
  });

  // ─────────────────────────────────────────────
  // SC-007: GET /health → 200 {status:"ok"}
  // ─────────────────────────────────────────────
  describe('SC-007: GET /health → 200 {status:"ok"}', () => {
    it('when_get_health_then_200_status_ok', async () => {
      /**
       * SC-007 (FR-007 관련):
       * GET /health 요청 시 HTTP 200과 {"status":"ok"} JSON 응답.
       * DB 연결 상태 포함 안 함 (alive 만 확인 — ADR-006).
       */
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
        });
    });
  });

  // ─────────────────────────────────────────────
  // SC-008: health P95 ≤ 200ms (연속 50회)
  // ─────────────────────────────────────────────
  describe('SC-008: GET /health P95 응답시간 ≤ 200ms (NFR-001)', () => {
    it(
      'when_50_health_requests_then_p95_under_200ms',
      async () => {
        /**
         * SC-008 (NFR-001 관련):
         * 로컬/dev 환경에서 GET /health 연속 50회 요청의 P95 응답시간 ≤ 200ms.
         * DB 미접근(alive 만) → 단순 라우트라 200ms 충족 용이.
         */
        const REQUESTS = 50;
        const P95_THRESHOLD_MS = 200;
        const responseTimes: number[] = [];

        for (let i = 0; i < REQUESTS; i++) {
          const start = Date.now();
          await request(app.getHttpServer()).get('/health').expect(200);
          responseTimes.push(Date.now() - start);
        }

        expect(responseTimes).toHaveLength(REQUESTS);
        const p95 = calculateP95(responseTimes);
        expect(p95).toBeLessThanOrEqual(P95_THRESHOLD_MS);
      },
      60_000, // timeout: 60초 (50회 순차 요청)
    );
  });
});
