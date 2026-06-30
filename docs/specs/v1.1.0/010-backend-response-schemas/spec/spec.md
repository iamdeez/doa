---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 03:37
상태: 확정 (retroactive)
---

# Spec: 010-backend-response-schemas

## 목차

- [배경 및 목적](#배경-및-목적)
- [사용자 스토리](#사용자-스토리)
- [기능 요구사항](#기능-요구사항-fr)
- [비기능 요구사항](#비기능-요구사항-nfr)
- [수용 기준](#수용-기준-sc)
- [범위 외](#범위-외)
- [구조화 매트릭스](#구조화-매트릭스)

> Branch: 010-backend-response-schemas | Date: 2026-06-30 | Version: v1.1.0
>
> **역문서화 주의**: 이 문서는 이미 구현·커밋된 코드(a3fc463→1fe3489)를 기준으로 작성하였다.
> 설계 결정은 코드에서 추출한 사실 기반이며, 미래 계획이 아닌 과거 구현을 기술한다.

---

## 배경 및 목적

GAP-001-01(OpenAPI 응답 스키마 0건 — `@ApiResponse` type 미정의)에서 도출된 작업이다.
컨트롤러가 Prisma 엔티티를 직접 반환하면서 `@ApiOkResponse` 어노테이션이 없어
OpenAPI 사양서의 `responses[200].content` 가 빈 상태였다.

이로 인해 `pnpm --filter @doa/shared-types gen` (openapi-typescript)이 생성하는
`packages/shared-types/src/openapi.gen.ts` 의 2xx 응답 타입이 전량 `unknown` 이 되어
프론트엔드 타입 안전성을 제공하지 못했다.

본 스펙은 **런타임 변경 없이** 문서 전용 응답 DTO(`*-response.dto.ts`) 를 도입하고
각 컨트롤러에 `@ApiOkResponse({ type })` 어노테이션을 부착함으로써 OpenAPI 응답 스키마를
보강한다. 컨트롤러는 여전히 Prisma 엔티티를 반환하며, DTO 클래스는 스키마 생성 목적으로만
존재한다.

---

## 사용자 스토리

- **US-001**: 프론트엔드 개발자로서, 백엔드 API 응답 타입을 `openapi.gen.ts` 에서 안전하게
  참조하여 `unknown` 없이 도메인 객체를 다루고 싶다.
- **US-002**: API 소비자(앱·외부 파트너)로서, Swagger UI 에서 각 엔드포인트의 응답 스키마를
  확인하여 페이로드 구조를 파악하고 싶다.

---

## 기능 요구사항 (FR)

- **FR-001**: 14개 도메인(admin, auth, banner, cart, coupon, notification, order, product,
  review, seller, settlement, shipping, stats, user)에 대해 각각 `*-response.dto.ts` 파일을
  신규 생성하고 `@ApiProperty` 어노테이션을 부착한 응답 DTO 클래스를 정의한다.
- **FR-002**: 응답 DTO 클래스를 해당 도메인 컨트롤러(14개)의 각 라우트에
  `@ApiOkResponse({ type })` 또는 `@ApiOkResponse({ type: [DTO] })` 로 부착한다.
- **FR-003**: 금전 필드(가격·합계·할인액 등)는 Prisma `Decimal` → JSON 직렬화 시 문자열이
  되므로 DTO에서 `@ApiProperty({ type: String })` 으로 선언한다 (P-005 원칙).
- **FR-004**: 크로스 스키마 plain String 필드(userId, sellerId 등 외래 모듈 엔티티 ID)는
  `@ApiProperty({ description: 'cross-schema plain String — … (P-001)' })` 으로 기재한다.
- **FR-005**: `apps/backend/package.json` 의 `openapi:gen` 스크립트에 `NODE_ENV=production`
  을 추가하여 pino-pretty 초기화로 인한 silent exit 버그를 수정한다.
- **FR-006**: 코드 생성 파이프라인을 실행하여 `apps/backend/openapi.json` 과
  `packages/shared-types/src/openapi.gen.ts` 를 갱신한다.
- **FR-007**: 찜·최근 본 상품 엔드포인트는 `productId` 만 반환하는 현재 구현을 DTO로
  표현하되 상품 상세 summary join 은 하지 않는다 (P-001 경계 — user→product 모듈 의존 금지).

---

## 비기능 요구사항 (NFR)

- **NFR-001**: 런타임 동작 변경 없음 — 컨트롤러는 여전히 Prisma 엔티티를 반환하며
  DTO 클래스는 OpenAPI 스키마 생성에만 사용된다.
- **NFR-002**: 기존 백엔드 테스트 261개 전량 PASS 유지(회귀 없음).
- **NFR-003**: `openapi.json` 컴포넌트 스키마 수가 증가하되 모든 신규 스키마는
  `*Response` 네이밍 컨벤션을 따른다.
- **NFR-004**: 금전 필드 타입 표기는 P-005 원칙을 코드베이스 전체에서 일관되게 적용한다.
- **NFR-005**: 프론트엔드 codegen(`openapi-typescript`)이 오류 없이 실행되어야 한다.

---

## 수용 기준 (SC)

- **SC-001** (`FR-001` 관련): 14개 도메인의 `*-response.dto.ts` 파일이 각각 신규 생성되어
  있으며, 각 파일에 `@ApiProperty` 어노테이션이 부착된 1개 이상의 DTO 클래스가 존재한다.
- **SC-002** (`FR-002` 관련): `git diff a3fc463 1fe3489 -- apps/backend/src/**/*.controller.ts`
  에서 `@ApiOkResponse` 추가 변경이 확인된다.
- **SC-003** (`FR-003` 관련): 금전 필드가 있는 DTO에서 해당 필드가 모두
  `@ApiProperty({ type: String, … })` 으로 선언되어 있다.
- **SC-004** (`FR-005` 관련): `apps/backend/package.json` 의 `openapi:gen` 스크립트에
  `NODE_ENV=production` 이 포함되어 있다.
- **SC-005** (`FR-006` 관련): `apps/backend/openapi.json` 의 `components.schemas` 수가
  32(base)에서 73(final)으로 증가하였다.
- **SC-006** (`FR-006` 관련): OpenAPI 전체 89개 오퍼레이션 중 2xx 응답에 content가 정의된
  오퍼레이션이 38(base)에서 62(final)로 증가하였다.
- **SC-007** (`FR-006` 관련): `packages/shared-types/src/openapi.gen.ts` 가 신규/변경 스키마를
  반영하여 갱신되었다.
- **SC-008** (`NFR-002` 관련): `pnpm --filter backend test` 실행 결과 261개 테스트 전량 PASS.
- **SC-009** (`FR-007` 관련): 찜(`/user/wishlist`) · 최근 본 상품(`/user/recent-views`) 응답
  DTO 는 `productId: string` 만 포함하고 상품 상세 필드가 없다.

---

## 범위 외

- **Void(204) 응답 보강**: 로그아웃·삭제 등 204 No Content 응답은 스키마 대상이 아니다.
- **SettlementWithItems items 필드 완전 모델링**: `createSettlement` 응답의 `items` 배열을
  DTO로 완전히 표현하는 것은 별도 스펙으로 이월한다(GAP-010-01).
- **런타임 직렬화 변환**: Prisma 엔티티 → DTO 변환(class-transformer 등)은 이 스펙에서
  다루지 않는다.
- **페이지네이션 공통 제네릭 DTO**: 도메인별 Paginaton 응답을 공통 제네릭으로 통합하는
  리팩토링은 이 스펙 범위 외다.

---

## 구조화 매트릭스

| FR | SC | NFR | 비고 |
|---|---|---|---|
| FR-001 | SC-001 | NFR-001 | 14개 DTO 파일 신규 생성 |
| FR-002 | SC-002 | NFR-001 | 14개 컨트롤러 어노테이션 부착 |
| FR-003 | SC-003 | NFR-004 | P-005 금전 필드 string 타입 |
| FR-004 | — | — | cross-schema P-001 description 표기 |
| FR-005 | SC-004 | — | openapi:gen bug fix |
| FR-006 | SC-005, SC-006, SC-007 | NFR-003, NFR-005 | 코드 생성 파이프라인 실행 |
| FR-007 | SC-009 | NFR-001 | P-001 경계 — wishlist/recent-views |
| — | SC-008 | NFR-002 | 회귀 검증 |
