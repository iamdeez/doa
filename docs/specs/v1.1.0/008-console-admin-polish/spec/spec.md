---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-30 02:29
상태: 확정 (구현 완료 — retroactive 문서화)
---

# Spec: 008-console-admin-polish

> Branch: 008-console-admin-polish | Date: 2026-06-30 | Version: v1.1.0
>
> 본 문서는 이미 구현·검증이 완료된 코드(커밋 `5a14be6`·`4a446b2`·`99d34a9`, base `e7d8ebb`)를 근거로 정식
> SDD 포맷으로 retroactive 작성되었다. 모든 요구사항·수용 기준은 실제 구현된 파일 — `coupon-manager.tsx`(공유
> 컴포넌트)·`admin/coupons/page.tsx`·`seller/coupons/page.tsx`(리팩토링)·`theme-toggle.tsx`·`app/layout.tsx`
> (FOUC 스크립트)·`(dashboard)/layout.tsx`(헤더 ThemeToggle·네비 갱신)·`account/notifications/page.tsx`·
> `api-client`(notification facade + admin 쿠폰 메서드)·`shared-types`(notification 타입) — 에서 확인한 사실을
> 기준으로 한다. **007(관리자 콘솔 6종) 이후 폴리시 작업**으로, (1) 관리자 쿠폰 화면(007 범위 외 예고), (2) 판매자·
> 관리자 공용 `CouponManager` 컴포넌트 추출(코드 중복 해소), (3) 다크모드 토글 UI(002 GAP-002-01 부분 해소),
> (4) 인앱 알림 화면(009 알림 이벤트 소비)을 구현한다.

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

007 이 FRONTEND-PLAN Phase 3(관리자 운영 콘솔 6종)을 완성했으나 세 가지 공백이 남았다. 첫째, 007 §범위 외에서
예고한 **관리자 쿠폰 화면**(`/admin/coupons`)이 미구현이다. 백엔드는 `GET/POST /admin/coupons`·`POST /admin/
coupons/:id/issue`를 이미 제공하나 소비 UI가 없었다. 둘째, 006 `seller/coupons/page.tsx`(235줄)와 향후 admin
쿠폰 화면은 동일한 "쿠폰 목록 + 생성 다이얼로그 + 발급 다이얼로그" 구조를 공유해야 하므로 **공유 컴포넌트 추출**이
필요하다. 셋째, 002 디자인 시스템에서 시맨틱 토큰·`.dark` 클래스 기반 다크모드 토큰은 완비됐으나
**토글 UI 자체**(GAP-002-01)와 **FOUC 방지**(서버 렌더 후 클라이언트 hydration 전 순간 라이트 플래시)가 미구현이었다.
넷째, 백엔드 009 인앱 알림 이벤트(`GET /notifications`·`PATCH /notifications/:id/read`·`PATCH /notifications/
read-all`)를 소비하는 **알림 화면**이 없어 사용자가 알림을 확인할 수 없었다.

- **기존 한계**:
  - admin/coupons 화면 미구현(007 §범위 외, 백엔드 라우트 존재).
  - `seller/coupons/page.tsx` 235줄이 독립 모듈 — admin 쿠폰과 동일 구조 복제 시 중복 유발.
  - 다크모드 토글 UI 없음(토큰·`.dark` 클래스는 완비 — 002 GAP-002-01).
  - 인앱 알림 화면 없음(009 알림 이벤트 미소비).

- **008 해소 범위**: (1) `CouponManager` 공유 컴포넌트 추출로 판매자·관리자 쿠폰 화면을 단일 구현으로 통합,
  (2) `admin/coupons/page.tsx`에서 admin 쿠폰 facade 주입, (3) `ThemeToggle` + `THEME_SCRIPT`(FOUC 방지)로
  다크모드 토글 제공, (4) `account/notifications/page.tsx`로 알림 조회·읽음 처리.

