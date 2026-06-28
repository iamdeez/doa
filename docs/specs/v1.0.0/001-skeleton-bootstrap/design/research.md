---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-28 10:54
상태: 확정
---

# Research: 001-skeleton-bootstrap

## 목차

- [분석 우선순위 게이트 적용 결과](#분석-우선순위-게이트-적용-결과)
- [기존 코드베이스 분석](#기존-코드베이스-분석)
- [영향 범위 분석](#영향-범위-분석)
- [외부 라이브러리 API 실제 동작 확인](#외부-라이브러리-api-실제-동작-확인)
  - [핀 버전 확정](#핀-버전-확정)
  - [Prisma multiSchema 동작 검증](#prisma-multischema-동작-검증)
  - [@nestjs/jwt 토큰 발급·exp 검증](#nestjsjwt-토큰-발급exp-검증)
  - [passport-jwt 가드 만료 차단 검증](#passport-jwt-가드-만료-차단-검증)
  - [bcrypt 해싱 검증](#bcrypt-해싱-검증)
  - [refresh token SHA-256 lookup·동시성 분석](#refresh-token-sha-256-lookup동시성-분석)
- [인정되는 한계 및 안전망 (PATCH-A07)](#인정되는-한계-및-안전망-patch-a07)
- [배포 환경 영향 추정 (PATCH-A10)](#배포-환경-영향-추정-patch-a10)
- [context.md 부정합 사전 점검 (PATCH-A11)](#contextmd-부정합-사전-점검-patch-a11)
- [기술 선택 조사](#기술-선택-조사)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 분석 우선순위 게이트 적용 결과

> 03-design.md "분석 우선순위 게이트" 적용. 본 spec 은 **그린필드(코드베이스 미존재 — context.md §6)**.

| 게이트 항목 | 판정 |
|---|---|
| 1. 변경 대상 모듈 추출 (plan.md "핵심 설계") | 전부 신규 생성 (모노레포·NestJS·Prisma·auth·CI). 기존 변경 대상 0. |
| 2. §A·§B·§C 분석 범위 | 신규 생성 대상이라 기존 호출 측·상속 트리 분석 불필요. 신규 클래스 설계 관점만 기록. |
| 3. §D (다단계 병렬 파이프라인) | plan.md 미요구 → **건너뜀**. |
| 3. §E (동일 가드 조건 결정 통합) | auth login 의 access+refresh 동시 발급에 적용 — 단일 성공 분기에서 함께 결정(plan §5 흐름과 일관). 위반 없음. |
| 4. 외부 라이브러리 검증 | **신규 도입 라이브러리 다수 → 전체 수행**(본 문서 핵심). QualityGate 명시. |
| 5. §F (production 시그니처 변경) | 그린필드 → 호출 측 테스트 없음 → **건너뜀**. |

---

## 기존 코드베이스 분석

### 클래스·모듈 계층 구조

- 코드베이스 미존재. 모든 클래스가 신규. 상속 트리 분석 대상은 NestJS·Prisma·passport 추상 클래스에 한정:
  - `PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy` — `@prisma/client` 의 `PrismaClient`(concrete) 를 확장. 생성자 `super()` 호출로 인스턴스화 가능. `protected`/`pure virtual` 제약 없음.
  - `JwtStrategy extends PassportStrategy(Strategy, 'jwt')` — `@nestjs/passport` mixin. `validate()` 구현 필수(추상 → 구현 강제). 생성자에서 `super({ jwtFromRequest, secretOrKey, ignoreExpiration:false })` 호출.
  - `JwtAuthGuard extends AuthGuard('jwt')` — `@nestjs/passport` mixin. 기본 `canActivate` 사용, override 불요.
  - 17개 스텁 모듈: 빈 `@Injectable()`/`@Controller()` 클래스. 상속 없음. 빈 클래스 lint 처리 주의(엣지 케이스 절).

### 영향 범위 분석

- 신규 프로젝트 → 호출 측 전수 목록 N/A. breaking change 없음.
- 내부 신규 인터페이스 호출 관계(설계 기준):
  - `AuthController → AuthService → (AuthRepository, JwtService, bcrypt, node:crypto.createHash)`
  - `AuthRepository → PrismaService(users.users, users.refresh_tokens)` — P-001 모듈 경계 준수(타 스키마 미접근).
  - `JwtAuthGuard → JwtStrategy → (request.user)`; `@CurrentUser` → `request.user`.

### 공유 상태·동시성 분석

- Stage 1 은 멀티스레드 공유 캐시·outbox 없음(P-005 범위 외).
- 유일한 check-then-act: refresh token 의 `revoked` 검사(refresh) ↔ `revoked=true` 갱신(logout). [refresh token SHA-256 lookup·동시성 분석](#refresh-token-sha-256-lookup동시성-분석) 절에서 상세.

---

## 영향 범위 분석

| 파일 | 변경 유형 | 영향 내용 |
|---|---|---|
| (전체) | 신규 | 그린필드. 기존 파일 수정·삭제 0건. |

---

## 외부 라이브러리 API 실제 동작 확인

> 코드베이스·node_modules 미존재이므로 venv 소스 인용 불가. 공식 동작 지식 + npm 레지스트리 실조회(2026-06-28)로 핀 버전을 확정하고, 통합 단계(SC) 실검증으로 가정을 재확인한다. 본 절은 plan.md "외부 라이브러리 동작 검증" 표와 cross-check 한다.

### 핀 버전 확정

npm 레지스트리 실조회 결과(2026-06-28):

| 패키지 | latest | 본 spec 채택 핀 | 근거 |
|---|---|---|---|
| `prisma` / `@prisma/client` | 7.8.0 (6.x 계열 latest 6.19.3) | `^6.19.0` | multiSchema GA(6.7.0+) 계열 안정 버전. Prisma 7.x 는 신규 major 라 골격 단계 리스크 회피 위해 보류(Stage 2+ 승격 검토). |
| `@nestjs/core`·`common`·`platform-express` | 11.1.27 | `^11.0.0` | Node 20 LTS 호환 최신 stable. |
| `@nestjs/jwt` | 11.0.2 | `^11.0.0` | Nest 11 정합. |
| `@nestjs/passport` | (11.x 계열) | `^11.0.0` | Nest 11 정합. `passport` `^0.7`, `passport-jwt` 동반. |
| `passport-jwt` | 4.0.1 | `^4.0.0` | `ExtractJwt.fromAuthHeaderAsBearerToken()` + `ignoreExpiration` 지원. `@types/passport-jwt` 동반. |
| `bcrypt` | 6.0.0 | `^6.0.0` | Node 18+ 요구(충족). `@types/bcrypt` 동반. |
| `class-validator` / `class-transformer` | (0.14 / 0.5 계열) | `^0.14.0` / `^0.5.0` | `ValidationPipe` DTO 검증. |
| `nestjs-pino` / `pino` / `pino-http` | (4.x / 9.x 계열) | `^4.0.0` / `^9.0.0` | 구조적 stdout 로그(FR-002). |
| `@nestjs/event-emitter` | (3.x 계열) | `^3.0.0` | Nest 11 정합(2.x 는 Nest 10). Stage 1 은 골격만. |
| `jest` / `@nestjs/testing` / `supertest` | — | Nest 11 기본 toolchain | 단위/통합 테스트. |

- JWT `jti` 생성: 별도 `uuid` 의존 없이 Node 20 내장 `node:crypto.randomUUID()` 사용. refresh 해싱은 `node:crypto.createHash('sha256')`. → 신규 의존 최소화.
- 정확한 patch 버전은 `pnpm install` lockfile(`pnpm-lock.yaml`)로 고정한다.

### Prisma multiSchema 동작 검증

| 항목 | 확정 동작 | spec 영향 |
|---|---|---|
| GA 여부 | multiSchema 는 Prisma **6.7.0 에서 GA**. 채택 핀 `^6.19.0` → **`previewFeatures = ["multiSchema"]` flag 불필요**(생략). | plan.md §3 "GA 면 flag 생략" 가정 확정. `generator client { provider = "prisma-client-js" }` 만으로 충분. |
| 다중 스키마 선언 | `datasource db { schemas = ["users","products",...8개] }` + 각 모델 `@@schema("users")` 필요. | FR-004/SC-004 충족(정적). |
| **모델 없는 빈 스키마의 CREATE SCHEMA 생성** | ⚠️ **리스크 확인**: Prisma migrate 의 SQL diff 는 **모델이 매핑된 스키마만** `CREATE SCHEMA IF NOT EXISTS` 를 생성한다. `schemas` 배열에 선언만 되고 `@@schema` 로 참조되지 않는 빈 스키마(products·commerce·orders·payments·settlements·admin·files 7개)는 **자동 생성되지 않을 수 있다.** | **SC-006("8개 스키마가 생성") 위배 위험.** → 안전망 필수(아래). |

> **안전망 설계(SC-006 결정적 충족)**: `prisma migrate dev --create-only` 로 초기 마이그레이션을 생성한 뒤, 생성된 `migration.sql` 에 **8개 스키마 전부**에 대한 `CREATE SCHEMA IF NOT EXISTS "<name>";` 문이 포함되어 있는지 검증한다. Prisma 가 빈 7개 스키마를 누락했다면 해당 `CREATE SCHEMA IF NOT EXISTS` 문을 마이그레이션 SQL **상단에 수동 보강**한 후 `prisma migrate dev` 로 적용한다. 이 방식은 Prisma 버전별 빈-스키마 처리 차이에 무관하게 8개 스키마 생성을 보장한다(`IF NOT EXISTS` 라 Prisma 가 일부를 이미 생성해도 멱등).
> → tasks.md **T-A4** 로 분해. FR-004(테이블 미포함 선언)와 충돌 없음 — `CREATE SCHEMA` 만 추가하며 테이블은 생성하지 않는다.

- `prisma migrate dev` 가 빈 배열 항목에 대해 validation **에러**를 내는지: 현재 Prisma 6.x 는 `schemas` 배열의 미사용 항목을 **에러로 취급하지 않는다**(배열은 "Prisma 가 관리 인지하는 스키마 목록"). 단 위 안전망은 에러 발생 시에도(배열에서 빼고 raw SQL 로 생성하는 fallback) 대응 가능하도록 통합 검증 단계(SC-006)에서 실측한다.

### @nestjs/jwt 토큰 발급·exp 검증

- `JwtService.signAsync(payload, { secret, expiresIn })` → JWT `exp = iat + TTL`. `expiresIn` 은 초(number) 또는 `"15m"`/`"30d"`(zeit/ms 문자열) 허용.
- **단위 혼용 방지(상수화)**: access 는 초 단위 정수 상수 `JWT_ACCESS_TTL_SECONDS = 900` 사용 → `exp - iat === 900`(SC-014 결정적). refresh 는 `JWT_REFRESH_TTL_DAYS = 30` → `expiresIn` 에 초 환산(`30*24*60*60 = 2592000`) 또는 `"30d"`. DB `expiresAt = now + 30d` 동일 상수 파생(SC-017).
- 검증: SC-014(access exp=+900s), SC-017(refresh 만료=+30d) 단위 테스트로 실검증.

### passport-jwt 가드 만료 차단 검증

- `JwtStrategy` 생성자 옵션 기본 `ignoreExpiration: false` → 만료 access 토큰은 검증 실패 → passport 가 `UnauthorizedException`(401) 반환.
- `jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken()` → `Authorization: Bearer <token>` 파싱. 헤더 부재 시 토큰 추출 실패 → 401.
- `secretOrKey = JWT_ACCESS_SECRET` (refresh secret 과 분리) → access 전용 검증.
- 검증: SC-020(토큰 부재 401), SC-021(만료 access 401) 단위 테스트.

### bcrypt 해싱 검증

- `bcrypt.hash(plain, saltRounds)` → salt 내장 단방향 해시(`$2b$<cost>$...`). cost 10~12(ADR-001).
- `bcrypt.compare(plain, hash)` → boolean. 로그인 검증.
- DB `users.password` 에는 해시만 저장(원문 미저장, NFR-005). 검증: SC-011(register 후 DB password 가 해시값).

### refresh token SHA-256 lookup·동시성 분석

**왜 bcrypt 가 아닌 SHA-256 인가(ADR-003)**:
- refresh 검증/logout 은 제출된 **원문으로 DB row 를 조회(lookup)** 해야 한다. bcrypt 는 salt 가 매번 달라 동일 입력→동일 출력이 보장되지 않아 **WHERE 절 동등 비교 조회 불가**.
- SHA-256 은 결정적 해시 → `tokenHash = sha256(원문)` 으로 인덱스 조회 가능.
- refresh token 은 고엔트로피 JWT(서명+`jti` uuid 포함)라 무염 SHA-256 의 brute-force/rainbow 위험이 낮다. 저엔트로피 비밀번호의 bcrypt 와 용도가 구분된다.

**lookup 흐름**:
```
refresh: 원문 → JWT 서명·exp 검증(REFRESH_SECRET) → sha256(원문)=h
         → SELECT * FROM users.refresh_tokens WHERE tokenHash=h AND revoked=false AND expiresAt>now()
         → 존재 시 새 access 발급(200) / 부재 시 401
logout:  원문 → sha256(원문)=h → UPDATE ... SET revoked=true WHERE tokenHash=h
```

**`tokenHash` 인덱스/제약**:
- `tokenHash` 에 **`@unique`** 부여 → (1) lookup 인덱스 제공, (2) `jti`(uuid)로 토큰이 유일하므로 해시 충돌 없이 unique 가능. 동일 사용자가 같은 초에 중복 login 해도 `jti` 가 달라 tokenHash 가 유일(SC-012/017 안정).

**동시성(check-then-act) 분석**:
- 위험 구간: logout(`revoked=true` 쓰기) ↔ refresh(`revoked=false` 읽기 후 access 발급).
- Stage 1 단일 프로세스 + PostgreSQL. race window 는 "refresh 가 revoked=false 를 읽은 직후 logout 이 commit" 인 극히 짧은 구간. 이 경우 refresh 가 1회 성공할 수 있으나:
  - `revoked` 갱신은 **멱등**(여러 번 true 로 설정해도 결과 동일).
  - 영향은 "logout 직전 발급된 access 1개가 최대 15분 유효" 수준으로 위험 낮음(NFR-003 access 수명 내).
- 결정성 강화(권장, tasks 반영): refresh 시 조회+검증을 동일 Prisma 트랜잭션으로 묶거나, `UPDATE ... WHERE revoked=false RETURNING` 조건부 갱신 패턴으로 처리 가능. Stage 1 은 단순 조회+분기로 충족하되, 동시성 강화는 Design 노트로 남긴다(과설계 회피).
- 검증: SC-018(logout 후 refresh→401)은 순차 시나리오라 race 무관하게 PASS.

---

## 인정되는 한계 및 안전망 (PATCH-A07)

| 인정되는 한계 | 안전망 |
|---|---|
| 코드베이스·node_modules 미존재로 라이브러리 동작을 소스 인용 불가(공식 동작 지식 기준). | SC-006/014/017/020/021 등 통합·단위 테스트로 실검증. 핀 버전은 lockfile 고정. |
| Prisma 버전별 빈-스키마 CREATE SCHEMA 처리 차이. | `--create-only` + 마이그레이션 SQL 의 8개 `CREATE SCHEMA IF NOT EXISTS` 검증·수동 보강(T-A4, 멱등). |
| refresh check-then-act 의 극소 race window. | revoked 멱등 + (선택) 트랜잭션/조건부 갱신. SC-018 순차 검증으로 기능 정합 확인. |
| 17개 빈 스텁 클래스의 lint/typecheck 통과. | ESLint `no-extraneous-class` 데코레이터 예외 설정 + tsconfig 미사용 경고 회피(T-C/T-F). |

---

## 배포 환경 영향 추정 (PATCH-A10)

- 본 spec 검증 대상 환경: **로컬/dev(Docker Compose PostgreSQL)** + **GitHub Actions ubuntu-latest**. 실 Fly.io 배포(컨테이너 NAT·docker-proxy·L4 LB)는 범위 외(ASM-001, plan.md "배포 환경 영향").
- 점검 대상 환경 특이성(컨테이너 NAT TCP 흡수, L4 LB half-close, conntrack 만료 등)은 본 spec 의 검증 대상 API(health·auth·migration·docker build)에 직접 영향하지 않음 — 운영 토폴로지 무관한 표준 로컬·CI 환경에서 SC 가 완결.
- infra.md §2~3(Fly.io 토폴로지)·§5(재시도) cross-reference 완료: 본 spec SC 검증에 직접 관여하지 않으며 infra.md 누락 항목 없음 → **gaps 등록 불필요**.

---

## context.md 부정합 사전 점검 (PATCH-A11)

본 spec 의 변경 대상(신규 클래스/필드)과 context.md §2·§4·§5 항목 정합성 점검:

| context.md 항목 | 현재 정의 | 본 spec 변경 후 | 부정합 여부 |
|---|---|---|---|
| §2 핵심 모듈 목록(18개) | 기획 기준(코드 미존재) | 실제 18개 디렉토리·4계층 생성(auth 실구현) | 부정합 아님 — **§6 "코드베이스 미존재" 제약이 본 spec 완료 후 해소**됨(6단계 Docs Agent 갱신 대상). |
| §4 `users` 스키마 테이블 목록 | `users, sellers, addresses, wishlists, product_views, auth_tokens, refresh_tokens` 7개 명시 | Stage 1 은 `users.users`(=`users` 테이블)·`users.refresh_tokens` 2개만 실제 생성 | 부정합 아님 — context.md §4 는 **기획 전체 목록**이고 Stage 1 은 그 부분집합. spec.md 범위 외 표가 나머지 테이블을 Stage 2+ 로 명시. |
| §4 "세션: JWT stateless (Refresh Token은 users.refresh_tokens 테이블로 관리)" | refresh_tokens 테이블 관리 | ADR-003 으로 **SHA-256 해시 저장**(원문 미저장) 구체화 | 부정합 아님 — 저장 형태 구체화일 뿐 "refresh_tokens 테이블 관리" 정의와 일관. 6단계에서 "해시 저장" 세부를 §4 에 보강 권장. |
| §5 용어("모듈"=18개, "스키마"=네임스페이스) | — | 동일하게 사용 | 부정합 없음. |

- 결론: context.md 와 **모순되는 정의 부정합 0건**. 단 §1 버전(v0.0.0)·§6 "코드베이스 미존재" 제약은 본 spec 완료 후 갱신 대상 → 6단계 Docs Agent 가 처리(현 단계 GAP 등록 불요, 정보 제공 목적 기재).

---

## 기술 선택 조사

> plan.md ADR 표(ADR-001~011)와 cross-reference. 본 절은 추가 검토 결과만 기록.

| 결정 | 채택 | 검토했으나 미채택 | 본 단계 추가 근거 |
|---|---|---|---|
| Prisma 핀 메이저 | 6.x(`^6.19.0`) | 7.x(latest 7.8.0) | 7.x 신규 major — 골격 단계 안정성 우선. multiSchema 는 6.7+ GA 라 6.19 로 충분. |
| jti 생성 | `node:crypto.randomUUID()` | `uuid` 패키지 | Node 20 내장 → 의존 최소화(P-002 정신). |
| refresh 해싱 | SHA-256(`node:crypto`) | bcrypt | lookup 결정성(상세 위 절). |
| 빈 스키마 생성 | 마이그레이션 SQL 수동 보강 | 더미 모델 추가 | 더미 모델은 FR-004("테이블 미포함") 위배. SQL `CREATE SCHEMA` 만 보강이 정합. |
| events 골격 형태 | 모듈당 `{m}.events.ts` 파일 | 빈 `events/` 디렉토리(.gitkeep) | git 이 빈 디렉토리 미추적 → 파일로 존재 보장(SC-003 결정적). |

---

## 엣지 케이스 및 한계

- **빈 스텁 클래스 lint**: `@typescript-eslint/no-extraneous-class` 는 멤버 없는 클래스를 경고한다. NestJS 데코레이터(`@Injectable()`/`@Controller()`)가 붙어도 트리거될 수 있어 ESLint 설정에 `no-extraneous-class: ["error", { allowWithDecorator: true }]` 또는 해당 룰 완화가 필요(FR-015 lint job 통과 전제). → T-F(eslint 설정).
- **tsconfig 미사용 경고**: `noUnusedLocals`/`noUnusedParameters` 활성 시 빈 stub 의 미사용 import·파라미터가 typecheck 실패 유발. stub 은 import 없이 최소 골격으로 작성(또는 해당 옵션 범위 조정). → SC-024(typecheck) 전제.
- **ValidationPipe 400**: register/login DTO(`@IsEmail`, `@IsNotEmpty`/`@MinLength`)로 잘못된 입력은 400. 별도 SC 없으나 DTO 검증으로 흡수(범위 내 자명, 신규 SC 미추가 — Spec 책임).
- **CI integration SC 처리**: SC-002/006/007/008/009/011/012/015/018/019/027([env:integration])은 옵션 A(plan.md 확정) — main 이 Docker Compose+migrate+앱 기동 절차 제시→사용자 실행→결과 전달→Test Agent(EXECUTION) 검증. GitHub Actions `test` job 은 [env:unit] 단위 테스트 중심으로 구성(integration 은 Postgres service container 필요 — Stage 1 CI 는 unit+build 까지로 충분, SC-025 는 unit test 실패 차단 검증).
- **Dockerfile prisma generate**: builder 스테이지에서 `prisma generate` 후 `@prisma/client` 산출물을 runtime 스테이지로 복사해야 런타임 동작(ADR-009). docker build(SC-022)는 generate+build 성공까지 검증.
