---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-30 02:34
상태: 확정 (retroactive)
---

# 테스트 실행 결과 — 008-console-admin-polish

## 목차

- [실행 요약](#실행-요약)
- [실패 목록](#실패-목록)
- [SC 매핑표 검증](#sc-매핑표-검증)
- [설계 문서 정합성](#설계-문서-정합성)
- [회귀 탐지](#회귀-탐지)

---

## 실행 요약

> 본 retroactive 검증은 008 완료 커밋 `99d34a9`(base `e7d8ebb`, 커밋 3개: `5a14be6`·`4a446b2`·`99d34a9`)에서
> 수행되었다. 본 차수는 UI 화면으로 별도 e2e/단위 테스트 스위트가 없으며, 검증은 타입체크 + console 빌드 +
> 정적 구조 검증으로 갈음한다. 007 연속 패턴.

| 항목 | 결과 (HEAD `99d34a9`) |
|---|---|
| 실행 일시 | 2026-06-30 02:34 |
| console typecheck | **0 error** (PASS) |
| console build | **모든 라우트 PASS** (신규 `/admin/coupons`·`/account/notifications` 포함) |
| CouponManager 공유화 | `coupon-manager.tsx` — `CouponApi` 인터페이스·`queryScope` 캐시 분리·`CreateDialog`·`IssueDialog`·`validate`·`discountLabel` |
| 관리자 쿠폰 화면 | `admin/coupons/page.tsx` — `CouponManager` + `api.admin.*` 주입·`queryScope="admin"` |
| 판매자 쿠폰 리팩토링 | `seller/coupons/page.tsx` — 235줄→~26줄 위임·`isSeller` 분기 유지·기존 UX 회귀 0 |
| ThemeToggle + FOUC 방지 | `theme-toggle.tsx`·`app/layout.tsx` — `classList.toggle`·`localStorage`·`THEME_SCRIPT`·`suppressHydrationWarning` |
| 헤더 + 네비 | `(dashboard)/layout.tsx` — `<ThemeToggle />`·"쿠폰(관리자)"/알림 네비 |
| 알림 화면 | `account/notifications/page.tsx` — list·markRead·markAllRead·unread 조건·TYPE_LABEL |
| facade + 타입 | `api-client` notification 3종 + admin 쿠폰 3종·`shared-types` notification 타입 3종 |
| 전체 통과 여부 | **PASS** |
| 신규 단위/e2e 테스트 | **0** (UI 화면 — 타입체크·빌드·정적 갈음) |
| 마이그레이션 | **없음** (DB 스키마 변경 0) |

### 007(`e7d8ebb`) → 008(`99d34a9`) 델타

| 항목 | base(`e7d8ebb`) | 008(`99d34a9`) | 델타 |
|---|---|---|---|
| 공유 컴포넌트 | — | `coupon-manager.tsx` | **신규** — 판매자·관리자 쿠폰 공용 |
| 관리자 쿠폰 화면 | 미구현(007 범위 외) | `admin/coupons/page.tsx` | **신규** |
| 판매자 쿠폰 | 235줄 독립 | ~26줄 CouponManager 위임 | **리팩토링** |
| 다크모드 토글 | 미구현(GAP-002-01) | `theme-toggle.tsx` + FOUC 방지 | **신규** |
| 알림 화면 | 미구현(009 소비 UI) | `account/notifications/page.tsx` | **신규** |
| 네비(admin) | 판매자 승인까지(007) | + "쿠폰(관리자)" | **+1 항목** |
| 네비(common) | 위시리스트까지 | + "알림" | **+1 항목** |
| api-client | admin 10 메서드(007) | + notification 3종 + admin 쿠폰 3종 | **+6 메서드** |
| shared-types | admin view 타입 9종(007) | + notification 타입 3종 | **+3 타입** |
| console build 라우트 | 22(007) | 24(+2: admin/coupons·account/notifications) | +2 |

> **신규 단위/e2e 0 산정(직접 확인)**: `git diff e7d8ebb 99d34a9 -- apps/console packages`의 변경 파일
> (`coupon-manager.tsx`·`notifications/page.tsx`·`seller/coupons/page.tsx`·`(dashboard)/layout.tsx`·
> `theme-toggle.tsx`·`shared-types/index.ts`·`api-client/index.ts`·`admin/coupons/page.tsx`·`app/layout.tsx`) 9종 중
> `*.spec.ts`·`*.test.ts`·`*.e2e.ts` 변경/추가 0. UI 화면 성격으로 테스트 스위트 미추가.
> `package.json` 변경 0(신규 의존 0).

### 실행 커맨드

```bash
cd /Users/krystal/workspace/doa/doa-next
pnpm --filter console typecheck            # tsc --noEmit (0 error)
pnpm --filter console build                # 모든 라우트 PASS (신규 /admin/coupons·/account/notifications 포함)
git diff --numstat e7d8ebb 99d34a9 -- apps/console packages   # 9 files, +464/-229
```

---

## 실패 목록

**실패 없음.** console typecheck 0 error, console build 모든 라우트 PASS(신규 `/admin/coupons`·
`/account/notifications` 포함), 기존 화면(상품·계정·주문·배송·판매자 통계/정산/기존쿠폰) 동작 회귀 0.
변경 구조(CouponManager 공유화·관리자쿠폰 화면·판매자쿠폰 리팩토링·ThemeToggle+FOUC방지·알림화면·
notification facade·shared-types 타입)가 spec.md FR-001~009·SC-001~008과 일치.

---

## SC 매핑표 검증

| SC-ID | 관련 검증 | 통과 여부 |
|---|---|---|
| SC-001 | `coupon-manager.tsx` — `CouponApi` 인터페이스·`queryScope` 캐시·`CreateDialog`·`IssueDialog`·`validate`·`discountLabel` | VERIFIED(static)/PASS(typecheck) |
| SC-002 | `admin/coupons/page.tsx` — `CouponManager` admin 주입·`queryScope="admin"` + build `/admin/coupons` | VERIFIED(static)/PASS(typecheck/build) |
| SC-003 | `seller/coupons/page.tsx` — ≤30줄·`isSeller` 분기·`queryScope="seller"` + typecheck/build PASS | VERIFIED(static)/PASS(typecheck/build) |
| SC-004 | `theme-toggle.tsx` — `toggle()`·`localStorage`·try-catch·`useEffect` 초기화·`aria-label` | VERIFIED(static)/PASS(typecheck) |
| SC-005 | `app/layout.tsx` — `THEME_SCRIPT`·`suppressHydrationWarning` + build PASS | VERIFIED(static)/PASS(typecheck/build) |
| SC-006 | `(dashboard)/layout.tsx` — `<ThemeToggle />`·네비 `/admin/coupons`·`/account/notifications` | VERIFIED(static)/PASS(typecheck/build) |
| SC-007 | `notifications/page.tsx` — `useQuery`·markRead·markAllRead·unread 조건·TYPE_LABEL + build | VERIFIED(static)/PASS(typecheck/build) |
| SC-008 | `api-client` notification 3종 + admin 쿠폰 3종·`shared-types` 타입 3종 | VERIFIED(static)/PASS(typecheck) |

---

## 설계 문서 정합성

### plan.md 현행화 점검

- CouponManager — `CouponApi { list, create, issue }`·`queryScope` 캐시 분리·`CreateDialog`·`IssueDialog` —
  plan.md §핵심 설계 CouponManager·FR-001·NFR-006과 일치 ✓
- 관리자 쿠폰 — `api.admin.{listCoupons,createCoupon,issueCoupon}` 주입·`queryScope="admin"` —
  plan.md §핵심 설계·FR-002와 일치 ✓
- 판매자 쿠폰 리팩토링 — 235줄→~26줄·`isSeller` 분기 유지 — plan.md §핵심 설계·FR-003·NFR-002와 일치 ✓
- ThemeToggle — `classList.toggle`·`localStorage` try-catch·`useEffect` 초기화 — plan.md §핵심 설계
  다크모드·FR-004·NFR-001·003과 일치 ✓
- FOUC 방지 — `THEME_SCRIPT`·`suppressHydrationWarning` — plan.md §핵심 설계 FOUC 방지·FR-005·NFR-003과 일치 ✓
- 알림 화면 — `useQuery(['notifications'])`·markRead·markAllRead·unread 조건·TYPE_LABEL — plan.md §핵심 설계
  알림·FR-007·NFR-004와 일치 ✓
- facade·타입 — notification 도메인·admin 쿠폰 메서드·notification view 타입 — plan.md §인터페이스 계약·데이터
  모델·FR-008·009·NFR-004·005와 일치 ✓
- 신규 의존 0 — `package.json` 변경 없음 — plan.md Gates P-002·selection-phases와 일치 ✓

### 발견된 한계·관찰

- **e2e 부재**: UI 화면이나 e2e/단위 테스트 없음(빌드/타입체크/정적 갈음). 후속 권고(GAP-008-01).
- **다크모드 런타임 검증 부재**: FOUC 방지·localStorage 불가 환경 동작은 브라우저 확인 필요(coverage-gap.md 기록).
- **알림·admin 쿠폰 응답 view 타입 한시**: OpenAPI 미정의 → 전이형 view 타입. 백엔드 보강 후 대체(004·006·007
  GAP 연속 — GAP-008-01).
- **알림 경로 정정 이력**: `4a446b2`에서 cwd 버그로 `account/notification`(단수) 잘못 생성, `99d34a9`에서
  `account/notifications`(복수)로 정정 완료.

### v1.1.0(007) 회귀 확인

- console 화면: 기존 화면(상품·계정·주문·배송·판매자 통계/정산/쿠폰)은 동작 불변이며 신규 화면 2개
  (`/admin/coupons`·`/account/notifications`) 추가. typecheck 0·build 모든 라우트 PASS(회귀 0 — NFR-002·SC-003).
- 공유 패키지: `api-client`는 notification·admin 쿠폰 메서드 **추가**(기존 facade·client·http 불변),
  `shared-types`는 notification 타입 **추가**(기존 타입 불변), `@doa/ui`·`@doa/design-tokens` **변경 0**. 비파괴.

---

## 회귀 탐지

008이 추가/변경한 파일 (`git diff e7d8ebb 99d34a9 -- apps/console packages` 기준):
- `apps/console/components/coupon-manager.tsx`: CouponManager 공유 컴포넌트(신규 +247 -0)
- `apps/console/app/(dashboard)/account/notifications/page.tsx`: 알림 화면(신규 +83 -0)
- `apps/console/app/(dashboard)/seller/coupons/page.tsx`: CouponManager 위임 리팩토링(+13 -222)
- `apps/console/app/(dashboard)/layout.tsx`: ThemeToggle·네비 추가(+12 -6)
- `apps/console/components/theme-toggle.tsx`: 다크모드 토글(신규 +34 -0)
- `packages/shared-types/src/index.ts`: notification view 타입 3종(+28 -0)
- `packages/api-client/src/index.ts`: notification+admin 쿠폰 facade(+20 -0)
- `apps/console/app/(dashboard)/admin/coupons/page.tsx`: 관리자 쿠폰(신규 +20 -0)
- `apps/console/app/layout.tsx`: FOUC 방지(+7 -1)

기존 console 화면 동작·공유 패키지 기존 export 불변 → 회귀 0(typecheck 0·build 모든 라우트 PASS).
마이그레이션 없음(DB 스키마 변경 0). 신규 의존 0(`package.json` 변경 없음).
