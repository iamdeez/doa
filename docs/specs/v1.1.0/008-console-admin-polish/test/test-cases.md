---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-30 02:34
상태: 확정 (retroactive)
---

# 테스트 케이스 — 008-console-admin-polish

> 본 차수는 UI 화면 위주로 별도 단위/e2e 테스트 스위트가 없으며, 검증은 **TypeScript 타입체크 + console 빌드 +
> 정적 구조 검증(grep·코드 리뷰)**으로 갈음한다. 007 연속 패턴.

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
- [시나리오 상세](#시나리오-상세)

---

## SC × 시나리오 매트릭스

| SC-ID | FR | 시나리오 ID | 시나리오 요약 | 검증 유형 |
|---|---|---|---|---|
| SC-001 | FR-001 | TC-008-001 | CouponManager props·queryScope·CreateDialog·IssueDialog·validate·discountLabel | 정적 + typecheck |
| SC-002 | FR-002 | TC-008-002 | /admin/coupons 라우트 컴파일 + CouponManager admin 주입 | typecheck + build |
| SC-003 | FR-003 | TC-008-003 | seller/coupons 리팩토링·isSeller 분기·queryScope="seller"·기존 UX 회귀 0 | 정적 + typecheck + build |
| SC-004 | FR-004 | TC-008-004 | ThemeToggle toggle()·localStorage 영속·useEffect 초기화·aria-label | 정적 + typecheck |
| SC-005 | FR-005 | TC-008-005 | app/layout.tsx THEME_SCRIPT + suppressHydrationWarning | 정적 + typecheck + build |
| SC-006 | FR-006 | TC-008-006 | (dashboard)/layout.tsx ThemeToggle 헤더·/admin/coupons·/account/notifications 네비 | 정적 + typecheck + build |
| SC-007 | FR-007 | TC-008-007 | account/notifications 화면 구조·markRead·markAllRead·unread 조건부 전체읽음·경로 | 정적 + typecheck + build |
| SC-008 | FR-008·009 | TC-008-008 | notification facade 3종·admin 쿠폰 3종·shared-types 3종 | 정적 + typecheck |

---

## 시나리오 상세

### TC-008-001 — CouponManager 공유 컴포넌트 구조 검증 (SC-001)

**목적**: `CouponApi` 인터페이스·`queryScope` 캐시 키 분리·`CreateDialog`·`IssueDialog`·`validate`·`discountLabel` 존재 확인.

| 항목 | 내용 |
|---|---|
| 대상 파일 | `apps/console/components/coupon-manager.tsx` |
| 검증 방법 | 정적 코드 리뷰 + console typecheck |
| 입력 | 소스 코드 직접 확인 |
| 기대 결과 | `CouponApi { list, create, issue }` interface 존재·`useQuery([queryScope,'coupons'], api.list)` 캐시 키·`CreateDialog`(type Select·discountValue·minOrderAmount·maxIssuableCount·expiresAt·validate·mutation)·`IssueDialog`(mutation)·`discountLabel`·`validate` 함수 존재·typecheck 0 error |

---

### TC-008-002 — 관리자 쿠폰 화면 라우트 컴파일 (SC-002)

**목적**: `/admin/coupons` 신규 라우트가 타입체크·빌드에서 오류 없이 컴파일됨을 확인.

| 항목 | 내용 |
|---|---|
| 대상 파일 | `apps/console/app/(dashboard)/admin/coupons/page.tsx` |
| 검증 방법 | console typecheck 0 + console build `/admin/coupons` PASS |
| 입력 | 소스 코드 확인 |
| 기대 결과 | `CouponManager`에 `api.admin.{listCoupons,createCoupon,issueCoupon}` 주입·`queryScope="admin"`·라우트 build PASS |

---

### TC-008-003 — 판매자 쿠폰 리팩토링 회귀 0 (SC-003)

**목적**: CouponManager 위임 후 기존 판매자 쿠폰 UX 동작 불변·isSeller 분기 유지 확인.

| 항목 | 내용 |
|---|---|
| 대상 파일 | `apps/console/app/(dashboard)/seller/coupons/page.tsx` |
| 검증 방법 | 정적 코드 리뷰 + typecheck 0 + build PASS |
| 입력 | 소스 코드 확인 |
| 기대 결과 | ≤30줄·`isSeller` 분기(EmptyState "판매자 미등록") 유지·`queryScope="seller"`·`api.coupon.*` 주입·typecheck 0·기존 라우트 `/seller/coupons` build PASS |

---

### TC-008-004 — ThemeToggle 컴포넌트 동작 구조 검증 (SC-004)

**목적**: `ThemeToggle`의 다크모드 전환·localStorage 영속·마운트 초기화·접근성 구조 확인.

| 항목 | 내용 |
|---|---|
| 대상 파일 | `apps/console/components/theme-toggle.tsx` |
| 검증 방법 | 정적 코드 리뷰 + typecheck |
| 입력 | 소스 코드 직접 확인 |
| 기대 결과 | `documentElement.classList.toggle('dark', next)` + `localStorage.setItem('theme', ...)` try-catch 영속 + `useEffect` 마운트 시 `.dark` 상태 초기화 + `aria-label` 포함·typecheck 0 error |

---

### TC-008-005 — FOUC 방지 스크립트 + suppressHydrationWarning (SC-005)

**목적**: `app/layout.tsx`에 FOUC 방지 인라인 스크립트와 hydration 경고 억제가 올바르게 적용되었음을 확인.

| 항목 | 내용 |
|---|---|
| 대상 파일 | `apps/console/app/layout.tsx` |
| 검증 방법 | 정적 코드 리뷰 + typecheck 0 + build PASS |
| 입력 | 소스 코드 직접 확인 |
| 기대 결과 | `THEME_SCRIPT`(`localStorage.getItem('theme')`·`prefers-color-scheme`·`classList.add('dark')`) 상수 정의·`<head>` 내 `<script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}>` 삽입·`<html lang="ko" suppressHydrationWarning>` 확인·typecheck 0·build PASS |

---

### TC-008-006 — 헤더 ThemeToggle + 네비 항목 추가 (SC-006)

**목적**: 대시보드 레이아웃 헤더에 `ThemeToggle`이 추가되고 새 네비 항목이 올바른 경로로 등록됨 확인.

| 항목 | 내용 |
|---|---|
| 대상 파일 | `apps/console/app/(dashboard)/layout.tsx` |
| 검증 방법 | 정적 코드 리뷰 + typecheck 0 + build PASS |
| 입력 | 소스 코드 직접 확인 |
| 기대 결과 | 헤더 우측 액션에 `<ThemeToggle />` 존재·NAV 배열에 `{ href: '/admin/coupons', label: '쿠폰(관리자)', section: 'admin' }`·`{ href: '/account/notifications', label: '알림', section: 'common' }` 항목 존재·typecheck 0·build PASS |

---

### TC-008-007 — 알림 화면 구조·읽음·경로 (SC-007)

**목적**: `/account/notifications` 화면의 조회·읽음·전체 읽음 조건·경로 정확성 확인.

| 항목 | 내용 |
|---|---|
| 대상 파일 | `apps/console/app/(dashboard)/account/notifications/page.tsx` |
| 검증 방법 | 정적 코드 리뷰 + typecheck 0 + build PASS |
| 입력 | 소스 코드 직접 확인 |
| 기대 결과 | `useQuery(['notifications'], api.notification.list)` 조회·`NotificationRow`(Badge info/neutral·TYPE_LABEL 매핑·읽음 버튼)·`markRead` mutation onSuccess invalidate·`markAllRead` mutation onSuccess invalidate·`unread > 0` 시 "전체 읽음" 헤더 액션 노출·라우트 경로 `account/notifications`(복수) 확인·typecheck 0·build `/account/notifications` PASS |

---

### TC-008-008 — notification facade + admin 쿠폰 메서드 + shared-types (SC-008)

**목적**: api-client에 notification 3개 메서드·admin 쿠폰 3개 메서드가 추가되고 shared-types에 notification 타입 3종이 정의됨 확인.

| 항목 | 내용 |
|---|---|
| 대상 파일 | `packages/api-client/src/index.ts`, `packages/shared-types/src/index.ts` |
| 검증 방법 | 정적 코드 리뷰 + typecheck 0 |
| 입력 | 소스 코드 직접 확인 |
| 기대 결과 | `api.notification.list`·`api.notification.markRead`·`api.notification.markAllRead` 메서드 존재·`api.admin.listCoupons`·`api.admin.createCoupon`·`api.admin.issueCoupon` 메서드 존재·`NotificationType`·`Notification`·`NotificationListResult` 타입 존재·기존 facade 불변·typecheck 0 error |
