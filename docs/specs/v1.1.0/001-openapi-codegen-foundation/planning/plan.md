---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (retroactive)
---

# Plan: 001-openapi-codegen-foundation

> Branch: 001-openapi-codegen-foundation | Date: 2026-06-29 | Spec: [../spec/spec.md](../spec/spec.md)

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [사전 영향도 분석 결과](#사전-영향도-분석-결과)
- [핵심 설계](#핵심-설계)
- [결정 기록 (ADRs)](#결정-기록-adrs)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [보안 노트](#보안-노트)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> `constitution.md`(P-001~P-007) 존재 → 해당 조항을 Gates 로 사용한다(constitution 우선). spec.md NFR
> (NFR-001~004)은 P-006 테스트·P-002 외부 의존을 구체화하며 충돌(완화) 없음. 본 차수의 핵심 검토 조항은
> **P-002(신규 의존 도입 정당화)** 와 **P-007(스펙 범위)** 이다.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: 다른 도메인 모듈의 스키마 테이블을 직접 참조·쿼리하지 않음]
  → PASS. `openapi.ts` 는 **빌드 타임 문서 생성기**로 `AppModule` 을 listen 없이 부팅하여 라우트·DTO
  메타데이터만 추출한다. DB 접근·교차 쿼리 0(NestFactory 부팅 후 즉시 `createDocument` → `app.close`).
  모듈 4계층 구조·경계 변경 없음.
- [x] **P-002 AWS 의존 금지 원칙**: [Pass 기준: `@aws-sdk/*` 및 AWS 전용 SDK 신규 추가 0건]
  → PASS(직접 검토 조항). 신규 의존 2종 = `@nestjs/swagger ^11.4.4`(백엔드 dependency)·`openapi-typescript
  ^7.13.0`(shared-types devDependency). **어느 것도 AWS/Fly.io 전용 SDK 가 아니며**, OpenAPI 문서 생성·
  TS 코드젠을 위한 표준 도구다. P-002 의 금지 목록(Cognito·SQS·DynamoDB·CloudWatch 등)과 무관(NFR-004).
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 외부 저장소 0건]
  → PASS. 신규 데이터 저장소·캐시·큐 0건. DB 스키마 변경 0(마이그레이션 없음). 생성물은 정적 파일
  (`openapi.json`·`openapi.gen.ts`).
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: Fly.io 전용 API 결합 0건]
  → PASS. 표준 NestJS·Node 도구만 사용. 플랫폼 전용 API 0. 생성기는 배포·런타임이 아닌 빌드 보조 도구.
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: 금전 상태 변경 outbox·멱등성·Decimal]
  → PASS(무관). 본 차수는 타입 계약 생성·코드젠이며 결제·정산 상태 변경 로직을 포함하지 않는다. 금전
  수치 연산 0(생성 타입에서 Decimal 은 문자열로 직렬화 — 계약 표현일 뿐 연산 아님).
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건]
  → PASS. FR-001·002→SC-001·002, FR-003→SC-004, FR-004·005→SC-003, NFR-003→SC-005. 인프라/코드젠
  성격상 단위 테스트 스위트는 없으며 검증은 **생성 성공 + 정적 생성물 검증 + 타입체크**로 갈음한다
  (모든 FR 이 SC 로 대응 — P-006 충족). 기존 backend/console 테스트 커버리지 저하 0(NFR-003).
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건]
  → PASS(직접 검토 조항). 변경 범위 = `nest-cli.json`(플러그인)·`apps/backend/src/openapi.ts`(신규
  생성기)·`apps/backend/package.json`(스크립트·의존)·생성물 `openapi.json`·`shared-types/package.json`
  (의존·스크립트)·`shared-types/src/index.ts`(재노출)·생성물 `openapi.gen.ts`. 전부 FR-001~005 추적
  가능. **api-client 전환·수기 타입 제거·response 스키마 보강은 범위 외**로 분리(별도 차수).

> **예외 사항**: 없음. P-001~P-007 전부 통과(예외 0건). 신규 의존 2종은 P-002 의 AWS 금지와 무관함을
> NFR-004 로 명시 정당화.

