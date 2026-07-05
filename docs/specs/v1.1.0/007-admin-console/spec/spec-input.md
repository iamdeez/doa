---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-30 02:10
상태: 확정 (retroactive)
---

# Spec Input: 007-admin-console

> 수집 일시: 2026-06-30 | 맥락: 006(판매자 부가 운영 화면) 다음 단계 = FRONTEND-PLAN Phase 3 관리자 운영
> 콘솔(플랫폼 통계·전체 정산·사용자·감사 로그·판매자 승인·배너 관리) → 정식 SDD 문서화. 사용자 지시: "다음
> 진행 = Phase 3 (관리자 콘솔 화면)".

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
| 3. 핵심 기능 | 완료 | [Q-A~H] |
| 4. 데이터 & 입출력 | 완료 | [Q-I] |
| 5. 제약조건 | 완료 | [Q5] |
| 6. 예외 & 실패 시나리오 | 완료 | [Q6] |

## 원 요청 맥락

사용자 지시: **006(판매자 운영 화면) 다음 단계 = FRONTEND-PLAN Phase 3 관리자 운영 콘솔**. 004·005·006 이
Phase 1~2(판매자 주문 이행 + 판매자 부가 운영 화면)를 완성했으나 console 에 관리자 운영 화면이 부재했고
(`/admin/sellers` 는 플레이스홀더로만 존재), 백엔드는 관리자 전용 라우트(전부 `AdminGuard` 강제)를 이미
제공하나 소비 UI 가 없었다. 007 은 플랫폼 통계(`/admin/stats`)·전체 정산(`/admin/settlements`)·사용자
(`/admin/users` — cursor 무한 스크롤)·감사 로그(`/admin/audit-logs`)·판매자 승인(`/admin/sellers` —
플레이스홀더를 실데이터+승인 mutation 으로 교체)·배너 관리(`/admin/banners` — 목록+생성 다이얼로그+활성
토글+삭제) 6종 화면을 추가하고, 응답 스키마가 OpenAPI 미정의인 관리자 엔드포인트를 전이형 view 타입 + admin
facade 로 호출하며, AppShell 네비에 관리자 항목 5종을 추가한다. 본 문서는 그 구현(커밋 `e7d8ebb`)을 정식
SDD 포맷으로 보강하기 위한 입력 재구성이다(FRONTEND-PLAN Phase 3 관리자 콘솔 연속).

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션·근거 | 채택 결과 |
|---|---|---|---|
| Q-A | 응답 호출 도구 (타입드 client vs facade) | A:003 타입드 `api.client.GET` / B:`api.http` 기반 admin facade + view 타입 | **B 채택**(관리자 통계·정산·사용자·감사·판매자·배너 응답 스키마가 OpenAPI 미정의(Prisma 엔티티 반환 — 001 coverage-gap)여서 타입드 client 의 응답 타입이 비어 이점이 적음. 004·006 와 동일 — view 타입 + facade) |
| Q-B | 응답 타입 정의 위치 | A:화면 로컬 타입 / B:`@doa/shared-types` 전이형 view 타입 | **B 채택**(공유 패키지에 admin view 타입 9종 정의. 정산은 006 `SettlementView` 재사용. 금전 Decimal→문자열 — FR-007) |
| Q-C | 사용자 목록 페이지네이션 | A:단일 조회 / B:`useInfiniteQuery` cursor '더 보기' | **B 채택**(`GET /admin/users` 가 `CursorPage<AdminUser>` 반환. `useInfiniteQuery`·`getNextPageParam`=`nextCursor`·"더 보기" 버튼 — FR-003) |
| Q-D | 판매자 승인 화면 처리 | A:플레이스홀더 유지 / B:실데이터 + 승인 mutation | **B 채택**(기존 플레이스홀더(`/admin/sellers`)를 `pendingSellers` 조회 + `approveSeller` mutation 으로 교체. 처리 중 `approve.variables === s.id` 행만 비활성화 — FR-005) |
| Q-E | 배너 생성 UI 패턴 | A:별도 라우트 페이지 / B:Radix Dialog(목록 화면 내 모달) | **B 채택**(002 산출 Radix Dialog. 목록 화면에서 생성을 모달로 — FR-006, NFR-003) |
| Q-F | 배너 삭제 확인 | A:즉시 삭제 / B:AlertDialog 재확인 | **A 채택(현 구현) + B 후속**(현재 `danger` 버튼 즉시 삭제. AlertDialog 재확인은 후속 — 범위 외 gaps) |
| Q-G | 관리자 권한 강제 위치 | A:UI 강제(`isAdmin` 분기) / B:백엔드 `AdminGuard` 강제 + UI 표시 | **B 채택**(전 admin 라우트 `AdminGuard` 백엔드 강제. UI 네비는 권한 필터 없이 노출 — 클라이언트 차단은 후속 gaps — NFR-001) |
| Q-H | admin/coupons 화면 포함 여부 | A:007 에 포함 / B:별도 008 차수 | **B 채택**(관리자 전역 쿠폰 화면은 008 로 분리. 007 facade·네비 미포함 — 범위 외) |
| Q-I | 금전 표기 | Decimal→문자열 `formatKRW`(004 헬퍼 재사용) | **채택**(`PlatformOverview.totalSales`·`SettlementView` 금전 필드 `string`, 기존 `lib/order.ts` `formatKRW` 재사용 — 신규 헬퍼 없음 — NFR-002·P-005) |

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

