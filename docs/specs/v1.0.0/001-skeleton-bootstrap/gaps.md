---
작성: Design Agent (최초 생성)
버전: v1.3
최종 수정: 2026-06-28 16:40
상태: 운영중
---

# Gaps: 001-skeleton-bootstrap

> 본 파일은 3단계 Design Agent 가 최초 생성한다. 이후 모든 Agent 가 누적 기록한다.
> 형식: pipeline-conventions.md §6. 미해결 GAP 누적 5건 초과 시 main session 경고.

## 목차

- [GAP 목록](#gap-목록)
- [요약](#요약)

---

## GAP 목록

### GAP-001 — Prisma multiSchema 빈 스키마 CREATE SCHEMA 미생성 가능성

- **유형**: 기술-동작-불확실
- **출처**: Design Agent
- **컨텍스트**: T-A2/T-A4 (Prisma 마이그레이션), FR-004/FR-006/SC-006
- **내용**: Prisma migrate 의 SQL diff 는 모델이 `@@schema` 로 매핑된 스키마만 `CREATE SCHEMA IF NOT EXISTS` 를 생성한다. `schemas` 배열에 선언만 되고 모델이 없는 빈 7개 스키마(products·commerce·orders·payments·settlements·admin·files)가 PostgreSQL 에 자동 생성되지 않으면 SC-006("8개 스키마가 생성") 위배 가능.
- **영향**: SC-006 통합 검증 실패 위험.
- **처리**: **RESOLVED by Design Agent** — research.md "Prisma multiSchema 동작 검증" 절에 안전망 설계, tasks.md **T-A4** 로 분해(`prisma migrate dev --create-only` → migration.sql 의 8개 `CREATE SCHEMA IF NOT EXISTS` 검증·수동 보강, 멱등). spec 범위 내 해결이므로 상위 단계 복귀 불요. 5b/통합 검증(SC-006)에서 실측 확인. SC-006 PASS 확인됨.

### GAP-002 — logout 엔드포인트에 JwtAuthGuard 오적용

- **유형**: 구현 오류 [A]
- **출처**: Test Agent (EXECUTION 5b)
- **컨텍스트**: SC-018, FR-011
- **내용**: `auth.controller.ts` 의 `@Post('logout')` 에 `@UseGuards(JwtAuthGuard)` 가 적용되어 있으나, plan.md §인터페이스 계약 표(라인 237)는 "POST /auth/logout | 불필요(refreshToken 제출)" 로 인증을 요구하지 않음. 결과적으로 Authorization 헤더 없이 refreshToken 본문만 제출하는 SC-018 테스트가 401로 실패.
- **영향**: SC-018 통합 테스트 FAIL. logout 기능 자체도 접근 토큰 없이 사용 불가(access token 만료 후 logout 불가 등 UX 결함).
- **처리**: **RESOLVED by Development Agent** — `auth.controller.ts` 의 logout 핸들러에서 `@UseGuards(JwtAuthGuard)` 제거. SC-018 재검증 PASS (204 반환 확인).

### GAP-003 — bcrypt cost 12로 인한 P95 성능 미달

- **유형**: 구현 오류 [A]
- **출처**: Test Agent (EXECUTION 5b)
- **컨텍스트**: SC-027, NFR-002
- **내용**: `auth.service.ts` 의 `BCRYPT_SALT_ROUNDS = 12` 로 설정되어 있어 POST /auth/login 연속 50회 P95 = 859ms > 500ms (NFR-002). plan.md ADR-001은 cost 10~12 범위를 허용하나 cost 12 는 본 개발 환경(MacBook Air M-chip)에서 500ms를 넘어섬.
- **영향**: SC-027 통합 테스트 FAIL.
- **처리**: **RESOLVED by Development Agent** — `BCRYPT_SALT_ROUNDS = 10` 으로 변경. SC-027 재검증 PASS (P95≈139ms, 95~158ms 분포).

### GAP-004 — context.md 갱신 필요 (001-skeleton-bootstrap 구현 완료)

- **유형**: 문서-갱신-필요
- **출처**: Docs Agent
- **컨텍스트**: `.claude/docs/context.md` — §1·§2·§4·§6
- **상태**: OPEN (Retrospective Agent 처리 위임)

**갱신 대상 및 내용**:

1. **§1 현재 버전** (L17): `v0.0.0 (골격 구축 전)` → `v1.0.0`
   - 코드 검증: apps/backend/package.json `"version": "1.0.0"` 확인

2. **§2 디렉토리 레이아웃 표제** (L27): `(기획 기준 — 코드 미존재)` 제거 → 실제 구현 반영 표제로 변경
   - 코드 검증: 실제 파일 트리 존재 확인 완료. `mobile/customer-app/` 디렉토리는 현재 미존재이므로 레이아웃에서 제거 또는 "(미구현)" 표기 필요.

3. **§2 핵심 도메인 모듈 목록**: health 모듈·shared/auth·shared/config·shared/prisma 추가. 기존 18개 도메인 모듈 표에 "auth: 실구현 / 나머지 17개: 빈 스텁" 상태 주기 추가.
   - 코드 검증: `apps/backend/src/health/`, `apps/backend/src/shared/` 디렉토리 존재 확인.

4. **§4 데이터 모델 — users 스키마 목록** (L158): `auth_tokens` 항목 제거
   - 기존 표기: `schema: users (users, sellers, addresses, wishlists, product_views, auth_tokens, refresh_tokens)`
   - 실제 구현: `schema.prisma`에 `User`·`RefreshToken` 2개 모델만 존재. `auth_tokens` 미존재.
   - 코드 검증: `apps/backend/prisma/schema.prisma` L19-42 — User + RefreshToken 만 정의됨. `auth_tokens` 없음.

5. **§6 알려진 제약 — "코드베이스 미존재"** (L196): 해당 항목 제거. 대신 다음 신규 제약 추가:
   - `pino-pretty devDep 미설치`: 로컬 `NODE_ENV=development` 환경에서 pino-pretty transport 시도 시 모듈 오류. `pnpm add -D pino-pretty --filter backend` 필요. (test-report.md B-2 참조)
   - `17개 도메인 모듈 빈 스텁`: auth 외 17개 모듈 실구현 없음. Stage 2~3 대상.

### GAP-005 — infra.md 갱신 필요 (001-skeleton-bootstrap 구현 완료)

- **유형**: 문서-갱신-필요
- **출처**: Docs Agent
- **컨텍스트**: `.claude/docs/infra.md` — §3·§6
- **상태**: OPEN (Retrospective Agent 처리 위임)

**갱신 대상 및 내용**:

1. **§3 CI/CD 파이프라인** (L64): `→ '.github/workflows/' 파일 참조 (로드맵 1단계 완료 후 생성).` 플레이스홀더 제거. 실제 구현 반영:
   - CI 파일 위치: `.github/workflows/ci.yml`
   - 4단계 파이프라인: lint → typecheck → test → docker-build (needs chain)
   - 트리거: `push/pull_request` to `main`
   - Node.js 20, pnpm 9

2. **§6 로컬 개발 환경 — 의존성 설치** (L125-131): `로드맵 1단계 완료 후 구체화` 플레이스홀더 제거. 실제 구현 반영:
   - `pnpm install` (루트)
   - `docker compose up -d postgres`
   - `pnpm --filter backend exec prisma migrate deploy`

3. **§6 로컬 개발 환경 — 테스트** 항목: e2e 테스트 실행 명령 추가
   - unit: `pnpm --filter backend test`
   - e2e: `pnpm --filter backend test:e2e` (PostgreSQL + .env 필요, `NODE_ENV=production` 강제)

4. **§6 의존성 구조 표**: `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`, `class-validator`, `class-transformer` 신규 패키지 추가

### GAP-006 — .env.example에 미사용 변수 2개 존재

- **유형**: 문서-갱신-필요
- **출처**: Deploy Agent
- **컨텍스트**: `.env.example`, `apps/backend/src/shared/config/jwt.config.ts`
- **상태**: OPEN

**내용**: `.env.example`에 `JWT_ACCESS_TTL=900`과 `JWT_REFRESH_TTL=30d`가 선언되어 있으나, 실제 애플리케이션(`jwt.config.ts`)은 이 값들을 환경변수로 읽지 않는다. 해당 값들은 코드 내 하드코딩 상수(`JWT_ACCESS_TTL_SECONDS=900`, `JWT_REFRESH_TTL_DAYS=30`)로 관리된다.

**영향**: 개발자가 환경변수로 TTL을 변경 가능하다고 오해할 수 있음. 실제로는 코드 변경이 필요.

**처리 방향**: `.env.example`에서 두 변수를 제거하거나, 주석으로 "코드 상수로 고정됨, 변경 시 jwt.config.ts 수정 필요" 표기.

---

### GAP-007 — Dockerfile HEALTHCHECK 지시어 미설정

- **유형**: 문서-갱신-필요
- **출처**: Deploy Agent
- **컨텍스트**: `apps/backend/Dockerfile`
- **상태**: OPEN

**내용**: `apps/backend/Dockerfile`에 Docker `HEALTHCHECK` 지시어가 없다. 헬스체크는 현재 Fly.io `fly.toml`의 `[[services.http_checks]]`에서 `GET /health`를 사용하도록 설계되어 있으나 (fly.toml은 ASM-001 범위 외), Docker 이미지 자체에 HEALTHCHECK를 추가하면 `docker run` 또는 `docker-compose`에서 backend 서비스를 컨테이너로 기동할 때도 헬스체크가 동작한다.

**영향**: docker-compose에서 backend 컨테이너를 서비스로 추가할 경우 헬스체크 없이 배포됨.

**처리 방향**: 다음 Dockerfile 수정 시 runtime 스테이지 말미에 추가:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
```

### GAP-008 — Rate Limiting 미적용 (auth 엔드포인트)

- **유형**: 보안-설계-누락
- **출처**: Security Agent
- **컨텍스트**: [SEC-002: Rate Limiting 미적용] — `POST /auth/login`, `/auth/register`, `/auth/refresh`
- **상태**: OPEN

**내용**: 인증 엔드포인트에 rate limiting이 없어 브루트포스·계정 열거·DoS 공격에 노출된다. plan.md에서 "타이밍 공격 완화는 Stage 2+ 검토"로 명시되어 있으나 rate limiting은 별도 항목으로 처리 필요.

**처리 방향**: `@nestjs/throttler` 전역 또는 auth 모듈 적용. 다음 spec 또는 Stage 2 초기에 처리.

---

### GAP-009 — HTTP 보안 헤더 (helmet) 미적용

- **유형**: 보안-설정-누락
- **출처**: Security Agent
- **컨텍스트**: [SEC-003: helmet 미적용] — `apps/backend/src/main.ts`
- **상태**: OPEN

**내용**: `main.ts`에 `helmet()` 미적용. `X-Powered-By` 헤더로 Express 기술 스택 노출, Clickjacking·MIME sniffing 방어 헤더 부재.

**처리 방향**: `app.use(require('helmet')())` 또는 `@nestjs/helmet` 추가. 다음 spec 또는 Stage 2 초기에 처리.

---

## 요약

| 상태 | 건수 |
|---|---|
| 미해결(OPEN) | **6** (GAP-004, GAP-005, GAP-006, GAP-007, GAP-008, GAP-009) |
| 해결(RESOLVED) | 3 (GAP-001, GAP-002, GAP-003) |

- GAP-001: Design 단계 내 해결(설계 안전망). SC-006 PASS.
- GAP-002: Development Agent 수정 완료. logout JwtAuthGuard 제거. SC-018 PASS.
- GAP-003: Development Agent 수정 완료. bcrypt cost 10. SC-027 PASS.
- GAP-004: context.md 갱신 필요. Retrospective Agent 처리 위임.
- GAP-005: infra.md 갱신 필요. Retrospective Agent 처리 위임.
- GAP-006: .env.example 미사용 변수 2개. Deploy Agent 기록. 선택 개선.
- GAP-007: Dockerfile HEALTHCHECK 지시어 미설정. Deploy Agent 기록. 선택 개선.
- GAP-008: Rate Limiting 미적용. Security Agent 기록. 다음 spec 처리 권장.
- GAP-009: helmet 미적용. Security Agent 기록. 다음 spec 처리 권장.
