---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 01:06
상태: 확정 (retroactive)
---

# Diff: 004-seller-order-shipping

## 목차

- [커밋 메시지용 한 줄 요약](#커밋-메시지용-한-줄-요약)
- [변경 요약](#변경-요약)
- [변경 파일 및 라인 수](#변경-파일-및-라인-수)
- [Diff](#diff)

## 커밋 메시지용 한 줄 요약

- **KO**: 004 프론트 Phase 1 — 판매자 주문·배송 화면(목록·상태별 조치·송장 등록/배송 전이/추적 + view 타입·order/shipping facade·Table 프리미티브)
- **EN**: 004 frontend Phase 1 — seller order/shipping screens (list/actions·shipment create/status/tracking + view types·order·shipping facade·Table primitive)

## 변경 요약

- **주문 목록 화면(FR-001·002·003)**: `apps/console/app/(dashboard)/seller/orders/page.tsx`(신규) —
  `useQuery(['seller','orders'], api.order.listSeller, { enabled: isSeller })`로 목록 조회 후 `@doa/ui`
  Table 렌더(주문 ID·상태 Badge[`ORDER_STATUS_TONE/LABEL`]·결제금액[`formatKRW`]·주문일·조치). `OrderAction`
  상태별 분기 — confirmed→"주문 확인"(confirm mutation, invalidate)·preparing→"송장 등록" 링크·shipped/
  delivered→"배송 관리" 링크·그 외→"—". 로딩·에러·빈·비판매자 분기.
- **송장·배송 화면(FR-004·005·006)**: `seller/orders/[id]/ship/page.tsx`(신규) — 송장 등록 폼(carrier·
  trackingNumber `Input`)→`api.shipping.create`(발송, preparing→shipped), 생성 `Shipment` 를 세션
  state(`useState`) 보관. 배송 상태 전이(`updateStatus('in_transit'/'delivered')`, delivered 비활성화) +
  추적 이력(`api.shipping.tracking`, `enabled: !!shipment`).
- **상태 헬퍼(FR-002·NFR-001)**: `apps/console/lib/order.ts`(신규) — `ORDER_STATUS_LABEL`/`ORDER_STATUS_TONE`·
  `SHIPMENT_STATUS_LABEL`·`formatKRW(amount: string)`(Decimal 문자열, `Number.isFinite` 방어).
- **view 타입(FR-008)**: `packages/shared-types/src/index.ts` — 주문·배송 view 타입 7종(`OrderStatus`·
  `SellerOrder`·`ShipmentStatus`·`Shipment`·`ShipmentTracking`·`CreateShipmentRequest`·
  `UpdateShipmentStatusRequest`). 백엔드 응답 OpenAPI 미정의(Prisma 엔티티)이므로 전이형 view 타입(금전 string).
- **도메인 facade(FR-009)**: `packages/api-client/src/index.ts` — `createApiClient` 반환에 `order`
  (listSeller·confirm)·`shipping`(create·updateStatus·tracking) 추가(`api.http` 기반, view 타입 응답
  제네릭). 기존 facade·client·http 불변.
- **Table 프리미티브·네비·토큰(FR-007·010·NFR-002)**: `packages/ui/src/table.tsx`(신규) Table 6종(시맨틱
  토큰) + `ui/index.ts` 재노출. `apps/console/app/(dashboard)/layout.tsx` 에 "주문·배송" 판매자 네비 추가 +
  잔여 zinc→시맨틱 토큰 전환(잔여 zinc 0).
- **검증**: `pnpm --filter console typecheck` 0 error · `pnpm --filter console build` 14 라우트 PASS
  (`/seller/orders` ○ 정적·`/seller/orders/[id]/ship` ƒ 동적). 기존 화면 회귀 0. 신규 단위/e2e 테스트 0
  (UI 화면 — 타입체크 + 빌드 + 정적 구조 리뷰로 갈음). 신규 의존 0(`package.json` 변경 없음).
- **해결**: FRONTEND-PLAN Phase 1(판매자 화면) 주문·배송 이행 — 003 GAP-003-01 의 판매자 도메인 화면 부분
  RESOLVED. 판매자 주문 상세·주문→송장 조회 엔드포인트(BE-GAP)·응답 스키마 보강·rhf/낙관적/페이지네이션은
  후속(GAP-004-01).

## 변경 파일 및 라인 수

> 범위: `packages` + `apps/console`. base `0db61b9`(003 완료) → `8bba04d`(004 완료).
> `git diff --numstat 0db61b9 8bba04d -- packages apps/console` 직접 카운트.

| 파일 | 추가 | 삭제 | 비고 |
|---|---|---|---|
| `apps/console/app/(dashboard)/seller/orders/[id]/ship/page.tsx` (신규) | +173 | -0 | 송장 등록(발송)·배송 전이·추적·세션 state |
| `apps/console/app/(dashboard)/seller/orders/page.tsx` (신규) | +140 | -0 | 주문 목록·상태별 조치(confirm mutation·ship 링크) |
| `packages/shared-types/src/index.ts` | +61 | -0 | 주문·배송 view 타입 7종(금전 string) |
| `apps/console/lib/order.ts` (신규) | +37 | -0 | 상태 라벨·톤·formatKRW |
| `packages/ui/src/table.tsx` (신규) | +35 | -0 | Table 프리미티브 6종(시맨틱 토큰) |
| `packages/api-client/src/index.ts` | +23 | -0 | order·shipping 도메인 facade |
| `apps/console/app/(dashboard)/layout.tsx` | +11 | -10 | "주문·배송" 네비 + zinc→시맨틱 토큰 |
| `packages/ui/src/index.ts` | +1 | -0 | Table 프리미티브 재노출 |

**합계**: 8 files changed, 481 insertions(+), 10 deletions(-).

> **부수 변경 없음**: 신규 의존성 0(`package.json`·`pnpm-lock.yaml` 변경 없음). DB 스키마 변경 0(마이그레이션
> 없음).
>
> 본 004 SDD 문서 세트(`docs/specs/v1.1.0/004-seller-order-shipping/**`) 와 `DIFF-004`·`CHANGES.md` 004
> 항목은 `8bba04d` 코드 커밋 **이후** retroactive 로 별도 추가된다(코드 diff 범위 외).

## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 이며 전체 캡처는 중복·문서 비대화를
> 유발한다. 변경 내용은 위 "변경 요약" · "변경 파일 및 라인 수" 절로 추적하고, 라인 단위 diff 가 필요하면
> 아래로 재생성한다:
>
> ```bash
> git diff 0db61b9 8bba04d -- packages apps/console   # base commit: 0db61b9
> ```
</content>
