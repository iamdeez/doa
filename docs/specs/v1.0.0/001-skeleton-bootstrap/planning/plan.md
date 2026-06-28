---
작성: Planning Agent
버전: v1.1
최종 수정: 2026-06-28
상태: 확정
---

# Plan: 001-skeleton-bootstrap

> Branch: 001-skeleton-bootstrap | Date: 2026-06-28 | Spec: [../spec/spec.md](../spec/spec.md)

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [외부 라이브러리 동작 검증](#외부-라이브러리-동작-검증)
- [배포 환경 영향](#배포-환경-영향)
- [위험 완화 설계 (가정 안전망)](#위험-완화-설계-가정-안전망)
- [핵심 설계](#핵심-설계)
- [결정 기록 (ADRs)](#결정-기록-adrs)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> `constitution.md` (P-001~P-007) 존재 → 해당 조항을 Gates 로 사용한다.
> spec.md NFR 이 constitution 보다 강화된 경우 spec 기준 사용, 완화된 경우 constitution 으로 상향.
> 본 spec 의 NFR(성능·보안)은 constitution 조항과 충돌 없음.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: auth 모듈이 users 스키마 외 타 도메인 테이블을 직접 참조·쿼리하지 않음] → PASS. auth 는 `users.users` / `users.refresh_tokens` 만 접근. 17개 스텁 모듈은 빈 골격으로 교차 쿼리 없음. 각 모듈 controller/service/repository/events 4계층 강제.
- [x] **P-002 AWS 의존 금지 원칙**: [Pass 기준: AWS 전용 SDK/서비스 신규 의존 0건] → PASS. Stage 1 의존성에 `@aws-sdk/*`·Cognito·SQS 등 없음. (file 모듈의 R2용 `@aws-sdk/client-s3` 는 Stage 1 범위 외.)
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 외부 저장소 0건] → PASS. PostgreSQL 16 단일 인스턴스(스키마 분리)만 사용. 외부 Redis/브로커 없음. pg-boss 는 워크스페이스 폴더만 생성(실설정 범위 외).
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: Fly.io 전용 API 에 비즈니스 로직 결합 0건] → PASS. 표준 Docker 멀티스테이지 + 표준 PostgreSQL + 표준 JWT. `fly.toml`/`flyctl` 은 본 spec 범위 외(ASM-001).
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: 결제·정산 상태 변경에 outbox+멱등성 키 적용] → N/A (PASS, 공허참). payment·settlement 모듈은 빈 스텁이며 금전 로직 미구현. Stage 2+ 에서 적용.
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건] → PASS. FR-001~015 전부 SC 매핑 존재(매트릭스 검증). NFR-001~005 도 SC 매핑 존재.
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건] → PASS. 골격 + auth 만 구현. 17개 도메인 실로직·console/worker 실체화·Fly 배포는 범위 외(spec.md 범위 외 표 준수).

예외 사항: 없음.

---

## 기술 컨텍스트