> 설계 결정: 공유 컴포넌트(`CouponManager`)는 `CouponApi` 인터페이스 주입으로 판매자/관리자 facade 분기 —
> 직접 api 호출이 아니라 `{ list, create, issue }` 메서드 주입으로 결합도를 낮춘다. `queryScope` 파라미터로
> TanStack Query 캐시 키(`['seller','coupons']` vs `['admin','coupons']`)를 분리한다. 다크모드는 `next-themes`
> 신규 의존 없이 `documentElement.classList` + `localStorage`로 구현한다(P-002).

---

## 사용자 스토리

- **US-001**: 관리자로서, 플랫폼 전역 할인 쿠폰을 생성하고 특정 사용자에게 발급하기를 원한다.
- **US-002**: 판매자로서, 기존 쿠폰 화면의 UX가 그대로 유지되기를 원한다.
- **US-003**: 인증 사용자로서, 다크/라이트 모드를 전환하고 다음 방문에도 설정이 유지되기를 원한다.
- **US-004**: 인증 사용자로서, 내 알림 목록을 조회하고 개별·전체 읽음 처리하기를 원한다.

---

## 기능 요구사항

- **FR-001** (CouponManager 공유 컴포넌트): `apps/console/components/coupon-manager.tsx`(신규)가 `CouponApi`
  인터페이스(`list: () => Promise<CursorPage<Coupon>>`·`create: (body: CreateCouponRequest) => Promise<Coupon>`·
  `issue: (couponId: string, body: IssueCouponRequest) => Promise<UserCoupon>`)와 `queryScope: string`·`title:
  string`·`subtitle: string` props를 받아 쿠폰 목록(`useQuery(key, api.list)`)·`CreateDialog`(할인 유형 Select·
  할인값·최소주문·발급 수량·만료일 Input·클라이언트 `validate`·`api.create` mutation)·`IssueDialog`(`api.issue`
  mutation) 세 블록을 렌더한다. `queryScope`로 캐시 키(`[queryScope,'coupons']`)를 분리하여 판매자·관리자 쿼리가
  독립한다.

- **FR-002** (관리자 쿠폰 화면): `apps/console/app/(dashboard)/admin/coupons/page.tsx`(신규)가 `CouponManager`에
  `api={{ list: () => api.admin.listCoupons(), create: (body) => api.admin.createCoupon(body), issue: (id,
  body) => api.admin.issueCoupon(id, body) }}`·`queryScope="admin"`·`title="쿠폰(관리자)"`·`subtitle="플랫폼 전역
  할인 쿠폰을 생성하고 발급합니다."` 를 주입하여 렌더한다.

- **FR-003** (판매자 쿠폰 화면 리팩토링): `apps/console/app/(dashboard)/seller/coupons/page.tsx`가 기존 235줄
  독립 구현을 `CouponManager` 위임으로 대체한다. `isSeller` 분기(`EmptyState` "판매자 미등록") 유지. api 주입:
  `list: () => api.coupon.listSeller()`·`create: (body) => api.coupon.createSeller(body)`·`issue: (id, body) =>
  api.coupon.issueSeller(id, body)`. `queryScope="seller"`. UX·동작은 006 구현과 동일하게 유지된다.

- **FR-004** (다크모드 토글 컴포넌트): `apps/console/components/theme-toggle.tsx`(신규)가 `ThemeToggle` 컴포넌트를
  제공한다. `toggle()` 핸들러가 `document.documentElement.classList.toggle('dark', next)` + `localStorage.
  setItem('theme', ...)` 영속(try-catch로 localStorage 불가 환경 무시)을 수행한다. `useEffect`에서 마운트 시
  현재 `.dark` 클래스 상태로 `dark` state를 초기화한다. 버튼은 `aria-label`(라이트/다크 전환 안내)을 갖는다.

