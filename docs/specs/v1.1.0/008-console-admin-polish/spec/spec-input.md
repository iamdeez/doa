---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-30 02:29
상태: 확정 (retroactive)
---

# Spec Input: 008-console-admin-polish

> 수집 일시: 2026-06-30 | 맥락: 007(관리자 콘솔 6종) 직후 폴리시 작업 — 관리자 쿠폰 화면(007 범위 외 예고),
> CouponManager 공유 컴포넌트 추출(판매자·관리자 공용), 다크모드 토글(002 GAP-002-01 일부 해소), 인앱 알림 화면
> (009 알림 이벤트 소비 UI). 사용자 지시: "008 콘솔 폴리시".

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
| 3. 핵심 기능 | 완료 | [Q-A~E] |
| 4. 데이터 & 입출력 | 완료 | [Q-F] |
| 5. 제약조건 | 완료 | [Q5] |
| 6. 예외 & 실패 시나리오 | 완료 | [Q6] |

## 원 요청 맥락

사용자 지시: **007(관리자 콘솔) 이후 콘솔 폴리시**. 007 §범위 외에서 예고된 `admin/coupons`(008) 구현,
006 의 `seller/coupons/page.tsx` 와 admin coupons 간 코드 중복 해소를 위한 `CouponManager` 공유 컴포넌트 추출,
002 GAP-002-01(다크 토글 UI 부재) 해소를 위한 `ThemeToggle` 컴포넌트 + `app/layout.tsx` FOUC 방지 스크립트,
009 인앱 알림 이벤트를 소비하는 알림 화면(`/account/notifications`) 추가. 본 문서는 커밋 `5a14be6`·`4a446b2`·
`99d34a9`(base `e7d8ebb`)를 정식 SDD 포맷으로 보강하기 위한 입력 재구성이다.

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션·근거 | 채택 결과 |
|---|---|---|---|
| Q-A | 관리자 쿠폰 화면 구현 방식 | A:독립 페이지(006 coupons 복제) / B:공유 컴포넌트 추출 후 재사용 | **B 채택** — `CouponManager` 공유 컴포넌트(`apps/console/components/`)를 추출하고 판매자·관리자 양쪽에서 `api` prop 주입으로 재사용. 코드 중복 0 |
| Q-B | CouponManager API 추상화 방식 | A:api 객체 직접 참조 / B:CouponApi 인터페이스(list·create·issue 메서드) | **B 채택** — `CouponApi { list, create, issue }` 인터페이스 주입으로 판매자/관리자 facade 분기. queryScope로 캐시 키 분리 |
| Q-C | 다크모드 구현 방식 | A:Next.js `next-themes` 패키지 / B:자체 ThemeToggle + FOUC 방지 스크립트 | **B 채택** — 신규 의존 추가 없이(P-002) `documentElement.classList.toggle('dark')` + `localStorage.theme` 영속. `app/layout.tsx`에 인라인 `THEME_SCRIPT`(FOUC 방지) |
| Q-D | 인앱 알림 화면 경로 | A:`account/notification` / B:`account/notifications` | **B 채택** — `99d34a9`에서 경로 오류(cwd 버그)를 수정하여 `account/notifications`로 확정 |
| Q-E | 알림 facade 위치 | A:기존 facade 확장 / B:`notification` 신규 도메인 facade | **B 채택** — `api-client`에 `notification` 도메인(list·markRead·markAllRead) + `shared-types`에 `Notification`·`NotificationType`·`NotificationListResult` view 타입 추가 |

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

Q1. 왜 만드는가?
- 007 §범위 외에서 예고된 `admin/coupons` 구현. 006 판매자 쿠폰 화면과 공유 로직 추출로 코드 중복 해소.
  002 GAP-002-01(다크 토글 UI 부재) 부분 해소. 009 인앱 알림 이벤트의 소비 UI 제공.

Q2. 현재 어떻게? (008 이전)
- `admin/coupons` 미구현(007 범위 외 예고). 판매자 쿠폰 로직(`seller/coupons/page.tsx` 235줄)이 독립 모듈.
  다크모드 토글 UI 없음(시맨틱 토큰은 완비). 알림 화면 없음(백엔드 009 알림 이벤트 존재).

Q3. 성공 판단 기준
- `/admin/coupons`(CouponManager 위임)·`/account/notifications`(알림 목록+읽음) 렌더.
  `ThemeToggle`이 헤더에 노출되고 다크모드 전환이 localStorage에 영속.
  console typecheck 0·build 라우트 PASS·기존 화면 회귀 0.

