---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 02:10
상태: 확정 (retroactive)
---

# Diff: 007-admin-console

## 목차

- [커밋 메시지용 한 줄 요약](#커밋-메시지용-한-줄-요약)
- [변경 요약](#변경-요약)
- [변경 파일 및 라인 수](#변경-파일-및-라인-수)
- [Diff](#diff)

## 커밋 메시지용 한 줄 요약

- **KO**: 007 프론트 Phase 3 — 관리자 콘솔 화면 6종(플랫폼 통계·전체 정산·사용자 무한스크롤·감사 로그·판매자
  승인·배너 CRUD) + admin view 타입·admin facade·네비 5종
- **EN**: 007 frontend Phase 3 — admin console screens (platform stats·all settlements·users infinite-scroll·
  audit logs·seller approval·banner CRUD) + admin view types·admin facade·5 nav items

## 변경 요약

- **플랫폼 통계 화면(FR-001)**: `apps/console/app/(dashboard)/admin/stats/page.tsx`(신규) —
  `useQuery(['admin','stats'], api.admin.statsOverview)`로 `PlatformOverview` 조회 후 `StatCard` 5개(총
  매출(완료) `formatKRW(totalSales)`·총 주문·완료 주문·총 사용자·총 판매자 — 각 `toLocaleString('ko-KR')`)
  렌더. 로딩·에러 분기.
- **전체 정산 화면(FR-002)**: `admin/settlements/page.tsx`(신규) — `api.admin.settlements`(`SettlementView[]`
  — 006 재사용) 조회 후 Table(판매자 `sellerId` 앞 12자·총 매출·수수료 `−formatKRW`·지급액·상태 Badge) 렌더.
  status `completed`→"지급완료"(success)·그 외→"정산대기"(warning). 빈 목록 분기.
- **사용자 화면(FR-003)**: `admin/users/page.tsx`(신규) — `useInfiniteQuery` + `api.admin.users(cursor)`
  (`CursorPage<AdminUser>`)·`getNextPageParam`=`last.nextCursor`·`pages.flatMap(items)` Table(이메일·이름·연락처·
  가입일) + `hasNextPage` 시 "더 보기" Button(`isFetchingNextPage` 비활성화).
- **감사 로그 화면(FR-004)**: `admin/audit-logs/page.tsx`(신규) — `api.admin.auditLogs`(`AdminAuditLog[]`)
  조회 후 Table(일시·관리자 `adminId` 앞 12자·조치 `Badge` info·대상 `targetType`·`targetId` 앞 12자) 렌더.
  빈 목록 분기. append-only(013).
- **판매자 승인 화면(FR-005)**: `admin/sellers/page.tsx`(수정 — 플레이스홀더→실데이터) — `api.admin.
  pendingSellers`(`AdminSeller[]`) 조회 후 Table(상호·대표자·사업자번호·연락처·조치). 행 승인 Button →
  `api.admin.approveSeller`(`useMutation`) `onSuccess` invalidate `['admin','pendingSellers']`. 처리 중
  `approve.variables === s.id` 행만 비활성화·"처리 중…".
- **배너 관리 화면(FR-006)**: `admin/banners/page.tsx`(신규) — `api.admin.banners`(`Banner[]`) Table(제목·위치·
  순서·활성 Badge·조치). `CreateBannerDialog`(Radix Dialog — `Input`·`Select`(BannerPosition 4종)·`createBanner`
  `onSuccess` invalidate+닫기+reset). 활성 토글(`updateBanner({ isActive: !b.isActive })`)·삭제(`deleteBanner`
  danger 버튼). 세 mutation 모두 `onSuccess` invalidate. 삭제는 즉시(확인 다이얼로그 없음 — 후속).
- **view 타입(FR-007)**: `packages/shared-types/src/index.ts` — admin view 타입 9종(`PlatformOverview`·
  `AdminUser`·`AdminAuditLog`·`SellerApprovalStatus`·`AdminSeller`·`BannerPosition`·`Banner`·
  `CreateBannerRequest`·`UpdateBannerRequest`). 백엔드 응답 OpenAPI 미정의(Prisma 엔티티)이므로 전이형 view
  타입(금전 `PlatformOverview.totalSales` string). 정산은 006 `SettlementView` 재사용.
- **admin facade(FR-008)**: `packages/api-client/src/index.ts` — `createApiClient` 반환에 `admin` 추가
  (`statsOverview`·`settlements`·`users`·`auditLogs`·`pendingSellers`·`approveSeller`·`banners`·
  `createBanner`·`updateBanner`·`deleteBanner` — 10 메서드, `api.http` 기반, view 타입 응답 제네릭). `users`
  는 `{ query: { cursor, limit } }`, `auditLogs` 는 `{ query: { limit } }`. 기존 facade·client·http 불변.
- **네비(FR-009)**: `apps/console/app/(dashboard)/layout.tsx` 에 "배너"(`/admin/banners`)·"전체 정산"
  (`/admin/settlements`)·"플랫폼 통계"(`/admin/stats`)·"사용자"(`/admin/users`)·"감사 로그"(`/admin/audit-logs`)
  관리자 네비 5개 추가(기존 "판매자 승인" 위에 누적). `visible` 필터는 seller 섹션만 `isSeller` 로 가림(admin
  항상 노출 — 백엔드 AdminGuard 강제).
- **검증**: `pnpm --filter console typecheck` 0 error · `pnpm --filter console build` 22 라우트 PASS(신규
  `/admin/stats`·`/admin/settlements`·`/admin/users`·`/admin/audit-logs`·`/admin/banners` 포함). 기존 화면 동작
  회귀 0. 신규 단위/e2e 테스트 0(UI 화면 — 타입체크 + 빌드 + 정적 구조 리뷰로 갈음). 신규 의존 0(`package.json`
  변경 없음). `@doa/ui`(StatCard·Select·Table·Dialog)·`lib/order.ts`(formatKRW)·006 `SettlementView` 기존
  자산 재사용(변경 0).
- **해결**: FRONTEND-PLAN Phase 3(관리자 콘솔) — 관리자 운영 화면 6종(통계·정산·사용자·감사·승인·배너) +
  판매자 승인 플레이스홀더 실데이터화 RESOLVED. 배너 삭제 확인·클라이언트 권한 필터·배너 편집·낙관적 업데이트·
  e2e·응답 스키마 보강은 후속(GAP-007-01). admin/coupons 화면은 별도(008).

## 변경 파일 및 라인 수

> 범위: `apps/console` + `packages`. base `1a6d70d` → `e7d8ebb`(커밋 1개: `e7d8ebb` Phase 3 관리자 콘솔).
> `git diff --numstat 1a6d70d e7d8ebb -- apps/console packages` 직접 카운트.

| 파일 | 추가 | 삭제 | 비고 |
|---|---|---|---|
| `apps/console/app/(dashboard)/admin/banners/page.tsx` (신규) | +172 | -0 | 배너 목록·생성 다이얼로그·활성 토글·삭제 |
| `packages/shared-types/src/index.ts` | +77 | -0 | admin view 타입 9종(금전 string) |
| `apps/console/app/(dashboard)/admin/sellers/page.tsx` | +72 | -13 | 플레이스홀더→실데이터·승인 mutation |
| `apps/console/app/(dashboard)/admin/users/page.tsx` (신규) | +71 | -0 | 사용자 무한 스크롤(useInfiniteQuery) |
| `apps/console/app/(dashboard)/admin/settlements/page.tsx` (신규) | +64 | -0 | 전체 정산 Table·상태 Badge |
| `apps/console/app/(dashboard)/admin/audit-logs/page.tsx` (신규) | +61 | -0 | 감사 로그 Table·action Badge |
| `apps/console/app/(dashboard)/admin/stats/page.tsx` (신규) | +32 | -0 | 플랫폼 통계 StatCard 5개 |
| `packages/api-client/src/index.ts` | +32 | -0 | admin 도메인 facade 10 메서드 |
| `apps/console/app/(dashboard)/layout.tsx` | +5 | -0 | 관리자 네비 5개(배너·전체 정산·플랫폼 통계·사용자·감사 로그) |

**합계**: 9 files changed, 586 insertions(+), 13 deletions(-).

> **부수 변경 없음**: 신규 의존성 0(`package.json`·`pnpm-lock.yaml` 변경 없음). DB 스키마 변경 0(마이그레이션
> 없음). `@doa/ui`·`@doa/design-tokens` 변경 0(기존 컴포넌트·토큰 재사용). 006 `SettlementView` 재사용(신규
> 정산 타입 정의 0).
>
> 본 007 SDD 문서 세트(`docs/specs/v1.1.0/007-admin-console/**`) 와 `DIFF-007`·`CHANGES.md` 007 항목은
> `e7d8ebb` 코드 커밋 **이후** retroactive 로 별도 추가된다(코드 diff 범위 외).

## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 이며 전체 캡처는 중복·문서 비대화를
> 유발한다. 변경 내용은 위 "변경 요약" · "변경 파일 및 라인 수" 절로 추적하고, 라인 단위 diff 가 필요하면
> 아래로 재생성한다:
>
> ```bash
> git diff 1a6d70d e7d8ebb -- apps/console packages   # base commit: 1a6d70d
> ```
