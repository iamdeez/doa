---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-30 01:06
상태: 확정 (구현 완료 — retroactive 문서화)
---

# Spec: 004-seller-order-shipping

> Branch: 004-seller-order-shipping | Date: 2026-06-30 | Version: v1.1.0
>
> 본 문서는 이미 구현·검증이 완료된 코드(커밋 `8bba04d`, base `0db61b9`)를 근거로 정식 SDD 포맷으로
> retroactive 작성되었다. 모든 요구사항·수용 기준은 실제 구현된 console 화면(`seller/orders/page.tsx`·
> `seller/orders/[id]/ship/page.tsx`)·`lib/order.ts`·`@doa/api-client`(order·shipping facade)·
> `@doa/shared-types`(view 타입)·`@doa/ui`(Table 프리미티브)·AppShell `layout.tsx` 에서 확인한 사실을
> 기준으로 한다. **FRONTEND-PLAN.md Phase 1(판매자 화면)의 주문·배송 이행**을 구현하며, 002(디자인 시스템)·
> 003(api-client) 위에 첫 도메인 화면을 올린다.

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

001(생성 타입 SSOT)·002(디자인 시스템 토대)·003(타입드 api-client)이 v1.1.0 프론트엔드 사이클의 **공유
기반(Phase 0)** 을 완성했다. 그러나 그 시점까지 console 에는 판매자가 **주문을 이행(fulfill)** 할 화면 —
결제 완료 주문 확인, 송장 등록(발송), 배송 상태 전이, 추적 이력 조회 — 이 **부재** 했다. 판매자는 백엔드
주문·배송 API(`/seller/orders`·`/shipments`)를 호출할 UI 가 없어 주문 이행을 수행할 수 없었다.

- **기존 한계 (판매자 주문 이행 화면 부재)**: console 의 판매자 영역에는 상품 관리(`/seller/products`)만
  존재하고 주문·배송 화면이 없었다. 결제가 완료된 주문(`confirmed`)을 판매자가 확인하고, 송장을 등록해
  발송 처리하며, 배송 상태를 전이시키는 흐름 전체가 UI 로 노출되지 않았다.

- **백엔드 계약은 존재(소비 측 공백)**: 백엔드는 이미 판매자 주문 목록(`GET /seller/orders`)·주문 확인
  (`POST /seller/orders/:id/confirm`)·송장 생성(`POST /shipments`)·배송 상태 변경(`PATCH /shipments/:id/
  status`)·추적 이력(`GET /shipments/:id/tracking`) 5개 라우트를 제공한다. 다만 이 엔드포인트들의 **응답
  스키마가 OpenAPI 에 미정의**(컨트롤러가 Prisma 엔티티 반환 — 001 coverage-gap)여서, 003 의 타입드
  client(`api.client.GET`)는 응답 타입이 비어 본 화면에서 이점이 적다.

004 는 이 공백을 (1) console 판매자 영역에 **주문 목록 화면**(`/seller/orders` — Table·상태 Badge·결제금액·
주문일 + 상태별 조치)과 **송장·배송 화면**(`/seller/orders/[id]/ship` — 송장 등록 폼·배송 상태 전이·추적
이력)을 추가하고, (2) 응답 미정의 엔드포인트를 `@doa/shared-types` 의 **전이형 view 타입**(`SellerOrder`·
`Shipment`·`ShipmentTracking` 등 — 금전 Decimal→문자열)으로 정의하여 `api.http` 기반 도메인 facade
(`api.order`·`api.shipping`)로 호출하며, (3) 002 의 `@doa/ui` 시맨틱 토큰 컴포넌트와 TanStack Query
(useQuery/useMutation/invalidate)로 화면을 구성하는 방식으로 해소한다.

> 설계 결정(FRONTEND-PLAN 연속): Phase 0(001~003 공유 기반) 위에 Phase 1 첫 도메인 화면을 올린다. 본 차수는
> 응답 스키마가 미정의인 주문·배송 도메인이므로, 타입드 client 대신 view 타입 + facade 를 채택한다(요청 측은
> 정확, 응답은 한시 view 타입). rhf+zod 폼·낙관적 업데이트·서버 페이지네이션·DataTable 정렬/필터는 Phase 2
> 후속(범위 외).

---

## 사용자 스토리

- **US-001**: 판매자로서, 결제가 완료된 내 주문 목록을 상태·결제금액·주문일과 함께 한눈에 보고 각 주문의
  현재 단계에 맞는 조치(주문 확인 / 송장 등록 / 배송 관리)를 바로 취하기를 원한다.
- **US-002**: 판매자로서, 결제완료(`confirmed`) 주문을 "주문 확인" 하여 상품 준비 단계로 전이시키기를 원한다.
- **US-003**: 판매자로서, 준비 중인 주문에 택배사·운송장 번호로 송장을 등록하여 발송 처리하고, 이후 배송중·
  배송완료로 상태를 전이시키기를 원한다.
