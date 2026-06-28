-- Migration: 20260628111000_init (Down / Rollback)
-- Spec: 001-skeleton-bootstrap
-- Up 마이그레이션의 역순 롤백: FK → 인덱스 → 테이블 → 스키마

-- ============================================================
-- 주의사항
--   - 운영 환경에서는 DBA 검토 후 단계적으로 실행한다.
--   - users 스키마 DROP 시 해당 스키마의 모든 객체가 제거된다.
--   - CASCADE를 사용하지 않아 의존 객체 잔존 시 DROP이 실패하므로
--     반드시 아래 순서대로 실행한다.
--   - Prisma 마이그레이션 이력 테이블(_prisma_migrations)은
--     별도 처리 필요: prisma migrate resolve --rolled-back <migration_name>
-- ============================================================

-- ============================================================
-- 1. FK 제약 조건 제거
-- ============================================================

ALTER TABLE "users"."refresh_tokens"
    DROP CONSTRAINT IF EXISTS "refresh_tokens_userId_fkey";

-- ============================================================
-- 2. 인덱스 제거
-- ============================================================

DROP INDEX IF EXISTS "users"."refresh_tokens_userId_idx";
DROP INDEX IF EXISTS "users"."refresh_tokens_tokenHash_key";
DROP INDEX IF EXISTS "users"."users_email_key";

-- ============================================================
-- 3. 테이블 제거 (FK 의존성 역순: refresh_tokens → users)
-- ============================================================

DROP TABLE IF EXISTS "users"."refresh_tokens";
DROP TABLE IF EXISTS "users"."users";

-- ============================================================
-- 4. 스키마 제거 (Stage 1에서 생성한 8개 모두)
--    CASCADE 미사용: 실수에 의한 비의도적 데이터 삭제 방지.
--    각 스키마에 객체가 남아 있으면 DROP이 실패하므로
--    선행 단계에서 모든 객체를 제거했는지 확인 후 실행.
-- ============================================================

DROP SCHEMA IF EXISTS "files";
DROP SCHEMA IF EXISTS "admin";
DROP SCHEMA IF EXISTS "settlements";
DROP SCHEMA IF EXISTS "payments";
DROP SCHEMA IF EXISTS "orders";
DROP SCHEMA IF EXISTS "commerce";
DROP SCHEMA IF EXISTS "products";
DROP SCHEMA IF EXISTS "users";