Q1. 왜 만드는가?
- 004·005·006 이 판매자 화면(Phase 1~2)을 완성했으나 플랫폼을 운영하는 관리자용 콘솔 화면이 부재.
  `/admin/sellers` 만 플레이스홀더로 존재. 백엔드는 관리자 전용 라우트(AdminGuard 강제)를 이미 제공.
  Phase 3 관리자 운영 콘솔 6종 화면을 추가.

Q2. 현재 어떻게? (007 이전)
- console admin 영역에 판매자 승인 플레이스홀더(`/admin/sellers`)만 존재. 플랫폼 통계·전체 정산·사용자·감사
  로그·배너 관리 화면 없음. 백엔드는 관리자 라우트를 제공하나 소비 UI 부재. 응답 스키마는 OpenAPI 미정의
  (004·006 과 동일).

Q3. 성공 판단 기준
- `/admin/stats`(5 StatCard)·`/admin/settlements`(전체 정산 테이블)·`/admin/users`(cursor 무한 스크롤)·
  `/admin/audit-logs`(감사 로그 테이블)·`/admin/sellers`(승인 대기+승인)·`/admin/banners`(목록+생성+토글+삭제)
  렌더. console typecheck 0·build 22 라우트 PASS(기존 화면 회귀 0).

### [카테고리 2] 사용자 & 이해관계자

Q4. 사용자 역할
- 관리자(console admin): 플랫폼 운영 주체 — 통계·정산·사용자·감사 조회, 판매자 승인, 배너 관리.
- 백엔드 개발자: 관리자 라우트 + `AdminGuard` + 감사 로그(013) 제공 주체. 응답 DTO 미정의(view 타입 한시
  정의 사유 — GAP-007-01).

### [카테고리 3] 핵심 기능

**Must:**
- `apps/console/app/(dashboard)/admin/stats/page.tsx`(신규): `api.admin.statsOverview()` → `StatCard` 5개.
- `apps/console/app/(dashboard)/admin/settlements/page.tsx`(신규): `api.admin.settlements()` → Table(판매자·
  총 매출·수수료·지급액·상태 Badge).
- `apps/console/app/(dashboard)/admin/users/page.tsx`(신규): `useInfiniteQuery` + `api.admin.users(cursor)`
  (`CursorPage<AdminUser>`) → Table + "더 보기".
- `apps/console/app/(dashboard)/admin/audit-logs/page.tsx`(신규): `api.admin.auditLogs()` → Table(일시·관리자·
  조치 Badge·대상).
- `apps/console/app/(dashboard)/admin/sellers/page.tsx`(플레이스홀더→실데이터): `api.admin.pendingSellers()`
  + `api.admin.approveSeller()` mutation.
