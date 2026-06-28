---
작성: Retrospective Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 검토중
---

# Agent Patches: 001-skeleton-bootstrap

> 적용 주체 = main session (사용자 승인 후). 본 Agent 는 제안만 한다.
> 전역 문서 대상 패치는 적합성 2단계 검토(범용성·역할정합) 결과를 각 항목에 명시한다.

## 목차

- [Agent·규칙·스킬 패치](#agent규칙스킬-패치)
- [context.md / infra.md 갱신 패치 (PATCH-CXT)](#contextmd--inframd-갱신-패치-patch-cxt)
- [코드 정정 후보 (참고 — Retrospective 범위 외)](#코드-정정-후보-참고--retrospective-범위-외)

---

## Agent·규칙·스킬 패치

### PATCH-001: docker.md — pnpm workspace + Prisma client 멀티스테이지 경로 패턴

- 대상 파일: `~/.claude/rules/on-demand/docker.md`
- 대상 섹션: "빌드" 또는 신규 "## pnpm 워크스페이스 + Prisma 멀티스테이지 주의" 절
- 현재 내용: Docker 멀티스테이지·`.dockerignore`·CUDA 주의는 있으나, pnpm 모노레포에서 `prisma generate` 산출물(`node_modules/.prisma/client`)을 runtime 스테이지로 COPY 할 때의 경로 정합성 가이드가 없음.
- 변경 내용: 다음 주의를 추가 — `[Docker][pnpm]` pnpm 워크스페이스에서 Prisma client 는 hoist 구조상 `node_modules/.pnpm/@prisma+client*/...` 또는 워크스페이스 로컬 `node_modules/.prisma/client` 에 생성된다. builder 스테이지에서 `prisma generate` 실행 후, runtime 스테이지로 COPY 시 **실제 생성 경로를 빌드 로그로 확인**하고 COPY 대상 경로를 그에 맞춘다. 존재하지 않는 `.prisma` 경로를 COPY 하면 build 실패한다.
- 변경 근거: OBS-5 — Deploy 단계 docker build 실패(`apps/backend/Dockerfile` L53 의 `.prisma` 경로) 를 동적 검증으로 발견·제거 후 빌드 성공. retrospective-report §1b·§6.
- 적합성: 범용 O (pnpm monorepo + Prisma 조합은 OS·언어 도구 차원 공통) / 역할정합 O (Docker 빌드 규칙 문서). 재배치 불요.
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

### PATCH-002: 04-development.md — 구현 완료 전 plan.md 인터페이스 계약 표 대조 자가 점검

- 대상 파일: `~/.claude/agents/04-development.md`
- 대상 섹션: 중간 자가 검증 / 구현 완료 후 상태 점검 절
- 현재 내용: spec FR-XXX·constitution 준수 자가 점검은 있으나, plan.md **인터페이스 계약 표**(라우트별 인증 요구·가드 적용·env 사용)와 구현의 1:1 대조 체크가 명시되지 않음.
- 변경 내용: 구현 완료 전 자가 점검에 추가 — "plan.md 인터페이스 계약 표의 각 행(라우트·인증 요구·가드 적용·소비하는 env 변수)이 구현 코드와 일치하는가? (예: '인증 불필요' 로 명시된 엔드포인트에 가드를 적용하지 않았는가 / `.env.example` 에 선언한 env 를 코드가 실제로 읽는가)"
- 변경 근거: GAP-002(logout 에 JwtAuthGuard 오적용 — plan L237 '불필요' 위반) + GAP-006(`.env.example` 의 JWT_ACCESS_TTL/REFRESH_TTL 을 jwt.config.ts 가 읽지 않음).
- 적합성: 범용 O / 역할정합 O. 재배치 불요.
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

### PATCH-003: 02-planning.md — NFR 성능 직결 파라미터의 ADR 표기 원칙

- 대상 파일: `~/.claude/agents/02-planning.md`
- 대상 섹션: ADR / 핵심 설계 작성 가이드
- 현재 내용: ADR 작성 시 성능 NFR 에 직접 영향하는 파라미터(예: bcrypt cost)를 "허용 범위"(cost 10~12)로 기재하는 것에 대한 제약이 없음.
- 변경 내용: 추가 — "NFR 의 성능 수치(P95 등)에 직접 영향하는 구현 파라미터는 ADR 에서 '허용 범위'만 제시하지 않는다. 범위를 제시할 경우 **해당 NFR 측정 환경 기준의 단일 권장 기본값**을 함께 명시하고, 상한값이 NFR 을 위반하지 않음을 근거로 남긴다." (대안: 범위 대신 단일값 + 변경 시 재측정 조건)
- 변경 근거: GAP-003 — ADR-001 이 cost 10~12 범위 허용 → Development 가 상한 12 선택 → P95 859ms > 500ms(NFR-002) 위반 → cost 10 으로 정정. 범위 상한 선택이 NFR 위반을 유발.
- 적합성: 범용 O / 역할정합 O. 재배치 불요.
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

### PATCH-004: Agent frontmatter `model: fable` 재검토 (사용자 확인 필수)

- 대상 파일: `~/.claude/agents/02-planning.md`, `~/.claude/agents/03-design.md`, `~/.claude/agents/07-retrospective.md` (frontmatter `model:` 필드)
- 현재 내용: 위 3개 Agent 정의 frontmatter 가 `model: fable` 로 고정. 본 차수 fable(Fable 5) unavailable 로 매 단계 opus 4.8 수동 대체.
- 변경 내용 (택1, **사용자 결정 필요**): (A) `model:` 을 현재 가용 모델로 변경, 또는 (B) `model:` 제거(상속 기본 모델 사용), 또는 (C) 유지하되 main session 의 모델 가용성 fallback 운영 절차(PROC-002)로 대응.
- 변경 근거: OBS-1·OBS-2 — fable unavailable 로 02/03/07 단계마다 대체 호출. 특히 OBS-2 의 SendMessage 재개 시 fable 로 되살아나 재차 실패.
- 적합성: 범용 O (글로벌 Agent 정의 — 모든 프로젝트 영향) / 역할정합 O. **단 "fable unavailable" 은 사용자 환경 사실이므로 model 변경 방향은 사용자가 확정해야 한다.** 본 Agent 는 옵션만 제시.
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

---

## context.md / infra.md 갱신 패치 (PATCH-CXT)

> [MUST NOT] 본 Agent 는 context.md / infra.md 를 직접 수정하지 않는다. main session 이 사용자 승인 후 적용.
> 각 패치는 PROC-002(이 프로젝트 글로벌 규칙) 에 따라 코드 검증 결과를 명시한다.

### PATCH-CXT-001: context.md — §1 현재 버전

- 대상 파일: `/Users/krystal/workspace/doa/doa-next/.claude/docs/context.md`
- 대상 섹션: §1 프로젝트 개요 — "현재 버전" (L17) 및 그 아래 안내 블록(L20-21)
- 변경 내용: `현재 버전: v0.0.0 (골격 구축 전)` → `현재 버전: v1.0.0`. L20-21 의 "현재(2026-06-28) 프로젝트는 기획안만 존재하며 코드베이스가 없다 …" 안내 블록 제거(코드 실재).
- 변경 근거: GAP-004 item 1 + 001-skeleton-bootstrap 구현 완료.
- 코드 검증: **GAP-004 의 근거(package.json "version":"1.0.0")는 오류** — 실제 `apps/backend/package.json` L2 는 `"version": "0.0.1"`(scaffold 기본값 미갱신). 따라서 본 패치의 "현재 버전" 갱신 근거는 package.json 이 아니라 **spec 릴리즈 버전(docs/specs/v1.0.0/ 폴더, spec.md L10 `Version: v1.0.0`)** 이다. context.md §1 "현재 버전" 은 릴리즈 버전을 가리키므로 v1.0.0 갱신은 타당. package.json 0.0.1 → 1.0.0 정렬은 별도 코드 정정(아래 "코드 정정 후보").
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

### PATCH-CXT-002: context.md — §2 디렉토리 레이아웃 표제 및 미존재 디렉토리

- 대상 파일: `/Users/krystal/workspace/doa/doa-next/.claude/docs/context.md`
- 대상 섹션: §2 프로젝트 구조 — "디렉토리 레이아웃 (기획 기준 — 코드 미존재)" 표제(L27) 및 트리 내 `mobile/customer-app/`(L44-45)
- 변경 내용: 표제에서 `(기획 기준 — 코드 미존재)` 제거. `mobile/customer-app/`(Flutter) 는 현재 미존재이므로 "(미구현 — Stage 4)" 표기하거나 트리에서 분리 표기.
- 변경 근거: GAP-004 item 2.
- 코드 검증: `apps/backend/`, `packages/` 실재 확인(파일 트리). `mobile/**` Glob 결과 **0건(디렉토리 미존재)** 확인. `apps/console`·`apps/worker` 폴더는 워크스페이스 선언상 존재 여부 별도 — 트리 표기 시 실재만 단정.
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

### PATCH-CXT-003: context.md — §2 핵심 모듈 목록에 health·shared 추가 및 구현 상태 주기

- 대상 파일: `/Users/krystal/workspace/doa/doa-next/.claude/docs/context.md`
- 대상 섹션: §2 핵심 도메인 모듈 목록(L65-86)
- 변경 내용: (1) 표 또는 인접 주기에 `health`(앱 alive 헬스체크, `src/health/`), `shared/auth`(JwtStrategy·JwtAuthGuard·@CurrentUser), `shared/config`(jwt.config), `shared/prisma`(PrismaService·PrismaModule) 추가. (2) 18개 도메인 모듈 표에 구현 상태 주기 추가 — "auth: 실구현 / 나머지 17개(user~admin): 빈 스텁(4계층 골격만), Stage 2~3 대상".
- 변경 근거: GAP-004 item 3.
- 코드 검증: `apps/backend/src/health/{health.controller.ts,health.module.ts}` 존재. `src/shared/auth/{jwt.strategy,jwt-auth.guard,current-user.decorator,auth-shared.module}.ts`, `src/shared/config/{jwt.config,config.module}.ts`, `src/shared/prisma/{prisma.service,prisma.module}.ts` 존재 확인. `src/modules/` 18개 디렉토리 중 auth 만 service/controller/repository/dto 실구현, 나머지 17개는 controller·service·repository·events·module 골격만(Glob 전수 확인).
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

### PATCH-CXT-004: context.md — §4 users 스키마 테이블 목록 정정

- 대상 파일: `/Users/krystal/workspace/doa/doa-next/.claude/docs/context.md`
- 대상 섹션: §4 데이터 모델 — 스키마 분리 구조(L158)
- 변경 내용: `schema: users (users, sellers, addresses, wishlists, product_views, auth_tokens, refresh_tokens)` → 현재 실재 테이블만 반영. 옵션: "users (users, refresh_tokens) — Stage 1 실체화. sellers·addresses·wishlists·product_views 등은 해당 도메인 실구현 시 추가" 로 정정하고 `auth_tokens` 제거.
- 변경 근거: GAP-004 item 4.
- 코드 검증: `apps/backend/prisma/schema.prisma` — `model User`(@@map "users", @@schema "users") L19-28, `model RefreshToken`(@@map "refresh_tokens", @@schema "users") L31-42 **2개 모델만 정의**. `auth_tokens` 모델 미존재. 나머지 7개 스키마(products~files)는 datasource `schemas` 배열 선언만(L11), 테이블 없음.
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

### PATCH-CXT-005: context.md — §6 알려진 제약 갱신

- 대상 파일: `/Users/krystal/workspace/doa/doa-next/.claude/docs/context.md`
- 대상 섹션: §6 알려진 제약 및 기술 부채(L194-200)
- 변경 내용: (1) "코드베이스 미존재"(L196) 행 **제거**(코드 실재). (2) 신규 제약 추가:
  - `pino-pretty devDep 미설치`: 로컬 `NODE_ENV=development` 에서 pino-pretty transport 시도 시 모듈 오류. e2e 테스트는 `NODE_ENV=production`(JSON 로그)으로 우회 중. 해소: `pnpm add -D pino-pretty --filter backend`. (영향: `apps/backend` 로컬 dev 로그)
  - `17개 도메인 모듈 빈 스텁`: auth 외 17개 모듈은 4계층 골격만 존재, 비즈니스 로직 없음(Stage 2~3 대상).
  - (선택) `미사용 env 변수`: `.env.example` 의 JWT_ACCESS_TTL/JWT_REFRESH_TTL 은 코드 상수로 고정(jwt.config.ts), env 로 읽지 않음 — GAP-006.
- 변경 근거: GAP-004 item 5 + test-report.md B-2 + GAP-006.
- 코드 검증: `jwt.config.ts` L4·L7 — `JWT_ACCESS_TTL_SECONDS=900`·`JWT_REFRESH_TTL_DAYS=30` 상수, `process.env` 에서 TTL 미조회(JWT_ACCESS_SECRET·JWT_REFRESH_SECRET 만 조회 L10-11). `.env.example` L9·L15 — `JWT_ACCESS_TTL=900`·`JWT_REFRESH_TTL=30d` 선언(코드 미사용). test-report.md B-2 — pino-pretty 미설치로 e2e NODE_ENV=production 우회.
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

> **PROC-R02 점검**: context.md 에는 "버저닝 이력/changelog" 성격의 섹션(§7 갱신 이력 표 등)이 **현재 부재**(L201 §6 에서 종료). 따라서 이력 행 추가 패치는 도출하지 않음(규칙 부합). §1 "현재 버전" 단일 필드 갱신(PATCH-CXT-001)만 수행.

### PATCH-CXT-006: infra.md — §3 CI/CD 파이프라인 실제 구현 반영

- 대상 파일: `/Users/krystal/workspace/doa/doa-next/.claude/docs/infra.md`
- 대상 섹션: §3 배포 방식 — CI/CD 파이프라인(L64)
- 변경 내용: `→ '.github/workflows/' 파일 참조 (로드맵 1단계 완료 후 생성).` 플레이스홀더 제거. 실제 반영: CI 파일 `.github/workflows/ci.yml`, 4 job 체인 `lint → typecheck → test → docker-build`(각 `needs` 의존), 트리거 `push`/`pull_request` to `main`, Node.js 20, pnpm 9. (flyctl deploy 는 ASM-001 범위 외이므로 docker build 까지만 — 기존 흐름도의 flyctl 단계는 "Stage 2~6 예정" 표기 유지)
- 변경 근거: GAP-005 item 1.
- 코드 검증: `.github/workflows/ci.yml` 확인 — `on: push/pull_request branches: [main]`(L3-9), job `lint`/`typecheck`(needs lint)/`test`(needs typecheck)/`docker-build`(needs test)(L11-67), `pnpm/action-setup@v4 version:9`(L17-19), `setup-node@v4 node-version:'20'`(L20-23), docker-build 단계 `docker build -f apps/backend/Dockerfile .`(L67). flyctl deploy job 부재(ASM-001 일치).
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

### PATCH-CXT-007: infra.md — §6 의존성 설치 실제 명령 반영

- 대상 파일: `/Users/krystal/workspace/doa/doa-next/.claude/docs/infra.md`
- 대상 섹션: §6 로컬 개발 환경 — 의존성 설치(L125-133)
- 변경 내용: `→ package.json / turbo.json 참조 (로드맵 1단계 완료 후 구체화).` 플레이스홀더 제거. 실제: `pnpm install`(루트) → `docker compose up -d postgres` → `pnpm --filter backend exec prisma migrate deploy`.
- 변경 근거: GAP-005 item 2 + pipeline-log "통합 검증 환경 구축"(prisma migrate deploy 성공, 8스키마+2테이블).
- 코드 검증: `apps/backend/package.json` scripts 존재(L5-14). pipeline-log L550-553 — PostgreSQL 16 Docker Compose 기동 + `prisma migrate deploy` 성공으로 8스키마 생성 확인. (docker-compose.yml 의 postgres 서비스명은 별도 확인 권장.)
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

### PATCH-CXT-008: infra.md — §6 테스트 명령에 e2e 추가

- 대상 파일: `/Users/krystal/workspace/doa/doa-next/.claude/docs/infra.md`
- 대상 섹션: §6 로컬 개발 환경 — 테스트(L145-153)
- 변경 내용: unit `pnpm --filter backend test` + e2e `pnpm --filter backend test:e2e`(PostgreSQL + .env 필요, `NODE_ENV=production` 강제 — pino-pretty 우회) 추가.
- 변경 근거: GAP-005 item 3.
- 코드 검증: `apps/backend/package.json` L11 `"test":"jest"`, L13 `"test:e2e":"jest --config ./test/jest-e2e.json"`. test-report.md — e2e 는 PostgreSQL + .env(DATABASE_URL·JWT_*) 필요, `setup-env.js` 가 NODE_ENV=production 설정.
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

### PATCH-CXT-009: infra.md — §6 의존성 구조 표에 신규 인증 패키지 추가

- 대상 파일: `/Users/krystal/workspace/doa/doa-next/.claude/docs/infra.md`
- 대상 섹션: §6 로컬 개발 환경 — 의존성 구조(확정)(L155-166)
- 변경 내용: 표에 추가 — `@nestjs/jwt`(JWT 발급·검증), `@nestjs/passport`+`passport`+`passport-jwt`(인증 전략·가드), `bcrypt`(비밀번호 해싱), `class-validator`+`class-transformer`(DTO 입력 검증), `nestjs-pino`(NestJS pino 통합). 모두 `apps/backend`.
- 변경 근거: GAP-005 item 4.
- 코드 검증: `apps/backend/package.json` dependencies — `@nestjs/jwt ^11`(L20), `@nestjs/passport ^11`(L21), `passport ^0.7`(L28), `passport-jwt ^4`(L29), `bcrypt ^6`(L24), `class-transformer ^0.5`(L25), `class-validator ^0.14`(L26), `nestjs-pino ^4`(L27) 확인.
- 상태: 적용 완료 (docs-change-logs/2026-06-28-001)

---

## 코드 정정 후보 (참고 — Retrospective 범위 외)

> 본 Agent 는 코드를 수정하지 않는다. 다음은 main session/다음 spec 처리를 위한 참고 기록이다.

- **package.json version 0.0.1 → 1.0.0**: `apps/backend/package.json` 이 scaffold 기본값 0.0.1 유지. context.md 현재 버전(v1.0.0)·spec 릴리즈 버전과 정렬하려면 정정 필요. (GAP-004 코드 검증 오기재의 원인이기도 함.)
- **GAP-006 .env.example 미사용 변수**: `.env.example` L9·L15 의 JWT_ACCESS_TTL/JWT_REFRESH_TTL 제거 또는 "코드 상수 고정, 변경 시 jwt.config.ts 수정" 주석 추가.
- **GAP-007 Dockerfile HEALTHCHECK**: 다음 Dockerfile 수정 시 runtime 스테이지에 HEALTHCHECK 추가(gaps.md GAP-007 스니펫).
- **GAP-008/009 (rate limiting·helmet)**: 다음 spec 또는 Stage 2 초기 처리.
