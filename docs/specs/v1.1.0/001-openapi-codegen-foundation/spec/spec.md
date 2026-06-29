---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (구현 완료 — retroactive 문서화)
---

# Spec: 001-openapi-codegen-foundation

> Branch: 001-openapi-codegen-foundation | Date: 2026-06-29 | Version: v1.1.0
>
> 본 문서는 이미 구현·검증이 완료된 코드(커밋 `678ba1c`, base `6c4ddae`)를 근거로 정식 SDD
> 포맷으로 retroactive 작성되었다. 모든 요구사항·수용 기준은 실제 구현된 백엔드 OpenAPI 생성기
> (`apps/backend/src/openapi.ts`·`nest-cli.json` swagger CLI 플러그인·`openapi:gen` 스크립트)와 프론트
> 코드젠 파이프라인(`packages/shared-types` 의 `openapi-typescript` gen 스크립트·`openapi.gen.ts`·
> `index.ts` 재노출)에서 확인한 사실을 기준으로 한다. v1.1.0 은 프론트엔드 릴리즈 사이클의 첫 차수이며,
> 본 spec 은 그 **Phase 0(공유 기반 — OpenAPI 코드젠)** 에 해당한다(FRONTEND-PLAN.md §4).

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

백엔드 18개 도메인(30테이블) 실구현이 완료된 시점(v1.0.0, 커밋 `6c4ddae`)에서 프론트엔드(판매자·관리자
콘솔 웹 + 고객 Flutter 앱) 구축에 착수한다(FRONTEND-PLAN.md). 그 **선행 필수 단계(Phase 0)** 는 프론트와
백엔드 간 **타입 계약의 SSOT(Single Source of Truth)** 를 확립하는 것이다.

- **기존 한계 (수기 shared-types)**: `packages/shared-types` 는 `auth`·`user`·`product`·`inventory`·
  `seller`(001/002 도메인) 타입만 **수기로** 작성되어 있었고, commerce 이후 11개 도메인(주문·결제·쿠폰·
  배송·정산·리뷰·검색·알림·파일·배너·통계·관리자) 타입이 누락된 상태였다(FRONTEND-PLAN.md §2-2). 백엔드
  DTO 가 변경될 때마다 18개 도메인의 타입을 사람이 수동 동기화해야 하므로, 계약 불일치(drift)·누락·
  유지보수 부담이 구조적으로 누적된다.

001 은 이 공백을 **백엔드가 OpenAPI 문서를 자동 생성하고(`@nestjs/swagger` CLI 플러그인이 빌드 시
DTO 메타데이터를 introspect), 프론트가 그 문서에서 타입을 코드젠(`openapi-typescript`)** 하는 파이프라인으로
해소한다. 계약의 SSOT 가 백엔드 코드(DTO + class-validator + JSDoc)로 단일화되어, 수기 동기화 부담이
제거되고 백엔드 변경이 결정적(deterministic) 재생성으로 프론트에 전파된다.

> 설계 결정(FRONTEND/DESIGN-PLAN 확정): console 먼저 완성 → Flutter, 타입 공유는 OpenAPI 코드젠
> (console=`openapi-typescript`, Flutter=`openapi-generator(dart)` — Phase 5), Flutter 상태관리 Riverpod,
> 웹 파운데이션 Radix+shadcn/ui, 코드-퍼스트 디자인 토큰. 001 은 그중 **백엔드 OpenAPI 노출 + console
> 타입 코드젠** 까지를 범위로 한다.

---

## 사용자 스토리

- **US-001**: 프론트엔드 개발자로서, 백엔드 18개 도메인의 HTTP 계약 타입을 손으로 동기화하지 않고
  백엔드 OpenAPI 문서에서 자동 생성된 타입을 사용하여, 계약 불일치와 누락 없이 console·Flutter 를
  개발하기를 원한다.
- **US-002**: 백엔드 개발자로서, DTO 에 OpenAPI 데코레이터를 일일이 수기로 붙이지 않고 기존
  class-validator 제약과 JSDoc 주석만으로 속성·타입·검증 제약·설명이 OpenAPI 문서에 자동 반영되기를
  원한다.
- **US-003**: 프론트엔드 개발자로서, 백엔드 DTO 가 바뀌면 두 단계(백엔드 `openapi:gen` → 프론트 `gen`)의
  재실행만으로 타입 계약이 결정적으로 갱신되고, 기존 console 화면의 타입체크가 회귀 없이 통과하기를
  원한다.

---

## 기능 요구사항

- **FR-001** (백엔드 OpenAPI 노출): 백엔드가 OpenAPI 3 문서를 생성하여 `apps/backend/openapi.json` 으로
  출력한다. 생성기 `apps/backend/src/openapi.ts` 가 `NestFactory.create(AppModule, { logger: false })` 로
  앱을 (listen 없이) 부팅하고, `DocumentBuilder`(title `DOA Market API`·version `1.0.0`·
  `addBearerAuth({ type:'http', scheme:'bearer', bearerFormat:'JWT' }, 'access-token')`) → 
  `SwaggerModule.createDocument` 로 문서를 만든 뒤 `openapi.json` 에 직렬화하고 `app.close()` 후
  `process.exit` 한다.

