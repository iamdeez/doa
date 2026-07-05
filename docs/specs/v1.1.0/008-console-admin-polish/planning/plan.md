---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-30 02:34
상태: 확정 (retroactive)
---

# Plan: 008-console-admin-polish

> Branch: 008-console-admin-polish | Date: 2026-06-30 | Spec: [spec.md](../spec/spec.md)
>
> 이미 구현·커밋된 코드(커밋 `5a14be6`·`4a446b2`·`99d34a9`, base `e7d8ebb`)를 retroactive 문서화한 계획서.
> "어떻게 만들었는가"는 실제 구현 파일에서 역추론하였다.

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [사전 영향도 분석 결과](#사전-영향도-분석-결과)
- [핵심 설계](#핵심-설계)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> 아래 항목을 확인한 후 plan 작성을 시작한다.
> 위반 또는 예외가 있으면 "예외 사항" 항목에 근거를 명시한다.

- [x] P-001 성능 원칙: CouponManager 공유화·ThemeToggle·알림 화면은 추가 처리가 없으며 기존 TanStack Query 패턴과 동일하다.
- [x] P-002 의존 최소 원칙: 다크모드에 `next-themes` 미채택. `documentElement.classList`·`localStorage` 활용으로 신규 npm 의존 0.
- [x] P-003 디자인 시스템 원칙: `@doa/ui` semantic token 컴포넌트만 사용. 인라인 클래스 최소화.
- [x] P-004 facade 경계 원칙: 신규 `notification` 도메인·admin 쿠폰 메서드는 기존 `api-client` facade 패턴 준수.
- [x] P-005 타입 안전 원칙: `shared-types`의 `NotificationType`·`Notification`·`NotificationListResult` view 타입 추가. API 응답 `any` 없음.
- [x] P-006 코드 중복 금지 원칙: `CouponManager` 추출로 판매자·관리자 쿠폰 로직 단일화. `seller/coupons/page.tsx` 235줄→~26줄 위임.
- [x] P-007 회귀 방지 원칙: `console typecheck` 0 error·`console build` 라우트 PASS·기존 화면 동작 회귀 0 검증.

**예외 사항**: 알림·admin 쿠폰 응답은 OpenAPI 응답 content 미주석(백엔드)이므로 전이형 view 타입 사용(004·006·007 GAP 연속 — 백엔드 보강 후 대체 예정).

---

## 기술 컨텍스트

- **언어 / 런타임**: TypeScript 5, Next.js 15 (App Router), React 19
- **주요 의존성**: TanStack Query v5, `@doa/ui` semantic tokens, `@doa/api-client`(facade), `@doa/shared-types`(view 타입), Radix Dialog(002 산출)
- **패키지 매니저**: pnpm 워크스페이스
- **테스트 프레임워크**: (본 차수 없음 — typecheck·build·정적 구조 검증으로 갈음)
- **다크모드**: `.dark` CSS 클래스 + 시맨틱 토큰(002), `documentElement.classList`, `localStorage.theme`

---

## 사전 영향도 분석 결과

### 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 |
|---|---|---|
| `apps/console/components/coupon-manager.tsx` | 신규 | CouponApi 인터페이스 + CouponManager 공유 컴포넌트 |
| `apps/console/components/theme-toggle.tsx` | 신규 | 다크모드 토글 버튼 |
| `apps/console/app/(dashboard)/admin/coupons/page.tsx` | 신규 | CouponManager + admin facade 주입 |
| `apps/console/app/(dashboard)/seller/coupons/page.tsx` | 수정 | 235줄→~26줄 CouponManager 위임, isSeller 분기 유지 |
| `apps/console/app/(dashboard)/account/notifications/page.tsx` | 신규 | 알림 목록·읽음·전체 읽음 |
| `apps/console/app/layout.tsx` | 수정 | suppressHydrationWarning + THEME_SCRIPT 인라인 스크립트 |
| `apps/console/app/(dashboard)/layout.tsx` | 수정 | ThemeToggle 헤더 추가 + 알림·관리자쿠폰 네비 항목 추가 |
| `packages/api-client/src/index.ts` | 수정 | notification 도메인 facade + admin 쿠폰 3 메서드 |
| `packages/shared-types/src/index.ts` | 수정 | NotificationType·Notification·NotificationListResult view 타입 |

---

## 핵심 설계

### CouponManager 공유 컴포넌트 (FR-001~003)

006 `seller/coupons/page.tsx`의 쿠폰 관리 로직(목록·생성 다이얼로그·발급 다이얼로그·클라이언트 검증·유형별
할인 표시)을 `components/coupon-manager.tsx`로 추출한다.

**의존성 주입 설계**:
```typescript
export interface CouponApi {
  list: () => Promise<CursorPage<Coupon>>;
  create: (body: CreateCouponRequest) => Promise<Coupon>;
  issue: (couponId: string, body: IssueCouponRequest) => Promise<UserCoupon>;
}

export function CouponManager({ api, queryScope, title, subtitle }: {
  api: CouponApi;
  queryScope: string;  // TanStack Query 캐시 키: [queryScope, 'coupons']
  title: string;
  subtitle: string;
}) { ... }
```

`queryScope`로 판매자(`['seller','coupons']`)와 관리자(`['admin','coupons']`) 캐시를 분리한다.
`CouponApi` 인터페이스로 api-client facade와 결합도를 낮춘다.

**판매자 쿠폰 위임** (FR-003):
```typescript
// seller/coupons/page.tsx (~26줄)
const { isSeller } = useAuth();
if (!isSeller) return <EmptyState title="판매자 미등록" ... />;
return (
  <CouponManager
    api={{ list: () => api.coupon.listSeller(), ... }}
    queryScope="seller" title="쿠폰" subtitle="..." />
);
```

**관리자 쿠폰** (FR-002):
```typescript
// admin/coupons/page.tsx (~20줄)
return (
  <CouponManager
    api={{ list: () => api.admin.listCoupons(), create: ..., issue: ... }}
    queryScope="admin" title="쿠폰(관리자)" subtitle="..." />
);
```

### 다크모드 토글 (FR-004·FR-005)

**ThemeToggle 컴포넌트** (`components/theme-toggle.tsx`):
- `useEffect`에서 마운트 시 `document.documentElement.classList.contains('dark')` → `dark` state 초기화
- `toggle()`: `classList.toggle('dark', next)` + `localStorage.setItem('theme', ...)` (try-catch 감싸 불가 환경 허용)
- `aria-label` 포함

**FOUC 방지** (`app/layout.tsx`):
```typescript
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`;
// <html lang="ko" suppressHydrationWarning>
// <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
```

React hydration 전 실행되어 FOUC를 차단한다. `suppressHydrationWarning`으로 서버·클라이언트 className 불일치 경고 억제.

### 알림 화면 (FR-007~009)

**알림 조회**: `useQuery(['notifications'], api.notification.list)` → `NotificationListResult`

**읽음 처리**:
```typescript
const markRead = useMutation({ mutationFn: (id: string) => api.notification.markRead(id),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
const markAll = useMutation({ mutationFn: () => api.notification.markAllRead(),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
```

**UI 구성**:
- `unread = data?.items.filter((n) => !n.isRead).length ?? 0`
- 헤더 오른쪽: `unread > 0` 시 "전체 읽음" Button 노출
- `NotificationRow`: Card + Badge(`isRead ? 'neutral' : 'info'`) + `TYPE_LABEL[n.type]` + title·body + createdAt
- 읽음 항목: `className="opacity-70"`

**경로 확정**: `account/notifications` (`99d34a9` 정정 — cwd 버그로 잘못 생성됐던 경로 수정)

---

## 인터페이스 계약

### api-client 추가 메서드 (FR-008)

```typescript
// notification 도메인
notification: {
  list: (page?: number, size?: number) => http.get<NotificationListResult>('/notifications', { query: { page, size } }),
  markRead: (id: string) => http.patch<void>(`/notifications/${id}/read`),
  markAllRead: () => http.patch<{ updated: number }>('/notifications/read-all'),
},
// admin 쿠폰 메서드 (admin 도메인에 추가)
listCoupons: (cursor?: string, take?: number) => http.get<CursorPage<Coupon>>('/admin/coupons', { query: { cursor, take } }),
createCoupon: (body: CreateCouponRequest) => http.post<Coupon>('/admin/coupons', body),
issueCoupon: (couponId: string, body: IssueCouponRequest) => http.post<UserCoupon>(`/admin/coupons/${couponId}/issue`, body),
```

기존 facade·client·http 불변. 하위 호환 100%.

### 헤더 + 네비 변경 (FR-006)

```typescript
// (dashboard)/layout.tsx
// 헤더 우측 액션: <ThemeToggle /> 추가 (로그아웃 버튼 좌측)
// NAV 배열 추가:
{ href: '/account/notifications', label: '알림', section: 'common' }   // wishlist 이후
{ href: '/admin/coupons', label: '쿠폰(관리자)', section: 'admin' }    // 판매자 승인 이후
```

---

## 데이터 모델

### shared-types 추가 (FR-009)

```typescript
export type NotificationType = 'ORDER_PLACED' | 'ORDER_SHIPPED' | 'SETTLEMENT_CREATED' | 'REVIEW_RECEIVED';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: Notification[];
  total: number;
  page: number;
  size: number;
}
```

백엔드 `GET /notifications` 응답 구조가 OpenAPI 미정의이므로 한시 view 타입으로 정의. 백엔드 `@ApiResponse({ type })` 보강 후 생성 타입으로 대체 예정.

---

## 테스트 전략

| SC 식별자 | 테스트 유형 | 시나리오 요약 | 검증 방법 |
|---|---|---|---|
| SC-001 | 정적 코드 리뷰 | CouponManager props·queryScope·CreateDialog·IssueDialog·validate | grep + 코드 리뷰 |
| SC-002 | 타입체크 + 빌드 | /admin/coupons 라우트 컴파일 | console typecheck 0·build 라우트 PASS |
| SC-003 | 정적 + 타입체크 + 빌드 | seller/coupons 리팩토링·isSeller 분기·queryScope | grep + typecheck 0·build PASS |
| SC-004 | 정적 코드 리뷰 | ThemeToggle toggle()·localStorage·useEffect·aria-label | grep + 코드 리뷰 |
| SC-005 | 정적 + 타입체크 + 빌드 | THEME_SCRIPT·suppressHydrationWarning | grep + typecheck 0·build PASS |
| SC-006 | 정적 + 타입체크 + 빌드 | ThemeToggle 헤더·/admin/coupons·/account/notifications 네비 | grep + typecheck 0·build PASS |
| SC-007 | 정적 + 타입체크 + 빌드 | 알림 화면·markRead·markAllRead·unread 조건부 전체읽음 | grep + typecheck 0·build PASS |
| SC-008 | 정적 + 타입체크 | notification facade 3종·admin 쿠폰 3종·shared-types 3종 | grep + typecheck 0 |

> 본 차수는 UI 화면 위주로 별도 단위/e2e 테스트 스위트 없음. 검증은 **타입체크 0 error + 빌드 라우트 PASS +
> 정적 구조 리뷰(grep)**로 갈음한다. 007 연속 패턴(GAP-008-01로 기록).

---

## 기타 고려사항

- **FOUC 원리**: `suppressHydrationWarning`은 React가 서버 렌더 HTML과 클라이언트 hydration 결과의 className 불일치를
  무시하게 한다. `THEME_SCRIPT`는 `<head>` 내 동기 스크립트로 실행되어 첫 페인트 전에 `.dark` 클래스가 결정된다.
  두 메커니즘이 협력하여 FOUC를 차단한다.
- **CouponApi 인터페이스 전략**: `queryScope`·`title`·`subtitle`은 판매자/관리자 화면의 표시·캐시 키 차이만 다루고
  비즈니스 로직은 `CouponManager` 내부에 집중된다. 향후 추가 쿠폰 사용자(예: 파트너) 지원 시 `CouponApi` 구현체만
  추가하면 된다.
- **알림 경로 정정**: `4a446b2`에서 `account/notification`(단수)으로 잘못 생성된 파일을 `99d34a9`에서 cwd 버그를
  수정하여 `account/notifications`(복수)로 정정했다. 009 백엔드의 `/notifications` 경로와 일치한다.