- **US-004**: 판매자로서, 등록한 송장의 배송 추적 이력(상태 전이 기록)을 시간순으로 조회하기를 원한다.

---

## 기능 요구사항

- **FR-001** (판매자 주문 목록): `/seller/orders`(`page.tsx`)가 `GET /seller/orders`(`api.order.listSeller`)로
  판매자 본인 주문 목록을 조회하여 Table(`@doa/ui` Table·THead·TBody·TR·TH·TD)로 렌더한다. 컬럼은 주문 ID
  (앞 12자 + `…`)·상태 Badge·결제금액(우측 정렬)·주문일·조치다. `useQuery`(`['seller','orders']`)로 조회하며
  로딩(`Loading`)·에러(`ErrorText`)·빈 목록(`EmptyState`) 상태를 분기한다.

- **FR-002** (상태 라벨·톤 매핑): 주문 상태(`OrderStatus` — pending/confirmed/preparing/shipped/delivered/
  completed/cancelled)를 `ORDER_STATUS_LABEL`(한글 라벨)·`ORDER_STATUS_TONE`(Badge tone)으로 매핑하여
  표시한다. 배송 상태(`ShipmentStatus` — preparing/shipped/in_transit/delivered)는 `SHIPMENT_STATUS_LABEL`
  로 매핑한다(`lib/order.ts`).

- **FR-003** (상태별 조치 분기): 목록의 각 주문은 상태에 따라 조치를 분기한다(`OrderAction`). `confirmed` →
  "주문 확인" 버튼(`api.order.confirm` mutation — `POST /seller/orders/:id/confirm`, `confirmed→preparing`),
  `preparing` → "송장 등록" 링크(`/seller/orders/[id]/ship`), `shipped`/`delivered` → "배송 관리" 링크(동일
  ship 페이지), 그 외(pending/completed/cancelled) → "—". 주문 확인 성공 시 `invalidateQueries`로 목록을
  갱신한다.

- **FR-004** (송장 등록 → 발송): `/seller/orders/[id]/ship`(`ship/page.tsx`)가 택배사(`carrier`)·운송장 번호
  (`trackingNumber`) 입력 폼(`Input`)으로 `POST /shipments`(`api.shipping.create` — `CreateShipmentRequest`:
  orderId·carrier·trackingNumber)를 호출하여 송장을 등록하고 주문을 발송(`preparing→shipped`) 처리한다.
  생성된 `Shipment` 를 컴포넌트 세션 state(`useState`)에 보관한다.

- **FR-005** (배송 상태 전이): 송장 등록 후 "배송중 처리"(`updateStatus('in_transit')`)·"배송완료 처리"
  (`updateStatus('delivered')`)로 `PATCH /shipments/:id/status`(`api.shipping.updateStatus` —
  `UpdateShipmentStatusRequest`: status enum·description?)를 호출하여 배송 상태를 전이시킨다. `delivered`
  전이 시 백엔드가 주문도 `delivered` 로 전이한다. 이미 `delivered` 인 송장은 상태 변경 버튼을 비활성화한다.

- **FR-006** (배송 추적 이력 조회): 송장이 존재하면(`enabled: !!shipment`) `GET /shipments/:id/tracking`
  (`api.shipping.tracking`)으로 추적 이력(`ShipmentTracking[]`)을 조회하여 상태·설명·발생 시각을 시간순
  목록으로 렌더한다. 이력이 없으면 안내 문구를 표시한다.

- **FR-007** (네비게이션 추가): AppShell(`(dashboard)/layout.tsx`)의 판매자 섹션 네비게이션에 "주문·배송"
  (`/seller/orders`) 항목을 추가한다. 판매자(`isSeller`)에게만 노출된다.

- **FR-008** (응답 view 타입 정의): 응답 스키마가 OpenAPI 에 미정의인 주문·배송 엔드포인트를 위해
  `@doa/shared-types` 에 전이형 view 타입(`OrderStatus`·`SellerOrder`·`ShipmentStatus`·`Shipment`·
  `ShipmentTracking`·`CreateShipmentRequest`·`UpdateShipmentStatusRequest`)을 정의한다. 금전 필드
  (`totalAmount`·`discountAmount`)는 Decimal→JSON 직렬화상 **문자열**이다.

- **FR-009** (도메인 facade 추가): `@doa/api-client` 의 `createApiClient` 반환에 `order`(listSeller·confirm)·
  `shipping`(create·updateStatus·tracking) facade 를 추가한다. `api.http`(저수준 HttpClient) 기반이며 view
  타입을 응답 제네릭으로 사용한다.