- **FR-005** (FOUC 방지 스크립트): `apps/console/app/layout.tsx`가 `<html>` 태그에 `suppressHydrationWarning`을
  추가하고 `<head>`에 `THEME_SCRIPT` 인라인 스크립트를 삽입한다. 스크립트는 `localStorage.getItem('theme')`이
  `'dark'`이거나 `prefers-color-scheme: dark`이면 페인트 전에 `document.documentElement.classList.add('dark')`를
  실행하여 초기 라이트 플래시(FOUC)를 방지한다.

- **FR-006** (헤더 ThemeToggle + 네비 갱신): `apps/console/app/(dashboard)/layout.tsx`가 헤더 우측 액션에
  `<ThemeToggle />`를 추가하고, admin 섹션 네비에 "쿠폰(관리자)"(`/admin/coupons`) 항목을, common 섹션에 "알림"
  (`/account/notifications`) 항목을 추가한다.

- **FR-007** (인앱 알림 화면): `apps/console/app/(dashboard)/account/notifications/page.tsx`(신규)가 `useQuery
  (['notifications'], api.notification.list)`로 `NotificationListResult`를 조회하여 `NotificationRow` 카드 목록을
  렌더한다. `TYPE_LABEL`(`ORDER_PLACED→'주문'`·`ORDER_SHIPPED→'배송'`·`SETTLEMENT_CREATED→'정산'`·
  `REVIEW_RECEIVED→'리뷰'`) 매핑으로 알림 유형 Badge(읽음→neutral / 미읽음→info)를 표시한다. 미읽음 알림의
  "읽음" 버튼이 `api.notification.markRead(id)` mutation을 호출하고 성공 시 목록을 invalidate한다. 헤더 액션에
  미읽음 알림이 있을 때(unread>0) "전체 읽음" 버튼이 노출되며 `api.notification.markAllRead()` mutation을
  호출한다. 읽은 알림은 `opacity-70`으로 표시한다.

- **FR-008** (notification facade + admin 쿠폰 메서드): `packages/api-client/src/index.ts`에 `notification`
  도메인 facade(`list(page?, size?)→NotificationListResult`·`markRead(id)→void`·`markAllRead()→{ updated:
  number }`)와 `admin.listCoupons(cursor?, take?)→CursorPage<Coupon>`·`admin.createCoupon(body)→Coupon`·
  `admin.issueCoupon(couponId, body)→UserCoupon` 3개 메서드를 추가한다.

- **FR-009** (notification view 타입): `packages/shared-types/src/index.ts`에 `NotificationType`(4종:
  `ORDER_PLACED`·`ORDER_SHIPPED`·`SETTLEMENT_CREATED`·`REVIEW_RECEIVED`)·`Notification`(id·userId·type·title·
  body·isRead·createdAt)·`NotificationListResult`(items·total·page·size) view 타입을 추가한다. 009 인앱 알림
  백엔드 응답이 OpenAPI 미정의이므로 전이형 view 타입으로 한시 정의한다.

---

## 비기능 요구사항

- **NFR-001** (신규 의존 금지 — P-002): 다크모드 구현에 `next-themes` 등 신규 npm 패키지를 추가하지 않는다.
  `document.documentElement.classList`·`localStorage` + `window.matchMedia`(THEME_SCRIPT)만 사용한다.

- **NFR-002** (하위 호환 — console 회귀 0): 판매자 쿠폰 화면의 UX·동작은 006과 동일하게 유지된다. `CouponManager`
  추출 후 `seller/coupons/page.tsx`의 기능(목록·생성·발급)·010 클라이언트 검증(discountValue>0·PERCENTAGE 1~100)·
  에러 메시지·상태 분기가 변경 없이 작동한다. `console typecheck` 0 error·`console build` 라우트 PASS·기존 화면
  동작 회귀 0(NFR-005 연속).

- **NFR-003** (다크모드 hydration 불일치 방지): FOUC 방지 `THEME_SCRIPT`는 React hydration 전 `<head>` 스크립트로
  실행된다. `<html lang="ko" suppressHydrationWarning>`으로 서버·클라이언트 className 불일치 hydration 경고를 억제한다.