- **FR-002** (수기 데코레이터 0 — CLI 플러그인 introspect): `nest-cli.json` 의 `@nestjs/swagger` CLI
  플러그인(`introspectComments: true`, `dtoFileNameSuffix: [".dto.ts", ".entity.ts"]`)이 `nest build`
  컴파일 시 DTO(class-validator + JSDoc 주석)에서 `@ApiProperty` 메타데이터를 자동 주입한다. 개별 DTO 에
  수기 `@ApiProperty` 데코레이터를 추가하지 않는다.

- **FR-003** (빌드 경유 생성 스크립트): `apps/backend/package.json` 에 `openapi:gen` 스크립트
  (`nest build && node dist/openapi.js`)를 추가한다. 플러그인은 컴파일(빌드) 단계에만 동작하므로,
  `ts-node` 직접 실행이 아니라 **빌드 산출물(`dist/openapi.js`)을 실행**하는 방식이어야 메타데이터가 채워진
  문서가 생성된다.

- **FR-004** (프론트 타입 코드젠): `packages/shared-types` 에 `openapi-typescript`(devDep)와 `gen` 스크립트
  (`openapi-typescript ../../apps/backend/openapi.json -o src/openapi.gen.ts`)를 추가한다. 백엔드
  `openapi.json` 에서 `paths`/`components`/`operations` 인터페이스를 담은 `src/openapi.gen.ts` 를 자동
  생성한다.

- **FR-005** (생성 타입 재노출 + 한시 호환): `packages/shared-types/src/index.ts` 가 생성 타입
  (`export type { paths, components, operations } from './openapi.gen'`)을 재노출하고, 스키마 단축 접근
  헬퍼(`Schemas = components['schemas']`, `Schema<K>`)를 제공한다. 기존 수기 타입(001/002 도메인)은
  console 화면 호환을 위해 **한시 유지**하며 생성 타입으로 점진 대체한다.

---

## 비기능 요구사항

- **NFR-001** (수기 데코레이터 0 / 자동 introspect): OpenAPI 스키마는 DTO 의 class-validator 제약
  (`@MinLength(8)`·`@Min(1)`·`@IsEmail` 등)과 JSDoc 주석에서 **자동 도출**되며, 수기 `@ApiProperty`
  데코레이터 추가는 0건이다. 속성·타입·검증 제약(`minLength`·`minimum`·`format: email`)·enum
  (`FIXED`/`PERCENTAGE` 등)·`required`·한글 설명(JSDoc)이 자동으로 채워진다.

- **NFR-002** (재생성 결정성): 생성물(`openapi.json`·`openapi.gen.ts`)은 백엔드 DTO 상태에서 결정적으로
  재생성 가능하다. 백엔드 `pnpm --filter backend openapi:gen` → 프론트 `pnpm --filter @doa/shared-types
  gen` 두 단계가 계약 동기화의 표준 절차다.

- **NFR-003** (console 회귀 0): 본 변경은 기존 console 화면의 타입체크를 깨뜨리지 않는다
  (`pnpm --filter console typecheck` 회귀 0). 수기 타입을 즉시 제거하지 않고 한시 유지하여 점진 전환을
  보장한다(FR-005).

- **NFR-004** (신규 의존성 정당화): 신규 의존성은 `@nestjs/swagger`(백엔드 dependency, `^11.4.4` —
  NestJS 11 호환)와 `openapi-typescript`(shared-types devDependency, `^7.13.0`) 2종이다. 어느 것도
  `@aws-sdk/*` 또는 클라우드 전용 SDK 가 아니며, 계약 생성·코드젠 도구로서 P-002(AWS 의존 금지)에
  저촉되지 않는다.

---

## 수용 기준

> **환경 태그 규약**:
> | 태그 | 의미 |
> |---|---|
> | `[env:build]` | 생성 스크립트 실행(빌드 경유 산출) 성공으로 판정 |
> | `[env:static]` | 정적 코드/생성물 검증(코드 리뷰·grep·산출물 카운트)으로 판정 |
> | `[env:typecheck]` | TypeScript 타입체크(`tsc --noEmit`) 통과로 판정 |

- **SC-001** (`FR-001`·`FR-002` 관련): `pnpm --filter backend openapi:gen` 실행이 성공하여
  `apps/backend/openapi.json`(OpenAPI 3.0.0, title `DOA Market API` v1.0.0)이 생성되며, **70 paths /
  32 component schemas** 를 포함한다. `securitySchemes` 에 `access-token`(http bearer JWT)이 등록된다.
  [env:build]

- **SC-002** (`FR-002`·`NFR-001` 관련): 생성된 component schemas 가 수기 데코레이터 0 으로 속성·타입·
  검증 제약·enum·required·한글 설명을 자동 포함한다 — 예: `RegisterDto`(`email` format:email,
  `password` minLength:8, required [email,password]), `CreateCouponDto`(`type` enum [FIXED,PERCENTAGE],
  `totalQuantity` minimum:1, `discountValue` JSDoc 한글 설명, required [type,discountValue,expiresAt]).
  [env:static]

