---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-30 01:06
상태: 확정 (retroactive — 전 태스크 구현 완료)
---

# Tasks: 004-seller-order-shipping

> Branch: 004-seller-order-shipping | Date: 2026-06-30 | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [Test Authoring Contract](#test-authoring-contract)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목 해소(미결 사항: 없음)
- [x] plan.md Constitution Gates(P-001~P-007) 통과(예외 0건, 신규 의존 0 — P-002 무저촉)
- [x] CHANGES.md 의 이전 작업(003·002·001) "후속 작업 시 주의사항" 확인 — 003 의 "console 마이그레이션
      점진"·"응답 스키마 품질 백엔드 의존(GAP-003-01)" 이 본 차수 view 타입 채택의 직접 배경. 001 의 "응답
      스키마 미주석(GAP-001-01)" 연속
- [x] 선택 단계 전부 N(Database Design·Deploy·Security·Performance — selection-phases.md)

> A = 타입 계약(view 타입), B = 공유 인프라(facade·Table 프리미티브), C = 화면(헬퍼·목록·ship·셸),
> D = 검증(타입체크·빌드·정적). 레이어 A→B→C→D 의존 순.

---

## 태스크 목록

> 레이어: A 타입 계약 / B 공유 인프라 / C 화면 / D 검증(5a/5b).

### Step 1. 타입 계약 — view 타입 (A)

- [x] **T001** — 주문·배송 view 타입 정의
  - 레이어: A
  - 구현 파일: `packages/shared-types/src/index.ts`
  - 관련 요구사항: FR-008, NFR-001
  - 상세: `OrderStatus`(7값)·`SellerOrder`(금전 `string`)·`ShipmentStatus`(4값)·`Shipment`·`ShipmentTracking`·
    `CreateShipmentRequest`·`UpdateShipmentStatusRequest` 정의. 백엔드 응답 OpenAPI 미정의(Prisma 엔티티)
    이므로 전이형 view 타입. 금전 필드(`totalAmount`·`discountAmount`) Decimal→문자열.
  - 완료 기준: view 타입 7종 정의, 금전 필드 `string`.

### Step 2. 공유 인프라 — facade·Table 프리미티브 (B)

- [x] **T002** — order·shipping 도메인 facade 추가
  - 레이어: B (T001 완료 후)
  - 구현 파일: `packages/api-client/src/index.ts`
  - 관련 요구사항: FR-009
  - 상세: `createApiClient` 반환에 `order.{listSeller,confirm}`·`shipping.{create,updateStatus,tracking}`
    추가. `api.http` 기반(`http.get/post/patch`), view 타입 응답 제네릭. 기존 facade 불변.
  - 완료 기준: `api.order`·`api.shipping` 메서드 5종, 기존 facade·client·http 불변.

- [x] **T003** `[P]` — Table 프리미티브 추가
  - 레이어: B
  - 구현 파일: `packages/ui/src/table.tsx`(신규) + `packages/ui/src/index.ts`(재노출)
  - 관련 요구사항: FR-010, NFR-002
  - 상세: `Table`·`THead`·`TBody`·`TR`·`TH`·`TD` 시맨틱 토큰 프리미티브(`border-border`·`bg-muted/50`·
    `divide-border`·`text-foreground` 등). `index.ts` 에 6종 export. 주석에 "정렬·필터 필요 시 TanStack
    Table 확장" 명시.
  - 완료 기준: Table 6종 정의·재노출, 시맨틱 토큰만 사용(하드코딩 0).

### Step 3. 화면 — 헬퍼·목록·ship·셸 (C)

- [x] **T004** — 상태 라벨·톤·금전 헬퍼
  - 레이어: C (T001 완료 후)
  - 구현 파일: `apps/console/lib/order.ts`(신규)
  - 관련 요구사항: FR-002, NFR-001
  - 상세: `ORDER_STATUS_LABEL`/`ORDER_STATUS_TONE`(Badge tone)·`SHIPMENT_STATUS_LABEL`·`formatKRW(amount:
    string)`(Decimal 문자열, `Number.isFinite` 방어).
  - 완료 기준: 라벨·톤 매핑 + formatKRW.

- [x] **T005** — 주문 목록 화면
  - 레이어: C (T002·T003·T004 완료 후)
  - 구현 파일: `apps/console/app/(dashboard)/seller/orders/page.tsx`(신규)
  - 관련 요구사항: FR-001, FR-002, FR-003, NFR-003, NFR-004
  - 상세: `useQuery`(`['seller','orders']`, `enabled: isSeller`)로 `api.order.listSeller()`. Table 렌더
    (주문 ID 앞 12자…·상태 Badge·결제금액 formatKRW 우측·주문일·조치). `OrderAction` 상태별 분기(confirmed→
    confirm mutation·preparing→ship 링크·shipped/delivered→ship 링크·그 외 "—"). confirm `onSuccess`
    invalidate. 로딩·에러·빈·비판매자 분기.
  - 완료 기준: 목록 렌더·상태별 조치·confirm mutation·상태 분기.

- [x] **T006** — 송장·배송 화면
  - 레이어: C (T002·T004 완료 후)
  - 구현 파일: `apps/console/app/(dashboard)/seller/orders/[id]/ship/page.tsx`(신규)
  - 관련 요구사항: FR-004, FR-005, FR-006, NFR-003, NFR-004
  - 상세: 송장 미등록 시 등록 폼(carrier·trackingNumber `Input`, 빈 값 비활성화) → `api.shipping.create` →
    생성 `Shipment` `useState` 보관(발송). 등록 후 배송 상태 Card(`updateStatus('in_transit')`·
    `updateStatus('delivered')`, delivered 비활성화) + 추적 이력 Card(`api.shipping.tracking`,
    `enabled: !!shipment`, 상태·설명·시각 시간순). 비판매자 `ErrorText`.
  - 완료 기준: 송장 등록·상태 전이·추적 조회·세션 state 보관.

- [x] **T007** `[P]` — AppShell 네비·토큰 전환
  - 레이어: C
  - 구현 파일: `apps/console/app/(dashboard)/layout.tsx`
  - 관련 요구사항: FR-007, NFR-002
  - 상세: `NAV` 판매자 섹션에 `{ href: '/seller/orders', label: '주문·배송', section: 'seller' }` 추가
    (`isSeller` 한정 노출). 잔여 zinc 토큰을 시맨틱 토큰(`border-border`·`bg-surface`·`text-muted-foreground`·
    `bg-accent`·`text-on-accent`·`bg-muted` 등)으로 전환(잔여 zinc 0).
  - 완료 기준: 네비 추가 + 잔여 zinc 0.

### Step 4. 검증 (D 레이어 — 5a/5b)

> 본 차수는 UI 화면으로 별도 e2e/단위 테스트 스위트를 작성하지 않는다(빌드/타입체크 갈음). D 레이어는
> **타입체크 + console 빌드 + 정적 구조 검증**으로 SC 를 판정한다(5a 는 검증 시나리오 정의, 5b 는 실행·
> 확인). test-cases.md / coverage.md 참조.

- [x] **T008** — 검증 시나리오 정의 (5a Test Agent AUTHORING)
  - 검증 대상: SC-001(목록 렌더)·SC-002(조치 분기)·SC-003(송장·배송·추적)·SC-004(view 타입·facade)·
    SC-005(네비·토큰·프리미티브·회귀 0)
  - 산출물: test-cases.md(목록 렌더·상태별 조치·송장/배송/추적·view 타입·금전 포맷 — 단위/e2e 아닌 빌드/
    타입/정적 기반)
  - 신규 단위/e2e 테스트 it() 0건(UI 화면 — 빌드/타입/정적 갈음)

- [x] **T009** — 게이트 실행·확인 (5b Test Agent EXECUTION)
  - 실행: `pnpm --filter console typecheck`(0 error) / `pnpm --filter console build`(14 라우트 PASS —
    `/seller/orders` ○ 정적·`/seller/orders/[id]/ship` ƒ 동적) / 정적 구조 검증(상태별 조치 분기·view 타입·
    facade·금전 포맷·네비·zinc→시맨틱 코드 리뷰)
  - 산출물: coverage.md·coverage-gap.md·test-report.md

---

## Test Authoring Contract

> **5a Test Agent(AUTHORING) 입력 contract**. 본 차수는 UI 화면으로 단위/e2e 테스트 it() 를 추가하지 않으며,
> 검증은 타입체크·console 빌드·정적 구조 검증으로 갈음한다(추측 단언 금지 — 직접 코드 리뷰/빌드).

### 검증 canonical 대상

| 대상 | canonical 형태 |
|---|---|
| 주문 목록 | `orders/page.tsx` — `useQuery(['seller','orders'], api.order.listSeller)` + Table(상태 Badge·formatKRW) |
| 상태별 조치 | `orders/page.tsx` `OrderAction` — confirmed→confirm·preparing→ship·shipped/delivered→ship·그 외 "—" |
| confirm mutation | `orders/page.tsx` `useMutation(api.order.confirm)` `onSuccess` invalidate `['seller','orders']` |
| 송장 등록·발송 | `ship/page.tsx` `useMutation(api.shipping.create)` `onSuccess(s) setShipment(s)` |
| 배송 전이 | `ship/page.tsx` `updateStatus('in_transit'/'delivered')`, delivered 비활성화 |
| 추적 이력 | `ship/page.tsx` `useQuery(['shipment',id,'tracking'], api.shipping.tracking, enabled: !!shipment)` |
| view 타입 | `shared-types/index.ts` — `SellerOrder`·`Shipment`·`ShipmentTracking` 등 7종(금전 string) |
| facade | `api-client/index.ts` — `order.{listSeller,confirm}`·`shipping.{create,updateStatus,tracking}` |
| Table 프리미티브 | `ui/table.tsx` 6종 + `ui/index.ts` 재노출(시맨틱 토큰) |
| 네비·토큰 | `layout.tsx` — `/seller/orders` 네비 추가 + 잔여 zinc 0(시맨틱 토큰) |
| 타입체크/빌드 | `pnpm --filter console typecheck`·`pnpm --filter console build`(14 라우트) |

### 검증 재현 규약

- **SC-001(목록 렌더)**: `orders/page.tsx` grep `api.order.listSeller` + Table·`ORDER_STATUS_TONE`·
  `formatKRW`. `console build` 에 `/seller/orders` 라우트 컴파일.
- **SC-002(조치 분기)**: `orders/page.tsx` `OrderAction` switch(`confirmed`·`preparing`·`shipped`/
  `delivered`·default) + confirm `onSuccess` invalidate.
- **SC-003(송장·배송·추적)**: `ship/page.tsx` `api.shipping.create`/`updateStatus`/`tracking` + `useState`
  shipment + `enabled: !!shipment` + delivered 비활성화. `console build` 에 `/seller/orders/[id]/ship` 동적(ƒ).
- **SC-004(view 타입·facade)**: `shared-types/index.ts` view 타입 7종(금전 string) + `api-client/index.ts`
  order·shipping facade.
- **SC-005(네비·토큰·프리미티브·회귀)**: `layout.tsx` `/seller/orders` 네비 + 잔여 zinc 0. `ui/table.tsx`+
  `index.ts` Table 6종. `console typecheck` 0·`build` 14 라우트 PASS.

### SC → 검증 매핑

| SC-ID | 수용 기준 | 검증 방법 | 비고 |
|---|---|---|---|
| SC-001 | 목록 렌더·상태 Badge·금전 | orders/page.tsx grep + console typecheck/build | [env:typecheck][env:build] |
| SC-002 | 상태별 조치 분기 | orders/page.tsx 코드 리뷰 | [env:static] OrderAction |
| SC-003 | 송장·배송·추적·세션 state | ship/page.tsx 코드 리뷰 + console build | [env:typecheck][env:build] |
| SC-004 | view 타입·facade | shared-types·api-client 코드 리뷰 | [env:static][env:typecheck] |
| SC-005 | 네비·토큰·프리미티브·회귀 0 | layout·ui 코드 리뷰 + console typecheck/build | [env:static][env:typecheck][env:build] |

---

## 구현 완료 기준

- [x] 모든 A·B·C 태스크 체크박스 완료(4단계), D 검증 시나리오 완료(5a/5b)
- [x] `shared-types/index.ts` — view 타입 7종(금전 string) `[TypeScript]`
- [x] `api-client/index.ts` — order·shipping facade 추가, 기존 facade·client·http 불변
- [x] `ui/table.tsx`(신규)+`index.ts` — Table 프리미티브 6종 추가·재노출(시맨틱 토큰)
- [x] `lib/order.ts`(신규) — 라벨·톤·formatKRW
- [x] `orders/page.tsx`(신규) — 목록·상태별 조치·confirm mutation
- [x] `ship/page.tsx`(신규) — 송장 등록·배송 전이·추적·세션 state
- [x] `layout.tsx` — "주문·배송" 네비 추가 + 잔여 zinc→시맨틱 토큰(잔여 zinc 0)
- [x] `pnpm --filter console typecheck` 0 error + `pnpm --filter console build` 14 라우트 PASS(회귀 0)
- [x] 신규 의존 0(`package.json` 변경 없음 — P-002 무저촉)
- [x] git status 의도치 않은 파일 없음(8파일 변경)
</content>
