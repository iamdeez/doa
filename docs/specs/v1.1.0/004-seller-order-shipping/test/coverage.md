---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-30 01:06
상태: 확정 (retroactive)
---

# Coverage: 004-seller-order-shipping

## 목차

- [실행 요약](#실행-요약)
- [SC × 시나리오 커버리지 매트릭스](#sc--시나리오-커버리지-매트릭스)
- [커버리지 요약](#커버리지-요약)
- [STALE_SC 경고](#stale_sc-경고)

---

## 실행 요약

> 본 retroactive 검증은 004 완료 커밋 `8bba04d`(base `0db61b9`) 기준으로 main session 이 게이트를 직접
> 재실행·구조 확인한 결과다. 본 차수는 UI 화면으로 별도 e2e/단위 테스트 스위트가 없으며, SC 는 **타입체크 +
> console 빌드 + 정적 구조 검증**으로 판정한다.

| 항목 | 본 retroactive 검증 (HEAD `8bba04d`) |
|---|---|
| console typecheck | **0 error** (`pnpm --filter console typecheck` — main 검증) |
| console build | **14 라우트 PASS** (`/seller/orders` ○ 정적·`/seller/orders/[id]/ship` ƒ 동적 — main 검증) |
| 주문 목록 | `orders/page.tsx` — `useQuery(api.order.listSeller)` + Table(상태 Badge·formatKRW) |
| 상태별 조치 | `OrderAction` — confirmed→confirm·preparing→ship·shipped/delivered→ship·그 외 "—" |
| 송장·배송·추적 | `ship/page.tsx` — create(발송)·updateStatus(in_transit/delivered)·tracking, 세션 state |
| view 타입 | `shared-types/index.ts` — 7종(`SellerOrder`·`Shipment`·`ShipmentTracking` 등, 금전 string) |
| facade | `api-client/index.ts` — order·shipping 5종(`api.http` 기반) |
| Table 프리미티브 | `ui/table.tsx` 6종 + `ui/index.ts` 재노출(시맨틱 토큰) |
| 네비·토큰 | `layout.tsx` — "주문·배송" 네비 + 잔여 zinc 0(시맨틱 토큰) |
| 신규 단위/e2e 테스트 | **0** (UI 화면 — 타입체크·빌드·정적 갈음) |
| 마이그레이션 | **없음** (DB 스키마 변경 0) |
| 신규 의존 | **0** (`package.json` 변경 없음) |

> **신규 단위/e2e 0 산정 근거(사실 기준)**: 004 git diff(`git diff 0db61b9 8bba04d -- packages apps/console`)의
> 변경 파일 8종(화면 2·`lib/order.ts`·`layout.tsx`·`api-client/index.ts`·`shared-types/index.ts`·
> `ui/table.tsx`·`ui/index.ts`)에 `*.spec.ts`·`*.test.ts`·`*.e2e.ts` 변경/추가가 0 이다. 검증은 console
> typecheck/build + 정적 구조 리뷰로 갈음한다.

### 변경 라인 직접 카운트 (자가 보고 비신뢰)

| 파일 | 추가 | 삭제 | 방법 |
|---|---|---|---|
| `apps/console/.../seller/orders/[id]/ship/page.tsx`(신규) | 173 | 0 | `git diff --numstat 0db61b9 8bba04d` |
| `apps/console/.../seller/orders/page.tsx`(신규) | 140 | 0 | 동일 |
| `packages/shared-types/src/index.ts` | 61 | 0 | 동일(view 타입 7종) |
| `apps/console/lib/order.ts`(신규) | 37 | 0 | 동일 |
| `packages/ui/src/table.tsx`(신규) | 35 | 0 | 동일 |
| `packages/api-client/src/index.ts` | 23 | 0 | 동일(order·shipping facade) |
| `apps/console/app/(dashboard)/layout.tsx` | 11 | 10 | 동일(네비 + zinc→시맨틱) |
| `packages/ui/src/index.ts` | 1 | 0 | 동일(Table 재노출) |

**합계**: 8 files changed, 481 insertions(+), 10 deletions(-).

### 실행 커맨드

```bash
pnpm --filter console typecheck          # tsc --noEmit (0 error)
pnpm --filter console build              # 14 라우트 PASS (/seller/orders ○, /seller/orders/[id]/ship ƒ)
git diff --numstat 0db61b9 8bba04d -- packages apps/console   # 변경 라인 카운트
```

---

## SC × 시나리오 커버리지 매트릭스

| SC-ID | 수용 기준 | 케이스 | 상태 |
|---|---|---|---|
| SC-001 | 목록 렌더·상태 Badge·금전 | orders/page.tsx + console typecheck/build | PASS(typecheck/build) |
| SC-002 | 상태별 조치 분기 | orders/page.tsx OrderAction 코드 리뷰 | VERIFIED(static) |
| SC-003 | 송장·배송·추적·세션 state | ship/page.tsx + console build | PASS(typecheck/build) |
| SC-004 | view 타입·facade | shared-types·api-client 코드 리뷰 | VERIFIED(static)/PASS(typecheck) |
| SC-005 | 네비·토큰·프리미티브·회귀 0 | layout·ui 리뷰 + console typecheck/build | PASS(typecheck/build)/VERIFIED(static) |

---

## 커버리지 요약

| 항목 | 수 |
|---|---|
| 전체 SC | 5 (목록 렌더 1 + 조치 분기 1 + 송장·배송·추적 1 + view 타입·facade 1 + 네비·토큰·프리미티브 1) |
| PASS (타입체크·빌드 직접) | 3 (SC-001·003·005) |
| VERIFIED (정적 구조 검증) | 2 (SC-002·004 — 조치 분기·view 타입/facade 코드 리뷰) |
| GAP | 0 (단, e2e 부재·BE-GAP 의존 시나리오·rhf 검증·낙관적 업데이트는 coverage-gap.md·GAP-004-01 참조) |

> SC-001(목록 렌더)·SC-003(송장·배송·추적)·SC-005(네비·토큰·프리미티브·회귀 0)는 console typecheck/build 로
> 직접 PASS, SC-002(조치 분기)·SC-004(view 타입·facade)는 정적 구조 리뷰로 확인(VERIFIED). 모든 SC 가
> 충족되며, e2e 부재·BE-GAP 의존 시나리오·rhf 검증·낙관적 업데이트는 Low~Medium 잔여 권고다(GAP-004-01).
> Phase 1 핵심 목표(판매자 주문 확인·송장 등록(발송)·배송 상태 전이·추적 조회 화면)는 console typecheck 0·
> build 14 라우트 PASS 로 달성.

---

## STALE_SC 경고

STALE_SC 검출 결과: **0건**

검출 대상: 004 git diff(`git diff 0db61b9 8bba04d -- packages apps/console`) 변경 파일. 변경 파일에 테스트
SC 번호를 포함한 `*.spec.ts`·`*.test.ts`·`*.e2e.ts` 가 없고(UI 화면), SC 판정은 본 coverage.md·test-cases.md
가 정적 구조 리뷰 + console typecheck/build 로 담당한다. semantic mismatch 없음.
</content>
