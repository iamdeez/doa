---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-30 02:10
상태: 확정 (retroactive)
---

# Test Cases: 007-admin-console

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
- [케이스 상세](#케이스-상세)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류)](#미커버-항목-사전-분류)

---

## SC × 시나리오 매트릭스

> 본 차수는 UI 화면으로 **단위/e2e 테스트 it() 를 추가하지 않는다**. 검증은 타입체크([env:typecheck]) +
> console 빌드([env:build]) + 정적 구조 검증([env:static] — 승인 mutation·배너 CRUD·useInfiniteQuery·view
> 타입·facade·금전 포맷·네비)으로 SC 를 판정한다. 구조는 추측하지 않고 실제 코드를 직접 확인한다.

| SC-ID | 수용 기준 | Happy Path | Edge Case | 검증 대상 | env 태그 |
|---|---|---|---|---|---|
| SC-001 | 통계 StatCard 5·금전 | StatCard 5개 렌더 | 로딩 Loading·에러 ErrorText | stats/page.tsx·console | [env:typecheck][env:build] |
| SC-002 | 정산 Table·상태 Badge | Table 렌더 + 상태 매핑 | 빈 목록 EmptyState | settlements/page.tsx·console | [env:typecheck][env:build] |
| SC-003 | 사용자 무한스크롤 | flatMap Table + 더 보기 | 빈 목록·로딩 더 보기 비활성화 | users/page.tsx·console | [env:static][env:typecheck][env:build] |
| SC-004 | 감사 로그 Table | Table 렌더 + action Badge | 빈 목록 EmptyState | audit-logs/page.tsx·console | [env:typecheck][env:build] |
| SC-005 | 판매자 승인 | pendingSellers Table + 승인 invalidate | 처리 중 행 비활성화·에러·빈 목록 | sellers/page.tsx | [env:static] |
| SC-006 | 배너 CRUD | 목록·생성·토글·삭제 invalidate | 빈 목록·생성 비활성화·생성 에러 | banners/page.tsx·console | [env:static][env:typecheck][env:build] |
| SC-007 | view 타입·facade | view 타입 9종·admin facade 10 | 응답 OpenAPI 미정의 → 전이형 view 타입 | shared-types·api-client | [env:static][env:typecheck] |
| SC-008 | 네비·회귀 0 | 네비 5개·22 라우트 | 기존 화면 동작 불변 | layout·console | [env:static][env:typecheck][env:build] |

---

## 케이스 상세

### SC-001 (통계 StatCard 5·금전)

- 검증 방법: `stats/page.tsx` 코드 리뷰 + console typecheck/build.
- 확인 사실:
  - `useQuery({ queryKey: ['admin','stats'], queryFn: () => api.admin.statsOverview() })`.
  - `StatCard` 5개: 총 매출(완료) = `formatKRW(data.totalSales)` · 총 주문 = `${data.totalOrders.
    toLocaleString('ko-KR')}건` · 완료 주문 = `${data.completedOrders.toLocaleString('ko-KR')}건` · 총 사용자
    = `${data.totalUsers.toLocaleString('ko-KR')}명` · 총 판매자 = `${data.totalSellers.toLocaleString('ko-KR')}
    명`. 그리드(`grid sm:grid-cols-2 lg:grid-cols-3`).
  - 분기: `isLoading`→`Loading`, `error`→`ErrorText`(`ApiError` instanceof). PageHeader subtitle "관리자 전용 ·
    전체 플랫폼 요약".
  - `pnpm --filter console typecheck` 0 error + `pnpm --filter console build` 에 `/admin/stats` 라우트 컴파일.

### SC-002 (정산 Table·상태 Badge)

- 검증 방법: `settlements/page.tsx` 코드 리뷰 + console typecheck/build.
- 확인 사실:
  - `useQuery({ queryKey: ['admin','settlements'], queryFn: () => api.admin.settlements() })`(`SettlementView[]`
    — 006 재사용).
  - Table 컬럼: 판매자(`sellerId.slice(0,12)…` mono)·총 매출 `formatKRW(totalSales)`·수수료
    `−formatKRW(commission)`·지급액 `formatKRW(payoutAmount)`(font-semibold)·상태 `<Badge tone={s.status ===
    'completed' ? 'success' : 'warning'}>{s.status === 'completed' ? '지급완료' : '정산대기'}</Badge>`.
  - 분기: `data.length === 0`→`EmptyState`("정산 내역 없음").
  - `console build` 에 `/admin/settlements` 라우트 컴파일.

### SC-003 (사용자 무한스크롤)

- 검증 방법: `users/page.tsx` 코드 리뷰 + console build.
- 확인 사실:
  - `useInfiniteQuery({ queryKey: ['admin','users'], queryFn: ({pageParam}) => api.admin.users(pageParam),
    initialPageParam: undefined, getNextPageParam: (last) => last.nextCursor ?? undefined })`.
  - `items = data?.pages.flatMap((p) => p.items) ?? []`. Table(이메일·이름 `?? '—'`·연락처 `?? '—'`·가입일
    `new Date(createdAt).toLocaleDateString('ko-KR')`).
  - `hasNextPage` 시 "더 보기" `Button`(variant secondary·`onClick fetchNextPage`·`disabled isFetchingNextPage`·
    "불러오는 중…"/"더 보기").
  - 분기: `isLoading`→`Loading`, `error`→`ErrorText`, `!isLoading && items.length === 0`→`EmptyState`("사용자
    없음"). `console build` 에 `/admin/users` 컴파일.

### SC-004 (감사 로그 Table)

- 검증 방법: `audit-logs/page.tsx` 코드 리뷰 + console typecheck/build.
- 확인 사실:
  - `useQuery({ queryKey: ['admin','auditLogs'], queryFn: () => api.admin.auditLogs() })`(`AdminAuditLog[]`).
  - Table 컬럼: 일시 `new Date(createdAt).toLocaleString('ko-KR')`·관리자 `adminId.slice(0,12)…`·조치
    `<Badge tone="info">{log.action}</Badge>`·대상 `{targetType} · {targetId.slice(0,12)…}`.
  - 분기: `data.length === 0`→`EmptyState`("기록 없음", "아직 관리자 조치 기록이 없어요."). PageHeader subtitle
    "관리자 전용 · 조치 이력(append-only)". `console build` 에 `/admin/audit-logs` 컴파일.

### SC-005 (판매자 승인)

- 검증 방법: `sellers/page.tsx` 코드 리뷰.
- 확인 사실:
  - `useQuery({ queryKey: ['admin','pendingSellers'], queryFn: () => api.admin.pendingSellers() })`
    (`AdminSeller[]`). Table(상호 `businessName`·대표자 `representativeName`·사업자번호 `businessNumber`·연락처
    `contactPhone ?? '—'`·조치).
  - `approve = useMutation({ mutationFn: (sellerId) => api.admin.approveSeller(sellerId), onSuccess: () =>
    qc.invalidateQueries({ queryKey: ['admin','pendingSellers'] }) })`.
  - 행 조치: `<Badge tone="warning">{s.status}</Badge>` + 승인 `Button`(`onClick approve.mutate(s.id)`·`disabled
    approve.isPending && approve.variables === s.id`·라벨 "처리 중…"/"승인").
  - 분기: 로딩→`Loading`, 에러→`ErrorText`, `data.length === 0`→`EmptyState`("대기 중인 판매자 없음", "승인
    대기 큐가 비어 있습니다."), `approve.error`→`ErrorText`(`ApiError`).

### SC-006 (배너 CRUD)

- 검증 방법: `banners/page.tsx` 코드 리뷰 + console build.
- 확인 사실:
  - `useQuery({ queryKey: ['admin','banners'], queryFn: () => api.admin.banners() })`(`Banner[]`). `invalidate =
    () => qc.invalidateQueries({ queryKey: ['admin','banners'] })`.
  - Table 컬럼: 제목·위치 `position`·순서 `sortOrder`(tabular-nums)·활성 `<Badge tone={b.isActive ? 'success' :
    'neutral'}>{b.isActive ? '활성' : '비활성'}</Badge>`·조치(활성/비활성 ghost 버튼 `toggle.mutate(b)` + 삭제
    danger 버튼 `remove.mutate(b.id)`).
  - `toggle = useMutation({ mutationFn: (b) => api.admin.updateBanner(b.id, { isActive: !b.isActive }), onSuccess:
    invalidate })`, `remove = useMutation({ mutationFn: (id) => api.admin.deleteBanner(id), onSuccess: invalidate
    })`.
  - `CreateBannerDialog`(Radix Dialog): `Input`(title·imageUrl·linkUrl·sortOrder type number)·`Select`(position
    `POSITIONS: BannerPosition[] = ['MAIN_TOP','MAIN_MIDDLE','MAIN_BOTTOM','SIDEBAR']`). `create = useMutation
    ({ mutationFn: () => api.admin.createBanner(body), onSuccess: () => { onCreated(); setOpen(false); form
    reset } })`. `disabled: create.isPending || !form.title || !form.imageUrl`·라벨 "추가 중…"/"추가".
    `create.error`→`ErrorText`(`ApiError`). body 는 linkUrl/sortOrder 가 있을 때만 포함(조건부 spread).
  - 분기: 로딩·에러·`data.length === 0`→`EmptyState`("배너 없음"). `console build` 에 `/admin/banners` 컴파일.

### SC-007 (view 타입·facade)

- 검증 방법: `shared-types/index.ts`·`api-client/index.ts` 코드 리뷰.
- 확인 사실:
  - `shared-types/index.ts`: `PlatformOverview`(totalOrders/completedOrders/totalUsers/totalSellers `number`·
    totalSales `string`)·`AdminUser`(email·name/phone `string|null`·createdAt)·`AdminAuditLog`(adminId·action·
    targetType·targetId·createdAt)·`SellerApprovalStatus`(PENDING/APPROVED/REJECTED/SUSPENDED)·`AdminSeller`
    (businessName·businessNumber·representativeName·contactPhone/businessAddress `string|null`·status)·
    `BannerPosition`(MAIN_TOP/MAIN_MIDDLE/MAIN_BOTTOM/SIDEBAR)·`Banner`(linkUrl/startsAt/endsAt `string|null`·
    sortOrder `number`·isActive `boolean`)·`CreateBannerRequest`·`UpdateBannerRequest`(`Partial<CreateBannerRequest>`).
    주석 "admin (Phase 3 — 관리자 콘솔)". 정산은 006 `SettlementView` 재사용.
  - `api-client/index.ts`: `admin: { statsOverview: () => http.get<PlatformOverview>('/admin/stats/overview'),
    settlements: () => http.get<SettlementView[]>('/admin/settlements'), users: (cursor?, limit?) =>
    http.get<CursorPage<AdminUser>>('/admin/users', { query: { cursor, limit } }), auditLogs: (limit?) =>
    http.get<AdminAuditLog[]>('/admin/audit-logs', { query: { limit } }), pendingSellers: () =>
    http.get<AdminSeller[]>('/admin/sellers/pending'), approveSeller: (id) => http.post<SellerProfile>
    (\`/admin/sellers/${id}/approve\`), banners: () => http.get<Banner[]>('/admin/banners'), createBanner =>
    http.post<Banner>, updateBanner => http.patch<Banner>, deleteBanner => http.delete<void> }`.

### SC-008 (네비·회귀 0)

- 검증 방법: `layout.tsx` 코드 리뷰 + console typecheck/build.
- 확인 사실:
  - `layout.tsx` `NAV`(`e7d8ebb`): `{ href: '/admin/banners', label: '배너', section: 'admin' }`·
    `{ href: '/admin/settlements', label: '전체 정산', section: 'admin' }`·`{ href: '/admin/stats', label:
    '플랫폼 통계', section: 'admin' }`·`{ href: '/admin/users', label: '사용자', section: 'admin' }`·
    `{ href: '/admin/audit-logs', label: '감사 로그', section: 'admin' }`(기존 `판매자 승인` 위에 누적).
  - `visible = NAV.filter((n) => n.section !== 'seller' || isSeller)` — admin 항상 노출(AdminGuard 백엔드 강제).
  - `pnpm --filter console typecheck` 0 error + `pnpm --filter console build` 22 라우트 PASS — 기존 화면(상품·
    계정·주문·배송·판매자 통계/정산/쿠폰) 동작 회귀 0(NFR-005).

---

## 외부 의존성 명시

### 도구 / 라이브러리

- `@tanstack/react-query`(기존): `useQuery`·`useInfiniteQuery`·`useMutation`·`useQueryClient.invalidateQueries`.
- `@doa/ui`(기존, 변경 0): `StatCard`(`./card`)·`Select`(`./field`)·Table 프리미티브(`./table`)·Dialog
  (Radix `./dialog`)·Badge·Button·Input·PageHeader·EmptyState·Loading·ErrorText.
- `@doa/api-client`(기존 + admin facade 신규): `api.admin.*`(`api.http` 기반) + `ApiError`.
- `@doa/shared-types`(기존 + admin view 타입 9종 신규): `PlatformOverview`·`AdminUser`·`AdminAuditLog`·
  `AdminSeller`·`Banner` 등 + 006 `SettlementView` 재사용 + `CursorPage`.
- `apps/console/lib/order.ts`(기존, 004 산출): `formatKRW` 재사용(신규 헬퍼 0).
- **신규 의존성 0**(`package.json` 변경 없음).

### 환경 변수

- 별도 환경 변수 불필요. API `baseUrl`·`TokenStore` 는 기존 console `lib/api` 가 `createApiClient` 에 주입.

### 외부 서비스

- 검증 단계에서 실제 백엔드 호출 없음. 검증은 정적 구조 리뷰 + 타입체크 + console 빌드(라우트 컴파일)로 수행
  (테스트 서버 기동·네트워크 호출 아님).

---

## 미커버 항목 (사전 분류)

| 항목 | 미커버 사유 | 카테고리 | 권장 검증 방법 |
|---|---|---|---|
| e2e 자동화 | 본 차수는 UI 화면이나 별도 e2e/단위 테스트 부재(빌드/타입체크/정적 갈음) | (2) 설계(테스트 자동화 한계) | Playwright 등으로 통계·정산·사용자·감사·승인·배너 흐름 e2e 후속 |
| 배너 삭제 확인 다이얼로그 | 현재 danger 버튼 즉시 삭제 | (3) 기능 미구현(범위 외) | 후속 AlertDialog 재확인 + 테스트 |
| 클라이언트 권한 노출 차단 | admin 네비 권한 필터 없이 노출(백엔드 AdminGuard 강제) | (3) 기능 미구현(범위 외) | 후속 UI `isAdmin` 필터 추가 |
| 배너 편집(필드 수정) | 활성 토글 외 필드 편집 UI 부재 | (3) 기능 미구현(범위 외) | 후속 편집 다이얼로그 + 테스트 |
| 낙관적 업데이트 | mutation 은 서버 응답 후 invalidate(낙관적 미적용) | (3) 기능 미구현(범위 외) | 후속 `onMutate` 낙관적 업데이트 + 롤백 테스트 |
| 응답 view 타입 한시 | 관리자 응답 OpenAPI 미정의 → 전이형 view 타입 | (3) 백엔드 의존 | 응답 DTO + `@ApiResponse` 보강 후 생성 타입 대체 |