- **FR-010** (Table 프리미티브 추가): `@doa/ui` 에 경량 Table 프리미티브(`Table`·`THead`·`TBody`·`TR`·`TH`·
  `TD` — 시맨틱 토큰)를 추가하고 `index.ts` 에서 재노출한다. 정렬·필터가 필요해지면 TanStack Table 로 확장
  (주석 명시).

---

## 비기능 요구사항

- **NFR-001** (금전 Decimal 문자열 표기): 결제금액은 Decimal→JSON 직렬화상 문자열로 전달되며,
  `formatKRW(amount: string)`(`lib/order.ts`)이 부동소수점 연산 없이 `Number().toLocaleString('ko-KR')`로
  원화 표기한다. view 타입의 금전 필드는 `string` 으로 정의된다(부동소수점 금지 — P-005 정합성).

- **NFR-002** (시맨틱 토큰 일관): 본 화면은 `@doa/ui` 시맨틱 토큰 컴포넌트(Table·Badge·Button asChild·Card·
  Input·PageHeader·EmptyState·Loading·ErrorText)만 사용하며 하드코딩 팔레트(`zinc-*` 등)를 사용하지 않는다.
  AppShell `layout.tsx` 의 잔여 zinc 토큰을 시맨틱 토큰(`border-border`·`bg-surface`·`text-muted-foreground`
  ·`bg-accent`·`text-on-accent` 등)으로 전환한다(잔여 zinc 0).

- **NFR-003** (권한 — 판매자 스코프): 본 화면은 판매자 전용이다. 목록 화면은 `isSeller` 가 아니면 안내
  (`EmptyState`)를, ship 화면은 `ErrorText`("판매자 전용 화면입니다.")를 표시한다. 실제 권한 강제는 백엔드
  (판매자 스코프 라우트·권한 3축)가 담당하며 UI 는 표시 분기만 수행한다.

- **NFR-004** (접근성·상태 분기): 로딩·에러·빈 상태를 명시적으로 분기하여 표시한다. 에러는 `ApiError`
  instanceof 검사로 메시지를 노출하고, 처리 중 버튼은 비활성화(`disabled`)·라벨 전환("처리 중…"·"등록 중…")
  한다.

- **NFR-005** (하위 호환 — console 회귀 0): 본 변경은 기존 console 화면의 타입체크·빌드를 깨뜨리지 않는다
  (`console typecheck` 0, `console build` 14 라우트 PASS). 신규 화면 2개 추가(`/seller/orders` ○ 정적,
  `/seller/orders/[id]/ship` ƒ 동적), 기존 화면 회귀 0.

---

## 수용 기준

> **환경 태그 규약**:
> | 태그 | 의미 |
> |---|---|
> | `[env:static]` | 정적 코드/구조 검증(코드 리뷰·grep·분기 로직 확인)으로 판정 |
> | `[env:typecheck]` | TypeScript 타입체크(`console typecheck`) 통과로 판정 |
> | `[env:build]` | 빌드 산출(`console build` 라우트 컴파일) 성공으로 판정 |

- **SC-001** (`FR-001`·`FR-002` 관련): `/seller/orders` 가 `api.order.listSeller()`로 주문 목록을 조회하여
  Table 로 렌더하고, 상태가 `ORDER_STATUS_LABEL`·`ORDER_STATUS_TONE`(Badge), 결제금액이 `formatKRW`로
  표시된다. 로딩·에러·빈 목록 분기가 존재한다. console build 에서 `/seller/orders` 라우트가 컴파일된다.
  [env:typecheck] [env:build]

- **SC-002** (`FR-003` 관련): `OrderAction` 이 주문 상태별로 조치를 분기한다 — `confirmed`→주문 확인
  버튼(confirm mutation)·`preparing`→송장 등록 링크·`shipped`/`delivered`→배송 관리 링크·그 외→"—".
  confirm mutation 성공 시 `['seller','orders']` 쿼리를 invalidate 한다. [env:static]

- **SC-003** (`FR-004`·`FR-005`·`FR-006` 관련): ship 페이지가 (1) `api.shipping.create`로 송장 등록(발송),
  (2) 생성 `Shipment` 를 세션 state 보관, (3) `api.shipping.updateStatus`로 in_transit·delivered 전이,
  (4) `api.shipping.tracking`(`enabled: !!shipment`)으로 추적 이력 조회를 수행한다. `delivered` 송장은 상태
  변경 버튼이 비활성화된다. console build 에서 `/seller/orders/[id]/ship` 가 동적 라우트(ƒ)로 컴파일된다.
  [env:typecheck] [env:build]

- **SC-004** (`FR-008`·`FR-009` 관련): `@doa/shared-types` 에 주문·배송 view 타입 7종이 정의되고(금전 필드
  `string`), `@doa/api-client` 의 `createApiClient` 반환에 `order`(listSeller·confirm)·`shipping`(create·
  updateStatus·tracking) facade 가 추가된다(view 타입을 응답 제네릭으로 사용). [env:static] [env:typecheck]

