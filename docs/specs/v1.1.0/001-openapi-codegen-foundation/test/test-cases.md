---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (retroactive)
---

# Test Cases: 001-openapi-codegen-foundation

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
- [케이스 상세](#케이스-상세)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류)](#미커버-항목-사전-분류)

---

## SC × 시나리오 매트릭스

> 본 차수는 인프라/코드젠으로 **단위 테스트 it() 를 추가하지 않는다**. 검증은 생성 스크립트 실행
> ([env:build]) + 생성물 정적 카운트/조회([env:static]) + 타입체크([env:typecheck])로 SC 를 판정한다.
> 생성물 수치는 추측하지 않고 직접 카운트한다.

| SC-ID | 수용 기준 | Happy Path | Edge Case | 검증 대상 | env 태그 |
|---|---|---|---|---|---|
| SC-001 | openapi.json 70 paths/32 schemas 생성 | openapi:gen 실행 → 문서 산출·카운트 | — | apps/backend/openapi.json | [env:build] |
| SC-002 | 스키마 속성·검증·enum·desc 자동(수기 데코레이터 0) | RegisterDto·CreateCouponDto 속성 조회 | — | openapi.json component schemas | [env:static] |
| SC-003 | openapi.gen.ts 3220줄·재노출 | gen 실행 → wc -l + index.ts 재노출 grep | — | shared-types openapi.gen.ts·index.ts | [env:static] |
| SC-004 | 빌드 경유 결정적 재생성 | openapi:gen 재실행 → 동일 70 paths | ts-node 직접 실행 시 빈 스키마 | package.json openapi:gen | [env:build] |
| SC-005 | console·backend typecheck 회귀 0 | tsc --noEmit EXIT 0 | — | console·backend | [env:typecheck] |

---

## 케이스 상세

### SC-001 (openapi:gen 생성 성공 — 카운트)

- 입력: `pnpm --filter backend openapi:gen`(= `nest build && node dist/openapi.js`).
- 확인 사실:
  - `openapi`: `3.0.0`
  - `info.title` / `info.version`: `DOA Market API` / `1.0.0`
  - `Object.keys(paths).length` = **70**
  - `Object.keys(components.schemas).length` = **32**
  - `components.securitySchemes` 키 = `access-token`(type http·scheme bearer·bearerFormat JWT)
- 검증 방법: `node -e "const d=require('./apps/backend/openapi.json'); ..."` 직접 카운트.

### SC-002 (스키마 속성 자동 — 수기 데코레이터 0)

- 검증 방법: `openapi.json` component schemas 직접 조회.
- 확인 사실:
  - `RegisterDto`: `{ email: { type:string, format:email }, password: { type:string, minLength:8 },
    required:[email,password] }`.
  - `CreateCouponDto`: `type` `{ enum:[FIXED,PERCENTAGE], type:string }`, `totalQuantity` `{ type:number,
    minimum:1 }`, `discountValue` `{ type:string, description:"정액(원) 또는 비율(1~100, 정수). Decimal
    문자열로 전달" }`, `required:[type,discountValue,expiresAt]`.
  - 위 속성·검증 제약(`format`·`minLength`·`minimum`)·enum·required·한글 설명이 **DTO 의 class-validator +
    JSDoc 에서 자동 도출**되며 수기 `@ApiProperty` 데코레이터는 0 이다(NFR-001).

### SC-003 (프론트 코드젠·재노출)

- 입력: `pnpm --filter @doa/shared-types gen`(= `openapi-typescript ../../apps/backend/openapi.json -o
  src/openapi.gen.ts`).
- 확인 사실:
  - `wc -l src/openapi.gen.ts` = **3220**(paths/components/operations interface).
  - `index.ts`: `export type { paths, components, operations } from './openapi.gen'` +
    `export type Schemas = _components['schemas']` + `export type Schema<K ...> = _components['schemas'][K]`.
  - 기존 수기 타입(`LoginRequest`·`UserProfile`·`Product`·`Category` 등 001/002 도메인)도 export 유지
    (점진 대체 — NFR-003).

### SC-004 (빌드 경유 결정성)

- 검증 방법: `apps/backend/package.json` `openapi:gen` = `nest build && node dist/openapi.js` 코드 리뷰 +
  재실행.
- 확인 사실: 플러그인은 빌드 컴파일 단계에만 적용되므로 `ts-node` 직접 실행은 빈 스키마를 산출한다. 빌드
  경유(`nest build` → `node dist/openapi.js`)로 메타데이터가 채워진 70 paths 문서가 결정적으로 재생성된다.

### SC-005 (타입체크 회귀 0)

- 입력: `pnpm --filter console typecheck`(= `tsc --noEmit`) / backend `tsc --noEmit`.
- 확인 사실: 생성 타입 도입(재노출) 후에도 기존 console 화면(수기 타입 의존)이 타입체크 통과 — EXIT 0.
  수기 타입을 즉시 제거하지 않아 회귀 0(NFR-003). backend `tsc --noEmit` 0 error.

---

## 외부 의존성 명시

### 도구 / 스크립트

- `@nestjs/swagger ^11.4.4`(백엔드): `nest build` 시 플러그인 introspect + `openapi.ts` 의 `DocumentBuilder`·
  `SwaggerModule`.
- `openapi-typescript ^7.13.0`(shared-types devDep): `openapi.json` → `openapi.gen.ts` 코드젠.

### 환경 변수

- 별도 환경 변수 불필요. `openapi.ts` 는 `NestFactory.create(..., { logger: false })` 로 부팅하며 DB·
  네트워크 listen 없이 메타데이터만 추출 후 종료.

### 외부 서비스

- 없음. 생성기는 listen 없이 부팅 → `createDocument` → `app.close`. DB 연결·HTTP 바인딩 없음. 검증은
  정적 생성물 카운트/조회 + 타입체크(테스트 서버 기동 아님).

---

## 미커버 항목 (사전 분류)

| 항목 | 미커버 사유 | 카테고리 | 권장 검증 방법 |
|---|---|---|---|
| response 스키마(응답 DTO) 보강 | component schemas 32종이 전부 입력 DTO 이며 응답 본문 대부분 타입 미주석(87 ops 중 typed 2xx content 36). 응답 스키마 자동 코드젠 미완 | (3) 기능 미구현(범위 외) | 컨트롤러 응답 DTO 정의 + `@ApiResponse({ type })` 후속 보강 |
| 생성물 CI 재생성 검증 자동화 | 백엔드 DTO 변경 후 재생성 누락 시 생성물 drift. CI 자동 재생성·diff 0 검증 부재 | (2) 설계(운영 자동화 한계) | CI 에서 openapi:gen → gen 재실행 후 git diff 0 검증 |
| api-client 생성 타입 전환 | shared-types 생성·재노출까지만 — api-client 18도메인 메서드 정비는 후속 차수 | (3) 기능 미구현(범위 외) | Phase 0 후속 차수에서 api-client typed 메서드 전환 |
