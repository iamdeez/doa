---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-30 01:06
상태: 확정 (retroactive)
---

# 테스트 실행 결과 — 004-seller-order-shipping

## 목차

- [실행 요약](#실행-요약)
- [실패 목록](#실패-목록)
- [SC 매핑표 검증](#sc-매핑표-검증)
- [설계 문서 정합성](#설계-문서-정합성)
- [회귀 탐지](#회귀-탐지)

---

## 실행 요약

> 본 retroactive 검증은 004 완료 커밋 `8bba04d`(base `0db61b9`)에서 main session 이 게이트를 직접
> 재실행·구조 확인했다. 본 차수는 UI 화면으로 별도 e2e/단위 테스트 스위트가 없으며, 검증은 타입체크 +
> console 빌드 + 정적 구조 검증으로 갈음한다.

| 항목 | 결과 (HEAD `8bba04d`) |
|---|---|
| 실행 일시 | 2026-06-30 01:06 |
| console typecheck | **0 error** (PASS) |
| console build | **14 라우트 PASS** (`/seller/orders` ○ 정적·`/seller/orders/[id]/ship` ƒ 동적) |
| 주문 목록 | `orders/page.tsx` — `useQuery(api.order.listSeller)` + Table(상태 Badge·formatKRW) |
| 상태별 조치 | `OrderAction` — confirmed→confirm·preparing→ship·shipped/delivered→ship·그 외 "—" |
| 송장·배송·추적 | `ship/page.tsx` — create(발송)·updateStatus(in_transit/delivered)·tracking, 세션 state |
| view 타입·facade | `shared-types`(7종 view 타입)·`api-client`(order·shipping facade) |
| 네비·토큰 | `layout.tsx` — "주문·배송" 네비 + 잔여 zinc 0 |
| Table 프리미티브 | `ui/table.tsx` 6종 + `ui/index.ts` 재노출 |
| 전체 통과 여부 | **PASS** |
| 신규 단위/e2e 테스트 | **0** (UI 화면 — 타입체크·빌드·정적 갈음) |
| 마이그레이션 | **없음** (DB 스키마 변경 0) |

### 003(`0db61b9`) → 004(`8bba04d`) 델타

| 항목 | base(`0db61b9`) | 004(`8bba04d`) | 델타 |
|---|---|---|---|
| 판매자 영역 화면 | 상품 관리만(`/seller/products`) | + 주문 목록 + 송장·배송 | **주문·배송 화면 2개 추가** |
| api-client facade | auth·user·seller·catalog·inventory | + order·shipping | **주문·배송 facade 추가** |
| shared-types | 생성 타입 + 기존 수기 타입 | + 주문·배송 view 타입 7종 | **전이형 view 타입 추가** |
| @doa/ui | Button·Dialog·Card·field·feedback·page-header | + Table 프리미티브 6종 | **Table 프리미티브 추가** |
| AppShell 토큰 | 잔여 zinc 일부 | 시맨틱 토큰(잔여 zinc 0) | **토큰 전환 + 네비 추가** |
| console build 라우트 | 13 | 14 | +1 (신규 2 — `/seller/orders` ○ + `[id]/ship` ƒ, 기타 회귀 0) |

> **신규 단위/e2e 0 산정(직접 확인)**: `git diff 0db61b9 8bba04d -- packages apps/console` 의 변경 파일은
> 화면 2·`lib/order.ts`·`layout.tsx`·`api-client/index.ts`·`shared-types/index.ts`·`ui/table.tsx`·
> `ui/index.ts` 8종이며 `*.spec.ts`·`*.test.ts`·`*.e2e.ts` 변경/추가가 0 이다. UI 화면 성격으로 테스트
> 스위트 미추가. `package.json` 변경 0(신규 의존 0).

### 실행 커맨드

```bash
cd /Users/krystal/workspace/doa/doa-next
pnpm --filter console typecheck            # tsc --noEmit (0 error)
pnpm --filter console build                # 14 라우트 PASS (/seller/orders ○, /seller/orders/[id]/ship ƒ)
# 변경 라인 카운트
git diff --numstat 0db61b9 8bba04d -- packages apps/console   # 8 files, +481/-10
```

---

## 실패 목록

**실패 없음.** console typecheck 0 error, console build 14 라우트 PASS(신규 `/seller/orders` ○ 정적·
`/seller/orders/[id]/ship` ƒ 동적 포함), 기존 화면(상품·계정·관리자) 회귀 0. 변경 구조(주문 목록·상태별
조치·송장 등록/배송 전이/추적·view 타입·order/shipping facade·Table 프리미티브·AppShell 네비·토큰)가
spec.md FR-001~010·SC-001~005 와 일치.

---

## SC 매핑표 검증

| SC-ID | 관련 검증 | 통과 여부 |
|---|---|---|
| SC-001 | `orders/page.tsx` 목록 Table·상태 Badge·formatKRW + console typecheck/build(`/seller/orders` ○) | PASS(typecheck/build) |
| SC-002 | `OrderAction` 상태별 분기(confirmed→confirm·preparing/shipped/delivered→ship·그 외 "—")·invalidate | VERIFIED(static) |
| SC-003 | `ship/page.tsx` create(발송)·updateStatus·tracking·세션 state·delivered 비활성화 + console build(ƒ) | PASS(typecheck/build) |
| SC-004 | `shared-types` view 타입 7종(금전 string)·`api-client` order·shipping facade | VERIFIED(static)/PASS(typecheck) |
| SC-005 | `layout.tsx` 네비+잔여 zinc 0·`ui/table.tsx`+`index.ts` Table 6종 + console typecheck 0·build 14 라우트 | PASS(typecheck/build)/VERIFIED(static) |

---

## 설계 문서 정합성

### plan.md 현행화 점검

- 주문 목록·상태별 조치 — `useQuery(api.order.listSeller)`·`OrderAction` switch — plan.md §핵심 설계 1·
  ADR(상태 머신)·FR-001·002·003 과 일치 ✓
- 송장·배송·추적 — `api.shipping.create/updateStatus/tracking`·세션 state·`enabled: !!shipment` — plan.md
  §핵심 설계 2·ADR-004·FR-004·005·006 과 일치 ✓
- 상태 라벨·톤·금전 — `ORDER_STATUS_LABEL/TONE`·`SHIPMENT_STATUS_LABEL`·`formatKRW`(string) — plan.md §핵심
  설계 3·ADR-007·FR-002·NFR-001 과 일치 ✓
- view 타입·facade — view 타입 7종(금전 string)·order/shipping facade — plan.md §핵심 설계 4·ADR-001·002·
  FR-008·009 과 일치 ✓
- Table 프리미티브·네비·토큰 — Table 6종·네비 추가·zinc→시맨틱 — plan.md §핵심 설계 5·ADR-003·FR-007·010·
  NFR-002 와 일치 ✓
- 신규 의존 0 — `package.json` 변경 없음 — plan.md Gates P-002·selection-phases 와 일치 ✓

### 발견된 한계·관찰

- **e2e 부재**: UI 화면이나 e2e/단위 테스트 없음(빌드/타입체크/정적 갈음). 후속 권고(GAP-004-01).
- **BE-GAP 의존**: ship 재진입 기존 송장 복구·판매자 주문 상세 — 백엔드 엔드포인트 부재로 미구현
  (GAP-004-01). 현재 세션 내 완결.
- **rhf 검증·낙관적 업데이트 미적용**: 제어 컴포넌트 + 빈 값 비활성화·서버 응답 후 갱신(Phase 2 후속 — 범위 외).

### v1.1.0(003) 회귀 확인

- console 화면: 기존 화면(상품·계정·관리자)은 불변이며 신규 화면 2개만 추가되어 typecheck 0·build 14 라우트
  PASS(회귀 0 — NFR-005·SC-005).
- 공유 패키지: `api-client` 는 order·shipping facade **추가**(기존 facade·client·http 불변), `@doa/ui` 는
  Table export **추가**(기존 export 불변), `shared-types` 는 view 타입 **추가**(기존 타입 불변). 비파괴.

---

## 회귀 탐지

004 이 추가/변경한 파일 (`git diff 0db61b9 8bba04d -- packages apps/console` 기준):
- `apps/console/app/(dashboard)/seller/orders/page.tsx`: 주문 목록·상태별 조치(신규 +140 -0)
- `apps/console/app/(dashboard)/seller/orders/[id]/ship/page.tsx`: 송장·배송·추적(신규 +173 -0)
- `apps/console/lib/order.ts`: 라벨·톤·formatKRW(신규 +37 -0)
- `apps/console/app/(dashboard)/layout.tsx`: 네비 추가·zinc→시맨틱(+11 -10)
- `packages/api-client/src/index.ts`: order·shipping facade(+23 -0)
- `packages/shared-types/src/index.ts`: view 타입 7종(+61 -0)
- `packages/ui/src/table.tsx`: Table 프리미티브(신규 +35 -0)
- `packages/ui/src/index.ts`: Table 재노출(+1 -0)

기존 console 화면·공유 패키지 기존 export 불변 → 회귀 0(console typecheck 0·build 14 라우트 PASS).
마이그레이션 없음(DB 스키마 변경 0). 신규 의존 0(`package.json` 변경 없음).
</content>