- **SC-003** (`FR-004`·`FR-005` 관련): `pnpm --filter @doa/shared-types gen` 이 `openapi.json` 에서
  `src/openapi.gen.ts`(paths/components/operations 인터페이스, 3220줄)를 생성하며, `index.ts` 가
  `paths`/`components`/`operations` 와 `Schemas`/`Schema<K>` 헬퍼를 재노출한다. [env:static]

- **SC-004** (`FR-003`·`NFR-002` 관련): `openapi:gen` 이 `nest build && node dist/openapi.js` 로 **빌드를
  경유**하여 실행되며(플러그인이 빌드 단계에만 적용 — `ts-node` 직접 실행 아님), 재실행 시 동일한 70 paths
  문서를 결정적으로 산출한다. [env:build]

- **SC-005** (`NFR-003` 관련): 생성 타입 도입 후 기존 console 화면이 타입체크를 통과한다
  (`pnpm --filter console typecheck` 회귀 0). backend `tsc --noEmit` 0 error. [env:typecheck]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건.
> MoSCoW: Must / Should / Could / Won't

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-001 | FR-001 | NFR-002 | SC-001 | build | Must |
| US-002 | FR-002 | NFR-001 | SC-002 | static | Must |
| US-001 | FR-004 | NFR-002 | SC-003 | static | Must |
| US-001 | FR-005 | NFR-003 | SC-003 | static | Must |
| US-003 | FR-003 | NFR-002 | SC-004 | build | Must |
| US-003 | — | NFR-003 | SC-005 | typecheck | Must |

> 모든 FR(FR-001~005)이 SC 로 대응되며(FR-004·005 는 SC-003 공유), 매핑 누락 0건이다. SC-001·004 는
> 생성 스크립트 실행(빌드 경유)으로, SC-002·003 은 생성물 정적 검증(스키마 속성·gen 줄수·재노출)으로,
> SC-005 는 타입체크로 판정된다. 본 차수는 인프라/코드젠 성격이라 별도 단위 테스트 스위트가 없으며,
> 검증은 **생성 성공 + 타입체크**로 갈음한다(plan.md 테스트 전략·NFR-001~003 참조). NFR-004(신규 의존성
> 정당화)는 P-002 Gates 충족 근거로 plan.md 에 기록되며 별도 SC 없음(도입 사실은 SC-001 의 생성 성공으로
> 간접 검증).

---

## 범위 외

- **`@doa/api-client` 의 생성 타입 전면 전환**: `packages/api-client` 를 생성 타입 기반으로 재작성하고
  18개 도메인 메서드를 정비하는 작업은 Phase 0 후속(별도 차수)이다. 001 은 `shared-types` 의 타입 생성·
  재노출까지만 다루며, api-client 메서드 전환은 포함하지 않는다(FRONTEND-PLAN.md §0-2 후속).
- **수기 타입 제거**: `index.ts` 의 수기 타입(001/002 도메인)은 console 호환을 위해 한시 유지한다. 생성
  타입으로의 완전 대체·수기 타입 삭제는 본 차수 범위 외(점진 전환).
- **Flutter `openapi-generator(dart)` 클라이언트**: 고객 앱(`mobile/customer_app`)의 dart 클라이언트
  생성은 Phase 5 범위다(FRONTEND-PLAN.md §6).
- **디자인 시스템(`packages/design-tokens`·`@doa/ui` shadcn 전환·Storybook)**: DESIGN-PLAN Phase 0 후속
  작업이며 본 spec(타입 계약 코드젠)과 별개다.
- **response 스키마(응답 DTO) 보강**: 현재 component schemas 32종은 전부 **입력(request) DTO**
  (`*Dto` 31 + `OrderItemInput`)이며, 응답 본문은 대부분 타입 미주석이다(87 operations 중 typed 2xx
  content 36건). 응답 스키마 보강은 본 차수 범위 외(coverage-gap.md·gaps.md GAP-001-01).
- **생성물 CI 재생성 검증 자동화**: `openapi.json`·`openapi.gen.ts` 가 최신 DTO 와 일치하는지 CI 에서
  자동 검증(재생성 후 diff 0 확인)하는 파이프라인은 범위 외(gaps.md GAP-001-01).

---

## 미결 사항

없음 — 본 spec 은 구현 완료 코드를 기준으로 retroactive 작성되었으며, 모든 요구사항·수용 기준이 실제
구현(생성기·플러그인·스크립트·코드젠·재노출)과 대조 확인되었다. 응답 스키마 보강·api-client 전환·생성물
CI 검증은 Low 등급 잔여 권고로 남기되(GAP-001-01), 수기 shared-types 동기화 부담 제거(Phase 0 핵심
목표)는 70 paths/32 schemas 자동 생성 + console typecheck 회귀 0 으로 달성되었다.
