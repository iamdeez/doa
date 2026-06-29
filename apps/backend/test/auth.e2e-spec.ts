/**
 * Auth API 통합 테스트 — [env:integration]
 *
 * 대상 SC: SC-006, SC-009, SC-011, SC-012, SC-015, SC-018, SC-019, SC-027
 * 검증 방법: NestJS TestingModule + supertest + PrismaClient (직접 DB 조회)
 *
 * 실행 전제 (옵션 A — plan.md 확정):
 *   1. `docker compose up -d` (PostgreSQL 16)
 *   2. `pnpm --filter backend exec prisma migrate dev`
 *   3. `.env` 파일 환경변수 설정
 *   4. 본 테스트 실행: `pnpm --filter backend test:e2e`
 *
 * 주의 (AUTHORING — TDD Red):
 *   - AppModule, PrismaService 이 아직 미존재 → import error 허용 (TDD Red).
 *   - 프로덕션 코드 구현 완료 후 Green 됨.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

// AppModule: apps/backend/src/app.module.ts (구현 완료 시 존재)
import { AppModule } from '../src/app.module';
// PrismaService: apps/backend/src/shared/prisma/prisma.service.ts
import { PrismaService } from '../src/shared/prisma/prisma.service';

// ─────────────────────────────────────────────
// P95 계산 헬퍼
// ─────────────────────────────────────────────
function calculateP95(responseTimes: number[]): number {
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─────────────────────────────────────────────
// 테스트용 픽스처
// ─────────────────────────────────────────────
const TEST_USER = {
  email: `test-auth-e2e-${Date.now()}@example.com`,
  password: 'TestPassword123!',
};

// ─────────────────────────────────────────────
// 테스트 스위트
// ─────────────────────────────────────────────
describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // 테스트 간 공유 상태 (순차 흐름 테스트)
  let registeredUserId: string;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // ValidationPipe 전역 설정 (main.ts 와 동일하게)
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // 테스트 사용자 정리 (테스트 격리)
    try {
      await prisma.refreshToken.deleteMany({
        where: { user: { email: TEST_USER.email } },
      });
      await prisma.user.deleteMany({ where: { email: TEST_USER.email } });
    } catch {
      // 정리 실패는 무시 (이미 삭제됐을 수 있음)
    }
    await app.close();
  });

  // ─────────────────────────────────────────────
  // SC-006: prisma migrate → 8 스키마 + users 2 테이블
  // ─────────────────────────────────────────────
  describe('SC-006: Prisma 마이그레이션 결과 (8 스키마 + users 2 테이블)', () => {
    it('when_migrate_dev_then_8_schemas_2_tables', async () => {
      /**
       * SC-006 (FR-006 관련):
       * prisma migrate dev 실행 후 PostgreSQL에
       * 8개 스키마가 존재하고, users 스키마에 2개 테이블이 존재한다.
       *
       * 검증: PostgreSQL information_schema 직접 쿼리.
       */
      const EXPECTED_SCHEMAS = [
        'users', 'products', 'commerce', 'orders',
        'payments', 'settlements', 'admin', 'files',
      ];

      // 스키마 존재 확인
      const schemas = await prisma.$queryRawUnsafe<Array<{ schema_name: string }>>(
        `SELECT schema_name FROM information_schema.schemata
         WHERE schema_name = ANY($1::text[])`,
        EXPECTED_SCHEMAS,
      );
      expect(schemas).toHaveLength(EXPECTED_SCHEMAS.length);

      // users 스키마 핵심 테이블 존재 확인 (users, refresh_tokens 포함 여부만 검증)
      // 002-catalog 이후 users 스키마가 sellers·addresses·wishlists·product_views 로 확장됨.
      // 테이블 수가 늘어도 깨지지 않도록 arrayContaining 으로 핵심 2개만 단언.
      const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'users'
         ORDER BY table_name`,
      );
      const tableNames = tables.map((t) => t.table_name);
      expect(tableNames).toEqual(expect.arrayContaining(['users', 'refresh_tokens']));
    });
  });

  // ─────────────────────────────────────────────
  // SC-009: POST /auth/register → 201 {id, email}
  // ─────────────────────────────────────────────
  describe('SC-009: 회원가입 성공 → 201 {id, email}', () => {
    it('when_valid_register_then_201_id_email', async () => {
      /**
       * SC-009 (FR-008 관련):
       * 유효한 이메일·비밀번호로 POST /auth/register 시
       * HTTP 201과 생성된 사용자의 id, email 반환.
       */
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(TEST_USER)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', TEST_USER.email);
      expect(response.body.id).toBeTruthy();

      // 이후 테스트에서 사용할 userId 보존
      registeredUserId = response.body.id;
    });
  });

  // ─────────────────────────────────────────────
  // SC-011: 회원가입 후 DB password 해시 저장
  // ─────────────────────────────────────────────
  describe('SC-011: DB password 필드에 해시값 저장 (NFR-005)', () => {
    it('when_register_then_db_password_is_hashed', async () => {
      /**
       * SC-011 (FR-008, NFR-005 관련):
       * register 후 DB users 테이블의 password 필드에
       * 원문 비밀번호가 아닌 bcrypt 해시값이 저장된다.
       */
      expect(registeredUserId).toBeDefined();

      const user = await prisma.user.findUnique({
        where: { id: registeredUserId },
      });

      expect(user).toBeTruthy();
      // 원문 비밀번호가 아님
      expect(user!.password).not.toBe(TEST_USER.password);
      // bcrypt 해시 패턴: $2b$NN$... (60자)
      expect(user!.password).toMatch(/^\$2[aby]\$\d{2}\$/);
    });
  });

  // ─────────────────────────────────────────────
  // SC-012: POST /auth/login → 200 {accessToken, refreshToken}
  // ─────────────────────────────────────────────
  describe('SC-012: 로그인 성공 → 200 {accessToken, refreshToken}', () => {
    it('when_valid_login_then_200_access_refresh', async () => {
      /**
       * SC-012 (FR-009 관련):
       * 올바른 이메일·비밀번호로 POST /auth/login 시
       * HTTP 200과 accessToken, refreshToken 반환.
       * refreshToken은 DB users.refresh_tokens에 저장됨.
       */
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(TEST_USER)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(typeof response.body.accessToken).toBe('string');
      expect(typeof response.body.refreshToken).toBe('string');
      expect(response.body.accessToken.split('.')).toHaveLength(3); // JWT format
      expect(response.body.refreshToken.split('.')).toHaveLength(3);

      // 이후 테스트에서 사용할 토큰 보존
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });
  });

  // ─────────────────────────────────────────────
  // SC-019: GET /auth/me → 200 {id, email, createdAt}
  // ─────────────────────────────────────────────
  describe('SC-019: GET /auth/me → 200 {id, email, createdAt}', () => {
    it('when_valid_access_then_me_200_profile', async () => {
      /**
       * SC-019 (FR-012 관련):
       * 유효한 Access Token으로 GET /auth/me 시
       * HTTP 200과 사용자 id, email, createdAt 반환.
       */
      expect(accessToken).toBeDefined();

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', registeredUserId);
      expect(response.body).toHaveProperty('email', TEST_USER.email);
      expect(response.body).toHaveProperty('createdAt');
      // createdAt은 ISO 날짜 문자열
      expect(new Date(response.body.createdAt).getTime()).not.toBeNaN();
    });
  });

  // ─────────────────────────────────────────────
  // SC-015: POST /auth/refresh → 200 {accessToken}
  // ─────────────────────────────────────────────
  describe('SC-015: 토큰 갱신 → 200 {accessToken}', () => {
    it('when_valid_refresh_then_200_new_access', async () => {
      /**
       * SC-015 (FR-010 관련):
       * 유효한 Refresh Token으로 POST /auth/refresh 시
       * HTTP 200과 새 accessToken 반환.
       */
      expect(refreshToken).toBeDefined();

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body.accessToken.split('.')).toHaveLength(3);

      // 새 access token 업데이트 (이후 테스트에서 사용)
      accessToken = response.body.accessToken;
    });
  });

  // ─────────────────────────────────────────────
  // SC-018: logout 후 동일 refresh → 401
  // ─────────────────────────────────────────────
  describe('SC-018: logout 후 refresh → 401', () => {
    it('when_logout_then_refresh_returns_401', async () => {
      /**
       * SC-018 (FR-011 관련):
       * POST /auth/logout 호출 후 동일 Refresh Token으로
       * POST /auth/refresh 시 HTTP 401.
       * (refreshToken이 revoked=true 로 무효화됨)
       */
      expect(refreshToken).toBeDefined();

      // 로그아웃
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken })
        .expect((res) => {
          expect([200, 204]).toContain(res.status);
        });

      // 동일 refresh token 으로 갱신 시도 → 401
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────
  // SC-027: POST /auth/login P95 ≤ 500ms (연속 50회)
  // ─────────────────────────────────────────────
  describe('SC-027: POST /auth/login P95 ≤ 500ms (NFR-002)', () => {
    it(
      'when_50_login_requests_then_p95_under_500ms',
      async () => {
        /**
         * SC-027 (NFR-002 관련):
         * 로컬/dev 환경에서 POST /auth/login 연속 50회 요청의 P95 ≤ 500ms.
         * bcrypt.compare(cost 10~12) 포함한 응답시간.
         *
         * 주의: bcrypt cost가 높으면 단건 응답시간이 길어진다. cost 10 기준 약 100~200ms.
         */
        const REQUESTS = 50;
        const P95_THRESHOLD_MS = 500;
        const responseTimes: number[] = [];

        for (let i = 0; i < REQUESTS; i++) {
          const start = Date.now();
          await request(app.getHttpServer())
            .post('/auth/login')
            .send(TEST_USER)
            .expect(200);
          responseTimes.push(Date.now() - start);
        }

        expect(responseTimes).toHaveLength(REQUESTS);
        const p95 = calculateP95(responseTimes);
        expect(p95).toBeLessThanOrEqual(P95_THRESHOLD_MS);
      },
      120_000, // timeout: 120초 (bcrypt 포함 50회 요청)
    );
  });
});
