---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-30 01:06
상태: 확정 (retroactive)
---

# Research: 004-seller-order-shipping

## 목차

- [분석 우선순위 게이트 결과](#분석-우선순위-게이트-결과)
- [기존 코드베이스 분석](#기존-코드베이스-분석)
  - [console 판매자 영역 현황 (004 이전)](#console-판매자-영역-현황-004-이전)
  - [백엔드 주문·배송 라우트 계약](#백엔드-주문배송-라우트-계약)
- [응답 타입 처리 — 타입드 client vs facade+view 타입](#응답-타입-처리--타입드-client-vs-facadeview-타입)
- [상태별 조치 매핑](#상태별-조치-매핑)
- [목록 렌더 — Table 프리미티브 vs TanStack Table](#목록-렌더--table-프리미티브-vs-tanstack-table)
- [ship 페이지 재진입 갭 분석](#ship-페이지-재진입-갭-분석)
- [생성물·구조 검증 (직접 확인)](#생성물구조-검증-직접-확인)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 분석 우선순위 게이트 결과

- **변경 대상(plan §핵심 설계)**: console 화면 2개(`seller/orders/page.tsx`·`seller/orders/[id]/ship/
  page.tsx`)·`lib/order.ts`·`layout.tsx`·`api-client/index.ts`(facade)·`shared-types/index.ts`(view 타입)·
  `ui/table.tsx`+`index.ts`(프리미티브). 백엔드·DB **변경 없음**(기존 라우트 소비).
- §A·B·C 분석은 위 8파일로 한정.
- §D(다단계 병렬 파이프라인): 미해당.
- §E(동일 가드 결정 통합): 미해당.
- 외부 라이브러리 검증(§4): **신규 라이브러리 0건**(기존 TanStack Query·`@doa/ui`·`@doa/api-client`·
  `@doa/shared-types` 만 사용).
- §F(production 시그니처 변경): **부분 해당** — `createApiClient` 반환에 `order`·`shipping` facade **추가**
  (기존 facade·console 화면 불변 — 호출 측 영향 0). `@doa/ui` `index.ts` 에 Table 6종 export 추가(기존
  export 불변).

---

## 기존 코드베이스 분석

> context.md 의 모노레포·공유 패키지 구조를 기준선. 본 절은 변경 대상 한정 정밀 분석.

### console 판매자 영역 현황 (004 이전)

- **구조**: console 판매자 영역(`(dashboard)/seller/`)에 상품 관리(`/seller/products`)만 존재. 주문·배송
  화면 부재. AppShell(`(dashboard)/layout.tsx`)의 `NAV` 판매자 섹션에 "내 상품"만 등록.
- **공유 패키지**: 003 이 `@doa/api-client` 에 도메인 facade(auth·user·seller·catalog·inventory) + 타입드
  client + `http`(저수준)를 제공. `order`·`shipping` facade 는 부재. `@doa/shared-types` 에 주문·배송 view
  타입 부재. `@doa/ui` 에 Table 프리미티브 부재(Badge·Button·Card·Input·PageHeader·feedback 군은 002 존재).

### 백엔드 주문·배송 라우트 계약

- 백엔드는 이미 5개 라우트를 제공한다(엔드포인트 경로는 글로벌 프리픽스 없음 — 003 facade 컨벤션 동일):
  `GET /seller/orders`(판매자 본인 주문 목록, items 미포함)·`POST /seller/orders/:id/confirm`(confirmed→
  preparing)·`POST /shipments`(CreateShipmentDto: orderId·carrier·trackingNumber → preparing→shipped,
  Shipment 반환)·`PATCH /shipments/:id/status`(UpdateShipmentStatusDto: status enum preparing/shipped/
  in_transit/delivered·description? → delivered 시 주문 delivered)·`GET /shipments/:id/tracking`(권한 3축).
- **응답 스키마 미정의**: 위 라우트의 응답은 컨트롤러가 Prisma 엔티티를 반환하며 OpenAPI 응답 content 가
  미주석이다(001 coverage-gap — 87 ops 중 typed 2xx content 36건). 따라서 003 의 타입드 client 는 이
  라우트들의 response 타입이 비어 본 화면에서 이점이 적다.

---

## 응답 타입 처리 — 타입드 client vs facade+view 타입

| 항목 | 003 타입드 client(`api.client.GET`) | facade + view 타입(004 채택) |
|---|---|---|
| 요청(params·body) 타입 | 생성 타입에서 자동 | view 타입 수기(`CreateShipmentRequest` 등) |
| 응답 타입 | **비어 있음**(백엔드 응답 미정의 — 001 coverage-gap) | **전이형 view 타입**(`SellerOrder`·`Shipment` — 금전 string) |
| 금전 표기 | (응답 타입 부재로 미보장) | view 타입 금전 필드 `string`(Decimal→문자열, `formatKRW`) |
| 호출 형태 | `api.client.GET('/seller/orders', ...)` | `api.order.listSeller()`(facade) |
| 한시성 | — | 백엔드 응답 DTO 보강 후 생성 타입 대체 |

> 채택: facade + view 타입(ADR-001·002). 주문·배송 응답이 OpenAPI 미정의(Prisma 엔티티 반환)여서 타입드
> client 의 응답 타입이 비어 있다. `@doa/shared-types` 에 전이형 view 타입(금전 Decimal→문자열)을 정의하고
> `api.http` 기반 도메인 facade(`api.order`·`api.shipping`)로 호출하여 화면에서 응답 타입 안전성을 확보한다.
> 백엔드 응답 DTO + `@ApiResponse({ type })` 보강 후 코드젠 재생성하면 view 타입을 생성 타입(`Schemas['...']`)
> 으로 대체할 수 있다(GAP-004-01 / 001 GAP-001-01 연속).

---

## 상태별 조치 매핑

- **문제**: 주문 상태(7종)별로 판매자가 취할 조치가 다르다(확인 / 송장 등록 / 배송 관리 / 없음).
- **해결(채택)**: `OrderAction`(page.tsx) 상태 머신으로 분기한다.

| 주문 상태 | 라벨(`ORDER_STATUS_LABEL`) | 조치 | 동작 |
|---|---|---|---|
| `confirmed` | 결제완료 | "주문 확인" 버튼 | `confirm` mutation(`POST /seller/orders/:id/confirm`) → confirmed→preparing, invalidate |
| `preparing` | 상품준비 | "송장 등록" 링크 | `/seller/orders/[id]/ship` 이동 |
| `shipped` | 배송중 | "배송 관리" 링크 | 동일 ship 페이지 이동 |
| `delivered` | 배송완료 | "배송 관리" 링크 | 동일 ship 페이지 이동 |
| `pending`·`completed`·`cancelled` | 결제대기·구매확정·취소 | "—" | 조치 없음 |

- 배송 상태(`ShipmentStatus` — preparing/shipped/in_transit/delivered)는 `SHIPMENT_STATUS_LABEL`(준비/발송/
  배송중/배송완료)로 ship 페이지에서 매핑한다.

---

## 목록 렌더 — Table 프리미티브 vs TanStack Table

| 항목 | 경량 Table 프리미티브(004 채택) | DataTable(TanStack Table) |
|---|---|---|
| 정렬·필터 | 없음(Phase 1 미요구) | 제공 |
| 의존성 | 0(시맨틱 토큰 마크업) | `@tanstack/react-table` 추가 |
| 컴포넌트 | `Table`·`THead`·`TBody`·`TR`·`TH`·`TD`(6종, 시맨틱 토큰) | 헤더/셀/정렬 모델 |
| 확장 경로 | 주석 명시("정렬·필터가 필요해지면 TanStack Table 로 확장") | — |

> 채택: 경량 Table 프리미티브(ADR-003). Phase 1 주문 목록은 정렬·필터가 미요구이므로 `@doa/ui` 에 시맨틱
> 토큰 기반 경량 Table 프리미티브 6종을 추가한다(신규 의존 0). 정렬·필터·서버 페이지네이션이 필요해지면
> TanStack Table 기반 DataTable 로 확장한다(Phase 2 — 범위 외, `table.tsx` 주석 명시).

---

## ship 페이지 재진입 갭 분석

- **문제**: 송장 등록 후 ship 페이지를 떠났다가 재진입하면, 그 주문에 이미 등록된 송장의 id 를 알아야 상태
  변경·추적을 이어갈 수 있다. 그러나 백엔드에 **주문→송장 조회 엔드포인트**(`GET /shipments?orderId` 또는
  주문 응답에 shipment 포함)가 부재하다(BE-GAP).
- **해결(현 구현)**: 송장 등록 직후 `create` mutation 의 `onSuccess(s)` 에서 생성된 `Shipment` 를 세션
  state(`useState`)에 보관하고, 이후 상태 변경(`updateStatus`)·추적(`tracking`, `enabled: !!shipment`)이
  세션 state 의 shipment id 로 동작한다(**세션 내 완결**). 재진입 시에는 기존 shipment 를 복구할 수 없으며,
  이미 발송된 주문에 재등록을 시도하면 백엔드가 400(주문이 preparing 아님)으로 거부한다.
- **추가 BE-GAP**: 판매자용 단건 주문 상세 조회 엔드포인트도 부재하다(`GET /orders/:id` 는 구매자 스코프).
  따라서 ship 페이지는 주문 상세(items 등)를 직접 가져오지 못하고 `useParams` 의 orderId 만 사용한다.
- 두 BE-GAP 은 gaps.md GAP-004-01 로 기록하며 백엔드 후속 차수에 위임한다(Low~Medium).

---

## 생성물·구조 검증 (직접 확인)

> 변경 구조는 추측하지 않고 실제 파일·diff 를 직접 확인하여 확정했다(자가 보고 신뢰하지 않음).

| 대상 | 측정 | 값 | 측정 방법 |
|---|---|---|---|
| `ship/page.tsx` | 신규 라인 | +173 / -0 | `git diff --numstat 0db61b9 8bba04d` |
| `orders/page.tsx` | 신규 라인 | +140 / -0 | 동일 |
| `shared-types/index.ts` | 변경 | +61 / -0 | 동일(view 타입 7종) |
| `lib/order.ts` | 신규 | +37 / -0 | 동일(라벨·톤·formatKRW) |
| `ui/table.tsx` | 신규 | +35 / -0 | 동일(Table 프리미티브 6종) |
| `api-client/index.ts` | 변경 | +23 / -0 | 동일(order·shipping facade) |
| `layout.tsx` | 변경 | +11 / -10 | 동일(네비 추가 + zinc→시맨틱 토큰) |
| `ui/index.ts` | 변경 | +1 / -0 | 동일(Table 재노출) |
| 합계 | 8 files | +481 / -10 | `git diff --numstat 0db61b9 8bba04d -- packages apps/console` |

- view 타입(직접 확인 — `shared-types/index.ts` L250~309): `OrderStatus`(7값)·`SellerOrder`(금전 `string`)·
  `ShipmentStatus`(4값)·`Shipment`·`ShipmentTracking`·`CreateShipmentRequest`·`UpdateShipmentStatusRequest`.
  주석에 "백엔드 응답이 OpenAPI 에 미정의(Prisma 엔티티 반환)이므로 전이형 view 타입으로 한시 정의" 명시.
- facade(직접 확인 — `api-client/index.ts` L138~154): `order.{listSeller,confirm}`·`shipping.{create,
  updateStatus,tracking}` — `http.get/post/patch` 기반, view 타입 응답 제네릭.

---

## 엣지 케이스 및 한계

- **응답 타입 백엔드 의존(view 타입 한시성)**: 주문·배송 응답은 OpenAPI 미정의(Prisma 엔티티)여서 전이형
  view 타입으로 한시 정의했다. 백엔드 응답 DTO 보강 후 생성 타입 대체 예정(GAP-004-01 — 001 GAP-001-01 연속).
- **ship 재진입 복구 불가(BE-GAP)**: 주문→송장 조회 엔드포인트 부재로 재진입 시 기존 shipment 복구 불가
  (세션 내 완결). 판매자 단건 주문 상세 엔드포인트도 부재(`GET /orders/:id` 는 구매자 스코프). GAP-004-01.
- **서버 페이지네이션 미적용**: 주문 목록은 `GET /seller/orders` 전체 배열을 렌더한다. 커서/오프셋 서버
  페이지네이션은 Phase 2 후속(범위 외).
- **rhf+zod·낙관적 업데이트 미적용**: 송장 등록 폼은 제어 컴포넌트 + 빈 값 비활성화 수준이며, mutation 은
  서버 응답 후 setState/invalidate 방식이다(낙관적 업데이트 미적용). Phase 2 후속.
- **e2e 부재**: 본 차수는 UI 화면이나 별도 e2e/단위 테스트가 없다. 검증은 console typecheck/build + 정적
  구조 리뷰로 갈음(GAP-004-01).

가정-실제 불일치 현재 미발견(변경 구조·diff·view 타입·facade 를 실제 파일/numstat 직접 확인).
</content>
