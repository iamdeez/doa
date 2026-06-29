---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-30 02:10
상태: 확정 (retroactive — 전 태스크 구현 완료)
---

# Tasks: 007-admin-console

> Branch: 007-admin-console | Date: 2026-06-30 | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [Test Authoring Contract](#test-authoring-contract)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목 해소(미결 사항: 없음)
- [x] plan.md Constitution Gates(P-001~P-007) 통과(예외 0건, 신규 의존 0 — P-002 무저촉)
- [x] CHANGES.md 의 이전 작업(006·005·004) "후속 작업 시 주의사항" 확인 — 006 의 "응답 view 타입 한시성"·
      "권한은 백엔드 강제(UI 표시 분기)"·"formatKRW 재사용"·"`SettlementView` 정의"가 본 차수 view 타입·
      facade·정산 타입 재사용·금전 표기의 직접 배경. 004 의 동일 패턴도 연속
- [x] 선택 단계 전부 N(Database Design·Deploy·Security·Performance — selection-phases.md)

> A = 타입 계약(view 타입), B = 공유 인프라(facade), C = 화면(통계·정산·사용자·감사·승인·배너·셸), D = 검증
> (타입체크·빌드·정적). 레이어 A→B→C→D 의존 순. 본 차수는 `@doa/ui` 변경이 없어(기존 컴포넌트 재사용) B
> 레이어는 facade 만.

---

## 태스크 목록

> 레이어: A 타입 계약 / B 공유 인프라 / C 화면 / D 검증(5a/5b).

### Step 1. 타입 계약 — view 타입 (A)

- [x] **T001** — admin view 타입 정의
  - 레이어: A
  - 구현 파일: `packages/shared-types/src/index.ts`
  - 관련 요구사항: FR-007, NFR-002, NFR-004
  - 상세: `PlatformOverview`(totalSales string·나머지 number)·`AdminUser`·`AdminAuditLog`·`SellerApprovalStatus`
    (PENDING/APPROVED/REJECTED/SUSPENDED)·`AdminSeller`·`BannerPosition`(MAIN_TOP/MAIN_MIDDLE/MAIN_BOTTOM/
    SIDEBAR)·`Banner`·`CreateBannerRequest`·`UpdateBannerRequest`(`Partial<CreateBannerRequest>`). 백엔드 응답
    OpenAPI 미정의(Prisma 엔티티)이므로 전이형 view 타입. 금전 필드 Decimal→문자열. 정산은 006 `SettlementView`
    재사용(신규 정의 없음).
  - 완료 기준: admin view 타입 9종 정의, 금전 필드 `string`.

### Step 2. 공유 인프라 — facade (B)

- [x] **T002** — admin 도메인 facade 추가
  - 레이어: B (T001 완료 후)
  - 구현 파일: `packages/api-client/src/index.ts`
  - 관련 요구사항: FR-008
  - 상세: `createApiClient` 반환에 `admin.{statsOverview,settlements,users,auditLogs,pendingSellers,
    approveSeller,banners,createBanner,updateBanner,deleteBanner}` 추가. `api.http` 기반(`http.get/post/patch/
    delete`), view 타입 응답 제네릭. `users` 는 `{ query: { cursor, limit } }`, `auditLogs` 는
    `{ query: { limit } }`. 정산은 `SettlementView[]`(006 재사용). 기존 facade 불변.
  - 완료 기준: admin facade 10 메서드, 기존 facade·client·http 불변.

### Step 3. 화면 — 통계·정산·사용자·감사·승인·배너·셸 (C)

- [x] **T003** — 플랫폼 통계 화면
  - 레이어: C (T002 완료 후)
  - 구현 파일: `apps/console/app/(dashboard)/admin/stats/page.tsx`(신규)
  - 관련 요구사항: FR-001, NFR-002
  - 상세: `useQuery(['admin','stats'], api.admin.statsOverview)`. `StatCard` 5개(총 매출(완료)
    `formatKRW(totalSales)`·총 주문·완료 주문·총 사용자·총 판매자 — 각 `toLocaleString('ko-KR')` + 단위).
    로딩·에러 분기.
  - 완료 기준: StatCard 5개 렌더·상태 분기.

- [x] **T004** — 전체 정산 화면
  - 레이어: C (T002 완료 후)
  - 구현 파일: `apps/console/app/(dashboard)/admin/settlements/page.tsx`(신규)
  - 관련 요구사항: FR-002, NFR-002
  - 상세: `useQuery(['admin','settlements'], api.admin.settlements)`(`SettlementView[]`). Table(판매자
    `sellerId` 앞 12자·총 매출·수수료 `−formatKRW`·지급액·상태 Badge). status `completed`→지급완료(success)·
    그 외→정산대기(warning). 빈 목록 분기.
  - 완료 기준: Table 렌더·상태 Badge 매핑·금액 formatKRW.

- [x] **T005** — 사용자 화면(cursor 무한 스크롤)
  - 레이어: C (T002 완료 후)
  - 구현 파일: `apps/console/app/(dashboard)/admin/users/page.tsx`(신규)
  - 관련 요구사항: FR-003
  - 상세: `useInfiniteQuery(['admin','users'], ({pageParam}) => api.admin.users(pageParam))`,
    `getNextPageParam`=`last.nextCursor ?? undefined`, `pages.flatMap(items)` Table(이메일·이름·연락처·가입일).
    `hasNextPage` 시 "더 보기" Button(`fetchNextPage`·`isFetchingNextPage` 비활성화·"불러오는 중…"). 빈·로딩·
    에러 분기.
  - 완료 기준: 무한 스크롤 Table·더 보기 버튼.

- [x] **T006** — 감사 로그 화면
  - 레이어: C (T002 완료 후)
  - 구현 파일: `apps/console/app/(dashboard)/admin/audit-logs/page.tsx`(신규)
  - 관련 요구사항: FR-004
  - 상세: `useQuery(['admin','auditLogs'], api.admin.auditLogs)`(`AdminAuditLog[]`). Table(일시 `toLocaleString`·
    관리자 `adminId` 앞 12자·조치 `Badge` info·대상 `targetType`·`targetId` 앞 12자). 빈 목록 `EmptyState`.
  - 완료 기준: Table 렌더·action Badge.

- [x] **T007** — 판매자 승인 화면(플레이스홀더 실데이터화)
  - 레이어: C (T002 완료 후)
  - 구현 파일: `apps/console/app/(dashboard)/admin/sellers/page.tsx`(수정)
  - 관련 요구사항: FR-005, NFR-001
  - 상세: 기존 플레이스홀더를 `useQuery(['admin','pendingSellers'], api.admin.pendingSellers)`(`AdminSeller[]`)
    + Table(상호·대표자·사업자번호·연락처·조치)로 교체. 행 승인 Button → `approve = useMutation(api.admin.
    approveSeller)`, `onSuccess` invalidate `['admin','pendingSellers']`. 처리 중 `approve.variables === s.id`
    행만 비활성화·"처리 중…". 로딩·에러·빈 분기.
  - 완료 기준: 승인 대기 Table·승인 mutation·행별 비활성화.

- [x] **T008** — 배너 관리 화면(CRUD)
  - 레이어: C (T002 완료 후)
  - 구현 파일: `apps/console/app/(dashboard)/admin/banners/page.tsx`(신규)
  - 관련 요구사항: FR-006, NFR-003
  - 상세: `useQuery(['admin','banners'], api.admin.banners)`(`Banner[]`) Table(제목·위치·순서·활성 Badge·조치).
    `CreateBannerDialog`(Radix Dialog — Input(title/imageUrl/linkUrl/sortOrder)·Select(position
    `BannerPosition`)·`createBanner` `onSuccess` invalidate+닫기+reset). 활성 토글(`updateBanner({ isActive:
    !b.isActive })`)·삭제(`deleteBanner` danger 버튼). 세 mutation 모두 `onSuccess` invalidate. 로딩·에러·빈
    분기.
  - 완료 기준: 목록 Table·생성 다이얼로그·활성 토글·삭제.

- [x] **T009** `[P]` — AppShell 네비 추가
  - 레이어: C
  - 구현 파일: `apps/console/app/(dashboard)/layout.tsx`
  - 관련 요구사항: FR-009
  - 상세: `NAV` 관리자 섹션에 `배너`(`/admin/banners`)·`전체 정산`(`/admin/settlements`)·`플랫폼 통계`
    (`/admin/stats`)·`사용자`(`/admin/users`)·`감사 로그`(`/admin/audit-logs`) 5개 추가(기존 `판매자 승인`
    `/admin/sellers` 위에 누적). `visible` 필터는 seller 섹션만 `isSeller` 로 가림(admin 항상 노출 — AdminGuard
    백엔드 강제).
  - 완료 기준: 네비 5개 추가.

### Step 4. 검증 (D 레이어 — 5a/5b)

> 본 차수는 UI 화면으로 별도 e2e/단위 테스트 스위트를 작성하지 않는다(빌드/타입체크 갈음). D 레이어는
> **타입체크 + console 빌드 + 정적 구조 검증**으로 SC 를 판정한다(5a 는 검증 시나리오 정의, 5b 는 실행·
> 확인). test-cases.md / coverage.md 참조.

- [x] **T010** — 검증 시나리오 정의 (5a Test Agent AUTHORING)
  - 검증 대상: SC-001(통계)·SC-002(정산)·SC-003(사용자 무한스크롤)·SC-004(감사 로그)·SC-005(판매자 승인)·
    SC-006(배너 CRUD)·SC-007(view 타입·facade)·SC-008(네비·회귀 0)
  - 산출물: test-cases.md(통계·정산·사용자·감사·승인·배너·view 타입·네비 — 단위/e2e 아닌 빌드/타입/정적 기반)
  - 신규 단위/e2e 테스트 it() 0건(UI 화면 — 빌드/타입/정적 갈음)

- [x] **T011** — 게이트 실행·확인 (5b Test Agent EXECUTION)
  - 실행: `pnpm --filter console typecheck`(0 error) / `pnpm --filter console build`(22 라우트 PASS —
    신규 `/admin/stats`·`/admin/settlements`·`/admin/users`·`/admin/audit-logs`·`/admin/banners` 포함) /
    정적 구조 검증(승인 mutation·배너 CRUD·useInfiniteQuery·view 타입·facade·금전 포맷·네비)
  - 산출물: coverage.md·coverage-gap.md·test-report.md

---

## Test Authoring Contract

> **5a Test Agent(AUTHORING) 입력 contract**. 본 차수는 UI 화면으로 단위/e2e 테스트 it() 를 추가하지 않으며,
> 검증은 타입체크·console 빌드·정적 구조 검증으로 갈음한다(추측 단언 금지 — 직접 코드 리뷰/빌드).

### 검증 canonical 대상

| 대상 | canonical 형태 |
|---|---|
| 플랫폼 통계 | `stats/page.tsx` — `useQuery(['admin','stats'], api.admin.statsOverview)` + StatCard 5개(formatKRW·toLocaleString) |
| 전체 정산 | `settlements/page.tsx` — `useQuery(api.admin.settlements)` + Table(상태 Badge completed/pending·formatKRW) |
| 사용자 | `users/page.tsx` — `useInfiniteQuery(api.admin.users)`·`getNextPageParam` nextCursor·`pages.flatMap(items)`·더 보기 |
| 감사 로그 | `audit-logs/page.tsx` — `useQuery(api.admin.auditLogs)` `AdminAuditLog[]` Table·action Badge |
| 판매자 승인 | `sellers/page.tsx` — `useQuery(api.admin.pendingSellers)` + `approveSeller` `onSuccess` invalidate·`approve.variables === s.id` |
| 배너 CRUD | `banners/page.tsx` — `banners`·`CreateBannerDialog`(Radix·createBanner invalidate)·`updateBanner` toggle·`deleteBanner` danger |
| view 타입 | `shared-types/index.ts` — `PlatformOverview`·`AdminUser`·`AdminAuditLog`·`AdminSeller`·`Banner` 등 9종(금전 string) |
| facade | `api-client/index.ts` — `admin.{statsOverview,settlements,users,auditLogs,pendingSellers,approveSeller,banners,createBanner,updateBanner,deleteBanner}` |
| 네비 | `layout.tsx` — `/admin/banners`·`/admin/settlements`·`/admin/stats`·`/admin/users`·`/admin/audit-logs` 5개(section admin) |
| 타입체크/빌드 | `pnpm --filter console typecheck`·`pnpm --filter console build`(22 라우트) |

### 검증 재현 규약

- **SC-001(통계)**: `stats/page.tsx` grep `api.admin.statsOverview` + `StatCard`×5·`formatKRW(data.totalSales)`·
  `data.totalOrders.toLocaleString`. `console build` 에 `/admin/stats` 라우트 컴파일.
- **SC-002(정산)**: `settlements/page.tsx` grep `api.admin.settlements` + Table + `s.status === 'completed'`
  분기(지급완료/정산대기 Badge) + `formatKRW`. `console build` 에 `/admin/settlements` 컴파일.
- **SC-003(사용자)**: `users/page.tsx` `useInfiniteQuery`·`api.admin.users(pageParam)`·`getNextPageParam`
  nextCursor·`pages.flatMap`·`hasNextPage` 더 보기. `console build` 에 `/admin/users` 컴파일.
- **SC-004(감사 로그)**: `audit-logs/page.tsx` `api.admin.auditLogs`·Table·`Badge tone="info"`. `console build`
  에 `/admin/audit-logs` 컴파일.
- **SC-005(판매자 승인)**: `sellers/page.tsx` `api.admin.pendingSellers` + `approveSeller` `onSuccess`
  invalidate `['admin','pendingSellers']` + `approve.variables === s.id` 비활성화.
- **SC-006(배너 CRUD)**: `banners/page.tsx` `api.admin.banners` + `CreateBannerDialog`(`createBanner`
  invalidate) + `updateBanner` toggle + `deleteBanner` danger. `console build` 에 `/admin/banners` 컴파일.
- **SC-007(view 타입·facade)**: `shared-types/index.ts` view 타입 9종(금전 string) + `api-client/index.ts`
  admin facade 10 메서드.
- **SC-008(네비·회귀)**: `layout.tsx` 네비 5개. `console typecheck` 0·`build` 22 라우트 PASS.

### SC → 검증 매핑

| SC-ID | 수용 기준 | 검증 방법 | 비고 |
|---|---|---|---|
| SC-001 | 통계 StatCard 5·formatKRW | stats/page.tsx grep + console typecheck/build | [env:typecheck][env:build] |
| SC-002 | 정산 Table·상태 Badge | settlements/page.tsx grep + console typecheck/build | [env:typecheck][env:build] |
| SC-003 | 사용자 무한스크롤 | users/page.tsx 코드 리뷰 + console build | [env:static][env:typecheck][env:build] |
| SC-004 | 감사 로그 Table | audit-logs/page.tsx grep + console typecheck/build | [env:typecheck][env:build] |
| SC-005 | 판매자 승인 | sellers/page.tsx 코드 리뷰 | [env:static] |
| SC-006 | 배너 CRUD | banners/page.tsx 코드 리뷰 + console build | [env:static][env:typecheck][env:build] |
| SC-007 | view 타입·facade | shared-types·api-client 코드 리뷰 | [env:static][env:typecheck] |
| SC-008 | 네비·회귀 0 | layout grep + console typecheck/build | [env:static][env:typecheck][env:build] |

---

## 구현 완료 기준

- [x] 모든 A·B·C 태스크 체크박스 완료(4단계), D 검증 시나리오 완료(5a/5b)
- [x] `shared-types/index.ts` — admin view 타입 9종(금전 string) `[TypeScript]`
- [x] `api-client/index.ts` — admin facade 10 메서드 추가, 기존 facade·client·http 불변
- [x] `stats/page.tsx`(신규) — StatCard 5개
- [x] `settlements/page.tsx`(신규) — Table·상태 Badge·formatKRW
- [x] `users/page.tsx`(신규) — useInfiniteQuery·더 보기
- [x] `audit-logs/page.tsx`(신규) — Table·action Badge
- [x] `sellers/page.tsx`(수정) — 플레이스홀더→실데이터·승인 mutation
- [x] `banners/page.tsx`(신규) — 목록·생성 다이얼로그·활성 토글·삭제
- [x] `layout.tsx` — 관리자 네비 5개 추가
- [x] `pnpm --filter console typecheck` 0 error + `pnpm --filter console build` 22 라우트 PASS(회귀 0)
- [x] 신규 의존 0(`package.json` 변경 없음 — P-002 무저촉)
- [x] git status 의도치 않은 파일 없음(9파일 변경, 커밋 1개 `e7d8ebb`)
