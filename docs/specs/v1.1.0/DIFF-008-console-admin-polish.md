---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 02:34
상태: 확정 (retroactive)
---

# Diff: 008-console-admin-polish

## 목차

- [커밋 메시지용 한 줄 요약](#커밋-메시지용-한-줄-요약)
- [변경 요약](#변경-요약)
- [변경 파일 및 라인 수](#변경-파일-및-라인-수)
- [Diff](#diff)

## 커밋 메시지용 한 줄 요약

(이 섹션은 커밋 메시지 작성 시 참고할 수 있도록 제공하는 보조 자료이다.)

- **KO**: 008 콘솔 폴리시 — CouponManager 공유 컴포넌트 + 관리자 쿠폰 화면 + 다크모드 토글(FOUC 방지) + 인앱
  알림 화면 + notification facade
- **EN**: 008 console polish — CouponManager shared component + admin coupons page + dark-mode toggle (FOUC
  prevention) + in-app notifications page + notification facade

## 변경 요약

- **CouponManager 공유 컴포넌트(FR-001)**: `apps/console/components/coupon-manager.tsx`(신규) — `CouponApi`
  인터페이스(`list·create·issue`) 의존성 주입·`queryScope`로 TanStack Query 캐시 키 분리(판매자/관리자 독립)·
  `discountLabel`·`validate`(010 정합 클라이언트 검증)·`CreateDialog`(할인 유형 Select·할인값·최소주문·발급
  수량·만료일·mutation·onSuccess invalidate·close·reset)·`IssueDialog`(userId Input·mutation·onSuccess invalidate)
  서브컴포넌트 포함.

- **관리자 쿠폰 화면(FR-002)**: `apps/console/app/(dashboard)/admin/coupons/page.tsx`(신규) — `CouponManager`에
  `api.admin.{listCoupons, createCoupon, issueCoupon}` 주입·`queryScope="admin"`·`title="쿠폰(관리자)"`.

- **판매자 쿠폰 리팩토링(FR-003)**: `apps/console/app/(dashboard)/seller/coupons/page.tsx`(수정) — 235줄
  독립 구현을 `CouponManager` 위임(~26줄)으로 대체. `isSeller` 분기(EmptyState "판매자 미등록")·`queryScope=
  "seller"` 유지. 기존 UX·동작 회귀 0.

- **ThemeToggle 컴포넌트(FR-004)**: `apps/console/components/theme-toggle.tsx`(신규) — `documentElement.
  classList.toggle('dark', next)` + `localStorage.setItem('theme', ...)` 영속(try-catch 감싸 불가 환경 허용) +
  `useEffect` 마운트 시 `.dark` 상태 초기화 + `aria-label`.

- **FOUC 방지 스크립트(FR-005)**: `apps/console/app/layout.tsx`(수정) — `THEME_SCRIPT`(`localStorage.
  getItem('theme')` + `prefers-color-scheme: dark` 분기 → `classList.add('dark')`) 인라인 스크립트를 `<head>`
  에 삽입. `<html lang="ko" suppressHydrationWarning>` 추가.

- **헤더·네비 갱신(FR-006)**: `apps/console/app/(dashboard)/layout.tsx`(수정) — 헤더 우측 액션에 `<ThemeToggle />`
  추가(logout 버튼 좌측). NAV 배열: common 섹션에 "알림"(`/account/notifications`)·admin 섹션에 "쿠폰(관리자)"
  (`/admin/coupons`) 추가.

- **알림 화면(FR-007)**: `apps/console/app/(dashboard)/account/notifications/page.tsx`(신규) — `useQuery
  (['notifications'], api.notification.list)` + `NotificationRow`(Badge info/neutral·`TYPE_LABEL[n.type]`·
  `opacity-70` 읽음 표시·"읽음" 버튼 → `markRead` mutation) + 헤더 "전체 읽음"(unread>0 시) → `markAllRead`
  mutation. 경로: `account/notifications`(99d34a9에서 cwd 버그 경로 정정).

- **notification facade + admin 쿠폰 메서드(FR-008)**: `packages/api-client/src/index.ts`(수정) —
  `notification` 도메인(`list·markRead·markAllRead`)·`admin.listCoupons·admin.createCoupon·admin.issueCoupon`
  추가. 기존 facade·client·http 불변.

- **notification view 타입(FR-009)**: `packages/shared-types/src/index.ts`(수정) — `NotificationType`(4종:
  `ORDER_PLACED·ORDER_SHIPPED·SETTLEMENT_CREATED·REVIEW_RECEIVED`)·`Notification`·`NotificationListResult`
  view 타입 추가. 백엔드 응답 OpenAPI 미정의이므로 전이형 한시 정의.

- **검증**: `pnpm --filter console typecheck` 0 error · `pnpm --filter console build` 모든 라우트 PASS(신규
  `/admin/coupons`·`/account/notifications` 포함). 기존 화면 동작 회귀 0. 신규 단위/e2e 테스트 0(UI 화면 —
  타입체크+빌드+정적 갈음). 신규 의존 0(`package.json` 변경 없음).

- **해결**: FRONTEND-PLAN Phase 3 잔여 — 007 §범위 외 예고 `admin/coupons` 화면 구현. GAP-002-01(다크모드 토글
  UI 부재) 부분 해소(FOUC 방지 포함). 009 인앱 알림 이벤트 소비 UI 제공. 판매자 쿠폰 화면 CouponManager 공유화
  로 코드 중복 해소. 알림 실시간 push·삭제·낙관적 업데이트·cursor 더보기·e2e·응답 스키마 보강은 후속(GAP-008-01).

## 변경 파일 및 라인 수

> 범위: `apps/console` + `packages`. base `e7d8ebb` → `99d34a9`(커밋 3개).
> `git diff --numstat e7d8ebb 99d34a9 -- apps/console packages` 직접 카운트.

| 파일 | 추가 | 삭제 | 비고 |
|---|---|---|---|
| `apps/console/components/coupon-manager.tsx` (신규) | +247 | -0 | CouponApi 인터페이스·CouponManager 공유 컴포넌트 |
| `apps/console/app/(dashboard)/account/notifications/page.tsx` (신규) | +83 | -0 | 알림 목록·읽음·전체 읽음 |
| `apps/console/app/(dashboard)/seller/coupons/page.tsx` | +13 | -222 | CouponManager 위임 리팩토링(235→~26줄) |
| `apps/console/app/(dashboard)/layout.tsx` | +12 | -6 | ThemeToggle 헤더·네비 2개 추가 |
| `apps/console/components/theme-toggle.tsx` (신규) | +34 | -0 | 다크모드 토글 버튼 |
| `packages/shared-types/src/index.ts` | +28 | -0 | notification view 타입 3종 |
| `packages/api-client/src/index.ts` | +20 | -0 | notification facade 3종 + admin 쿠폰 3종 |
| `apps/console/app/(dashboard)/admin/coupons/page.tsx` (신규) | +20 | -0 | 관리자 쿠폰 화면 |
| `apps/console/app/layout.tsx` | +7 | -1 | FOUC 방지 스크립트·suppressHydrationWarning |

**합계**: 9 files changed, **464 insertions(+), 229 deletions(-)**.

> **부수 변경 없음**: 신규 의존성 0(`package.json`·`pnpm-lock.yaml` 변경 없음). DB 스키마 변경 0(마이그레이션
> 없음). `@doa/ui`·`@doa/design-tokens` 변경 0(기존 컴포넌트·토큰 재사용).
>
> 본 008 SDD 문서 세트(`docs/specs/v1.1.0/008-console-admin-polish/**`)와 `DIFF-008`·`CHANGES.md` 008 항목은
> `99d34a9` 코드 커밋 **이후** retroactive로 별도 추가된다(코드 diff 범위 외).

## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 이며 전체 캡처는 중복·문서 비대화를
> 유발한다. 변경 내용은 위 "변경 요약" · "변경 파일 및 라인 수" 절로 추적하고, 라인 단위 diff 가 필요하면
> 아래로 재생성한다:
>
> ```bash
> git diff e7d8ebb 99d34a9 -- apps/console packages   # base commit: e7d8ebb
> ```
