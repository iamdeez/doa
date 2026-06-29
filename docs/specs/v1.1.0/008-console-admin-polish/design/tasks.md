---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-30 02:34
상태: 확정 (retroactive)
---

# Tasks: 008-console-admin-polish

> Branch: 008-console-admin-polish | Date: 2026-06-30 | Plan: [plan.md](../planning/plan.md)
>
> 구현 완료 코드(커밋 `5a14be6`·`4a446b2`·`99d34a9`, base `e7d8ebb`)를 기준으로 retroactive 작성된 태스크 분해.
> 모든 태스크는 이미 완료 상태이다.

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md의 모든 `[NEEDS CLARIFICATION]` 항목이 해소되었는가?
  → 없음. 모든 결정이 spec-input.md Q-A~E에서 확정되었다.
- [x] plan.md의 Constitution Gates가 모두 통과(또는 예외 기재)되었는가?
  → P-001~007 모두 통과. 예외: 알림·admin 쿠폰 응답 view 타입 한시(GAP-008-01).
- [x] CHANGES.md에서 이전 작업의 "후속 작업 시 주의사항"을 확인했는가?
  → 007 항목 확인: admin/coupons 화면은 008에서 별도 구현 예고됨(007 §범위 외). 판매자 쿠폰 화면과
  공유 컴포넌트 추출 권고 — 008에서 이행.

---

## 태스크 목록

> [P] 표시: 이전 태스크와 병렬 실행 가능
> 의존 관계가 있는 태스크는 반드시 선행 태스크 완료 후 실행한다.

### Phase 1. 공유 컴포넌트 + 타입 기반

- [x] **T001** — shared-types에 notification view 타입 추가
  - 구현 파일: `packages/shared-types/src/index.ts`
  - 관련 요구사항: `FR-009`
  - 상세: `NotificationType` union(`ORDER_PLACED`·`ORDER_SHIPPED`·`SETTLEMENT_CREATED`·`REVIEW_RECEIVED`)·
    `Notification` interface(id·userId·type·title·body·isRead·createdAt)·`NotificationListResult`(items·total·page·size) 추가
  - 완료 기준: `shared-types typecheck` 0 error

- [x] **T002** `[P]` — api-client에 notification facade + admin 쿠폰 메서드 추가
  - 구현 파일: `packages/api-client/src/index.ts`
  - 관련 요구사항: `FR-008`
  - 상세: `notification` 도메인(list·markRead·markAllRead) + `admin.listCoupons`·`admin.createCoupon`·`admin.issueCoupon` 추가
  - 완료 기준: `api-client typecheck` 0 error. 기존 facade 불변.

- [x] **T003** — CouponManager 공유 컴포넌트 작성
  - 구현 파일: `apps/console/components/coupon-manager.tsx` (신규)
  - 관련 요구사항: `FR-001`
  - 상세: `CouponApi` 인터페이스·`CouponManager({ api, queryScope, title, subtitle })`·`discountLabel`·
    `validate`·`CreateDialog`·`IssueDialog` 구현. 006 `seller/coupons/page.tsx` 로직을 이전.
  - 완료 기준: 컴포넌트가 타입 에러 없이 작성됨

- [x] **T004** `[P]` — ThemeToggle 컴포넌트 작성
  - 구현 파일: `apps/console/components/theme-toggle.tsx` (신규)
  - 관련 요구사항: `FR-004`
  - 상세: `toggle()` + `localStorage` 영속 + try-catch + `useEffect` 마운트 초기화 + `aria-label`
  - 완료 기준: 타입 에러 없이 작성됨

### Phase 2. 라우트·레이아웃 적용

- [x] **T005** — app/layout.tsx FOUC 방지 스크립트 + suppressHydrationWarning 추가
  - 구현 파일: `apps/console/app/layout.tsx`
  - 관련 요구사항: `FR-005`
  - 상세: `THEME_SCRIPT` 상수(localStorage + prefers-color-scheme → classList.add('dark')) 정의·`<head>` 내 script 삽입·`<html suppressHydrationWarning>` 추가
  - 완료 기준: build 0 error. 기존 Providers·children 불변.

- [x] **T006** — seller/coupons/page.tsx CouponManager 위임 리팩토링
  - 구현 파일: `apps/console/app/(dashboard)/seller/coupons/page.tsx`
  - 관련 요구사항: `FR-003`
  - 상세: 235줄 독립 구현 → `CouponManager` 위임(~26줄). `isSeller` 분기(EmptyState "판매자 미등록") 유지. `queryScope="seller"`.
  - 완료 기준: 타입 에러 없이 리팩토링. 기존 UX 회귀 0.

- [x] **T007** `[P]` — admin/coupons/page.tsx 신규 작성
  - 구현 파일: `apps/console/app/(dashboard)/admin/coupons/page.tsx` (신규)
  - 관련 요구사항: `FR-002`
  - 상세: `CouponManager`에 `api.admin.{listCoupons, createCoupon, issueCoupon}` 주입·`queryScope="admin"`·`title="쿠폰(관리자)"`
  - 완료 기준: 타입 에러 없이 작성. build 라우트 `/admin/coupons` PASS.

- [x] **T008** — account/notifications/page.tsx 알림 화면 작성
  - 구현 파일: `apps/console/app/(dashboard)/account/notifications/page.tsx` (신규)
  - 관련 요구사항: `FR-007`
  - 상세: `useQuery(['notifications'], api.notification.list)`·`NotificationRow`(Badge·TYPE_LABEL·읽음 버튼)·`markRead`·`markAllRead` mutation·`unread > 0` 시 "전체 읽음" 헤더 액션. 경로: `account/notifications`(99d34a9 정정).
  - 완료 기준: 타입 에러 없이 작성. build 라우트 `/account/notifications` PASS.

### Phase 3. 헤더·네비 통합

- [x] **T009** — (dashboard)/layout.tsx 헤더·네비 갱신
  - 구현 파일: `apps/console/app/(dashboard)/layout.tsx`
  - 관련 요구사항: `FR-006`
  - 상세: `ThemeToggle` import·헤더 우측 액션에 추가. NAV 배열: `{ href: '/admin/coupons', label: '쿠폰(관리자)', section: 'admin' }`·`{ href: '/account/notifications', label: '알림', section: 'common' }` 추가.
  - 완료 기준: 타입 에러 없이 작성. build PASS.

### Phase 4. 검증

- [x] **T010** — 전체 typecheck·build 검증
  - 검증 파일: 모든 변경 파일
  - 관련 요구사항: `SC-001~008`, `NFR-002·NFR-003·NFR-007`
  - 상세: `pnpm --filter console typecheck` 0 error·`pnpm --filter console build` 라우트 PASS(신규 `/admin/coupons`·`/account/notifications` 포함). 기존 화면 동작 회귀 0.
  - 완료 기준: typecheck 0·build 라우트 모두 PASS·기존 판매자 쿠폰 UX 회귀 0

---

## 구현 완료 기준

- [x] 모든 태스크 체크박스가 완료 처리되었다.
- [x] `pnpm --filter console typecheck` 0 error
- [x] `pnpm --filter console build` 모든 라우트 PASS(신규 `/admin/coupons`·`/account/notifications` 포함)
- [x] 기존 판매자 쿠폰 화면 UX 회귀 0
- [x] `git status`에 의도치 않은 파일 없음