### [카테고리 2] 사용자 & 이해관계자

Q4. 사용자 역할
- 관리자(admin): 플랫폼 전역 쿠폰 생성·사용자 발급.
- 판매자(seller): 기존 쿠폰 화면 동작 불변(CouponManager 위임 후 동일 UX).
- 인증 사용자: 다크/라이트 모드 전환, 인앱 알림 조회·읽음 처리.

### [카테고리 3] 핵심 기능

**Must:**
- `apps/console/components/coupon-manager.tsx`(신규): `CouponApi` 인터페이스(list·create·issue) + `queryScope` 주입.
  판매자·관리자 공용. `discountLabel`·`validate`·`CreateDialog`·`IssueDialog` 추출.
- `apps/console/app/(dashboard)/admin/coupons/page.tsx`(신규): `CouponManager`에 `api.admin.{listCoupons,
  createCoupon,issueCoupon}` 주입.
- `apps/console/app/(dashboard)/seller/coupons/page.tsx`(수정): 235줄 코드를 `CouponManager` 위임으로
  대체(13줄). `isSeller` 분기 유지.
- `apps/console/components/theme-toggle.tsx`(신규): `documentElement.classList.toggle('dark')` +
  `localStorage.theme` 영속 + `suppressHydrationWarning`.
- `apps/console/app/layout.tsx`(수정): `THEME_SCRIPT` 인라인 스크립트(FOUC 방지) + `suppressHydrationWarning`.
- `apps/console/app/(dashboard)/layout.tsx`(수정): 헤더에 `<ThemeToggle />` + admin 네비에 "쿠폰(관리자)"
  (`/admin/coupons`) + common 네비에 "알림"(`/account/notifications`) 추가.
- `apps/console/app/(dashboard)/account/notifications/page.tsx`(신규): `api.notification.list()`
  (`GET /notifications` → `NotificationListResult`) + `markRead`·`markAllRead` mutation. 읽음 Badge(info/neutral)·
  TYPE_LABEL 매핑. "전체 읽음" 헤더 액션(unread>0 시만).
- `packages/api-client/src/index.ts`: `notification` 도메인 facade(list·markRead·markAllRead) +
  `admin.listCoupons`·`admin.createCoupon`·`admin.issueCoupon` 추가.
- `packages/shared-types/src/index.ts`: `NotificationType`·`Notification`·`NotificationListResult` view 타입 추가.

**제외(Out of Scope):**
- 알림 실시간 push(WebSocket/SSE), 알림 삭제, 쿠폰 cursor 더보기(admin), 낙관적 업데이트, e2e 테스트.

### [카테고리 4] 데이터 & 입출력

- 백엔드 라우트: `GET /notifications`(`NotificationListResult`)·`PATCH /notifications/:id/read`·
  `PATCH /notifications/read-all`(009 인앱 알림). `POST /admin/coupons`·`GET /admin/coupons`·
  `POST /admin/coupons/:id/issue`(관리자 쿠폰).
- view 타입: `Notification`(id·userId·type·title·body·isRead·createdAt)·`NotificationType`(4종)·
  `NotificationListResult`(items·total·page·size).
- facade: `api.notification.{list,markRead,markAllRead}`·`api.admin.{listCoupons,createCoupon,issueCoupon}`.

### [카테고리 5] 제약조건

Q5. 기술 스택 제약
- 신규 npm 의존 추가 0(`next-themes` 미채택 — P-002). 기존 `documentElement.classList`·`localStorage` 활용.
- 다크모드: `.dark` 클래스 + 시맨틱 토큰(002 산출). `suppressHydrationWarning`으로 SSR hydration 불일치 회피.
- 알림·쿠폰 응답은 OpenAPI 미정의이므로 전이형 view 타입 + facade(004·006·007 연속).
- console typecheck/build 회귀 0(NFR-005 연속).

### [카테고리 6] 예외 & 실패 시나리오

Q6. 엣지 케이스
- 다크모드 localStorage 불가 환경 → try-catch 무시(기능 저하 허용).
- 알림 0건 → `EmptyState`. 전체 읽음 → "모든 알림을 확인했습니다." 헤더 subtitle.
- 관리자 쿠폰 비관리자 접근 → 백엔드 AdminGuard 403 차단. UI는 항상 노출(007 연속 패턴).
- 판매자 쿠폰 비판매자 → `EmptyState`("판매자 미등록").
- 알림 경로 버그(`99d34a9`) → cwd 버그로 잘못 생성된 경로를 `account/notifications`로 정정.