> **Gates 판정**: P-001~P-007 전부 통과(예외 0건). 선택 단계는 Database Design=N·Deploy=N·Security=N·
> Performance=N(selection-phases.md). Design Agent(3단계) → Development(4) + Test AUTHORING(5a) 진입 가능.

---

## 기술 컨텍스트

> v1.0.0(백엔드) 확정 스택을 재확정. 001 고유 변경만 명시.

- **언어 / 런타임**: TypeScript 5.x / Node.js ≥20. pnpm `9.0.0` + Turborepo. 모노레포
  (apps/backend·apps/console·packages/*).
- **백엔드 프레임워크**: NestJS 11.x. `@nestjs/swagger ^11.4.4`(NestJS 11 호환) 신규 추가.
- **OpenAPI 생성**: `nest-cli.json` 의 `@nestjs/swagger` CLI 플러그인(`introspectComments:true`,
  `dtoFileNameSuffix:[".dto.ts",".entity.ts"]`)이 `nest build` 컴파일 시 DTO → `@ApiProperty` 메타데이터
  자동 주입. `src/openapi.ts` 가 `DocumentBuilder`·`SwaggerModule.createDocument` 로 OpenAPI 3.0.0 문서
  생성 → `openapi.json`.
- **프론트 코드젠**: `packages/shared-types` 에 `openapi-typescript ^7.13.0`(devDep). `gen` 스크립트가
  `openapi.json` → `src/openapi.gen.ts`(paths/components/operations interface).
- **테스트 프레임워크**: 본 차수 별도 단위 테스트 없음(인프라/코드젠). 검증 = 생성 스크립트 실행 성공
  ([env:build]) + 생성물 정적 검증([env:static]) + `tsc --noEmit`([env:typecheck], backend·console).
- **환경변수**: 신규 0. **신규 의존성**: 2건(`@nestjs/swagger` dep, `openapi-typescript` devDep).

---

## 사전 영향도 분석 결과

> 상세는 [../design/research.md](../design/research.md) 참조. 본 절은 영향 파일 요약.

### 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 | 레이어 |
|---|---|---|---|
| `apps/backend/nest-cli.json` | 수정 | `@nestjs/swagger` CLI 플러그인(`introspectComments`·`dtoFileNameSuffix`) 추가 | A(빌드 설정) |
| `apps/backend/src/openapi.ts` | 신규 | OpenAPI 문서 생성기(AppModule 부팅 → DocumentBuilder → createDocument → openapi.json) | B(생성기) |
| `apps/backend/package.json` | 수정 | `openapi:gen` 스크립트 + `@nestjs/swagger ^11.4.4` 의존 | A |
| `apps/backend/openapi.json` | 신규(생성물) | OpenAPI 3.0.0 문서(70 paths·32 schemas) — 생성물(레포 커밋, CI 재생성 가능) | 산출물 |
| `packages/shared-types/package.json` | 수정 | `openapi-typescript ^7.13.0`(devDep) + `gen` 스크립트 | A |
| `packages/shared-types/src/index.ts` | 수정 | `paths`/`components`/`operations` 재노출 + `Schemas`/`Schema<K>` 헬퍼(수기 타입 한시 유지) | C(재노출) |
| `packages/shared-types/src/openapi.gen.ts` | 신규(생성물) | 자동 생성 타입(3220줄) — 생성물 | 산출물 |

> `apps/console/**`·`apps/backend/src/modules/**`(DTO 본문)·`packages/api-client/**` 변경 0건. DTO 에
> 수기 `@ApiProperty` 추가 0(플러그인 introspect — NFR-001). console 화면 코드 불변(생성 타입은 한시
> 미사용, 수기 타입 유지로 회귀 0 — NFR-003).

---

## 핵심 설계

### 1. 백엔드 OpenAPI 생성기 (FR-001 — openapi.json 산출)

```ts
// apps/backend/src/openapi.ts
async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });   // listen 없이 부팅
  const config = new DocumentBuilder()
    .setTitle('DOA Market API')
    .setDescription('DOA Market 백엔드 HTTP 계약 (프론트 코드젠 SSOT).')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  writeFileSync(resolve(__dirname, '..', 'openapi.json'), JSON.stringify(document, null, 2));
  await app.close();
}
generate().then(() => process.exit(0)).catch(() => process.exit(1));
```

- 앱을 listen 없이 부팅하여 라우트·DTO 메타데이터만 추출 → `createDocument` → `openapi.json` 직렬화 →
  `app.close()` + `exit`. 콘솔에 출력 경로·paths 수를 로그.

### 2. CLI 플러그인 introspect (FR-002·NFR-001 — 수기 데코레이터 0)

```json
// apps/backend/nest-cli.json (compilerOptions.plugins)
{ "name": "@nestjs/swagger",
  "options": { "introspectComments": true, "dtoFileNameSuffix": [".dto.ts", ".entity.ts"] } }
```

- `nest build` 컴파일 시 플러그인이 `*.dto.ts`/`*.entity.ts` 의 class-validator 데코레이터
  (`@MinLength`·`@Min`·`@IsEmail`·`@IsEnum` 등)와 JSDoc 주석을 읽어 `@ApiProperty` 메타데이터를 자동
  주입한다. 결과적으로 component schemas 의 속성·타입·검증 제약·enum·required·한글 설명이 **수기
  데코레이터 0** 으로 채워진다.

### 3. 빌드 경유 생성 스크립트 (FR-003·SC-004)

```jsonc
// apps/backend/package.json scripts
"openapi:gen": "nest build && node dist/openapi.js"
```

- 플러그인은 **빌드 컴파일 단계에만** 동작하므로 `ts-node` 직접 실행 시 메타데이터가 비어 빈 스키마가
  산출된다. 반드시 `nest build`(플러그인 적용 컴파일) → `node dist/openapi.js`(빌드 산출물 실행) 순으로
  실행해야 한다.

### 4. 프론트 타입 코드젠 + 재노출 (FR-004·005)

```jsonc
// packages/shared-types/package.json
"gen": "openapi-typescript ../../apps/backend/openapi.json -o src/openapi.gen.ts"
```

```ts
// packages/shared-types/src/index.ts
export type { paths, components, operations } from './openapi.gen';
import type { components as _components } from './openapi.gen';
export type Schemas = _components['schemas'];                 // Schemas['CreateProductDto']
export type Schema<K extends keyof _components['schemas']> = _components['schemas'][K];
// + 수기 타입(001/002 도메인: LoginRequest·UserProfile·Product 등) 한시 유지
```

- `openapi-typescript` 가 `openapi.json` → `openapi.gen.ts`(paths/components/operations interface) 생성.
  `index.ts` 가 생성 타입을 재노출하고 스키마 단축 헬퍼를 제공. 수기 타입은 console 호환 위해 유지하며
  생성 타입으로 점진 대체(FR-005).

### 5. 재생성 동기화 절차 (NFR-002)

```
백엔드 DTO 변경
   ↓ pnpm --filter backend openapi:gen        (nest build → node dist/openapi.js → openapi.json)
   ↓ pnpm --filter @doa/shared-types gen       (openapi.json → openapi.gen.ts)
프론트 타입 갱신(결정적)
```

---

## 결정 기록 (ADRs)

| ADR-ID | 결정 항목 | 채택안 | 대안(검토했으나 미채택) | 근거(spec FR/NFR) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | 타입 공유 방식 | 백엔드 OpenAPI → 프론트 코드젠 | 수기 shared-types 유지·보강 | FR-001·004, 배경(18도메인 동기화 부담) | backend·shared-types |
| ADR-002 | 메타데이터 주입 | `@nestjs/swagger` CLI 플러그인 introspect | DTO 마다 수기 `@ApiProperty` | FR-002, NFR-001(수기 데코레이터 0) | nest-cli.json |
| ADR-003 | 생성기 실행 방식 | `nest build && node dist/openapi.js`(빌드 경유) | `ts-node src/openapi.ts` 직접 실행 | FR-003, SC-004(플러그인 빌드 단계 한정) | package.json·openapi.ts |
| ADR-004 | 프론트 코드젠 도구 | `openapi-typescript ^7.13` | 수기 변환 / 타 코드젠 | FR-004(결정적 TS interface 생성) | shared-types |
| ADR-005 | 수기 타입 처리 | 한시 유지·점진 대체(생성 타입 재노출 병행) | 즉시 제거·전면 전환 | FR-005, NFR-003(console 회귀 0) | shared-types/index.ts |
| ADR-006 | 생성물 레포 관리 | `openapi.json`·`openapi.gen.ts` 레포 커밋(CI 재생성 가능, `dist/` gitignore) | gitignore(매 빌드 재생성) | NFR-002(편의·diff 추적, 생성물 CI 검증은 후속 GAP-001-01) | 산출물 |

---

## 인터페이스 계약

### 001 신규 인터페이스 (계약 SSOT)

```ts
// 백엔드 산출 OpenAPI (apps/backend/openapi.json) — OpenAPI 3.0.0
// info: { title: 'DOA Market API', version: '1.0.0' }
// paths: 70개 / components.schemas: 32개(입력 DTO) / securitySchemes: { 'access-token': http bearer JWT }

// 프론트 생성 타입 (packages/shared-types/src/openapi.gen.ts)
export interface paths { /* 70 path operations */ }
export interface components { schemas: { RegisterDto: ...; CreateCouponDto: ...; /* 32종 */ } }
export interface operations { /* operationId 별 req/res */ }

