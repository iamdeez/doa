---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-30 01:06
상태: 확정 (retroactive)
---

# Spec Input: 004-seller-order-shipping

> 수집 일시: 2026-06-30 | 맥락: 003(타입드 api-client) 다음 단계 = FRONTEND-PLAN Phase 1 판매자 주문·배송
> 화면 → 정식 SDD 문서화. 사용자 지시: "Phase 1 판매자 주문·배송 진행".

## 목차

- [수집 진행 상태](#수집-진행-상태)
- [원 요청 맥락](#원-요청-맥락)
- [질문 분석 근거](#질문-분석-근거-question-analysis-basis)
- [카테고리별 수집 내용](#카테고리별-수집-내용)

## 수집 진행 상태

| 카테고리 | 상태 | 답변 완료 항목 |
|---|---|---|
| 1. 배경 및 목적 | 완료 | [Q1, Q2, Q3] |
| 2. 사용자 & 이해관계자 | 완료 | [Q4] |
| 3. 핵심 기능 | 완료 | [Q-A~G] |
| 4. 데이터 & 입출력 | 완료 | [Q-H] |
| 5. 제약조건 | 완료 | [Q5] |
| 6. 예외 & 실패 시나리오 | 완료 | [Q6] |

## 원 요청 맥락

사용자 지시: **003(api-client 전환) 다음 단계 = FRONTEND-PLAN Phase 1 판매자 주문·배송 화면**. 001~003 이
공유 기반(생성 타입·디자인 시스템·타입드 api-client)을 완성했으나 console 에는 판매자가 주문을 이행할
화면(주문 확인·송장 등록·배송 전이·추적)이 없었다. 004 는 판매자 주문 목록 화면(`/seller/orders`)과 송장·
배송 화면(`/seller/orders/[id]/ship`)을 추가하고, 응답 스키마가 OpenAPI 에 미정의인 주문·배송 엔드포인트를
전이형 view 타입 + 도메인 facade 로 호출하며, 002 의 `@doa/ui` 시맨틱 토큰 + TanStack Query 로 구성한다.
본 문서는 그 구현(커밋 `8bba04d`)을 정식 SDD 포맷으로 보강하기 위한 입력 재구성이다(FRONTEND-PLAN Phase 1
판매자 화면 / DESIGN-PLAN 컴포넌트·패턴 연속).

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션·근거 | 채택 결과 |
|---|---|---|---|
| Q-A | 응답 호출 도구 (타입드 client vs facade) | A:003 타입드 `api.client.GET` / B:`api.http` 기반 도메인 facade + view 타입 | **B 채택**(주문·배송 응답 스키마가 OpenAPI 미정의(Prisma 엔티티 반환 — 001 coverage-gap)여서 타입드 client 의 응답 타입이 비어 이점이 적음. 요청 측은 정확, 응답은 한시 view 타입 facade — research §응답 타입 처리) |
| Q-B | 응답 타입 정의 위치 | A:화면 로컬 타입 / B:`@doa/shared-types` 전이형 view 타입 | **B 채택**(공유 패키지에 view 타입 7종 정의 — 금전 Decimal→문자열. 백엔드 응답 DTO 보강 후 생성 타입으로 대체 예정 — FR-008) |
| Q-C | 목록 렌더 컴포넌트 | A:DataTable(TanStack Table) / B:경량 Table 프리미티브(`@doa/ui`) | **B 채택**(정렬·필터 미요구. 경량 Table 프리미티브 추가, 확장 시 TanStack Table — FR-010·범위 외) |
| Q-D | 상태별 조치 흐름 | confirmed→주문확인(mutation)·preparing→송장등록(링크)·shipped/delivered→배송관리(링크)·그 외→"—" | **채택**(`OrderAction` 상태 머신 분기 — FR-003·SC-002) |
| Q-E | ship 페이지 송장 상태 보관 | A:서버 재조회 / B:송장 등록 직후 세션 state(`useState`) 보관 | **B 채택**(주문→송장 조회 엔드포인트 부재(BE-GAP)로 재조회 불가. 세션 내 완결 — 등록 직후 state 로 상태변경·추적 — FR-004·GAP-004-01) |
| Q-F | 폼 검증 | A:rhf+zod / B:제어 컴포넌트 + 빈 값 비활성화 | **B 채택**(Phase 1 은 최소 제어 폼. rhf+zod 는 Phase 2 — 범위 외) |
| Q-G | 권한 강제 위치 | A:UI 강제 / B:백엔드 강제 + UI 표시 분기 | **B 채택**(판매자 스코프·권한 3축은 백엔드 강제. UI 는 `isSeller` 표시 분기만 — NFR-003) |
| Q-H | 금전 표기 | Decimal→문자열 `formatKRW`(부동소수점 금지) | **채택**(view 타입 금전 필드 `string`, `Number().toLocaleString('ko-KR')` — NFR-001·P-005) |

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

Q1. 왜 만드는가?
- 001~003 이 공유 기반을 완성했으나 console 에 판매자 주문 이행 화면이 부재. 결제 완료 주문 확인·송장 등록
  (발송)·배송 전이·추적 조회를 UI 로 제공하여 FRONTEND-PLAN Phase 1(판매자 화면)을 시작.

Q2. 현재 어떻게? (004 이전)
- console 판매자 영역에 상품 관리(`/seller/products`)만 존재. 주문·배송 화면 없음. 백엔드는 주문·배송 5개
  라우트를 이미 제공하나 소비 UI 부재. 응답 스키마는 OpenAPI 미정의(Prisma 엔티티 반환 — 001 coverage-gap).

Q3. 성공 판단 기준
- `/seller/orders` 목록 렌더 + 상태별 조치(주문 확인/송장 등록/배송 관리). ship 페이지 송장 등록(발송)·
  배송 상태 전이·추적 조회. console typecheck 0·build 14 라우트 PASS(신규 2 + 기존 회귀 0).

### [카테고리 2] 사용자 & 이해관계자

Q4. 사용자 역할
- 판매자(console): 주문 이행 수행 주체 — 주문 확인·송장 등록·배송 전이·추적 조회.
- 백엔드 개발자: 주문·배송 라우트 제공 주체. 응답 DTO 미정의(view 타입 한시 정의 사유) + 판매자 주문 상세·
  주문→송장 조회 엔드포인트 부재(BE-GAP — GAP-004-01).
- 프론트엔드 개발자(후속): rhf+zod·낙관적 업데이트·서버 페이지네이션·DataTable 보강 주체(Phase 2).

### [카테고리 3] 핵심 기능

**Must:**
- `apps/console/app/(dashboard)/seller/orders/page.tsx`(신규): 주문 목록(Table·상태 Badge·결제금액·주문일)
  + 상태별 조치(`OrderAction`). `useQuery` 조회 + `confirm` mutation(invalidate).
- `apps/console/app/(dashboard)/seller/orders/[id]/ship/page.tsx`(신규): 송장 등록 폼(carrier·trackingNumber)
  → `POST /shipments` 발송. 배송 상태 전이(in_transit·delivered) + 추적 이력(GET tracking). 생성 Shipment
  세션 state 보관.
- `apps/console/lib/order.ts`(신규): `ORDER_STATUS_LABEL`/`ORDER_STATUS_TONE`·`SHIPMENT_STATUS_LABEL`·
  `formatKRW`(Decimal 문자열).
- `packages/api-client/src/index.ts`: `order`(listSeller·confirm)·`shipping`(create·updateStatus·tracking)
  facade 추가.
- `packages/shared-types/src/index.ts`: 주문·배송 view 타입 7종(`OrderStatus`·`SellerOrder`·`ShipmentStatus`·
  `Shipment`·`ShipmentTracking`·`CreateShipmentRequest`·`UpdateShipmentStatusRequest`).
- `packages/ui/src/table.tsx`(신규)·`index.ts`: Table 프리미티브 6종 + 재노출.
- `apps/console/app/(dashboard)/layout.tsx`: "주문·배송" 네비 추가 + 잔여 zinc→시맨틱 토큰 전환.

**제외(Out of Scope):**
- rhf+zod 폼, 낙관적 업데이트, 서버 페이지네이션, DataTable 정렬/필터, 판매자 주문 상세(items), ship
  재진입 시 기존 송장 복구(BE-GAP 의존).

### [카테고리 4] 데이터 & 입출력

- 백엔드 라우트(실제): `GET /seller/orders`(목록, items 미포함)·`POST /seller/orders/:id/confirm`
  (confirmed→preparing)·`POST /shipments`(CreateShipmentDto → preparing→shipped, Shipment 반환)·
  `PATCH /shipments/:id/status`(UpdateShipmentStatusDto: status enum·description? → delivered 시 주문
  delivered)·`GET /shipments/:id/tracking`(권한 3축).
- view 타입: `SellerOrder`(id·userId·status·totalAmount·discountAmount·deliveredAt·completedAt·createdAt —
  금전 string)·`Shipment`(id·orderId·status·carrier·trackingNumber·shippedAt·deliveredAt·createdAt)·
  `ShipmentTracking`(id·shipmentId·status·description·occurredAt).
- facade: `api.order.{listSeller,confirm}`·`api.shipping.{create,updateStatus,tracking}`(`api.http` 기반).

### [카테고리 5] 제약조건

Q5. 기술 스택 제약
- Next.js 15(App Router) + TanStack Query(useQuery/useMutation/invalidate) + `@doa/ui` 시맨틱 토큰.
- 응답 스키마 미정의(001 coverage-gap)로 타입드 client 대신 view 타입 + facade.
- 금전 Decimal→문자열(부동소수점 금지 — P-005). console typecheck/build 회귀 0(NFR-005).

### [카테고리 6] 예외 & 실패 시나리오

Q6. 엣지 케이스
- 비판매자 접근 → 목록은 `EmptyState`("판매자 미등록"), ship 은 `ErrorText`("판매자 전용 화면입니다.").
  실제 강제는 백엔드.
- ship 재진입(이미 발송된 주문) → 주문→송장 조회 엔드포인트 부재(BE-GAP)로 기존 shipment id 복구 불가.
  재등록 시도 시 백엔드가 400(주문이 preparing 아님)으로 거부. 현재는 세션 내 완결(등록 직후 state).
- 응답 타입 → 백엔드 OpenAPI 응답 미정의(Prisma 엔티티 반환 — 001 coverage-gap). 전이형 view 타입으로 한시
  정의(백엔드 응답 DTO 보강 후 생성 타입 대체 — GAP-004-01).
- 금전 부동소수점 → Decimal 문자열을 `formatKRW`가 `Number().toLocaleString`으로 표기(비유한값은 원문 표기).
</content>