- **SC-005** (`FR-007`·`FR-010`·`NFR-002`·`NFR-005` 관련): AppShell 네비에 "주문·배송"(`/seller/orders`)이
  판매자 한정 추가되고 `layout.tsx` 잔여 zinc 토큰이 시맨틱 토큰으로 전환된다(잔여 zinc 0). `@doa/ui` 에
  Table 프리미티브가 추가·재노출된다. `console typecheck` 0 error·`console build` 14 라우트 PASS(기존 화면
  회귀 0). [env:static] [env:typecheck] [env:build]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건.
> MoSCoW: Must / Should / Could / Won't

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-001 | FR-001·FR-002 | NFR-001·NFR-004 | SC-001 | typecheck/build | Must |
| US-002 | FR-003 | NFR-004 | SC-002 | static | Must |
| US-003·US-004 | FR-004·FR-005·FR-006 | NFR-003·NFR-004 | SC-003 | typecheck/build | Must |
| US-001 | FR-008·FR-009 | NFR-001 | SC-004 | static/typecheck | Must |
| US-001 | FR-007·FR-010 | NFR-002·NFR-005 | SC-005 | static/typecheck/build | Must |

> 모든 FR(FR-001~010)이 SC 로 대응된다(FR-001·002→SC-001, FR-003→SC-002, FR-004·005·006→SC-003,
> FR-008·009→SC-004, FR-007·010→SC-005). 매핑 누락 0건. SC-001·003·005 는 타입체크/빌드(+정적)로,
> SC-002·004 는 정적 구조 검증(상태별 조치 분기·view 타입·facade)으로 판정한다. 본 차수는 UI 화면이나
> 별도 e2e/단위 테스트 스위트가 없으며, 검증은 **빌드/타입체크 + 정적 구조 검증**으로 갈음한다(plan.md
> 테스트 전략·NFR-005 참조).

---

## 범위 외

- **rhf+zod 폼 검증**: 송장 등록 폼은 제어 컴포넌트(`useState` + `disabled` 분기)이며 react-hook-form +
  zod 스키마 검증을 사용하지 않는다(Phase 2 후속). 현재 검증은 빈 값 비활성화(`!carrier || !trackingNumber`)
  수준이다.
- **낙관적 업데이트(optimistic update)**: confirm·updateStatus mutation 은 서버 응답 후 invalidate/setState
  하는 방식이며 낙관적 업데이트를 적용하지 않는다(Phase 2 후속).
- **서버 페이지네이션**: 주문 목록은 `GET /seller/orders` 의 **전체 배열**을 한 번에 렌더한다. 커서/오프셋
  서버 페이지네이션은 범위 외다(Phase 2 후속).
- **DataTable(TanStack Table) 정렬/필터**: 목록은 경량 Table 프리미티브로 렌더하며 정렬·필터·컬럼 토글은
  제공하지 않는다(TanStack Table 확장은 Phase 2 — Table 프리미티브 주석에 명시).
- **주문 상세(items) 표시**: `GET /seller/orders` 는 items 미포함이며, 판매자용 단건 주문 상세 조회 화면은
  본 차수에 없다(백엔드 BE-GAP — 판매자 스코프 단건 주문 엔드포인트 부재. gaps.md GAP-004-01).
- **ship 페이지 기존 송장 복구**: ship 페이지는 송장 등록 직후 세션 state 의 shipment 로 상태 변경·추적이
  동작한다(세션 내 완결). 이미 발송된 주문에 재진입 시 기존 shipment id 를 복구하는 흐름은 없다(백엔드
  BE-GAP — 주문→송장 조회 엔드포인트 부재. gaps.md GAP-004-01).

---

## 미결 사항

없음 — 본 spec 은 구현 완료 코드를 기준으로 retroactive 작성되었으며, 모든 요구사항·수용 기준이 실제 구현
(orders 목록·ship 송장/배송/추적·view 타입·order/shipping facade·Table 프리미티브·AppShell 네비)과 대조
확인되었다. rhf+zod·낙관적 업데이트·서버 페이지네이션·DataTable·판매자 주문 상세는 범위 외(Phase 2 / 백엔드
BE-GAP 의존)로 분리하되, Phase 1 핵심 목표 — 판매자 주문 확인·송장 등록(발송)·배송 상태 전이·추적 조회 화면
제공 — 은 console typecheck 0·build 14 라우트 PASS 로 달성되었다. 백엔드 BE-GAP 2건(판매자 주문 상세·주문→
송장 조회)은 gaps.md GAP-004-01 로 기록한다.
</content>
</invoke>
