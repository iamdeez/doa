---
작성: Test Agent (EXECUTION)
버전: v1.1
최종 수정: 2026-06-28 12:01
상태: 확정
---

# 테스트 실행 결과

## 목차

- [실행 요약](#실행-요약)
- [실패 목록](#실패-목록)
- [SC 미커버 항목](#sc-미커버-항목)
- [plan.md 매핑표 검증](#planmd-매핑표-검증)
- [설계 문서 정합성](#설계-문서-정합성)
- [회귀 탐지](#회귀-탐지)
- [테스트 수정 이력 (B 오류 정정)](#테스트-수정-이력-b-오류-정정)

---

## 실행 요약

### 최종 결과 (재검증 완료)

| 항목 | 1차 (BLOCKED) | 2차 재검증 (COMPLETE) |
|---|---|---|
| 전체 테스트 수 | 32 | 32 |
| 통과 | 30 | **32** |
| 실패 | 2 | **0** |
| 스킵 | 0 | 0 |

### 실행 환경

- Backend 경로: `apps/backend/`
- unit 실행: `pnpm test` (`jest`, rootDir=`src/`)
- e2e 실행: `pnpm test:e2e` (`jest --config ./test/jest-e2e.json`)
- PostgreSQL: Docker Compose localhost:5432 (DB=doa_next)
- `.env`: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET 설정 완료
- `prisma migrate deploy`: 적용 완료 (8 스키마 + users 2테이블)

### 테스트 스위트별 결과 (재검증)

| 스위트 | 테스트 수 | 통과 | 실패 | 비고 |
|---|---|---|---|---|
| src/modules/auth/auth.service.spec.ts | 8 | 8 | 0 | SC-010/013/014/016/017 |
| src/shared/auth/jwt-auth.guard.spec.ts | 4 | 4 | 0 | SC-020/021 ([B] 정정 후 PASS) |
| test/static/structure.spec.ts | 4 | 4 | 0 | SC-001/003/004/005 |
| test/static/ci-workflow.spec.ts | 5 | 5 | 0 | SC-022/023/024/025/026 |
| test/health.e2e-spec.ts | 3 | 3 | 0 | SC-002/007/008 |
| test/auth.e2e-spec.ts | 8 | **8** | **0** | SC-018 PASS, SC-027 PASS |

---

## 실패 목록

### 재검증 결과: 실패 0건

1차 BLOCKED 결함 2건 모두 Development Agent 수정으로 해소:

| SC-ID | 1차 실패 원인 | Development Agent 수정 | 재검증 결과 |
|---|---|---|---|
| SC-018 | logout에 `@UseGuards(JwtAuthGuard)` 오적용 → 401 | `@UseGuards(JwtAuthGuard)` 제거 | **PASS** (204 반환 확인) |
| SC-027 | `BCRYPT_SALT_ROUNDS=12`, P95=859ms > 500ms | `BCRYPT_SALT_ROUNDS=10` 변경 | **PASS** (P95≈139ms, login 응답 95~158ms) |

---

## SC 미커버 항목

현재 spec의 모든 27 SC에 대해 테스트가 존재하며 전원 PASS. 미커버 SC 없음.

---

## plan.md 매핑표 검증

**SC 매핑 테이블**:

| SC-ID | 관련 테스트 | 통과 여부 | 미커버 근본원인 |
|---|---|---|---|
| SC-001 | structure.spec.ts::when_monorepo_structure_exists | PASS | - |
| SC-002 | health.e2e-spec.ts::when_app_boots_then_no_error_and_pino_stdout | PASS | - |
| SC-003 | structure.spec.ts (nest skeleton) | PASS | - |
| SC-004 | structure.spec.ts (prisma schema) | PASS | - |
| SC-005 | structure.spec.ts (domain modules) | PASS | - |
| SC-006 | auth.e2e-spec.ts::when_migrate_dev_then_8_schemas_2_tables | PASS | - |
| SC-007 | health.e2e-spec.ts::when_get_health_then_200_status_ok | PASS | - |
| SC-008 | health.e2e-spec.ts (P95 ≤200ms) | PASS | - |
| SC-009 | auth.e2e-spec.ts::when_valid_register_then_201_id_email | PASS | - |
| SC-010 | auth.service.spec.ts (중복 이메일 → 409) | PASS | - |
| SC-011 | auth.e2e-spec.ts::when_register_then_db_password_is_hashed | PASS | - |
| SC-012 | auth.e2e-spec.ts::when_valid_login_then_200_access_refresh | PASS | - |
| SC-013 | auth.service.spec.ts (잘못된 이메일 → 401) | PASS | - |
| SC-014 | auth.service.spec.ts (잘못된 비밀번호 → 401) | PASS | - |
| SC-015 | auth.e2e-spec.ts::when_valid_refresh_then_200_new_access | PASS | - |
| SC-016 | auth.service.spec.ts (만료·무효 refresh → 401) | PASS | - |
| SC-017 | auth.service.spec.ts (revoked refresh → 401) | PASS | - |
| SC-018 | auth.e2e-spec.ts::when_logout_then_refresh_returns_401 | **PASS** | - |
| SC-019 | auth.e2e-spec.ts::when_valid_access_then_me_200_profile | PASS | - |
| SC-020 | jwt-auth.guard.spec.ts::when_no_token_then_me_401 | PASS | - |
| SC-021 | jwt-auth.guard.spec.ts::when_expired_access_then_guard_401 | PASS | - |
| SC-022 | ci-workflow.spec.ts (docker build 단계 존재) | PASS | - |
| SC-023 | ci-workflow.spec.ts (lint→typecheck needs chain) | PASS | - |
| SC-024 | ci-workflow.spec.ts (typecheck→test needs chain) | PASS | - |
| SC-025 | ci-workflow.spec.ts (test→docker-build needs chain) | PASS | - |
| SC-026 | ci-workflow.spec.ts (전 단계 needs chain 완결) | PASS | - |
| SC-027 | auth.e2e-spec.ts::when_50_login_requests_then_p95_under_500ms | **PASS** | - |

---

## 설계 문서 정합성

### 불일치 해소 확인

| 항목 | 1차 불일치 내용 | 수정 결과 | 판정 |
|---|---|---|---|
| POST /auth/logout 인증 | `@UseGuards(JwtAuthGuard)` 오적용 | 제거 완료. plan.md "불필요(refreshToken 제출)" 준수 | **일치** |
| bcrypt cost | `BCRYPT_SALT_ROUNDS=12`, P95 위반 | `=10` 변경. login P95≈139ms (< 500ms) | **일치** |

### 일치 항목 (주요 검증)

- Refresh Token: SHA-256 해시 저장, 원문 미저장 (ADR-003) ✓
- JWT 네임스페이스 키: `'jwt.accessSecret'` / `'jwt.refreshSecret'` (jwtConfig registerAs) ✓
- Health endpoint: `{status: "ok"}` 단순 응답 (ADR-006) ✓
- Prisma multiSchema 8개 스키마 마이그레이션 ✓
- GitHub Actions needs chain (ADR-008) ✓
- 17개 도메인 골격 4계층 구조 ✓

---

## 회귀 탐지

본 spec은 신규 프로젝트(DOA Market v1.0.0 최초 구현)이므로 이전 spec 대비 회귀 탐지 대상 없음.

---

## 테스트 수정 이력 (B 오류 정정)

EXECUTION 5b 단계에서 발견된 [B] 테스트 오류 2건을 정정 후 재실행:

### B-1: jwt-auth.guard.spec.ts ConfigService mock 키 오류

- **파일**: `src/shared/auth/jwt-auth.guard.spec.ts`
- **원인**: ConfigService mock이 `'JWT_ACCESS_SECRET'` 키로 secret을 반환했으나, `JwtStrategy` 생성자는 `jwtConfig` 네임스페이스 키 `'jwt.accessSecret'` 로 조회
- **수정**: mock의 `if (key === 'JWT_ACCESS_SECRET')` → `if (key === 'jwt.accessSecret')`
- **결과**: 4개 테스트 FAIL → PASS

### B-2: jest-e2e.json NODE_ENV 환경 설정 누락

- **파일**: `test/jest-e2e.json`, `test/setup-env.js` (신규)
- **원인**: `.env`의 `NODE_ENV=development` + Jest 실행 시 pino-pretty transport 시도 → `pino-pretty` 미설치로 모듈 초기화 실패
- **수정**: `setupFiles: ["<rootDir>/setup-env.js"]` 추가 + `setup-env.js`에서 `process.env.NODE_ENV = 'production'`으로 e2e 테스트 환경 설정
- **결과**: health.e2e-spec.ts, auth.e2e-spec.ts 정상 실행

### 후속 권고

`pino-pretty`를 `devDependencies`에 추가(`pnpm add -D pino-pretty`)하면 로컬 개발 환경에서 pretty 로그를 사용할 수 있음. 현재 e2e 테스트는 `NODE_ENV=production`(JSON 로그)으로 우회 중.