- **언어 / 런타임**: TypeScript 5.x / Node.js LTS (20.x). pnpm 패키지 매니저.
- **모노레포**: Turborepo + pnpm workspace (`pnpm-workspace.yaml`, `turbo.json`).
- **백엔드 프레임워크**: NestJS (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`).
- **ORM / DB**: Prisma (`prisma`, `@prisma/client`) `multiSchema` + PostgreSQL 16. 로컬은 Docker Compose PostgreSQL.
- **인증**: `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` (JWT 발급·검증·가드). 비밀번호 해싱 `bcrypt`.
- **검증**: `class-validator` + `class-transformer` (DTO 검증, `ValidationPipe`).
- **로그**: `nestjs-pino` + `pino` (구조적 로그 stdout).
- **도메인 이벤트**: `@nestjs/event-emitter` (인-프로세스 이벤트 버스 — Stage 1 은 골격만).
- **테스트 프레임워크**: Jest (NestJS 기본) + `supertest` (HTTP 통합). 단위/통합 분리.
- **컨테이너 / CI**: 멀티스테이지 Dockerfile (builder → runtime) / GitHub Actions (`.github/workflows/`).
- **환경변수**: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`(900s), `JWT_REFRESH_TTL`(30d). `.env` / `.env.example` 로 관리(infra.md 원칙). DB 미저장.

> 버전 핀(예: NestJS 10.x, Prisma 6.x)은 3단계 research.md 에서 확정한다(코드베이스 미존재).

---

## 외부 라이브러리 동작 검증

> 본 프로젝트는 코드베이스·venv 미존재(context.md §6 "코드베이스 미존재")이므로 venv 소스 인용 불가.
> 핵심 가정은 공식 문서 지식 기준으로 정리하고, 핀 버전 확정 시 Design 단계 research.md 에서 재확인한다.

| 가정 | 정리 | 인정되는 한계 (PATCH-A07) | 안전망 |
|---|---|---|---|
| Prisma `multiSchema` 로 8개 스키마 선언·마이그레이션 가능 | `generator client { previewFeatures = ["multiSchema"] }` + `datasource db { schemas = [...] }` + 각 모델 `@@schema("...")` 필요. Prisma 5.x preview / 6.7+ GA 로 버전별 활성화 방식 상이. | 핀 버전에 따라 preview flag 필요 여부가 달라 마이그레이션 명령 결과가 달라질 수 있음. | research.md 에서 핀 버전 기준 활성화 구문 확정 + SC-006 통합 테스트(`prisma migrate dev` 에러 0)로 실검증. |
| `@nestjs/jwt` `signAsync({}, {expiresIn})` 로 exp 클레임 설정 | `expiresIn: "15m"`/`"30d"` 또는 초 단위(900) 지정 시 JWT `exp` = iat + TTL. | TTL 문자열·초 혼용 시 단위 오인 가능. | SC-014(access exp=+900s)·SC-017(refresh 만료=+30d) 단위 테스트로 실검증. 상수화(`JWT_ACCESS_TTL_SECONDS=900`). |
| `passport-jwt` 가드가 만료 토큰을 401 로 차단 | 기본 `ignoreExpiration: false` → 만료 토큰은 검증 실패 → `UnauthorizedException`(401). | secret 불일치·clock skew 시 동작 차이. | SC-020·SC-021 단위 테스트로 실검증. |

가정과 실제 동작 불일치는 현재 미발견. 핀 버전 확정 후 불일치 발견 시 Design 단계에서 main 에 BLOCKED 보고.

---

## 배포 환경 영향 (PROC-009)

- 본 spec 의 검증 대상은 **로컬/dev (Docker Compose PostgreSQL)** 와 **GitHub Actions ubuntu-latest** 환경에 한정된다. 실제 Fly.io 배포(컨테이너 NAT·docker-proxy·L4 LB 등 운영 토폴로지)는 **범위 외**(ASM-001, spec.md 범위 외 표).
- 따라서 운영 배포 환경 특이성으로 인한 critical 결함 가능성은 본 단계에 낮음. infra.md §2~3(Fly.io 토폴로지)는 참조했으나 본 spec 의 SC 검증에 직접 관여하지 않는다.
- docker build (FR-014/SC-022/SC-026)는 GitHub Actions ubuntu-latest 의 Docker buildx 기반(ASM-003) — 멀티스테이지 빌드 지원 확인됨.
- infra.md §3 "DB 마이그레이션은 Fly release command 에서 `prisma migrate deploy`" 는 Stage 2+ 배포 시점 사항이며 본 spec 은 로컬 `prisma migrate dev`(SC-006)로 검증한다. infra.md 에 누락 항목 없음 → gaps 등록 불필요.

---

## 위험 완화 설계 (가정 안전망) (PATCH-A06)

assumptions.md 의 ASM 중 "확인 필요 여부 Y + defer/운영 검증" 항목 식별 및 안전망:

| ASM | 확인 필요 | 부정 검증 시 영향 | 안전망 설계 |
|---|---|---|---|
| ASM-001 (Fly.io 미준비 → CI 는 docker build 까지) | Y (Fly 준비 완료 시 CI 에 deploy 단계 추가) | 영향 낮음. CI 범위 결정 사항이며 런타임 동작 아님. | CI workflow 를 **deploy 단계 추가가 비파괴적(additive job)** 이 되도록 설계 — 기존 lint→typecheck→test→docker build job 체인을 변경 없이 두고 deploy job 을 `needs: [docker-build]` 로 append 가능한 구조로 작성. 별도 stale guard·재시도 불필요. |
| ASM-002 (로컬 pnpm/Node/Docker 설치 가정) | N | — | 범용 개발 환경 전제. README/CONTRIBUTING 의 prerequisites 명시로 흡수(범위 외). |
| ASM-003 (ubuntu-latest Docker buildx 기본 제공) | N (확인됨) | — | — |

ASM-001 의 안전망은 spec FR-015(CI 단계 차단 체인)에 매핑되며 CI workflow 설계에 반영된다. SC/FR 매핑 누락 없음 → BLOCKED 불필요.

---

## 핵심 설계

> 작성 깊이: Design Agent 가 추가 설계 판단 없이 tasks.md 를 분해할 수 있는 수준.

### 1. 모노레포 구조 (FR-001)

```
doa-next/
├── pnpm-workspace.yaml          packages: apps/*, packages/*
├── turbo.json                   pipeline: lint, typecheck, test, build
├── package.json                 루트 workspace 정의 + turbo 스크립트
├── apps/
│   ├── backend/                 NestJS (실구현)
│   ├── console/                 package.json + README.md (스텁)
│   └── worker/                  package.json + README.md (스텁)
└── packages/
    ├── shared-types/            package.json + src/index.ts (빈 export)
    ├── api-client/              package.json + src/index.ts (빈 export)
    └── ui/                      package.json + src/index.ts (빈 export)
```

- `turbo.json` 파이프라인 태스크: `lint`, `typecheck`, `test`, `build`. CI 에서 `turbo run <task> --filter=backend` 형태로 호출.

### 2. NestJS 백엔드 구조 (FR-002, FR-003)

```
apps/backend/
├── src/
│   ├── main.ts                  부트스트랩 (nestjs-pino, ValidationPipe 전역)
│   ├── app.module.ts            18개 도메인 모듈 + HealthModule + Prisma/Infra 모듈 import
│   ├── shared/
│   │   ├── prisma/              PrismaService (PrismaClient 확장, onModuleInit connect)
│   │   ├── auth/                JwtAuthGuard, JwtStrategy, @CurrentUser 데코레이터
│   │   └── config/              env 검증·JWT 설정 provider
│   ├── health/
│   │   ├── health.controller.ts GET /health → {status:"ok"}
│   │   └── health.module.ts
│   └── modules/
│       ├── auth/                (실구현) controller/service/repository/events + dto + module
│       ├── user/  seller/ product/ inventory/ cart/ coupon/ order/
│       ├── payment/ shipping/ settlement/ review/ search/ notification/
│       └── file/ banner/ stats/ admin/   ← 각 17개: 빈 4계층 스텁
├── prisma/schema.prisma
├── Dockerfile                   멀티스테이지
└── (fly.toml 은 범위 외)
```

**스텁 모듈(17개) 4계층 골격** (FR-003): 각 모듈 디렉토리에
- `{m}.controller.ts` — 빈 `@Controller()` 클래스
- `{m}.service.ts` — 빈 `@Injectable()` 클래스
- `{m}.repository.ts` — 빈 `@Injectable()` 클래스
- `events/` 디렉토리(또는 `{m}.events.ts`) — 빈 이벤트 핸들러 placeholder
- `{m}.module.ts` — controller/service/repository provider 등록

> SC-003 충족: `modules/` 하위 18개 디렉토리 + 각 controller·service·repository 파일 + events 디렉토리(또는 파일) 존재.

### 3. Prisma 스키마 (FR-004, FR-005, FR-006)

- `datasource db { provider = "postgresql"; url = env("DATABASE_URL"); schemas = ["users","products","commerce","orders","payments","settlements","admin","files"] }`
- `generator client { provider = "prisma-client-js"; previewFeatures = ["multiSchema"] }` (핀 버전이 GA 면 flag 생략 가능 — research.md 확정)
- `users` 스키마 2개 모델만 정의:
  - `User`: id, email(unique), password(해시), createdAt → `@@schema("users")`, `@@map("users")`
  - `RefreshToken`: id, userId(FK→User), `tokenHash`(SHA-256 해시, 조회용 인덱스), expiresAt, revoked(boolean default false), createdAt → `@@schema("users")`, `@@map("refresh_tokens")`. 원문 token 컬럼은 두지 않음 — 해시만 저장(ADR-003).
- 나머지 7개 스키마: `schemas` 배열에만 선언, 모델 없음. (Prisma multiSchema 는 모델 없는 스키마도 마이그레이션 SQL `CREATE SCHEMA` 생성 — research.md 에서 동작 확정.)
- SC-006: `prisma migrate dev` 에러 0 + 8개 스키마 생성 + users 스키마 2개 테이블.

### 4. 헬스체크 (FR-007)

- `HealthController` `@Get('health')` → `{ status: 'ok' }` (HTTP 200). DB 미접근(alive 만). `@nestjs/terminus` 미사용(ADR-006).

### 5. auth 모듈 (FR-008~013)

**흐름**:
```
register: email/password → 이메일 중복 검사 → bcrypt.hash → User insert → 201 {id,email}
login:    email/password → User 조회 → bcrypt.compare → JWT access(15m)+refresh(30d) 발급
                                        → refresh 원문 SHA-256 해싱 → RefreshToken row insert(tokenHash) → 200 {accessToken,refreshToken}
refresh:  refreshToken → JWT 서명·exp 검증 → 제출 원문 SHA-256 해싱 → tokenHash 로 row 조회(revoked=false & expiresAt>now) → 새 access 발급 → 200 {accessToken}
logout:   refreshToken → 제출 원문 SHA-256 해싱 → tokenHash 로 row 조회 → revoked=true → 204/200
me:       JwtAuthGuard 통과 → @CurrentUser → 200 {id,email,createdAt}
```

- `AuthService` 가 `AuthRepository`(Prisma) + `JwtService` + `bcrypt`(비밀번호) + `crypto.createHash('sha256')`(refresh token 해싱) 사용.
- 토큰 발급: access `signAsync(payload,{secret:ACCESS_SECRET,expiresIn:900})`, refresh `signAsync(payload,{secret:REFRESH_SECRET,expiresIn:'30d'})`. refresh payload 에 `jti`(uuid) 포함 — 동일 사용자가 같은 초에 중복 login 해도 JWT(따라서 tokenHash)가 유일하도록 보장(Design 단계 상세).
- RefreshToken 저장(ADR-003): `tokenHash = sha256(refreshToken 원문)`, `expiresAt = now + 30d`, `revoked = false`. **DB 에 원문 미저장** — 유출 시에도 refresh token 재사용 불가(NFR-005 단방향 저장 정신과 일관).
- refresh token 해싱에 bcrypt 가 아닌 SHA-256(결정적 해시)을 채택한 근거: refresh 검증은 제출 원문으로 DB row 를 **조회(lookup)** 해야 하므로, salt 가 매번 달라지는 bcrypt 로는 동등 비교 조회가 불가능하다. refresh token 은 고엔트로피 JWT 라 brute-force 위험이 낮아 무염 SHA-256 으로 충분하며, 저엔트로피 비밀번호의 bcrypt 와 용도가 구분된다.
- 오류 매핑: 중복 이메일 → `ConflictException`(409), 비밀번호 불일치/사용자 없음 → `UnauthorizedException`(401), 만료·무효 refresh → `UnauthorizedException`(401).

### 6. JWT 인증 가드 (FR-013)

- `JwtStrategy`(passport-jwt): `jwtFromRequest = fromAuthHeaderAsBearerToken()`, `ignoreExpiration:false`, `secretOrKey=ACCESS_SECRET`. `validate(payload)` → user 식별자 반환.
- `JwtAuthGuard extends AuthGuard('jwt')`. 보호 라우트(`GET /auth/me`)에 적용. 만료/부재/위조 토큰 → 401.

### 7. Dockerfile (FR-014)

- 멀티스테이지: `builder`(pnpm install + prisma generate + nest build) → `runtime`(prod deps + dist + prisma client 복사). `node dist/main.js` 실행. (ADR-009)

### 8. CI 파이프라인 (FR-015)

- `.github/workflows/ci.yml`: main push 트리거. job 4개를 `needs` 체인으로 직렬화:
  `lint` → `typecheck`(needs lint) → `test`(needs typecheck) → `docker-build`(needs test).
- 각 단계 실패 시 후속 job 미실행(`needs` 의존성). flyctl deploy 단계 없음(ASM-001) — deploy job 은 추후 `needs:[docker-build]` 로 비파괴적 추가 가능(위험 완화 설계 참조).

---

## 결정 기록 (ADRs)

| ADR-ID | 결정 항목 | 채택안 | 대안 (검토했으나 채택 안 함) | 근거 (spec FR/NFR 참조) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | 비밀번호 해싱 | `bcrypt` (cost 10~12) | argon2 / scrypt | FR-008, NFR-005 (단방향 해싱, 원문 미저장) | auth.service, AuthRepository, package.json |
| ADR-002 | JWT 발급·검증 | `@nestjs/jwt` + `passport-jwt` 가드 | express-jwt / 직접 jsonwebtoken | FR-009~013, NFR-003 (access exp 15m) | shared/auth, auth.module |
| ADR-003 | Refresh Token 저장 | `users.refresh_tokens` 에 **SHA-256 해시값만 저장** + `revoked` flag + `expiresAt`. 원문 refresh token(JWT)은 클라이언트에만 발급, refresh/logout 시 제출 원문을 SHA-256 해싱하여 DB 해시와 대조 | 평문 row 저장 / stateless(저장 안 함) / Redis 저장 | FR-009/010/011, NFR-004 (30d, 무효화), NFR-005 정신(원문 미저장 일관) | RefreshToken 모델, auth.service |
| ADR-004 | Prisma 다중 스키마 | `multiSchema` + 8개 schema 선언, `@@schema` 매핑 | 단일 public 스키마 / 8개 DB | FR-004/005/006 (8 스키마, 마이그레이션) | schema.prisma, migrations |
| ADR-005 | 17개 도메인 골격 방식 | 빈 controller/service/repository + events 4계층 스텁 | module.ts 만 생성 / 디렉토리만 | FR-003 (4계층 골격 전부 존재) | modules/*, P-001 4계층 강제 |
| ADR-006 | 헬스체크 구현 | 단순 컨트롤러 `{status:"ok"}` (DB 미포함) | `@nestjs/terminus` DB indicator 포함 | FR-007 (alive 만 확인), NFR-001 (200ms) | health.controller |
| ADR-007 | 구조적 로그 | `nestjs-pino` (pino) stdout | winston / 기본 Nest Logger | FR-002 (pino 구조적 로그) | main.ts, app.module |
| ADR-008 | CI 단계 차단 | GitHub Actions job `needs` 체인 직렬화 | 단일 job 내 step / `if: failure()` 분기 | FR-015 (실패 시 후속 미실행) | .github/workflows/ci.yml |
| ADR-009 | 컨테이너 빌드 | 멀티스테이지 Dockerfile (builder→runtime) | 단일스테이지 | FR-014 (멀티스테이지, 에러 없는 빌드) | apps/backend/Dockerfile |
| ADR-010 | 모노레포 도구 | Turborepo + pnpm workspace | Nx / npm/yarn workspace | FR-001 (Turborepo + pnpm) | 루트 turbo.json, pnpm-workspace.yaml |
| ADR-011 | 입력 검증 | `class-validator` + 전역 `ValidationPipe` | 수동 검증 / zod | FR-008/009 (이메일·비밀번호 형식) | auth dto, main.ts |

> 본 표는 Design Agent research.md "기술 선택 조사" 절과 cross-reference 한다.
> **사용자 확정 결정 (2026-06-28)**: ADR-001 비밀번호 해싱 = `bcrypt`(cost 10~12) **확정**. ADR-003 Refresh Token = **SHA-256 해시 저장 확정**(평문 row 저장안 폐기). 두 보안 정책 결정 모두 사용자 검토 완료. 나머지 ADR 은 REBUILD-PLAN/context.md 확정 스택 답습으로 자명.

---

## 인터페이스 계약

### auth 엔드포인트 (REST)

| 메서드 | 경로 | 인증 | 요청 | 응답(성공) | 오류 |
|---|---|---|---|---|---|
| POST | /auth/register | 불필요 | `{email, password}` | 201 `{id, email}` | 409(중복), 400(검증) |
| POST | /auth/login | 불필요 | `{email, password}` | 200 `{accessToken, refreshToken}` | 401(불일치), 400 |
| POST | /auth/refresh | 불필요 | `{refreshToken}` | 200 `{accessToken}` | 401(만료·무효) |
| POST | /auth/logout | 불필요(refreshToken 제출) | `{refreshToken}` | 200/204 | — |
| GET | /auth/me | `Authorization: Bearer {access}` | — | 200 `{id, email, createdAt}` | 401(부재·만료) |
| GET | /health | 불필요 | — | 200 `{status:"ok"}` | — |

### 내부 인터페이스

- `PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy` — `onModuleInit()` 에서 `$connect()`.
- `JwtAuthGuard` — 보호 라우트 데코레이터(`@UseGuards(JwtAuthGuard)`). 적용 시 401 차단.
- `@CurrentUser()` 파라미터 데코레이터 — `request.user` 추출.
- 17개 스텁 모듈은 외부에 라우트를 노출하지 않음(빈 controller). 하위 호환성 영향 없음(신규 프로젝트).

### 하위 호환성

신규 프로젝트(코드베이스 미존재)이므로 breaking change·기존 통합 영향 없음. 방어 코드: refresh/login 경로에서 사용자/토큰 부재 시 `UnauthorizedException` 일관 반환(타이밍 공격 완화는 Stage 2+ 검토).

---

## 데이터 모델

`users` 스키마 (Stage 1 정의 대상 2개 테이블):

| 테이블 | 필드 | 비고 |
|---|---|---|
| `users.users` | `id`(PK), `email`(unique), `password`(bcrypt 해시), `createdAt` | NFR-005: 원문 비밀번호 미저장. FR-005 |
| `users.refresh_tokens` | `id`(PK), `userId`(FK→users.id), `tokenHash`(SHA-256, 조회 인덱스 — 원문 미저장), `expiresAt`, `revoked`(bool, default false), `createdAt` | FR-005/009/010/011, NFR-004(30d), ADR-003(해시 저장) |

선언만 하고 테이블 미정의: `products, commerce, orders, payments, settlements, admin, files` (FR-004). Stage 2+ 에서 테이블 추가(spec.md 범위 외 표).

> 복잡도 낮음 → 별도 data-model.md 미분리.

---

## 테스트 전략

> 환경 태그: `[env:static]` 코드·설정 구조 검증 / `[env:unit]` 단위(기동 불필요) / `[env:integration]` 앱 기동 + PostgreSQL.

| SC | 테스트 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | static | Happy | 모노레포 구조 검증 | 레포 루트 | `pnpm install` 성공, turbo.json·pnpm-workspace.yaml + 6개 워크스페이스 폴더 존재 |
| SC-002 | integration | Happy | NestJS 기동 + pino 로그 | `pnpm --filter backend dev` | 에러 없이 기동, pino 포맷 로그 stdout 출력 |
| SC-003 | static | Happy | 18 모듈 4계층 골격 | modules/ 디렉토리 | 18개 디렉토리 + 각 controller·service·repository + events |
| SC-004 | static | Happy | 8 스키마 선언 | schema.prisma | 8개 스키마 datasource 선언 존재 |
| SC-005 | static | Happy | users 2 테이블 정의 | schema.prisma | User + RefreshToken 모델, 필수 필드 포함 |
| SC-006 | integration | Happy | 마이그레이션 적용 | `prisma migrate dev` | 에러 0, 8 스키마 생성 + users 2 테이블 |
| SC-007 | integration | Happy | 헬스체크 | `GET /health` | 200 + `{"status":"ok"}` |
| SC-008 | integration | Edge(성능 경계) | health P95 | 연속 50회 GET /health | P95 ≤ 200ms (NFR-001) |
| SC-009 | integration | Happy | 회원가입 성공 | 유효 email/password | 201 `{id,email}` |
| SC-010 | unit | Error | 중복 이메일 | 기존 email | 409 |
| SC-011 | integration | Happy(보안) | 비밀번호 해싱 | register 후 DB 조회 | password 필드가 해시값(원문 아님) (NFR-005) |
| SC-012 | integration | Happy | 로그인 성공 | 올바른 email/password | 200 `{accessToken,refreshToken}` |
| SC-013 | unit | Error | 잘못된 비밀번호 | 틀린 password | 401 |
| SC-014 | unit | Edge(경계) | access exp | login 발급 토큰 디코드 | `exp` = iat + 900s (NFR-003) |
| SC-015 | integration | Happy | 토큰 갱신 | 유효 refreshToken | 200 `{accessToken}` |
| SC-016 | unit | Error | 만료·무효 refresh | 만료/revoked refreshToken | 401 |
| SC-017 | unit | Edge(경계) | refresh 만료 | login 발급 refresh | DB `expiresAt`/페이로드 = +30d (NFR-004) |
| SC-018 | integration | Error | 로그아웃 후 갱신 차단 | logout → refresh | 401 |
| SC-019 | integration | Happy | 내 정보 | 유효 access 헤더 | 200 `{id,email,createdAt}` |
| SC-020 | unit | Error | 토큰 부재 | 헤더 없이 GET /auth/me | 401 |
| SC-021 | unit | Error | 만료 access | 만료 토큰 + 보호 라우트 | 401 |
| SC-022 | static | Happy | docker build | `docker build -f apps/backend/Dockerfile .` | 에러 0, 실행 가능 이미지 |
| SC-023 | static | Error | lint 차단 | ESLint 오류 상태 | lint job 실패, typecheck·test·docker-build 미실행 |
| SC-024 | static | Error | typecheck 차단 | TS 타입 오류 | typecheck 실패, test·docker-build 미실행 |
| SC-025 | unit | Error | test 차단 | 테스트 실패 | docker-build 미실행 |
| SC-026 | static | Happy | 전 단계 통과 | lint·typecheck·test 통과 | docker-build 실행·성공 |
| SC-027 | integration | Edge(성능 경계) | login P95 | 연속 50회 POST /auth/login | P95 ≤ 500ms (NFR-002) |

**Happy/Edge/Error 3유형 충족 점검** (기능 단위):
- auth(register/login/refresh/logout/me): Happy(SC-009/012/015/019) · Edge(SC-014/017) · Error(SC-010/013/016/018/020/021) 전부 커버.
- health: Happy(SC-007) · Edge(SC-008 성능 경계) · Error(앱 alive 만 — 별도 오류 시나리오 spec 미정의, 단순 라우트라 N/A).
- CI(FR-015): Happy(SC-026) · Error(SC-023/024/025). Edge: 단계 차단 경계 = SC-023~025 가 경계 동작 겸함.
- 모노레포·Prisma 골격(FR-001~006): static 존재 검증 중심 — Happy 위주(구조 존재). Error 유형은 마이그레이션 실패(SC-006 의 반례)로 통합 단계에서 암묵 검증.

### [env:integration] 검증 방식 결정 (PATCH-A08 / PROC-010)

본 spec 은 다수 SC 가 `[env:integration]`(앱 기동 + PostgreSQL Docker Compose)이다.

**확정: 옵션 A (사용자 확정, 2026-06-28)** — main session 이 Docker Compose(PostgreSQL) 기동 + `prisma migrate dev` + 앱 기동 절차를 제시 → 사용자 실행 → 결과(로그·HTTP 응답·P95 측정값·DB 조회) 전달 → Test Agent(EXECUTION)가 integration SC(SC-002/006/007/008/009/011/012/015/018/019/027) 를 검증. AWAITING_USER 해소 완료.

- 미채택: 옵션 B(사용자가 직접 환경 구축·실행·결과 전달), 옵션 C(`[env:integration]` 스킵, `[env:unit]`+`[env:static]` 만으로 마감).
- `[env:unit]`/`[env:static]` SC 는 옵션 A 와 무관하게 Test Agent 가 직접 실행·정적 검증한다.

**PROC-010 옵션 C 자가 점검** (옵션 C 미채택이나 의사결정 근거로 기록):
1. 운영 환경 의존성: 결함 발견이 운영 배포 환경(Fly.io NAT 등)에 의존하는가? → **N**. 표준 로컬 Docker Compose PostgreSQL 이면 충분(운영 토폴로지 무관).
2. mock 불가 시나리오: 단위 mock 으로 시뮬레이션 불가능한 시나리오 존재? → **Y**. 실 마이그레이션(SC-006), 실 HTTP P95(SC-008/027), 실 DB 해시 저장(SC-011) 은 실 PostgreSQL 필요.
3. 권장 재검토: #2 가 Y → 옵션 A 또는 B 권장. **옵션 A 확정**으로 충족.

### 사후 운영 검증 피드백 사이클 (PROC-014)

spec.md "사후 운영 검증 피드백 사이클" 절(spec.md L241~248)에 이미 명시됨:
- 점검 시나리오: (1) auth 전체 흐름 수동 확인 (2) docker 이미지 실행 후 /health (3) CI push 트리거 동작.
- 결함 발견 시: spec.md 배경 절 또는 hotfix spec 입력 → main "spec 수정" 이벤트 → cycle 2 재진입, 직전 cycle 산출물은 `_ai-workspace/cycle-N-archive/` 백업.
- 본 plan 은 위 절차를 승계하며 추가 수정 없음.

### smoke_tests (선택)

- 필요 여부: **N**
- 근거: 신규 그린필드 프로젝트로 회귀 위험 경로(기존 코드) 부재. SC-001~027 매핑 테스트가 전 변경을 커버.

---

## 기타 고려사항

- **입력 검증 400**: register/login 의 잘못된 이메일·빈 비밀번호는 `ValidationPipe`(class-validator)로 400 반환. spec 에 별도 SC 없으나 DTO 검증으로 흡수(범위 내 자명). 신규 SC 추가는 하지 않음(Spec 책임).
- **Refresh Token 저장 형태**: ADR-003 — **SHA-256 해시 저장 확정**(평문 저장안 폐기). DB `tokenHash` 컬럼에 해시만 저장하므로 DB 유출 시에도 원문 refresh token 재사용 불가. SC-005(refresh_tokens 테이블이 "토큰값" 필드 보유)는 `tokenHash` 컬럼으로 충족 — 토큰 파생값을 저장하는 정적 구조 검증이라 영향 없음. SC-017(만료 30일 확인)은 `expiresAt` 컬럼 또는 refresh JWT 페이로드 `exp` 로 확인하며 해시 저장과 독립적이므로 모순 0건. lookup 결정성 확보를 위해 bcrypt 가 아닌 SHA-256 채택(핵심 설계 §5 근거). Security Agent 가 cost·해시 알고리즘 적정성을 최종 검토.
- **동시성/공유 상태**: Stage 1 은 멀티스레드 공유 캐시·outbox 없음(P-005 범위 외). RefreshToken 의 logout(revoked=true) → refresh 의 check-then-act 는 단일 트랜잭션 또는 DB 제약으로 처리(Design 단계 상세). 동시 logout·refresh race 는 revoked 갱신이 멱등이라 위험 낮음.
- **상수화 원칙**: JWT TTL 은 `JWT_ACCESS_TTL_SECONDS=900`, `JWT_REFRESH_TTL_DAYS=30` 등 상수/환경변수로 관리(매직넘버 금지). 테스트(SC-014/017)도 동일 상수 참조.
- **17개 스텁 모듈 lint/typecheck**: 빈 클래스라도 ESLint·tsc 통과해야 CI(FR-015) 성립. 미사용 import·빈 클래스 경고 회피 설정 필요(Design 단계).
- **gaps**: 현재 없음. 3단계 이후 설계 공백 발견 시 gaps.md 에 GAP-XXX 기록.