- **NFR-004** (알림·쿠폰 view 타입 한시 — OpenAPI 미정의): 알림·admin 쿠폰 응답은 백엔드 OpenAPI 응답 content가
  미주석이므로(001 coverage-gap 연속) 전이형 view 타입으로 한시 정의한다. 백엔드 응답 DTO + `@ApiResponse({
  type })` 보강 후 생성 타입으로 대체 가능하다(004·006·007 GAP 연속).

- **NFR-005** (권한 — AdminGuard 백엔드 강제): 관리자 쿠폰 화면은 007 연속 패턴으로 admin 네비에 노출되며 UI
  권한 필터 없이 항상 표시된다. 실제 인가는 백엔드 AdminGuard가 강제한다.

---

## 수용 기준

> **환경 태그 규약**:
> | 태그 | 의미 |
> |---|---|
> | `[env:static]` | 정적 코드/구조 검증(코드 리뷰·grep·분기 로직 확인)으로 판정 |
> | `[env:typecheck]` | TypeScript 타입체크(`console typecheck`) 통과로 판정 |
> | `[env:build]` | 빌드 산출(`console build` 라우트 컴파일) 성공으로 판정 |

- **SC-001** (`FR-001` 관련): `CouponManager` 컴포넌트가 `CouponApi` 인터페이스·`queryScope`·`title`·`subtitle`
  props를 받고, `useQuery([queryScope,'coupons'], api.list)`로 조회하며, `CreateDialog`(`validate` 포함)·
  `IssueDialog` 서브컴포넌트를 포함한다. `discountLabel`·`validate`(discountValue>0·PERCENTAGE 1~100) 로직이
  존재한다. [env:static] [env:typecheck]

- **SC-002** (`FR-002` 관련): `/admin/coupons`가 `CouponManager`에 `api.admin.{listCoupons, createCoupon,
  issueCoupon}` 주입·`queryScope="admin"` 으로 렌더하고, console build에서 `/admin/coupons` 라우트가 컴파일된다.
  [env:static] [env:typecheck] [env:build]

- **SC-003** (`FR-003` 관련): `seller/coupons/page.tsx`가 `CouponManager` 위임으로 리팩토링되고(≤30줄),
  `isSeller` 분기(EmptyState "판매자 미등록")가 유지되며, `queryScope="seller"`·`api.coupon.*` 주입이 올바르다.
  console typecheck 0 error·build 라우트 기존 판매자 쿠폰 경로 PASS·기존 화면 동작 회귀 0. [env:static]
  [env:typecheck] [env:build]

- **SC-004** (`FR-004` 관련): `ThemeToggle` 컴포넌트가 `documentElement.classList.toggle('dark', next)` +
  `localStorage.setItem('theme', ...)` 영속 + try-catch(localStorage 불가 무시) + `useEffect`에서 마운트 시 `.dark`
  상태 초기화 + `aria-label`을 포함한다. [env:static] [env:typecheck]

- **SC-005** (`FR-005` 관련): `app/layout.tsx`에 `suppressHydrationWarning` + `THEME_SCRIPT`(`localStorage
  'theme'` + `prefers-color-scheme: dark` 분기 → `classList.add('dark')`) 인라인 스크립트가 `<head>` 내에
  존재한다. [env:static] [env:typecheck] [env:build]

- **SC-006** (`FR-006` 관련): `(dashboard)/layout.tsx` 헤더에 `<ThemeToggle />`가 있고, NAV 배열에 `{ href:
  '/admin/coupons', label: '쿠폰(관리자)', section: 'admin' }`·`{ href: '/account/notifications', label: '알림',
  section: 'common' }` 항목이 추가되었다. [env:static] [env:typecheck] [env:build]

- **SC-007** (`FR-007` 관련): `/account/notifications`가 `useQuery(['notifications'], api.notification.list)`로
  `NotificationListResult`를 조회하여 `NotificationRow`(Badge tone info/neutral·TYPE_LABEL 매핑·읽음 버튼·
  opacity-70 읽음 표시) 카드 목록을 렌더하고, `markRead`·`markAll` mutation이 `onSuccess` invalidate한다.
  unread>0 시 "전체 읽음" 헤더 버튼이 노출된다. console build에서 `/account/notifications` 라우트가 컴파일된다.
  [env:static] [env:typecheck] [env:build]

