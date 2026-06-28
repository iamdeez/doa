---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-28 11:12
상태: 확정
---

# Test Cases: 001-skeleton-bootstrap

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류 — 4-카테고리)](#미커버-항목-사전-분류--4-카테고리)

---

## SC × 시나리오 매트릭스

> **환경 태그 규약**:
> - `[env:static]`: 코드·설정 파일 존재·구조 검증 (fs.existsSync + 텍스트 파싱)
> - `[env:unit]`: 단위 테스트 (Mock 사용, 앱 기동 불필요)
> - `[env:integration]`: 앱 기동 + PostgreSQL 연결 필요 (supertest + Docker Compose)
>
> **[env:integration] 검증 방식**: 옵션 A 확정 (plan.md §테스트 전략). main 세션이 환경 준비 절차 제시 → 사용자 실행 → 결과 전달 → Test Agent(EXECUTION) 검증.

| SC-ID | 수용 기준(요약) | Happy | Edge | Error | 테스트 파일·함수 | env |
|---|---|---|---|---|---|---|
| SC-001 | 모노레포 구조·6 워크스페이스 존재 | `when_repo_root_then_workspaces_and_turbo_exist` | — | — | test/static/structure.spec.ts | [env:static] |
| SC-002 | NestJS 기동 + pino 로그 | `when_app_boots_then_no_error_and_pino_stdout` | — | — | test/health.e2e-spec.ts | [env:integration] |
| SC-003 | 18 모듈 4계층 골격 | `when_modules_dir_then_18_dirs_with_4_layers` | — | — | test/static/structure.spec.ts | [env:static] |
| SC-004 | schema.prisma 8 스키마 선언 | `when_schema_prisma_then_8_schemas_declared` | — | — | test/static/structure.spec.ts | [env:static] |
| SC-005 | users 2 테이블 정의 | `when_schema_prisma_then_user_and_refreshtoken_models` | — | — | test/static/structure.spec.ts | [env:static] |
| SC-006 | 마이그레이션 8 스키마 + 2 테이블 | `when_migrate_dev_then_8_schemas_2_tables` (beforeAll) | — | — | test/auth.e2e-spec.ts | [env:integration] |
| SC-007 | GET /health → 200 {status:ok} | `when_get_health_then_200_status_ok` | — | — | test/health.e2e-spec.ts | [env:integration] |
| SC-008 | health P95 ≤ 200ms (50회) | — | `when_50_health_requests_then_p95_under_200ms` | — | test/health.e2e-spec.ts | [env:integration] |
| SC-009 | register 성공 201 {id,email} | `when_valid_register_then_201_id_email` | — | — | test/auth.e2e-spec.ts | [env:integration] |
| SC-010 | 중복 이메일 → 409 | — | — | `when_duplicate_email_then_conflict_409` | src/modules/auth/auth.service.spec.ts | [env:unit] |
| SC-011 | DB password 해시 저장 | `when_register_then_db_password_is_hashed` | — | — | test/auth.e2e-spec.ts | [env:integration] |
| SC-012 | login 성공 200 {accessToken,refreshToken} | `when_valid_login_then_200_access_refresh` | — | — | test/auth.e2e-spec.ts | [env:integration] |
| SC-013 | 잘못된 비밀번호 → 401 | — | — | `when_wrong_password_then_unauthorized_401` | src/modules/auth/auth.service.spec.ts | [env:unit] |
| SC-014 | access exp = iat + 900s | — | `when_login_then_access_exp_iat_plus_900` | — | src/modules/auth/auth.service.spec.ts | [env:unit] |
| SC-015 | refresh 갱신 200 새 access | `when_valid_refresh_then_200_new_access` | — | — | test/auth.e2e-spec.ts | [env:integration] |
| SC-016 | 만료·무효 refresh → 401 | — | — | `when_expired_or_revoked_refresh_then_401` | src/modules/auth/auth.service.spec.ts | [env:unit] |
| SC-017 | refresh 만료 = +30d | — | `when_login_then_refresh_expiry_plus_30d` | — | src/modules/auth/auth.service.spec.ts | [env:unit] |
| SC-018 | logout 후 refresh → 401 | — | — | `when_logout_then_refresh_returns_401` | test/auth.e2e-spec.ts | [env:integration] |
| SC-019 | GET /auth/me → 200 {id,email,createdAt} | `when_valid_access_then_me_200_profile` | — | — | test/auth.e2e-spec.ts | [env:integration] |
| SC-020 | 토큰 부재 → 401 | — | — | `when_no_token_then_me_401` | src/shared/auth/jwt-auth.guard.spec.ts | [env:unit] |
| SC-021 | 만료 access 보호라우트 → 401 | — | — | `when_expired_access_then_guard_401` | src/shared/auth/jwt-auth.guard.spec.ts | [env:unit] |
| SC-022 | docker build 에러 0 | `when_dockerfile_then_multistage_buildable` | — | — | test/static/ci-workflow.spec.ts | [env:static] |
| SC-023 | lint 실패 → 후속 미실행 | — | — | `when_lint_fails_then_typecheck_test_build_skipped` | test/static/ci-workflow.spec.ts | [env:static] |
| SC-024 | typecheck 실패 → 후속 미실행 | — | — | `when_typecheck_fails_then_test_build_skipped` | test/static/ci-workflow.spec.ts | [env:static] |
| SC-025 | test 실패 → docker-build 미실행 | — | — | `when_test_fails_then_docker_build_skipped` | test/static/ci-workflow.spec.ts | [env:unit] |
| SC-026 | 전단계 통과 → docker-build 실행 | `when_all_pass_then_docker_build_runs` | — | — | test/static/ci-workflow.spec.ts | [env:static] |
| SC-027 | login P95 ≤ 500ms (50회) | — | `when_50_login_requests_then_p95_under_500ms` | — | test/auth.e2e-spec.ts | [env:integration] |

### SC 역방향 검증 (FR-XXX → SC-XXX)

| FR-ID | 연결 SC-ID | 매핑 여부 |
|---|---|---|
| FR-001 | SC-001 | ✓ |
| FR-002 | SC-002 | ✓ |
| FR-003 | SC-003 | ✓ |
| FR-004 | SC-004 | ✓ |
| FR-005 | SC-005 | ✓ |
| FR-006 | SC-006 | ✓ |
| FR-007 | SC-007, SC-008 | ✓ |
| FR-008 | SC-009, SC-010, SC-011 | ✓ |
| FR-009 | SC-012, SC-013, SC-014 | ✓ |
| FR-010 | SC-015, SC-016, SC-017 | ✓ |
| FR-011 | SC-018 | ✓ |
| FR-012 | SC-019, SC-020 | ✓ |
| FR-013 | SC-021 | ✓ |
| FR-014 | SC-022 | ✓ |
| FR-015 | SC-023, SC-024, SC-025, SC-026, SC-027 | ✓ |

**SC 없는 FR-XXX: 0건** — 전수 매핑 확인.

---

## 외부 의존성 명시

### [env:static] 테스트

- **의존**: Node.js `fs`, `path` 내장 모듈만 사용 (별도 설치 불필요)
- **경로 기준**: `__dirname` 기반 상대경로로 PROJECT_ROOT 계산

### [env:unit] 테스트

- **Jest mock**: `@nestjs/testing` (Test.createTestingModule)
- **의존**: `@nestjs/common`, `@nestjs/jwt`, `@nestjs/passport`, `bcrypt`
- **mock 대상**: AuthRepository, JwtService, ConfigService, bcrypt

### [env:integration] 테스트

- **실행 전제**: PostgreSQL 16 Docker Compose 기동 + `prisma migrate dev` 적용 + `pnpm --filter backend dev` 기동
- **테스트 프레임워크**: Jest + `supertest`
- **환경 변수**: `.env` 파일 (DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET)
- **옵션 A 절차** (plan.md 확정): main 세션이 환경 준비 절차 제시 → 사용자가 직접 실행 → 결과 전달 → Test Agent(EXECUTION) 검증

---

## 미커버 항목 (사전 분류 — 4-카테고리)

단위테스트로 직접 검증하기 어려운 SC를 4-카테고리로 분류한다. Test Agent(EXECUTION) 의 coverage-gap.md 작성 참조용.

| SC-ID | 수용 기준 요약 | 카테고리 | 미커버 사유 | 권장 검증 방법 |
|---|---|---|---|---|
| SC-002 | NestJS 기동 + pino stdout | (3) 운영 환경 권장 | 실제 앱 기동 + stdout 출력 확인 필요 (Docker Compose) | 옵션 A: 사용자가 `pnpm --filter backend dev` 실행 후 로그 캡처 |
| SC-006 | migrate 8스키마 + 2테이블 | (3) 운영 환경 권장 | 실제 PostgreSQL + prisma migrate dev 실행 필요 | 옵션 A: 사용자가 마이그레이션 실행 후 psql `\dn` / `\dt` 결과 전달 |
| SC-007 | GET /health 200 ok | (3) 운영 환경 권장 | 실제 앱 기동 후 HTTP 응답 확인 | 옵션 A: curl/supertest |
| SC-008 | health P95 ≤ 200ms | (3) 운영 환경 권장 | 50회 연속 요청 + 성능 측정 필요 | 옵션 A: 로컬 환경 측정 |
| SC-009 | register 201 {id,email} | (3) 운영 환경 권장 | 실 DB INSERT 필요 | 옵션 A: supertest |
| SC-011 | DB password 해시 저장 | (3) 운영 환경 권장 | 실 DB 조회 후 password 필드값 확인 | 옵션 A: Prisma client 직접 쿼리 |
| SC-012 | login 200 {accessToken,refreshToken} | (3) 운영 환경 권장 | 실 DB 사용자·토큰 저장 필요 | 옵션 A: supertest |
| SC-015 | refresh 200 새 accessToken | (3) 운영 환경 권장 | 실 refresh token 발급·검증 필요 | 옵션 A: supertest 전체 흐름 |
| SC-018 | logout 후 refresh 401 | (3) 운영 환경 권장 | logout → refresh 순차 실행, DB revoked 상태 변경 필요 | 옵션 A: supertest |
| SC-019 | GET /auth/me 200 | (3) 운영 환경 권장 | 유효 access token + 사용자 DB 조회 | 옵션 A: supertest |
| SC-027 | login P95 ≤ 500ms | (3) 운영 환경 권장 | 50회 연속 요청 + bcrypt 포함 성능 측정 | 옵션 A: 로컬 환경 측정 |

> **카테고리 설명**:
> - (1) 단위테스트 가능: 해당 없음 (모든 [env:unit] SC 는 테스트 작성됨)
> - (2) 단위테스트 불가: 외부 시스템·환경 의존으로 mock 불가능
> - (3) 운영 환경 권장: (2) 중 로컬/dev 환경에서 사용자 수동 검증 필요
> - (4) 차후 점검: 본 spec 범위 외 — 해당 없음
>
> **옵션 A 확정**: 위 (3) 분류 항목 전부는 plan.md §테스트 전략 "옵션 A 확정" 에 따라 사용자가 환경 준비 후 실행·결과 전달 → Test Agent(EXECUTION) 검증으로 처리한다. (2)(3)만 존재 → Docs Agent 진행 가능.
