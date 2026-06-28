---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# Spec: 001-skeleton-bootstrap

> Branch: 001-skeleton-bootstrap | Date: 2026-06-28 | Version: v1.0.0

## 목차

- [배경 및 목적](#배경-및-목적)
- [사용자 스토리](#사용자-스토리)
- [기능 요구사항](#기능-요구사항)
- [비기능 요구사항](#비기능-요구사항)
- [수용 기준](#수용-기준)
- [요구사항 구조화 매트릭스](#요구사항-구조화-매트릭스)
- [범위 외](#범위-외)
- [미결 사항](#미결-사항)

---

## 배경 및 목적

기존 DOA Market은 AWS 기반 MSA 16~18개 서비스로 운영되고 있으며 AWS에 깊이 결합되어 있다. 트래픽 규모 대비 인프라 고정비가 과도하고 AWS 종속으로 운영 복잡도가 높다.

이를 해결하기 위해 DOA Market을 Fly.io 기반 NestJS 모듈러 모놀리스로 재구축한다. 목표는 AWS 의존 완전 제거, 월 고정비 1/10 절감, 단일 배포 단위로의 운영 단순화, 기존 18개 도메인 기능 보존이다.

본 spec(단계 1)은 재구축 로드맵의 첫 번째 단계로, **이후 단계(2~6)의 공통 기반이 되는 프로젝트 골격**을 구축한다. Turborepo 모노레포 초기화, NestJS 백엔드 앱의 18개 도메인 모듈 4계층 골격, Prisma multiSchema 설정, JWT 인증 구현, GitHub Actions CI 파이프라인을 통해 "배포 가능한 빈 백엔드"를 만들어 팀이 단일 기반 위에서 도메인별 병렬 개발을 시작할 수 있게 한다.

**단계 1 완료 기준 (5개 조건 모두 충족)**:

1. GET /health → HTTP 200 반환
2. auth API 5종(register / login / refresh / logout / me) 모두 동작
3. GitHub Actions CI 전 단계(lint → typecheck → test → docker build) 통과
4. 18개 도메인 모듈 4계층 골격 파일 전부 존재
5. Prisma multiSchema 마이그레이션 에러 없이 통과

---

## 사용자 스토리

- **US-001**: 백엔드 개발팀으로서, 이후 도메인 기능 개발을 시작하기 위해 통일된 모노레포 기반 NestJS 백엔드 골격을 원한다.
- **US-002**: 백엔드 개발팀으로서, 코드 품질을 보장하기 위해 lint·typecheck·test·docker build를 자동으로 검증하는 CI 파이프라인을 원한다.
- **US-003**: 사용자로서, 서비스를 이용하기 위해 이메일·비밀번호 기반 회원가입 및 로그인을 원한다.
- **US-004**: 로그인한 사용자로서, 세션 만료 없이 서비스를 계속 이용하기 위해 Refresh Token 기반 토큰 갱신을 원한다.
- **US-005**: 운영팀 및 CI/CD 파이프라인으로서, 백엔드 서버가 정상 동작하는지 확인하기 위해 헬스체크 엔드포인트를 원한다.

---

## 기능 요구사항

### 모노레포 및 앱 초기화

- **FR-001**: 시스템은 Turborepo + pnpm workspace 기반 모노레포 구조로 초기화되어야 한다. 워크스페이스 구성: apps/backend, apps/console, apps/worker, packages/shared-types, packages/api-client, packages/ui.

- **FR-002**: apps/backend는 NestJS TypeScript 앱으로 초기화되어야 하며, pino 구조적 로그가 통합되어야 한다.

- **FR-003**: apps/backend는 아래 18개 도메인 모듈 각각에 대해 4계층(controller / service / repository / events) 파일 구조를 가져야 한다. auth 모듈만 실제 구현이며 나머지 17개(user, seller, product, inventory, cart, coupon, order, payment, shipping, settlement, review, search, notification, file, banner, stats, admin)는 빈 스텁 파일이다.

### Prisma 스키마

- **FR-004**: Prisma 스키마는 8개 스키마 네임스페이스(users, products, commerce, orders, payments, settlements, admin, files)를 선언해야 한다. 나머지 7개 스키마는 네임스페이스만 선언하며 테이블을 포함하지 않는다.

- **FR-005**: users 스키마는 사용자 기본 정보를 저장하는 테이블(이메일, 해싱된 비밀번호, 가입일시 포함)과 JWT Refresh Token을 저장하는 테이블(토큰값, 만료일시, 무효화 여부 포함)을 가져야 한다.

- **FR-006**: Prisma migrate가 에러 없이 적용되어 PostgreSQL에 선언된 스키마와 테이블이 생성되어야 한다.

### 헬스체크

- **FR-007**: 시스템은 GET /health 요청에 HTTP 200과 상태 정보(status: "ok" 포함)를 반환해야 한다. 헬스체크는 앱 프로세스의 alive 여부만 확인하며 DB 연결 상태는 포함하지 않는다.

### 인증 (auth 모듈)

- **FR-008**: 시스템은 POST /auth/register로 이메일과 비밀번호를 입력받아 새 사용자를 생성해야 한다. 비밀번호는 단방향 해싱으로 저장해야 하며 이미 존재하는 이메일은 오류로 처리해야 한다.

- **FR-009**: 시스템은 POST /auth/login으로 이메일·비밀번호를 검증하여 Access Token과 Refresh Token을 발급해야 한다. Refresh Token은 users 스키마의 refresh_tokens 테이블에 저장되어야 한다.

- **FR-010**: 시스템은 POST /auth/refresh로 유효한 Refresh Token을 입력받아 새 Access Token을 발급해야 한다. 만료되었거나 무효화된 Refresh Token은 오류로 처리해야 한다.

- **FR-011**: 시스템은 POST /auth/logout으로 제출된 Refresh Token을 무효화하여 이후 해당 토큰으로의 Access Token 갱신을 차단해야 한다.

- **FR-012**: 시스템은 GET /auth/me로 유효한 Access Token으로 인증된 요청에 현재 사용자의 기본 정보(id, email, 가입일시)를 반환해야 한다.

### JWT 인증 가드

- **FR-013**: 시스템은 Authorization: Bearer {AccessToken} 헤더를 검증하는 JWT 인증 가드를 제공해야 한다. 보호된 라우트에 이 가드를 적용하면 유효하지 않거나 만료된 토큰의 접근이 차단되어야 한다.

### 빌드 및 CI

- **FR-014**: apps/backend는 멀티스테이지 Dockerfile을 가져야 하며, docker build 명령으로 에러 없이 이미지가 빌드되어야 한다.

- **FR-015**: 시스템은 main 브랜치 push 시 GitHub Actions가 자동 실행되어야 하며, lint → typecheck → test → docker build 순서로 실행되고 각 단계 실패 시 후속 단계가 실행되지 않아야 한다.

---

## 비기능 요구사항

- **NFR-001**: GET /health의 P95 응답시간은 로컬/dev 환경(PostgreSQL Docker Compose) 기준 200ms 이내여야 한다. 측정 조건: 연속 50회 요청.

- **NFR-002**: /auth/* 엔드포인트(register, login, refresh, logout, me)의 P95 응답시간은 로컬/dev 환경 기준 500ms 이내여야 한다. 측정 조건: 연속 50회 요청.

- **NFR-003**: 발급되는 Access Token의 유효 기간은 발급 시점으로부터 15분이어야 한다.

- **NFR-004**: 발급되는 Refresh Token의 유효 기간은 발급 시점으로부터 30일이어야 한다.

- **NFR-005**: 사용자 비밀번호는 단방향 해싱으로 저장되어야 하며, 원문 비밀번호가 데이터베이스에 저장되어서는 안 된다.

---

## 수용 기준

> **환경 태그 규약**:
> - `[env:static]`: 코드·설정 파일 존재·구조 검증
> - `[env:unit]`: 단위 테스트 (앱 기동 불필요)
> - `[env:integration]`: 앱 기동 + PostgreSQL 연결 필요

### 모노레포 및 앱 초기화

- **SC-001** (FR-001 관련): `pnpm install`이 레포 루트에서 성공하고, `turbo.json`과 `pnpm-workspace.yaml`이 존재하며, apps/backend, apps/console, apps/worker, packages/shared-types, packages/api-client, packages/ui 폴더가 모두 존재한다. [env:static]

- **SC-002** (FR-002 관련): `pnpm --filter backend dev` 명령으로 NestJS 앱이 에러 없이 기동되고, pino 포맷의 로그가 stdout에 출력된다. [env:integration]

- **SC-003** (FR-003 관련): apps/backend/src/modules/ 하위에 auth, user, seller, product, inventory, cart, coupon, order, payment, shipping, settlement, review, search, notification, file, banner, stats, admin 18개 디렉토리가 존재하고, 각 디렉토리에 controller, service, repository 파일과 events 디렉토리(또는 파일)가 모두 존재한다. [env:static]

### Prisma 스키마

- **SC-004** (FR-004 관련): schema.prisma에 users, products, commerce, orders, payments, settlements, admin, files 8개 스키마가 선언되어 있다. [env:static]

- **SC-005** (FR-005 관련): users 스키마에 사용자 기본 정보 테이블과 refresh_tokens 테이블이 정의되어 있다. 각 테이블은 이메일·해시 비밀번호·가입일시 / 토큰값·만료일시·무효화 여부 필드를 포함한다. [env:static]

- **SC-006** (FR-006 관련): `prisma migrate dev`(또는 `prisma migrate deploy`) 명령이 에러 없이 완료되고, PostgreSQL에 8개 스키마가 생성되며 users 스키마에 2개 테이블이 존재한다. [env:integration]

### 헬스체크

- **SC-007** (FR-007 관련): GET /health 요청에 HTTP 200과 `{"status":"ok"}` 를 포함하는 JSON 응답이 반환된다. [env:integration]

- **SC-008** (NFR-001 관련): 로컬 환경에서 GET /health에 연속 50회 요청을 보낼 때 P95 응답시간이 200ms 이내다. [env:integration]

### 인증 — 회원가입

- **SC-009** (FR-008 관련): POST /auth/register에 유효한 이메일·비밀번호를 입력하면 HTTP 201과 생성된 사용자의 id, email이 반환된다. [env:integration]

- **SC-010** (FR-008 관련): 이미 가입된 이메일로 POST /auth/register 시 HTTP 409가 반환된다. [env:unit]

- **SC-011** (NFR-005 관련): POST /auth/register 후 데이터베이스 users 테이블의 password 필드에 원문 비밀번호가 아닌 해시값이 저장된다. [env:integration]

### 인증 — 로그인

- **SC-012** (FR-009 관련): POST /auth/login에 올바른 이메일·비밀번호를 입력하면 HTTP 200과 accessToken, refreshToken이 반환된다. [env:integration]

- **SC-013** (FR-009 관련): 잘못된 비밀번호로 POST /auth/login 시 HTTP 401이 반환된다. [env:unit]

- **SC-014** (NFR-003 관련): POST /auth/login으로 발급된 Access Token의 JWT exp 클레임이 발급 시점 + 15분(900초)으로 설정된다. [env:unit]

### 인증 — 토큰 갱신

- **SC-015** (FR-010 관련): POST /auth/refresh에 유효한 Refresh Token을 입력하면 HTTP 200과 새 accessToken이 반환된다. [env:integration]

- **SC-016** (FR-010 관련): 만료되었거나 무효화된 Refresh Token으로 POST /auth/refresh 시 HTTP 401이 반환된다. [env:unit]

- **SC-017** (NFR-004 관련): POST /auth/login으로 발급된 Refresh Token의 만료 기간이 발급 시점으로부터 30일임이 DB 저장값 또는 토큰 페이로드로 확인된다. [env:unit]

### 인증 — 로그아웃

- **SC-018** (FR-011 관련): POST /auth/logout 호출 후 해당 Refresh Token으로 POST /auth/refresh 시 HTTP 401이 반환된다. [env:integration]

### 인증 — 내 정보

- **SC-019** (FR-012 관련): 유효한 Access Token을 Authorization 헤더에 담아 GET /auth/me 요청 시 HTTP 200과 사용자 id, email, createdAt이 반환된다. [env:integration]

- **SC-020** (FR-012 관련): Access Token 없이 GET /auth/me 요청 시 HTTP 401이 반환된다. [env:unit]

### JWT 가드

- **SC-021** (FR-013 관련): JwtAuthGuard가 적용된 라우트에 만료된 Access Token으로 요청 시 HTTP 401이 반환된다. [env:unit]

### 빌드 및 CI

- **SC-022** (FR-014 관련): `docker build -f apps/backend/Dockerfile .` 명령이 에러 없이 완료되고 실행 가능한 이미지가 생성된다. [env:static]

- **SC-023** (FR-015 관련): GitHub Actions에서 ESLint 오류가 있을 때 lint 단계가 실패하고 typecheck·test·docker build 단계가 실행되지 않는다. [env:static]

- **SC-024** (FR-015 관련): GitHub Actions에서 TypeScript 타입 오류가 있을 때 typecheck 단계가 실패하고 test·docker build 단계가 실행되지 않는다. [env:static]

- **SC-025** (FR-015 관련): GitHub Actions에서 단위/통합 테스트가 실패할 때 docker build 단계가 실행되지 않는다. [env:unit]

- **SC-026** (FR-015 관련): GitHub Actions에서 lint·typecheck·test 전 단계가 통과하면 docker build 단계가 실행되고 성공한다. [env:static]

### 성능 (auth)

- **SC-027** (NFR-002 관련): 로컬 환경에서 POST /auth/login에 연속 50회 요청을 보낼 때 P95 응답시간이 500ms 이내다. [env:integration]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건.
> MoSCoW: Must / Should / Could / Won't.

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-001 | FR-001 | — | SC-001 | static | Must |
| US-001 | FR-002 | — | SC-002 | integration | Must |
| US-001 | FR-003 | — | SC-003 | static | Must |
| US-001 | FR-004 | — | SC-004 | static | Must |
| US-001 | FR-005 | — | SC-005 | static | Must |
| US-001 | FR-006 | — | SC-006 | integration | Must |
| US-005 | FR-007 | NFR-001 | SC-007, SC-008 | integration | Must |
| US-003 | FR-008 | NFR-005 | SC-009, SC-010, SC-011 | integration / unit | Must |
| US-003 | FR-009 | NFR-003 | SC-012, SC-013, SC-014 | integration / unit | Must |
| US-004 | FR-010 | NFR-004 | SC-015, SC-016, SC-017 | integration / unit | Must |
| US-004 | FR-011 | — | SC-018 | integration | Must |
| US-003 | FR-012 | — | SC-019, SC-020 | integration / unit | Must |
| US-001 | FR-013 | — | SC-021 | unit | Must |
| US-002 | FR-014 | — | SC-022 | static | Must |
| US-002 | FR-015 | NFR-002 | SC-023, SC-024, SC-025, SC-026, SC-027 | static / unit / integration | Must |

---

## 범위 외

아래 항목은 본 spec에서 의도적으로 제외한다.

| 항목 | 제외 이유 | 예정 단계 |
|---|---|---|
| 17개 비-auth 도메인 모듈의 실제 비즈니스 로직 | 본 단계는 골격 구축. 기능 구현은 Stage 2~3 | Stage 2+ |
| Fly.io 자동 배포 (flyctl deploy) | Stage 1 시점 Fly.io 계정·시크릿 미준비 (ASM-001) | Stage 2~6 또는 수동 |
| apps/console (Next.js) 실제 앱 초기화 및 페이지 구현 | Stage 4 (프론트 재배선) 대상 | Stage 4 |
| apps/worker pg-boss 실제 설정 | Stage 2+ (비동기 잡 필요 시) | Stage 2+ |
| Flutter 고객 앱 변경 | Stage 4 (API 클라이언트 교체) 대상 | Stage 4 |
| 비밀번호 재설정 기능 | 이메일 알림(notification 모듈) 의존. Stage 3 이후 | Stage 3+ |
| 소셜 로그인 (OAuth) | 기본 인증 구현 후 검토 | Stage 3+ |
| users 스키마의 sellers, addresses, wishlists, product_views, auth_tokens 테이블 | 해당 도메인 실구현 시점에 추가 | Stage 2+ |
| products, commerce, orders, payments, settlements, admin, files 스키마 테이블 정의 | 해당 도메인 실구현 시점에 추가 | Stage 2~3 |
| Stage 1 dev 환경 DB 백업 | dev 환경은 백업 불필요. prod 백업은 Stage 6 | Stage 6 |
| Swagger/OpenAPI 문서화 | Stage 1 이후 고려 | Stage 2+ |

**사후 운영 검증 피드백 사이클**:

Stage 1 파이프라인 종료 후 점검할 가능성이 있는 시나리오:
1. 로컬 Docker Compose 환경에서 전체 auth API 흐름(register → login → me → refresh → logout) 수동 확인
2. docker build 이미지 실행 후 /health 응답 확인
3. CI 파이프라인 실제 push 트리거 동작 확인

사후 결함 발견 시 처리: 결함 정보를 본 spec.md 배경 절 또는 별도 hotfix spec 입력으로 사용 → main session "spec 수정" 이벤트 → 1단계 재진입(cycle 2).

---

## 미결 사항

[NEEDS CLARIFICATION] 항목 없음. 모든 요구사항이 수치·범위·책임이 명확하게 정의되었다.

> **참고 — assumptions.md 등록 항목**:
> - ASM-001: Stage 1 시점 Fly.io 계정·flyctl·Fly secrets 미준비. CI 파이프라인은 docker build까지만 포함.
> - ASM-002: 로컬 개발 환경에 pnpm, Node.js, Docker가 설치되어 있다고 가정.