- **SC-008** (`FR-008`·`FR-009` 관련): `api-client`에 `notification` 도메인 facade 3 메서드(list·markRead·
  markAllRead)·`admin.listCoupons`·`admin.createCoupon`·`admin.issueCoupon` 3 메서드가 추가되고, `shared-types`에
  `NotificationType`·`Notification`·`NotificationListResult` view 타입 3종이 정의된다. [env:static]
  [env:typecheck]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건.
> MoSCoW: Must / Should / Could / Won't

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-002 | FR-001 | NFR-002 | SC-001 | static/typecheck | Must |
| US-001 | FR-002 | NFR-004·NFR-005 | SC-002 | static/typecheck/build | Must |
| US-002 | FR-003 | NFR-002 | SC-003 | static/typecheck/build | Must |
| US-003 | FR-004 | NFR-001·NFR-003 | SC-004 | static/typecheck | Must |
| US-003 | FR-005 | NFR-001·NFR-003 | SC-005 | static/typecheck/build | Must |
| US-003 | FR-006 | NFR-002 | SC-006 | static/typecheck/build | Must |
| US-004 | FR-007 | NFR-004 | SC-007 | static/typecheck/build | Must |
| US-001·004 | FR-008·FR-009 | NFR-004 | SC-008 | static/typecheck | Must |

> 모든 FR(FR-001~009)이 SC로 대응된다. 매핑 누락 0건. 본 차수는 UI 화면이나 별도 e2e/단위 테스트 스위트가
> 없으며, 검증은 **빌드/타입체크 + 정적 구조 검증**으로 갈음한다.

---

## 범위 외

- **알림 실시간 push**: WebSocket·SSE 기반 실시간 알림 수신은 범위 외다(후속). 현재는 진입 시 1회 조회.
- **알림 삭제**: 알림 삭제 UI는 범위 외다(후속). 읽음 처리만 제공.
- **관리자 쿠폰 cursor 더보기**: `admin.listCoupons` facade는 cursor/take를 지원하나 화면은 첫 페이지만 렌더한다
  (판매자 쿠폰과 동일 패턴 — 후속).
- **낙관적 업데이트**: markRead·markAllRead·쿠폰 create/issue mutation은 서버 응답 후 invalidate 방식이다(후속).
- **e2e/단위 테스트**: 본 차수는 타입체크·빌드·정적 구조 검증으로 갈음한다(후속).
- **다크모드 시스템 선호 실시간 감지**: THEME_SCRIPT는 초기 로드 시만 `prefers-color-scheme`을 확인한다. 런타임
  시스템 모드 변경 감지(matchMedia 이벤트)는 범위 외다(후속).

---

## 미결 사항

없음 — 본 spec은 구현 완료 코드를 기준으로 retroactive 작성되었으며, 모든 요구사항·수용 기준이 실제 구현
(`coupon-manager.tsx`·`admin/coupons/page.tsx`·`seller/coupons/page.tsx` 리팩토링·`theme-toggle.tsx`·
`app/layout.tsx` FOUC 스크립트·`(dashboard)/layout.tsx`·`account/notifications/page.tsx`·api-client·
shared-types)과 대조 확인되었다. 알림 실시간 push·삭제·쿠폰 cursor·낙관적 업데이트·e2e는 범위 외(후속)로 분리되며,
핵심 목표 — 관리자 쿠폰 화면·CouponManager 공유화·다크모드 토글·인앱 알림 화면 — 는 console typecheck 0·build
라우트 PASS로 달성되었다. 알림·admin 쿠폰 응답 스키마 미정의(view 타입 한시)는 001/004/006/007 GAP 연속이며
gaps.md GAP-008-01로 기록한다.
