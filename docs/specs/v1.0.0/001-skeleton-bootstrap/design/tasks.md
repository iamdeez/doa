---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-28 10:54
상태: 확정
---

# Tasks: 001-skeleton-bootstrap

> Branch: 001-skeleton-bootstrap | Date: 2026-06-28 | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 분해 레이어 정의](#태스크-분해-레이어-정의)
- [태스크 목록](#태스크-목록)
  - [Layer F — 기반·인프라/Build (4단계 Development)](#layer-f--기반인프라build-4단계-development)
  - [Layer A — 데이터 계층 (4단계 Development)](#layer-a--데이터-계층-4단계-development)
  - [Layer B — 도메인 계층 (4단계 Development)](#layer-b--도메인-계층-4단계-development)
  - [Layer C — 인터페이스 계층 (4단계 Development)](#layer-c--인터페이스-계층-4단계-development)
  - [Layer D — 테스트 계층 (5a Test AUTHORING)](#layer-d--테스트-계층-5a-test-authoring)
- [Test Authoring Contract](#test-authoring-contract)
- [태스크 입도 가이드](#태스크-입도-가이드)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목이 해소되었는가? → 0건(spec.md 미결 사항).
- [x] plan.md 의 Constitution Gates(P-001~P-007)가 모두 통과되었는가? → 전체 PASS(plan.md 사전 검증).
- [x] CHANGES.md 에서 이전 작업의 "후속 작업 시 주의사항" 을 확인했는가? → CHANGES.md 미존재(최초 spec). 해당 없음.

---

## 태스크 분해 레이어 정의

> 의존 순서: **F → A → B → C** (Development), **D** 는 PPG-1 병렬로 5a 가 작성(TDD Red). 의존 없는 태스크는 `[P]` 병렬.
> **PPG-1 책임 분할**: Layer F·A·B·C = **4단계 Development Agent**. Layer D = **5a Test Agent(AUTHORING)**. 두 Agent 는 동일 turn 동시 spawn 되어 본 tasks.md 를 공통 입력으로 병렬 진행한다(산출물 경로 비충돌: D 는 `*.spec.ts`/`test/` 만 생성).
> Database Design Agent(선택, 3단계 후/4단계 전)가 Layer A 의 Prisma 스키마 설계를 사전 정밀화할 수 있으며, 그 산출물도 PPG-1 입력에 포함된다.

| 레이어 | 본 spec 대상 | 담당 |
|---|---|---|
| F. 기반·인프라/Build | 모노레포·config·Dockerfile·CI·docker-compose | 4단계 Development |
| A. 데이터 계층 | Prisma schema/multiSchema/모델/마이그레이션/PrismaService | 4단계 Development |
| B. 도메인 계층 | AuthService/AuthRepository/config provider | 4단계 Development |
| C. 인터페이스 계층 | Controller/DTO/Guard/Strategy/Health/스텁 모듈/bootstrap | 4단계 Development |
| D. 테스트 계층 | SC-001~027 단위/통합/정적 테스트 | 5a Test(AUTHORING) |

---

## 태스크 목록

### Layer F — 기반·인프라/Build (4단계 Development)

- [x] **T-F1** — 모노레포 루트 골격
  - 레이어: F
  - 구현 파일: `pnpm-workspace.yaml`, `turbo.json`, `package.json`(루트), `.gitignore`, `.npmrc`
  - 관련 요구사항: FR-001
  - 상세: `pnpm-workspace.yaml` packages: `apps/*`,`packages/*`. `turbo.json` 파이프라인 `lint`/`typecheck`/`test`/`build`. 루트 `package.json` 에 turbo 스크립트.
  - 완료 기준: 레포 루트에서 `pnpm install` 성공, turbo.json·pnpm-workspace.yaml 존재(SC-001 전제).

- [x] **T-F2** `[P]` — 6개 워크스페이스 폴더·스텁
  - 레이어: F
  - 구현 파일: `apps/console/{package.json,README.md}`, `apps/worker/{package.json,README.md}`, `packages/shared-types/{package.json,src/index.ts}`, `packages/api-client/{package.json,src/index.ts}`, `packages/ui/{package.json,src/index.ts}`
  - 관련 요구사항: FR-001
  - 상세: console·worker 는 스텁(package.json+README). 3개 packages 는 빈 `export {}` index. apps/backend 는 Layer A·C 에서 구체화.
  - 완료 기준: apps/backend·console·worker + packages/shared-types·api-client·ui 6개 폴더 존재(SC-001).

- [x] **T-F3** — ESLint·tsconfig 설정 (lint/typecheck 통과 전제)
  - 레이어: F
  - 구현 파일: `eslint.config.mjs`(또는 `.eslintrc`), `tsconfig.json`(루트·backend), `apps/backend/tsconfig.json`
  - 관련 요구사항: FR-015
  - 상세: `@typescript-eslint/no-extraneous-class` 데코레이터 예외(`allowWithDecorator:true`) — 17개 빈 스텁 클래스 lint 통과(research 엣지케이스). tsconfig `strict` 유지하되 빈 stub 가 typecheck 통과하도록 미사용 옵션 조정/없는 import 작성.
  - 완료 기준: `turbo run lint`·`turbo run typecheck` 가 빈 스텁 포함 0 error(SC-023/024 정상 경로 전제).

- [x] **T-F4** — 멀티스테이지 Dockerfile
  - 레이어: F
  - 구현 파일: `apps/backend/Dockerfile`, `.dockerignore`
  - 관련 요구사항: FR-014
  - 상세: builder(pnpm install + `prisma generate` + `nest build`) → runtime(prod deps + dist + prisma client 복사). `node dist/main.js` 실행(ADR-009).
  - 완료 기준: `docker build -f apps/backend/Dockerfile .` 에러 0, 실행 가능 이미지(SC-022).

- [x] **T-F5** — GitHub Actions CI 워크플로우
  - 레이어: F
  - 구현 파일: `.github/workflows/ci.yml`
  - 관련 요구사항: FR-015
  - 상세: main push 트리거. job 4개 `needs` 체인 직렬화: `lint` → `typecheck`(needs lint) → `test`(needs typecheck) → `docker-build`(needs test). 각 실패 시 후속 미실행(ADR-008). flyctl deploy 없음(ASM-001) — deploy job 은 추후 `needs:[docker-build]` 비파괴적 추가 가능 구조. `test` job 은 [env:unit] 중심(integration 은 옵션 A).
  - 완료 기준: workflow `needs` 체인이 lint→typecheck→test→docker-build 순(SC-023~026 검증 대상 구조).

- [x] **T-F6** `[P]` — 로컬 PostgreSQL Docker Compose + 환경변수 예시
  - 레이어: F
  - 구현 파일: `docker-compose.yml`(PostgreSQL 16), `.env.example`
  - 관련 요구사항: FR-006, FR-002 (integration 환경 전제)
  - 상세: PostgreSQL 16 서비스. `.env.example` 에 `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`(900), `JWT_REFRESH_TTL`(30d) 변수명·용도(값 없음, infra.md 원칙).
  - 완료 기준: `docker compose up -d` 로 PostgreSQL 기동, `.env.example` 변수 완비(SC-002/006 옵션 A 전제).

### Layer A — 데이터 계층 (4단계 Development)

- [x] **T-A1** — PrismaService
  - 레이어: A
  - 구현 파일: `apps/backend/src/shared/prisma/prisma.service.ts`, `prisma.module.ts`
  - 관련 요구사항: FR-002, FR-006
  - 상세: `PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy`. `onModuleInit()`→`$connect()`, `onModuleDestroy()`→`$disconnect()`. global module 로 export.
  - 완료 기준: 앱 기동 시 DB 연결 성공(SC-002 전제), AuthRepository 주입 가능.

- [x] **T-A2** — Prisma datasource·generator (multiSchema 8 스키마 선언)
  - 레이어: A
  - 구현 파일: `apps/backend/prisma/schema.prisma`
  - 관련 요구사항: FR-004
  - 상세: `datasource db { provider="postgresql"; url=env("DATABASE_URL"); schemas=["users","products","commerce","orders","payments","settlements","admin","files"] }`. `generator client { provider="prisma-client-js" }` — **previewFeatures 불필요**(Prisma ^6.19 multiSchema GA, research 확정).
  - 완료 기준: schema.prisma 에 8개 스키마 선언(SC-004), `prisma validate` 통과.

- [x] **T-A3** — User·RefreshToken 모델 (users 스키마)
  - 레이어: A (T-A2 후)
  - 구현 파일: `apps/backend/prisma/schema.prisma`
  - 관련 요구사항: FR-005
  - 상세:
    - `User`: `id`(PK), `email @unique`, `password`(bcrypt 해시), `createdAt @default(now())`, relation→RefreshToken. `@@schema("users") @@map("users")`.
    - `RefreshToken`: `id`(PK), `userId`(FK→User), `tokenHash @unique`(SHA-256, 조회 인덱스 — 원문 미저장), `expiresAt`, `revoked Boolean @default(false)`, `createdAt`. `@@schema("users") @@map("refresh_tokens")`. (ADR-003)
  - 완료 기준: 2개 모델 정의, 필수 필드 포함, 원문 token/password 컬럼 없음(SC-005).

- [x] **T-A4** — 초기 마이그레이션 + 8개 CREATE SCHEMA 보강 (빈 스키마 안전망)
  - 레이어: A (T-A3 후)
  - 구현 파일: `apps/backend/prisma/migrations/<ts>_init/migration.sql`
  - 관련 요구사항: FR-006
  - 상세: `prisma migrate dev --create-only` 로 생성 → 생성된 migration.sql 에 **8개 스키마 전부** `CREATE SCHEMA IF NOT EXISTS "<name>";` 존재 검증. Prisma 가 빈 7개 스키마(products·commerce·orders·payments·settlements·admin·files)를 누락하면 SQL 상단에 수동 보강(멱등 `IF NOT EXISTS`) → `prisma migrate dev` 적용. (research "Prisma multiSchema 동작 검증" 안전망)
  - 완료 기준: `prisma migrate dev` 에러 0, PostgreSQL 에 8개 스키마 + users 2개 테이블 생성(SC-006).

### Layer B — 도메인 계층 (4단계 Development)

- [x] **T-B1** — config provider (env 검증·JWT 상수)
  - 레이어: B
  - 구현 파일: `apps/backend/src/shared/config/`(config.module.ts, jwt.config.ts/env validation)
  - 관련 요구사항: FR-009, NFR-003, NFR-004
  - 상세: 환경변수 로드·검증(class-validator 또는 joi). 상수 `JWT_ACCESS_TTL_SECONDS=900`, `JWT_REFRESH_TTL_DAYS=30`(매직넘버 금지, plan 상수화 원칙). access/refresh secret 분리 제공.
  - 완료 기준: 누락 env 시 기동 실패(검증), 상수 export(SC-014/017 동일 상수 참조).

- [x] **T-B2** — AuthRepository (users 스키마 접근)
  - 레이어: B (T-A1/T-A3 후)
  - 구현 파일: `apps/backend/src/modules/auth/auth.repository.ts`
  - 관련 요구사항: FR-008~011, P-001
  - 상세: `findUserByEmail`, `createUser`, `findUserById`, `createRefreshToken(tokenHash,expiresAt,userId)`, `findRefreshTokenByHash(tokenHash)`, `revokeRefreshToken(tokenHash)`. **users 스키마만 접근**(P-001).
  - 완료 기준: PrismaService 통해 users.users/refresh_tokens CRUD, 타 스키마 미접근.

- [x] **T-B3** — AuthService.register
  - 레이어: B (T-B2 후)
  - 구현 파일: `apps/backend/src/modules/auth/auth.service.ts`
  - 관련 요구사항: FR-008, NFR-005
  - 상세: 이메일 중복 검사(존재→`ConflictException` 409) → `bcrypt.hash`(cost 10~12) → createUser → `{id,email}` 반환. 원문 비밀번호 미저장.
  - 완료 기준: 유효 입력 시 사용자 생성+해시 저장, 중복 이메일 409(SC-009/010/011).

- [x] **T-B4** — AuthService.login (access+refresh 발급)
  - 레이어: B (T-B2/T-B1 후)
  - 구현 파일: `apps/backend/src/modules/auth/auth.service.ts`
  - 관련 요구사항: FR-009, NFR-003, NFR-004
  - 상세: User 조회→`bcrypt.compare`(실패/부재→`UnauthorizedException` 401). 성공 시 **동일 분기에서**(§E) access `signAsync(payload,{secret:ACCESS,expiresIn:900})` + refresh `signAsync({...,jti:randomUUID()},{secret:REFRESH,expiresIn:30d})` 함께 발급. refresh 원문 `sha256` → `createRefreshToken(tokenHash, now+30d)`. `{accessToken,refreshToken}` 반환.
  - 완료 기준: 올바른 자격→200+토큰 2종, 잘못된 비밀번호→401, access exp=+900s, refresh expiresAt/exp=+30d(SC-012/013/014/017).

- [x] **T-B5** — AuthService.refresh
  - 레이어: B (T-B4 후)
  - 구현 파일: `apps/backend/src/modules/auth/auth.service.ts`
  - 관련 요구사항: FR-010
  - 상세: refresh 원문 JWT 서명·exp 검증(REFRESH_SECRET) → `sha256(원문)` → `findRefreshTokenByHash` 조회(`revoked=false && expiresAt>now`) → 부재/무효→401 → 새 access 발급 → `{accessToken}`. (동시성: research 분석 — revoked 멱등, 단순 조회+분기로 충족)
  - 완료 기준: 유효 refresh→200+새 access, 만료/revoked→401(SC-015/016).

- [x] **T-B6** — AuthService.logout
  - 레이어: B (T-B4 후)
  - 구현 파일: `apps/backend/src/modules/auth/auth.service.ts`
  - 관련 요구사항: FR-011
  - 상세: 제출 refresh 원문 `sha256` → `revokeRefreshToken(tokenHash)`(revoked=true). 204/200. 이후 동일 토큰 refresh 차단.
  - 완료 기준: logout 후 동일 refresh 로 refresh→401(SC-018).

- [x] **T-B7** — AuthService.me / getProfile
  - 레이어: B (T-B2 후)
  - 구현 파일: `apps/backend/src/modules/auth/auth.service.ts`
  - 관련 요구사항: FR-012
  - 상세: 인증된 userId → `findUserById` → `{id,email,createdAt}` 반환.
  - 완료 기준: 유효 access 인증 시 사용자 정보 반환(SC-019).

### Layer C — 인터페이스 계층 (4단계 Development)

- [x] **T-C1** — main.ts 부트스트랩 (pino + ValidationPipe)
  - 레이어: C
  - 구현 파일: `apps/backend/src/main.ts`
  - 관련 요구사항: FR-002, FR-008/009 (검증)
  - 상세: `NestFactory.create` + `app.useLogger`(nestjs-pino) + 전역 `app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}))`. pino 구조적 로그 stdout.
  - 완료 기준: 에러 없이 기동, pino 포맷 로그 stdout 출력(SC-002).

- [x] **T-C2** — app.module.ts (모듈 조립)
  - 레이어: C (T-C6/Health/Auth 후)
  - 구현 파일: `apps/backend/src/app.module.ts`
  - 관련 요구사항: FR-003, FR-002
  - 상세: 18개 도메인 모듈(auth 실구현 + 17 스텁) + HealthModule + PrismaModule + ConfigModule + `LoggerModule`(nestjs-pino) + `EventEmitterModule.forRoot()` import.
  - 완료 기준: 전체 모듈 정상 부트(SC-002), 18개 모듈 등록.

- [x] **T-C3** `[P]` — HealthController
  - 레이어: C
  - 구현 파일: `apps/backend/src/health/health.controller.ts`, `health.module.ts`
  - 관련 요구사항: FR-007, NFR-001
  - 상세: `@Get('health')` → `{status:'ok'}`(HTTP 200). DB 미접근(alive 만, ADR-006). @nestjs/terminus 미사용.
  - 완료 기준: GET /health→200+`{"status":"ok"}`, P95≤200ms(SC-007/008).

- [x] **T-C4** — AuthController + DTO
  - 레이어: C (T-B3~B7/T-C5 후)
  - 구현 파일: `apps/backend/src/modules/auth/auth.controller.ts`, `dto/{register,login,refresh}.dto.ts`, `auth.module.ts`, `auth.events.ts`
  - 관련 요구사항: FR-008~012, FR-003
  - 상세: 5 엔드포인트(POST register/login/refresh/logout, GET me). DTO: RegisterDto/LoginDto(`@IsEmail`,`@IsNotEmpty`/`@MinLength`), RefreshDto(`@IsNotEmpty`). me 는 `@UseGuards(JwtAuthGuard)`+`@CurrentUser()`. auth.module 에 controller/service/repository provider 등록 + JwtModule. auth.events.ts placeholder(4계층).
  - 완료 기준: 인터페이스 계약 표(plan)대로 상태코드·응답(SC-009/012/015/018/019), 잘못된 입력 400.

- [x] **T-C5** — shared/auth: JwtStrategy·JwtAuthGuard·@CurrentUser
  - 레이어: C (T-B1 후)
  - 구현 파일: `apps/backend/src/shared/auth/{jwt.strategy.ts,jwt-auth.guard.ts,current-user.decorator.ts,auth-shared.module.ts}`
  - 관련 요구사항: FR-013
  - 상세: `JwtStrategy`(`fromAuthHeaderAsBearerToken`, `ignoreExpiration:false`, `secretOrKey=ACCESS_SECRET`, `validate(payload)`→user 식별자). `JwtAuthGuard extends AuthGuard('jwt')`. `@CurrentUser()`→`request.user`.
  - 완료 기준: 보호 라우트에서 무토큰/만료→401(SC-020/021).

- [x] **T-C6** `[P]` — 17개 스텁 도메인 모듈 4계층 골격
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/{user,seller,product,inventory,cart,coupon,order,payment,shipping,settlement,review,search,notification,file,banner,stats,admin}/` 각 `{m}.controller.ts`,`{m}.service.ts`,`{m}.repository.ts`,`{m}.events.ts`,`{m}.module.ts`
  - 관련 요구사항: FR-003, P-001
  - 상세: 각 모듈 빈 `@Controller()`/`@Injectable()` 클래스(라우트 미노출) + events placeholder 파일 + module 에 provider 등록. lint(no-extraneous-class allowWithDecorator)·typecheck 통과(research 엣지케이스).
  - 완료 기준: 17개 디렉토리 + 각 controller·service·repository·events 파일 + module(SC-003, auth 포함 18개).

### Layer D — 테스트 계층 (5a Test AUTHORING)

> 본 레이어는 **5a Test Agent(AUTHORING)** 가 PPG-1 병렬로 작성한다(TDD Red). 4단계 Development 는 본 레이어를 작성하지 않는다. 산출물은 `*.spec.ts`/`apps/backend/test/`. 각 SC 매핑은 [Test Authoring Contract](#test-authoring-contract) 표 참조.

- [ ] **T-D1** — 정적 구조·CI 검증 테스트 ([env:static])
  - 레이어: D | 검증 대상: SC-001, SC-003, SC-004, SC-005, SC-022, SC-023, SC-024, SC-026
  - 테스트 파일: `apps/backend/test/static/structure.spec.ts`, `test/static/ci-workflow.spec.ts`
  - 상세: 워크스페이스 폴더/파일 존재(fs 검증), schema.prisma 8 스키마·2 모델 파싱 검증, ci.yml `needs` 체인 순서 파싱 검증, Dockerfile 멀티스테이지 존재. SC-022/026 의 실제 docker build·전단계 통과는 옵션 A/CI 실행으로 갈음(정적 구조는 본 테스트).
  - 완료 기준: 각 SC 정적 단언 통과.

- [ ] **T-D2** — auth 단위 테스트 ([env:unit])
  - 레이어: D | 검증 대상: SC-010, SC-013, SC-014, SC-016, SC-017, SC-020, SC-021, SC-025
  - 테스트 파일: `apps/backend/src/modules/auth/auth.service.spec.ts`, `src/shared/auth/jwt-auth.guard.spec.ts`
  - 상세: AuthRepository/JwtService mock. 중복 이메일 409·잘못된 비밀번호 401·만료/revoked refresh 401·access exp=+900s·refresh +30d·무토큰 401·만료 access 401. SC-025 는 테스트 실패 시 CI docker-build 미실행(테스트 존재+CI 구조로 검증).
  - 완료 기준: 각 SC 단위 단언 통과(production Green 후).

- [ ] **T-D3** — auth·health 통합 테스트 ([env:integration], 옵션 A)
  - 레이어: D | 검증 대상: SC-002, SC-006, SC-007, SC-008, SC-009, SC-011, SC-012, SC-015, SC-018, SC-019, SC-027
  - 테스트 파일: `apps/backend/test/auth.e2e-spec.ts`, `test/health.e2e-spec.ts`
  - 상세: supertest 기반 e2e(앱 기동+PostgreSQL). register→login→me→refresh→logout 흐름, health 200, P95(health≤200ms/login≤500ms 연속 50회), DB password 해시 저장 확인. 실행은 옵션 A(plan 확정): main 이 Docker Compose+migrate+기동 절차 제시→사용자 실행→결과 전달→Test Agent(EXECUTION) 검증.
  - 완료 기준: 각 SC 통합 단언 통과(옵션 A 결과 기반).

---

## Test Authoring Contract

> **PPG-1 의 5a 단계 Test Agent(AUTHORING) 입력 contract.** 각 SC-XXX → 테스트 파일·함수명 후보 + 시나리오 유형 + 환경 태그.
> 함수명 규약: `test_when_<조건>_then_<결과>` (Jest `it('...')` 설명문 동등).

| SC-ID | 수용 기준(요약) | 유형 | 테스트 파일 경로 | 테스트 함수/it 후보 | env |
|---|---|---|---|---|---|
| SC-001 | 모노레포 구조·6 워크스페이스 존재 | Happy | test/static/structure.spec.ts | when_repo_root_then_workspaces_and_turbo_exist | static |
| SC-002 | NestJS 기동 + pino 로그 | Happy | test/health.e2e-spec.ts | when_app_boots_then_no_error_and_pino_stdout | integration |
| SC-003 | 18 모듈 4계층 골격 | Happy | test/static/structure.spec.ts | when_modules_dir_then_18_dirs_with_4_layers | static |
| SC-004 | schema.prisma 8 스키마 선언 | Happy | test/static/structure.spec.ts | when_schema_prisma_then_8_schemas_declared | static |
| SC-005 | users 2 테이블 정의 | Happy | test/static/structure.spec.ts | when_schema_prisma_then_user_and_refreshtoken_models | static |
| SC-006 | 마이그레이션 8 스키마+2 테이블 | Happy | test/auth.e2e-spec.ts (setup) | when_migrate_dev_then_8_schemas_2_tables | integration |
| SC-007 | GET /health 200 ok | Happy | test/health.e2e-spec.ts | when_get_health_then_200_status_ok | integration |
| SC-008 | health P95 ≤200ms (50회) | Edge(성능) | test/health.e2e-spec.ts | when_50_health_requests_then_p95_under_200ms | integration |
| SC-009 | register 성공 201 {id,email} | Happy | test/auth.e2e-spec.ts | when_valid_register_then_201_id_email | integration |
| SC-010 | 중복 이메일 409 | Error | src/modules/auth/auth.service.spec.ts | when_duplicate_email_then_conflict_409 | unit |
| SC-011 | DB password 해시 저장 | Happy(보안) | test/auth.e2e-spec.ts | when_register_then_db_password_is_hashed | integration |
| SC-012 | login 성공 200 토큰 2종 | Happy | test/auth.e2e-spec.ts | when_valid_login_then_200_access_refresh | integration |
| SC-013 | 잘못된 비밀번호 401 | Error | src/modules/auth/auth.service.spec.ts | when_wrong_password_then_unauthorized_401 | unit |
| SC-014 | access exp=+900s | Edge(경계) | src/modules/auth/auth.service.spec.ts | when_login_then_access_exp_iat_plus_900 | unit |
| SC-015 | refresh 갱신 200 새 access | Happy | test/auth.e2e-spec.ts | when_valid_refresh_then_200_new_access | integration |
| SC-016 | 만료·무효 refresh 401 | Error | src/modules/auth/auth.service.spec.ts | when_expired_or_revoked_refresh_then_401 | unit |
| SC-017 | refresh 만료=+30d | Edge(경계) | src/modules/auth/auth.service.spec.ts | when_login_then_refresh_expiry_plus_30d | unit |
| SC-018 | logout 후 refresh 401 | Error | test/auth.e2e-spec.ts | when_logout_then_refresh_returns_401 | integration |
| SC-019 | GET /auth/me 200 정보 | Happy | test/auth.e2e-spec.ts | when_valid_access_then_me_200_profile | integration |
| SC-020 | 토큰 부재 me 401 | Error | src/shared/auth/jwt-auth.guard.spec.ts | when_no_token_then_me_401 | unit |
| SC-021 | 만료 access 보호라우트 401 | Error | src/shared/auth/jwt-auth.guard.spec.ts | when_expired_access_then_guard_401 | unit |
| SC-022 | docker build 에러 0 | Happy | test/static/ci-workflow.spec.ts (+CI/옵션A) | when_dockerfile_then_multistage_buildable | static |
| SC-023 | lint 실패→후속 미실행 | Error | test/static/ci-workflow.spec.ts | when_lint_fails_then_typecheck_test_build_skipped | static |
| SC-024 | typecheck 실패→후속 미실행 | Error | test/static/ci-workflow.spec.ts | when_typecheck_fails_then_test_build_skipped | static |
| SC-025 | test 실패→docker-build 미실행 | Error | test/static/ci-workflow.spec.ts | when_test_fails_then_docker_build_skipped | unit |
| SC-026 | 전단계 통과→docker-build 성공 | Happy | test/static/ci-workflow.spec.ts (+CI/옵션A) | when_all_pass_then_docker_build_runs | static |
| SC-027 | login P95 ≤500ms (50회) | Edge(성능) | test/auth.e2e-spec.ts | when_50_login_requests_then_p95_under_500ms | integration |

> [env:integration] SC(SC-002/006/007/008/009/011/012/015/018/019/027)는 옵션 A(plan.md 확정)로 실행: main 이 절차 제시→사용자 실행→결과 전달→Test Agent(EXECUTION) 검증.
> [env:static]·[env:unit] SC 는 Test Agent 가 직접 실행·정적 검증.
> 외부 contract 공급(다른 agent/사용자/CI) 시 main 이 `ExternalAuthoring: YES` 로 5a 호출, 산출물(test 파일) 존재 확인 후 5b 진입.

---

## 태스크 입도 가이드

- 1 태스크 ≈ 구현 파일 1~3개 + 대응 테스트 1개 수준. (auth.service 는 register/login/refresh/logout/me 를 T-B3~B7 로 메서드 단위 분리 — 단일 파일이나 SC 매핑·완료 기준을 메서드별로 분리해 추적성 확보.)
- T-C6(17 스텁)은 동형 반복 골격이라 1 태스크로 묶되, 모듈당 5파일 동일 패턴.

---

## 구현 완료 기준

- [ ] 모든 태스크 체크박스 완료 (Layer F·A·B·C = 4단계, Layer D = 5a).
- [ ] [TypeScript] `turbo run lint` · `turbo run typecheck` 0 error.
- [ ] [TypeScript] `turbo run test`(단위) 전체 PASS. integration 은 옵션 A 결과로 검증.
- [ ] `docker build -f apps/backend/Dockerfile .` 에러 0.
- [ ] `prisma migrate dev` 에러 0 + 8 스키마 + users 2 테이블(SC-006).
- [ ] `git status` 의도치 않은 파일 없음.
