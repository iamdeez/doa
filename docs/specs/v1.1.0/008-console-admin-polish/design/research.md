---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-30 02:34
상태: 확정 (retroactive)
---

# Research: 008-console-admin-polish

> 구현 완료 코드(`5a14be6`·`4a446b2`·`99d34a9`, base `e7d8ebb`)에서 역추론한 사전 분석 결과.
> `plan.md §사전 영향도 분석 결과`에서 참조한다.

## 목차

- [기존 코드베이스 분석](#기존-코드베이스-분석)
- [기술 선택 조사](#기술-선택-조사)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 기존 코드베이스 분析

### seller/coupons/page.tsx (006 구현 — 리팩토링 대상)

007 이전 `apps/console/app/(dashboard)/seller/coupons/page.tsx`는 235줄의 독립 모듈이었다.

```typescript
// 006 구조 (요약)
// - useQuery(['seller','coupons'], api.coupon.listSeller)
// - CreateDialog: discountType(Select)·discountValue·minOrderAmount·maxIssuableCount·expiresAt(Input)
//                 validate(type, discountValue) → 010 정합 클라이언트 검증
//                 createCoupon mutation → onSuccess invalidate·close·reset
// - IssueDialog: userId Input·issueCoupon mutation → onSuccess invalidate·close·reset
// - discountLabel(coupon: Coupon): `${c.discountValue}%` / `${formatKRW(c.discountValue)} 할인`
```

이 구조를 그대로 `CouponManager` 컴포넌트로 추출하고 api·queryScope를 주입받는 형태로 일반화한다.

### 핵심 모듈 계층 구조

```
CouponManager (공유 컴포넌트)
  ├── CouponApi 인터페이스 (주입 — 판매자/관리자 분기)
  ├── discountLabel(coupon)
  ├── validate(type, discountValue)
  ├── CreateDialog
  │     ├── discountType Select (FIXED_AMOUNT / PERCENTAGE)
  │     ├── discountValue·minOrderAmount·maxIssuableCount·expiresAt Input
  │     └── createCoupon useMutation → onSuccess invalidate·close·reset
  └── IssueDialog
        ├── userId Input
        └── issueCoupon useMutation → onSuccess invalidate·close·reset

seller/coupons/page.tsx → CouponManager + api.coupon.* 주입 (queryScope="seller")
admin/coupons/page.tsx  → CouponManager + api.admin.* 주입 (queryScope="admin")
```

### ThemeToggle + FOUC 방지 구조

```
app/layout.tsx
  └── <html lang="ko" suppressHydrationWarning>
        └── <head>
              └── THEME_SCRIPT (동기 실행, localStorage → classList.add('dark'))
(dashboard)/layout.tsx
  └── 헤더 우측 액션
        └── <ThemeToggle /> (마운트 시 classList 상태 읽기)
```

### 알림 화면 구조

```
account/notifications/page.tsx
  ├── useQuery(['notifications'], api.notification.list) → NotificationListResult
  ├── PageHeader
  │     └── (액션) unread > 0 → "전체 읽음" Button → markAll.mutate()
  └── NotificationRow (per item)
        ├── Card
        ├── Badge (isRead ? 'neutral' : 'info') + TYPE_LABEL[n.type]
        ├── title·body (Typography)
        ├── createdAt (상대 시간 또는 포맷)
        └── (미읽음 시) "읽음" Button → markRead.mutate(n.id)
```

### 영향 범위 분석

| 모듈 | 변경 유형 | 영향 파일 |
|---|---|---|
| `coupon-manager.tsx` | 신규 | `seller/coupons/page.tsx`·`admin/coupons/page.tsx`에서 import |
| `theme-toggle.tsx` | 신규 | `(dashboard)/layout.tsx`에서 import |
| `app/layout.tsx` | 수정 | 전체 콘솔 앱 루트 — 모든 라우트에 영향 |
| `(dashboard)/layout.tsx` | 수정 | 모든 대시보드 라우트 헤더·네비에 영향 |
| `packages/api-client` | 수정 | notification·admin 쿠폰 관련 화면에서 import |
| `packages/shared-types` | 수정 | api-client·알림 화면에서 import |

### 기존 admin facade 구조 (007 산출)

```typescript
// api-client의 admin 도메인 (007 산출)
admin: {
  statsOverview, settlements, users, auditLogs,
  pendingSellers, approveSeller,
  banners, createBanner, updateBanner, deleteBanner,
}
// 008 추가 (admin 도메인에 추가)
  listCoupons, createCoupon, issueCoupon
```

기존 10개 메서드에 3개 추가. 인터페이스 확장이므로 기존 사용처 변경 불필요.

---

## 기술 선택 조사

### 다크모드 구현 방식 비교 (Q-C 결정)

| 방식 | 장점 | 단점 | 선택 |
|---|---|---|---|
| `next-themes` | 최적화된 FOUC 방지·SSR 친화 | 신규 npm 의존 추가(P-002 위반) | 미채택 |
| 자체 구현 | 의존 0·코드 완전 제어 | FOUC 방지 스크립트 수동 작성 필요 | **채택** |

`next-themes`는 내부적으로 동일한 `localStorage + classList` + inline script 패턴을 사용하므로 자체 구현으로
동일 결과를 얻을 수 있다. P-002(신규 의존 금지) 준수.

### CouponApi 인터페이스 vs 직접 api 참조

| 방식 | 장점 | 단점 | 선택 |
|---|---|---|---|
| 직접 `api.*` 참조 | 구현 단순 | 판매자/관리자 분기 시 if-else 필요, 테스트 어려움 | 미채택 |
| `CouponApi` 인터페이스 주입 | 분기 없음·facade 독립·테스트 용이 | props 설계 필요 | **채택** |

### 알림 facade 위치 (Q-E 결정)

| 위치 | 근거 |
|---|---|
| 기존 도메인 확장 | 009 인앱 알림은 사용자 도메인이 아닌 독립 알림 도메인 |
| **`notification` 신규 도메인** | 004~007 패턴 — 새 백엔드 도메인마다 신규 facade 도메인 추가. `api.notification.list()` 명확 |

---

## 엣지 케이스 및 한계

### 다크모드

- **localStorage 불가 환경** (시크릿 모드·보안 정책): `try-catch`로 감싸 무시. 기능 저하(저장 안 됨) 허용.
- **SSR className 불일치**: 서버는 항상 라이트 HTML을 렌더하고 클라이언트 스크립트가 다크를 적용하면 React hydration 경고가 발생한다. `suppressHydrationWarning`으로 억제.
- **시스템 모드 실시간 감지**: `THEME_SCRIPT`는 초기 로드 시만 `prefers-color-scheme`을 확인한다. 런타임 시스템 모드 변경은 미지원(범위 외).

### 알림

- **알림 0건**: `EmptyState` 렌더. 전체 읽음 버튼 미노출.
- **모두 읽음**: "모든 알림을 확인했습니다." 상태에서 "전체 읽음" 버튼 미노출(`unread === 0`).
- **경로 정정 이력**: `4a446b2`에서 cwd 버그로 `account/notification`(단수) 위치에 파일 생성됨. `99d34a9`에서 `account/notifications`(복수)로 정정. 구 경로 파일은 커밋에서 제거됨.
- **실시간 push 미지원**: 진입 시 1회 조회. WebSocket·SSE는 범위 외.

### CouponManager

- **cursor 더보기 미지원**: `admin.listCoupons`는 cursor를 지원하나 화면은 첫 페이지만 렌더(007·판매자 쿠폰 동일 패턴). 더보기 버튼은 범위 외.
- **010 클라이언트 검증**: `validate(type, discountValue)` — `discountValue > 0`·PERCENTAGE는 `1~100` 범위 검증. 010 백엔드와 정합.
- **낙관적 업데이트**: create·issue mutation은 서버 성공 후 invalidate. 낙관적 업데이트는 범위 외.