// 재노출 (packages/shared-types/src/index.ts)
export type { paths, components, operations };
export type Schemas = components['schemas'];
export type Schema<K extends keyof Schemas> = Schemas[K];
```

### 하위 호환성 / 방어 코드

- **수기 타입 한시 유지(비파괴)**: `index.ts` 가 생성 타입을 **추가**로 재노출하되 기존 수기 타입
  (`LoginRequest`·`AuthTokens`·`UserProfile`·`Product`·`Category` 등 001/002 도메인)을 그대로 export 한다.
  기존 console 화면은 수기 타입을 계속 참조하므로 타입체크 회귀 0(NFR-003·SC-005).
- **생성기 부팅 격리**: `openapi.ts` 는 `NestFactory.create(..., { logger: false })` 로 부팅하여 listen·
  HTTP 바인딩 없이 메타데이터만 추출하고 `app.close()` 한다. 런타임 서버 동작에 영향 0.
- **빌드 경유 강제**: `openapi:gen` 이 `nest build` 를 선행하지 않으면(또는 ts-node 직접 실행 시) 빈 스키마
  산출. 절차 위반 방지를 위해 스크립트로 양 단계를 고정(ADR-003).

---

## 데이터 모델

DB 스키마 변경 없음(마이그레이션 0). 신규 테이블·컬럼·enum·인덱스·제약 0건. 본 차수의 "데이터"는
런타임 데이터가 아닌 **계약 생성물**(`openapi.json`·`openapi.gen.ts`)이며, component schemas 32종은 백엔드
입력 DTO(`*Dto` 31 + `OrderItemInput`)의 OpenAPI 표현이다. Database Design Agent 비활성
(selection-phases.md).

---

## 테스트 전략

### SC↔검증 매핑 (요약)

| SC 식별자 | 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | build | 생성 성공 | openapi:gen 실행 → 문서 산출 | `pnpm --filter backend openapi:gen` | openapi.json: 70 paths·32 schemas·title `DOA Market API` v1.0.0·`access-token` scheme |
| SC-002 | static | 스키마 검증 | 수기 데코레이터 0 자동 속성 | openapi.json component schemas | RegisterDto(email format/password minLength:8/required)·CreateCouponDto(enum FIXED·PERCENTAGE/minimum:1/한글 desc) |
| SC-003 | static | 생성물 검증 | 프론트 코드젠·재노출 | `pnpm --filter @doa/shared-types gen` | openapi.gen.ts 3220줄(paths/components/operations)·index.ts Schemas/Schema 재노출 |
| SC-004 | build | 결정성 | 빌드 경유 결정적 재생성 | openapi:gen 재실행 | nest build → node dist/openapi.js → 동일 70 paths(ts-node 직접 실행 아님) |
| SC-005 | typecheck | 회귀 0 | console·backend 타입체크 | `pnpm --filter console typecheck` / backend `tsc --noEmit` | EXIT 0(회귀 0) |

### smoke_tests

- 필요 여부: N(별도 부팅 스모크 불필요). 본 차수는 인프라/코드젠으로, 검증은 **생성 스크립트 실행 성공
  (openapi:gen 70 paths 출력) + 생성물 정적 검증(스키마 속성·gen 줄수·재노출) + 타입체크(console·backend
  tsc 0)** 로 갈음한다. 별도 단위 테스트 스위트는 작성하지 않으며(생성물 자체가 결정적 산출), 기존
  backend/console 테스트는 회귀 0 으로 유지된다.

---

## 보안 노트

> Security Agent: N(selection-phases.md). 본 절로 보안 영향 분석을 갈음한다.

- **노출 표면**: 본 차수는 **빌드 타임 문서 생성**이며 런타임에 새 HTTP 엔드포인트를 노출하지 않는다
  (`openapi.ts` 는 listen 없이 부팅 후 즉시 종료). 개발용 Swagger UI(`/api-docs`) 라우트는 본 차수에서
  앱에 마운트하지 않는다(생성기만 추가).
- **인증 스킴 문서화**: OpenAPI 문서에 `addBearerAuth({ type:'http', scheme:'bearer', bearerFormat:'JWT'
  }, 'access-token')` 으로 JWT bearer 스킴을 **선언**한다. 이는 기존 백엔드 JwtAuthGuard 계약의 문서화일
  뿐 인증 로직을 변경하지 않는다.
- **민감정보 노출**: 생성물(`openapi.json`·`openapi.gen.ts`)은 DTO 의 **형태(shape)·검증 제약·설명**만
  포함하며 비밀키·토큰·실제 데이터를 담지 않는다. 레포 커밋 대상에 민감정보 노출 0(확인). `dist/` 는
  gitignore.
- **결론**: OWASP Top 10 관점의 신규 공격 표면 없음 — 인증·인가·입력 검증·접근 제어 표면을 변경하지
  않으며 클라이언트 입력 처리 경로를 추가하지 않는다. 보안 감사 대상 부재.

---

## 기타 고려사항

- **플러그인 빌드 경유 필수(핵심 함정)**: `@nestjs/swagger` CLI 플러그인은 TypeScript 컴파일(`nest build`)
  단계에서 메타데이터를 주입한다. 따라서 `ts-node src/openapi.ts` 직접 실행은 플러그인 미적용으로 **빈
  스키마**(속성 0)를 산출한다. `openapi:gen = nest build && node dist/openapi.js` 가 이를 강제한다
  (ADR-003·SC-004). 향후 생성 절차를 변경할 때 반드시 빌드 경유를 유지해야 한다.
- **response 스키마 미주석(현황)**: component schemas 32종은 전부 입력(request) DTO 다. 87 operations 중
  typed 2xx response content 는 36건이며, 응답 본문은 대부분 타입 미주석이다(컨트롤러가 엔티티를 반환하나
  `@ApiResponse({ type })` 미부여). 응답 스키마 보강은 범위 외(GAP-001-01).
- **생성물 drift 위험**: 백엔드 DTO 변경 후 `openapi:gen` → `gen` 양 단계를 재실행하지 않으면 생성물이
  최신 DTO 와 불일치한다. 현재 CI 자동 재생성·diff 검증이 없어 사람이 절차를 지켜야 한다(NFR-002 한계 —
  GAP-001-01, 후속 CI 자동화 권고).
- **api-client 전환·수기 타입 제거 후속**: 001 은 타입 생성·재노출까지만 다룬다. `@doa/api-client` 의
  생성 타입 전환·18도메인 메서드 정비와 수기 타입 완전 제거는 Phase 0 후속 차수(범위 외 — spec.md
  범위 외 참조).
