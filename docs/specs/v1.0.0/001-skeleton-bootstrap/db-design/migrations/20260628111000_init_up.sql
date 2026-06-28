-- Migration: 20260628111000_init (Up)
-- Spec: 001-skeleton-bootstrap | FR-004, FR-005, FR-006
-- Stage 1 초기 마이그레이션: 8개 스키마 생성 + users 스키마 2개 테이블

-- ============================================================
-- 1. 8개 스키마 생성 (GAP-001 안전망)
--
-- Prisma ^6.19.0 multiSchema에서 @@schema 모델이 없는 빈 스키마
-- (products·commerce·orders·payments·settlements·admin·files 7개)의
-- CREATE SCHEMA가 자동 생성되지 않을 수 있다.
-- 전체 8개를 IF NOT EXISTS(멱등)로 명시하여 SC-006 결정적 충족.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "users";
CREATE SCHEMA IF NOT EXISTS "products";
CREATE SCHEMA IF NOT EXISTS "commerce";
CREATE SCHEMA IF NOT EXISTS "orders";
CREATE SCHEMA IF NOT EXISTS "payments";
CREATE SCHEMA IF NOT EXISTS "settlements";
CREATE SCHEMA IF NOT EXISTS "admin";
CREATE SCHEMA IF NOT EXISTS "files";

-- ============================================================
-- 2. users.users 테이블 생성
--    Prisma 모델: User | @@map("users") | @@schema("users")
--    FR-005: 이메일·해싱된 비밀번호·가입일시 포함
--    NFR-005: password 컬럼은 bcrypt 해시값만 저장 (원문 미저장)
-- ============================================================

CREATE TABLE "users"."users" (
    "id"        TEXT            NOT NULL,
    "email"     TEXT            NOT NULL,
    "password"  TEXT            NOT NULL,
    "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 3. users.refresh_tokens 테이블 생성
--    Prisma 모델: RefreshToken | @@map("refresh_tokens") | @@schema("users")
--    FR-005: 토큰값·만료일시·무효화 여부 포함
--    ADR-003: tokenHash = sha256(원문 JWT). 원문 token 컬럼 없음.
--             SHA-256 채택 근거: refresh 검증은 원문으로 DB row를 lookup해야 하므로
--             salt가 매번 달라지는 bcrypt는 동등 비교 조회 불가.
--             고엔트로피 JWT(jti uuid 포함)라 무염 SHA-256의 위험이 낮다.
--    NFR-004: expiresAt = 발급 시점 + 30일
-- ============================================================

CREATE TABLE "users"."refresh_tokens" (
    "id"        TEXT            NOT NULL,
    "userId"    TEXT            NOT NULL,
    "tokenHash" TEXT            NOT NULL,
    "expiresAt" TIMESTAMP(3)    NOT NULL,
    "revoked"   BOOLEAN         NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 4. 인덱스 생성
-- ============================================================

-- users.email UNIQUE: 로그인 lookup + 중복 가입 차단 (SC-010 409)
CREATE UNIQUE INDEX "users_email_key"
    ON "users"."users" ("email");

-- refresh_tokens.tokenHash UNIQUE: refresh/logout 해시 lookup O(1).
-- jti(uuid)로 토큰이 유일하므로 해시 충돌 없이 UNIQUE 적용 가능.
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key"
    ON "users"."refresh_tokens" ("tokenHash");

-- refresh_tokens.userId: FK 인덱스(ON DELETE CASCADE 성능) + 사용자별 토큰 조회
CREATE INDEX "refresh_tokens_userId_idx"
    ON "users"."refresh_tokens" ("userId");

-- ============================================================
-- 5. FK 제약 조건
--    ON DELETE CASCADE: 사용자 삭제 시 refresh_tokens 자동 제거(고아 레코드 방지)
--    ON UPDATE CASCADE: users.id 변경 시 참조 정합성 유지
-- ============================================================

ALTER TABLE "users"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "users"."users" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