- `apps/console/app/(dashboard)/admin/banners/page.tsx`(신규): `api.admin.banners()` → Table + `CreateBannerDialog`
  (Radix Dialog) + 활성 토글(`updateBanner`) + 삭제(`deleteBanner` danger).
- `packages/api-client/src/index.ts`: `admin` facade 10 메서드.
- `packages/shared-types/src/index.ts`: admin view 타입 9종(`PlatformOverview`·`AdminUser`·`AdminAuditLog`·
  `SellerApprovalStatus`·`AdminSeller`·`BannerPosition`·`Banner`·`CreateBannerRequest`·`UpdateBannerRequest`).
- `apps/console/app/(dashboard)/layout.tsx`: "배너"·"전체 정산"·"플랫폼 통계"·"사용자"·"감사 로그" 네비 5개 추가.

**제외(Out of Scope):**
- admin/coupons 화면(008), 배너 삭제 확인 다이얼로그, 클라이언트 권한 노출 차단, 낙관적 업데이트, 배너 편집,
  통계 차트, e2e/단위 테스트.

### [카테고리 4] 데이터 & 입출력

- 백엔드 라우트(실제, 전부 `AdminGuard`): `GET /admin/stats/overview`(`PlatformOverview`)·`GET /admin/settlements`
  (`SettlementView[]`)·`GET /admin/users`(cursor `CursorPage<AdminUser>`)·`GET /admin/audit-logs`
  (`AdminAuditLog[]`)·`GET /admin/sellers/pending`(`AdminSeller[]`)·`POST /admin/sellers/:id/approve`·
  `GET·POST·PATCH·DELETE /admin/banners`.
- view 타입: `PlatformOverview`(totalOrders·completedOrders·totalSales[string]·totalUsers·totalSellers)·
  `AdminUser`(email·name·phone·createdAt)·`AdminAuditLog`(adminId·action·targetType·targetId·createdAt)·
  `AdminSeller`(businessName·businessNumber·representativeName·contactPhone·status)·`Banner`(title·imageUrl·
  position·sortOrder·isActive 등). 정산은 006 `SettlementView` 재사용.
- facade: `api.admin.{statsOverview,settlements,users,auditLogs,pendingSellers,approveSeller,banners,
  createBanner,updateBanner,deleteBanner}`(`api.http` 기반).

### [카테고리 5] 제약조건

Q5. 기술 스택 제약
- Next.js 15(App Router) + TanStack Query(useQuery/useInfiniteQuery/useMutation/invalidate) + Radix Dialog +
  `@doa/ui` 시맨틱 토큰.
- 응답 스키마 미정의(001 coverage-gap)로 타입드 client 대신 view 타입 + facade(004·006 연속).
- 금전 Decimal→문자열(부동소수점 금지 — P-005, `formatKRW` 재사용). console typecheck/build 회귀 0(NFR-005).
- 권한은 백엔드 `AdminGuard` 강제(NFR-001).

### [카테고리 6] 예외 & 실패 시나리오

Q6. 엣지 케이스
- 비관리자 접근 → UI 네비는 노출되나 백엔드 `AdminGuard` 가 403 차단(클라이언트 차단은 후속 gaps).
- 빈 목록 → 각 화면 `EmptyState`(정산 내역 없음·사용자 없음·기록 없음·대기 중인 판매자 없음·배너 없음).
- 판매자 승인 처리 중 → `approve.variables === s.id` 로 해당 행 버튼만 비활성화·"처리 중…".
- 배너 삭제 → `danger` 버튼 즉시 삭제(확인 다이얼로그 없음 — 후속). 성공 시 목록 invalidate.
- 사용자 목록 cursor → `useInfiniteQuery`·`getNextPageParam`=`nextCursor`. `hasNextPage` 시 "더 보기".
- 응답 타입 → 백엔드 OpenAPI 응답 미정의(Prisma 엔티티 반환). 전이형 view 타입으로 한시 정의(GAP-007-01).
- 금전 부동소수점 → Decimal 문자열을 `formatKRW`가 `Number().toLocaleString`으로 표기.
