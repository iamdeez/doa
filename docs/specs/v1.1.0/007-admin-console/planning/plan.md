---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-30 02:10
상태: 확정 (retroactive)
---

# Plan: 007-admin-console

> Branch: 007-admin-console | Date: 2026-06-30 | Spec: [../spec/spec.md](../spec/spec.md)

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [사전 영향도 분석 결과](#사전-영향도-분석-결과)
- [핵심 설계](#핵심-설계)
- [결정 기록 (ADRs)](#결정-기록-adrs)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [보안 노트](#보안-노트)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> `constitution.md`(P-001~P-007) 존재 → 해당 조항을 Gates 로 사용한다(constitution 우선). 본 차수의 핵심
> 검토 조항은 **P-002(신규 의존 — 추가 0)**·**P-005(금전 Decimal 정합성)**·**P-007(스펙 범위)** 이며,
> 화면 동작 정합성은 P-006(테스트 — 빌드/타입/정적 갈음)으로 검증한다.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: 다른 도메인 모듈의 스키마 테이블을 직접 참조·쿼리하지 않음]
  → PASS. 본 차수는 **프론트엔드 console 화면 + 공유 패키지**(api-client·shared-types) 변경이며 백엔드 도메인
  모듈·DB 스키마와 무관하다. DB 접근·교차 쿼리 0. 화면은 백엔드 HTTP 라우트(관리자 통계·정산·사용자·감사·
  판매자·배너)만 호출.
- [x] **P-002 AWS 의존 금지 원칙**: [Pass 기준: `@aws-sdk/*` 및 AWS 전용 SDK 신규 추가 0건]
  → PASS(직접 검토 조항). **신규 의존성 추가 0건**(`package.json` 변경 없음 — numstat 9파일에 `package.json`
  부재). 기존 TanStack Query·Radix Dialog(`@doa/ui`)·`@doa/api-client`·`@doa/shared-types` 만 사용.
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 외부 저장소 0건]
  → PASS(무관). 프론트 화면 변경으로 데이터 저장소·캐시·큐 0건. DB 스키마 변경 0(마이그레이션 없음). 배너
  생성 폼 state(`useState`)는 컴포넌트 메모리이며 영속 저장소가 아니다.
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: Fly.io 전용 API 결합 0건]
  → PASS. 표준 `fetch`(api-client)·TanStack Query·Radix·Next.js 만 사용. 플랫폼 전용 API 0.
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: 금전 상태 변경 outbox·멱등성·Decimal]
  → PASS(직접 검토 조항). 화면은 금전·정산 상태를 **변경하지 않으며**(플랫폼 통계·전체 정산은 조회만, 판매자
  승인·배너 CRUD 는 결제·정산 상태 전이가 아님), 금전 **표시** 만 한다. 플랫폼 매출·정산 금액은 Decimal→JSON
  직렬화상 **문자열**로 받고 view 타입 금전 필드를 `string` 으로 정의하며 기존 `formatKRW` 가 부동소수점 연산
  없이 표기한다(NFR-002). 클라이언트 금전 연산 0.
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건]
  → PASS. FR-001→SC-001, FR-002→SC-002, FR-003→SC-003, FR-004→SC-004, FR-005→SC-005, FR-006→SC-006,
  FR-007·008→SC-007, FR-009→SC-008. UI 화면 성격상 별도 e2e/단위 테스트 스위트는 없으며 검증은 **타입체크 +
  console 빌드 + 정적 구조 검증**으로 갈음한다(모든 FR 이 SC 로 대응 — P-006 충족). 기존 console 테스트
  커버리지 저하 0(NFR-005).
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건]
  → PASS(직접 검토 조항). 변경 범위 = console admin 화면 5개(신규)·판매자 승인 1개(실데이터화)·`layout.tsx`
  (네비)·`api-client/index.ts`(facade)·`shared-types/index.ts`(view 타입). 전부 FR-001~009 추적 가능.
  **admin/coupons(008)·배너 삭제 확인·클라이언트 권한 차단·낙관적 업데이트·배너 편집·통계 차트는 범위 외**로
  분리.

> **예외 사항**: 없음. P-001~P-007 전부 통과(예외 0건). 신규 의존성 추가 0(P-002 무저촉 자명).

> **Gates 판정**: P-001~P-007 전부 통과(예외 0건). 선택 단계는 Database Design=N·Deploy=N·Security=N·
> Performance=N(selection-phases.md). Design Agent(3단계) → Development(4) + Test AUTHORING(5a) 진입 가능.

---

## 기술 컨텍스트

> v1.1.0 프론트 스택을 재확정. 007 고유 변경만 명시.

- **언어 / 런타임**: TypeScript 5.x / Next.js 15(App Router, console). pnpm `9.0.0` + Turborepo 모노레포.
- **상태·데이터 페칭**: TanStack Query(`@tanstack/react-query`) — `useQuery`(통계·정산·감사·판매자·배너 목록)·
  `useInfiniteQuery`(사용자 cursor)·`useMutation`(approveSeller·createBanner·updateBanner·deleteBanner)·
  `useQueryClient.invalidateQueries`(승인·배너 갱신). 배너 생성 폼 state 는 컴포넌트 `useState`.
- **UI**: `@doa/ui` 시맨틱 토큰 컴포넌트(`StatCard`·Table 프리미티브·Badge·Button·Dialog[Radix]·Input·Select·
  PageHeader·EmptyState·Loading·ErrorText). **본 차수에 `@doa/ui` 패키지 변경 0**(기존 컴포넌트 재사용 —
  StatCard `./card`·Select `./field`·Table `./table`[004]·Dialog `./dialog`[002]).
- **API 호출**: `@doa/api-client` admin facade(`api.admin.*` — `api.http` 기반). 003 타입드 client 는 응답
  미정의로 본 화면에 이점이 적어 facade 채택(004·006 연속).
- **타입**: `@doa/shared-types` 전이형 view 타입(`PlatformOverview`·`AdminUser`·`AdminAuditLog`·`AdminSeller`·
  `Banner` 등 — 금전 Decimal→문자열). 정산은 006 `SettlementView` 재사용. 백엔드 응답 DTO 보강 후 생성 타입
  대체 예정.
- **금전 헬퍼**: 기존 `apps/console/lib/order.ts` 의 `formatKRW(amount: string)`(004 산출) 재사용. **신규
  헬퍼 0**.
- **권한**: 전 admin 라우트 백엔드 `AdminGuard` 강제. UI 는 표시만(네비 권한 필터 미적용 — NFR-001).
- **테스트 프레임워크**: 본 차수 별도 e2e/단위 테스트 없음(UI 화면). 검증 = 정적 구조 검증([env:static]) +
  `console typecheck`([env:typecheck]) + `console build` 라우트 컴파일([env:build]).
- **환경변수**: 신규 0. **신규 의존성**: 0건(기존 패키지만 사용).

---

## 사전 영향도 분석 결과

> 상세는 [../design/research.md](../design/research.md) 참조. 본 절은 영향 파일 요약.

### 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 | 레이어 |
|---|---|---|---|
| `packages/shared-types/src/index.ts` | 수정 | admin view 타입 9종(`PlatformOverview`·`AdminUser`·`AdminAuditLog`·`SellerApprovalStatus`·`AdminSeller`·`BannerPosition`·`Banner`·`CreateBannerRequest`·`UpdateBannerRequest` — 금전 string. 정산은 006 `SettlementView` 재사용) | A(타입 계약) |
| `packages/api-client/src/index.ts` | 수정 | `admin` facade 10 메서드(`statsOverview`·`settlements`·`users`·`auditLogs`·`pendingSellers`·`approveSeller`·`banners`·`createBanner`·`updateBanner`·`deleteBanner` — `api.http` 기반, view 타입 응답 제네릭) | B(도메인 facade) |
| `apps/console/app/(dashboard)/admin/banners/page.tsx` | 신규 | 배너 목록 Table + 생성 다이얼로그(Radix) + 활성 토글 + 삭제(danger) | C(화면) |
| `apps/console/app/(dashboard)/admin/sellers/page.tsx` | 수정 | 판매자 승인 — 플레이스홀더를 `pendingSellers` 조회 + `approveSeller` mutation 으로 실데이터화 | C(화면) |
| `apps/console/app/(dashboard)/admin/users/page.tsx` | 신규 | 사용자 Table + `useInfiniteQuery` cursor "더 보기" | C(화면) |
| `apps/console/app/(dashboard)/admin/settlements/page.tsx` | 신규 | 전체 정산 Table(판매자·총매출·수수료·지급액·상태 Badge) | C(화면) |
| `apps/console/app/(dashboard)/admin/audit-logs/page.tsx` | 신규 | 감사 로그 Table(일시·관리자·조치 Badge·대상) | C(화면) |
| `apps/console/app/(dashboard)/admin/stats/page.tsx` | 신규 | 플랫폼 통계(`StatCard` 5개) | C(화면) |
| `apps/console/app/(dashboard)/layout.tsx` | 수정 | "배너"·"전체 정산"·"플랫폼 통계"·"사용자"·"감사 로그" 관리자 네비 5개 추가(+5 -0) | C(셸) |

> 백엔드·DB·`@doa/ui`·`@doa/design-tokens` 변경 0건. `@doa/shared-types` 의 `SettlementView`(006)·`CursorPage`
> 등 기존 타입 불변(admin view 타입 9종 추가). 003 타입드 client 변경 0. `package.json` 변경 0(신규 의존 0 —
> P-002).

### 변경 라인 직접 카운트 (자가 보고 비신뢰)

| 파일 | 추가 | 삭제 | 방법 |
|---|---|---|---|
| `apps/console/.../admin/banners/page.tsx`(신규) | 172 | 0 | `git diff --numstat 1a6d70d e7d8ebb` |
| `packages/shared-types/src/index.ts` | 77 | 0 | 동일(admin view 타입 9종) |
| `apps/console/.../admin/sellers/page.tsx` | 72 | 13 | 동일(플레이스홀더→실데이터) |
| `apps/console/.../admin/users/page.tsx`(신규) | 71 | 0 | 동일 |
| `apps/console/.../admin/settlements/page.tsx`(신규) | 64 | 0 | 동일 |
| `apps/console/.../admin/audit-logs/page.tsx`(신규) | 61 | 0 | 동일 |
| `apps/console/.../admin/stats/page.tsx`(신규) | 32 | 0 | 동일 |
| `packages/api-client/src/index.ts` | 32 | 0 | 동일(admin facade 10 메서드) |
| `apps/console/app/(dashboard)/layout.tsx` | 5 | 0 | 동일(네비 5개 추가) |

**합계**: 9 files changed, 586 insertions(+), 13 deletions(-).

> 커밋 1개로 구성: `e7d8ebb`(Phase 3 관리자 콘솔 — 신규 5화면·판매자 승인 실데이터화·layout 네비·api-client·
> shared-types). base `1a6d70d` → `e7d8ebb`.

---

## 핵심 설계

### 1. 플랫폼 통계 화면 (FR-001)

```tsx
// admin/stats/page.tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['admin', 'stats'],
  queryFn: () => api.admin.statsOverview(),     // GET /admin/stats/overview → PlatformOverview
});
// StatCard 5개: 총 매출(완료) formatKRW(totalSales) · 총 주문 · 완료 주문 · 총 사용자 · 총 판매자
//   (각 toLocaleString('ko-KR') + 단위 건/명). 그리드(grid sm:grid-cols-2 lg:grid-cols-3)
```

- 로딩→`Loading`, 에러→`ErrorText`(`ApiError` instanceof). 비판매자/권한 분기는 백엔드 위임(UI 표시만).

### 2. 전체 정산 화면 (FR-002)

```tsx
// admin/settlements/page.tsx
const { data } = useQuery({ queryKey: ['admin','settlements'], queryFn: () => api.admin.settlements() });
//   GET /admin/settlements → SettlementView[] (006 타입 재사용)
// Table 컬럼: 판매자(sellerId 앞 12자 mono) · 총 매출 · 수수료(−formatKRW) · 지급액(font-semibold) · 상태 Badge
// status: 'completed' → '지급완료'(success) / 그 외 → '정산대기'(warning)
```

- 빈 목록(`data.length === 0`)→`EmptyState`. 금액은 전부 `formatKRW`(우측 정렬·`tabular-nums`).

### 3. 사용자 화면 — cursor 무한 스크롤 (FR-003)

```tsx
// admin/users/page.tsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['admin','users'],
  queryFn: ({ pageParam }) => api.admin.users(pageParam),       // GET /admin/users → CursorPage<AdminUser>
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});
const items = data?.pages.flatMap((p) => p.items) ?? [];
// Table(이메일·이름·연락처·가입일) + hasNextPage 시 "더 보기" Button(isFetchingNextPage 비활성화)
```

### 4. 감사 로그 화면 (FR-004)

```tsx
// admin/audit-logs/page.tsx
const { data } = useQuery({ queryKey: ['admin','auditLogs'], queryFn: () => api.admin.auditLogs() });
//   GET /admin/audit-logs → AdminAuditLog[] (013, append-only)
// Table: 일시(toLocaleString) · 관리자(adminId 앞 12자) · 조치(<Badge tone="info">action</Badge>) ·
//   대상(targetType · targetId 앞 12자)
```

### 5. 판매자 승인 화면 — 플레이스홀더 실데이터화 (FR-005)

```tsx
// admin/sellers/page.tsx
const { data } = useQuery({ queryKey: ['admin','pendingSellers'], queryFn: () => api.admin.pendingSellers() });
//   GET /admin/sellers/pending → AdminSeller[]
const approve = useMutation({
  mutationFn: (sellerId: string) => api.admin.approveSeller(sellerId),   // POST /admin/sellers/:id/approve
  onSuccess: () => qc.invalidateQueries({ queryKey: ['admin','pendingSellers'] }),
});
// Table(상호·대표자·사업자번호·연락처·조치). 행 승인 Button:
//   disabled: approve.isPending && approve.variables === s.id  → 라벨 "처리 중…"/"승인"
```

### 6. 배너 관리 화면 — CRUD (FR-006)

```tsx
// admin/banners/page.tsx
const { data } = useQuery({ queryKey: ['admin','banners'], queryFn: () => api.admin.banners() });  // Banner[]
const invalidate = () => qc.invalidateQueries({ queryKey: ['admin','banners'] });
const toggle = useMutation({ mutationFn: (b) => api.admin.updateBanner(b.id, { isActive: !b.isActive }),
  onSuccess: invalidate });          // PATCH /admin/banners/:id
const remove = useMutation({ mutationFn: (id) => api.admin.deleteBanner(id), onSuccess: invalidate }); // DELETE
// Table(제목·위치·순서·활성 Badge·조치[활성/비활성 ghost · 삭제 danger])
// CreateBannerDialog (Radix Dialog) — Input(title/imageUrl/linkUrl/sortOrder) + Select(position BannerPosition)
const create = useMutation({ mutationFn: () => api.admin.createBanner(body),   // POST /admin/banners
  onSuccess: () => { onCreated(); setOpen(false); /* form reset */ } });
// canSubmit = !create.isPending && form.title && form.imageUrl
```

- `POSITIONS: BannerPosition[] = ['MAIN_TOP','MAIN_MIDDLE','MAIN_BOTTOM','SIDEBAR']`. 삭제는 즉시(확인
  다이얼로그 없음 — 범위 외).

### 7. view 타입 + admin facade (FR-007·008)

```ts
// shared-types/index.ts — 백엔드 응답 OpenAPI 미정의(Prisma 엔티티) → 전이형 view 타입(금전 string)
export interface PlatformOverview { totalOrders: number; completedOrders: number; totalSales: string;
  totalUsers: number; totalSellers: number; }
export interface AdminUser { id: string; email: string; name: string|null; phone: string|null; createdAt: string; }
export interface AdminAuditLog { id; adminId; action; targetType; targetId; createdAt: string; }
export type SellerApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export interface AdminSeller { id; userId; businessName; businessNumber; representativeName;
  contactPhone: string|null; businessAddress: string|null; status: SellerApprovalStatus; }
export type BannerPosition = 'MAIN_TOP' | 'MAIN_MIDDLE' | 'MAIN_BOTTOM' | 'SIDEBAR';
export interface Banner { id; title; imageUrl; linkUrl: string|null; position: BannerPosition;
  sortOrder: number; isActive: boolean; startsAt: string|null; endsAt: string|null; createdAt: string; }
export interface CreateBannerRequest { title; imageUrl; linkUrl?; position?; sortOrder?; isActive?;
  startsAt?; endsAt?; }
export type UpdateBannerRequest = Partial<CreateBannerRequest>;

// api-client/index.ts — createApiClient 반환에 admin facade 추가
admin: {
  statsOverview: () => http.get<PlatformOverview>('/admin/stats/overview'),
  settlements:   () => http.get<SettlementView[]>('/admin/settlements'),
  users:      (cursor?, limit?) => http.get<CursorPage<AdminUser>>('/admin/users', { query: { cursor, limit } }),
  auditLogs:  (limit?) => http.get<AdminAuditLog[]>('/admin/audit-logs', { query: { limit } }),
  pendingSellers: () => http.get<AdminSeller[]>('/admin/sellers/pending'),
  approveSeller:  (sellerId) => http.post<SellerProfile>(`/admin/sellers/${sellerId}/approve`),
  banners:      () => http.get<Banner[]>('/admin/banners'),
  createBanner: (body: CreateBannerRequest) => http.post<Banner>('/admin/banners', body),
  updateBanner: (id, body: UpdateBannerRequest) => http.patch<Banner>(`/admin/banners/${id}`, body),
  deleteBanner: (id) => http.delete<void>(`/admin/banners/${id}`),
},
```

### 8. AppShell 네비 (FR-009)

```tsx
// layout.tsx — 관리자 네비에 5개 추가 (section: 'admin', 기존 '판매자 승인' 위에 누적)
{ href: '/admin/banners', label: '배너', section: 'admin' },
{ href: '/admin/settlements', label: '전체 정산', section: 'admin' },
{ href: '/admin/stats', label: '플랫폼 통계', section: 'admin' },
{ href: '/admin/users', label: '사용자', section: 'admin' },
{ href: '/admin/audit-logs', label: '감사 로그', section: 'admin' },
// visible 필터는 seller 섹션만 isSeller 로 가림 — admin 섹션은 항상 노출(AdminGuard 백엔드 강제 — NFR-001)
```

---

## 결정 기록 (ADRs)

| ADR-ID | 결정 항목 | 채택안 | 대안(검토했으나 미채택) | 근거(spec FR/NFR) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | 응답 호출 도구 | `api.http` 기반 admin facade + view 타입 | 003 타입드 `api.client.GET` | FR-007·008(응답 OpenAPI 미정의 — 타입드 이점 적음, 004·006 연속) | shared-types·api-client |
| ADR-002 | 응답 타입 정의 위치 | `@doa/shared-types` 전이형 view 타입(금전 string) | 화면 로컬 타입 | FR-007, NFR-002 | shared-types |
| ADR-003 | 정산 타입 | 006 `SettlementView` 재사용 | admin 전용 정산 타입 신규 정의 | FR-002·FR-007(동일 구조 — 중복 회피) | settlements/page.tsx |
| ADR-004 | 사용자 목록 페이지네이션 | `useInfiniteQuery` cursor "더 보기" | 단일 조회 / 페이지 번호 | FR-003 | users/page.tsx |
| ADR-005 | 판매자 승인 화면 | 플레이스홀더 → 실데이터 + `approveSeller` mutation | 플레이스홀더 유지 | FR-005 | sellers/page.tsx |
| ADR-006 | 배너 생성 UI | Radix `Dialog`(목록 화면 내 모달) | 별도 라우트 페이지 | FR-006, NFR-003(002 Dialog 재사용) | banners/page.tsx |
| ADR-007 | 배너 삭제 확인 | 즉시 삭제(현 구현) | AlertDialog 재확인 | 범위 분리(후속 — gaps) | banners/page.tsx |
| ADR-008 | 권한 강제 | 백엔드 `AdminGuard` 강제 + UI 표시(네비 필터 미적용) | UI `isAdmin` 분기 강제 | NFR-001 | layout·6 화면 |
| ADR-009 | 금전 헬퍼 | 기존 `lib/order.ts` `formatKRW` 재사용 | 신규 헬퍼 정의 | NFR-002, P-005(004 산출 재사용) | stats·settlements |

---

## 인터페이스 계약

### 백엔드 라우트 계약 (실제 — 호출 측 의존, 전부 AdminGuard)

| 라우트 | 메서드 | 요청 | 응답(view 타입) | 비고 |
|---|---|---|---|---|
| `/admin/stats/overview` | GET | — | `PlatformOverview` | 플랫폼 누적 요약(완료 기준 매출) |
| `/admin/settlements` | GET | — | `SettlementView[]`(006) | 전체 판매자 정산 |
| `/admin/users` | GET | `?cursor&limit` | `CursorPage<AdminUser>` | 사용자 목록(cursor) |
| `/admin/audit-logs` | GET | `?limit` | `AdminAuditLog[]` | 관리자 조치 감사 로그(013, 최신순) |
| `/admin/sellers/pending` | GET | — | `AdminSeller[]` | 승인 대기 판매자 |
| `/admin/sellers/:id/approve` | POST | — | `SellerProfile` | 판매자 승인 |
| `/admin/banners` | GET | — | `Banner[]` | 전체 배너(활성/비활성) |
| `/admin/banners` | POST | `CreateBannerRequest` | `Banner` | 배너 생성 |
| `/admin/banners/:id` | PATCH | `UpdateBannerRequest` | `Banner` | 배너 부분 갱신(활성 토글) |
| `/admin/banners/:id` | DELETE | — | `void` | 배너 삭제 |

### 007 신규/변경 프론트 인터페이스

```ts
// api-client/index.ts — createApiClient 반환에 추가
admin: {
  statsOverview(): Promise<PlatformOverview>;
  settlements(): Promise<SettlementView[]>;
  users(cursor?: string, limit?: number): Promise<CursorPage<AdminUser>>;
  auditLogs(limit?: number): Promise<AdminAuditLog[]>;
  pendingSellers(): Promise<AdminSeller[]>;
  approveSeller(sellerId: string): Promise<SellerProfile>;
  banners(): Promise<Banner[]>;
  createBanner(body: CreateBannerRequest): Promise<Banner>;
  updateBanner(id: string, body: UpdateBannerRequest): Promise<Banner>;
  deleteBanner(id: string): Promise<void>;
};
```

### 하위 호환성 / 방어 코드

- **기존 facade·화면 비파괴(핵심)**: `createApiClient` 반환에 `admin` 을 **추가** 할 뿐 기존 facade(auth·user·
  seller·catalog·inventory·order·shipping·stats·settlement·coupon·http·client)와 console 화면은 불변(타입체크
  회귀 0 — NFR-005·SC-008). 판매자 승인 화면은 플레이스홀더를 실데이터로 교체하나 라우트 경로(`/admin/sellers`)
  는 불변.
- **금전 부동소수점 방어**: 기존 `formatKRW` 가 `Number.isFinite` 검사로 비유한값은 원문으로 표기한다. view
  타입 금전 필드(`PlatformOverview.totalSales`)는 `string` 이므로 클라이언트가 Decimal 정밀도를 훼손하지
  않는다(P-005).
- **권한 표시 분기 없음(백엔드 위임)**: admin 네비는 권한 필터 없이 노출되며, 실제 데이터 보호는 백엔드
  `AdminGuard` 가 강제한다(비관리자 호출 시 403 — NFR-001). UI 의 `visible` 필터는 seller 섹션만 `isSeller`
  로 가린다.
- **처리 중 행 식별**: 판매자 승인은 `approve.variables === s.id` 로 처리 중인 행만 비활성화하여 다른 행 조작을
  허용한다. 배너 토글·삭제는 mutation `isPending` 전역 비활성화.

---

## 데이터 모델

DB 스키마 변경 없음(마이그레이션 0). 신규 테이블·컬럼·enum·인덱스·제약 0건. 본 차수의 "데이터"는 런타임 DB
데이터가 아닌 **HTTP 응답 view 타입**(`@doa/shared-types` 의 전이형 타입 — 백엔드 Prisma 엔티티 응답을
프론트가 한시 표현)이며, 화면은 이를 **소비·표시** 할 뿐 영속하지 않는다. 배너 생성 폼의 `useState` 는
컴포넌트 세션 메모리로 신규 저장소가 아니다. Database Design Agent 비활성(selection-phases.md).

> **view 타입 한시성**: 응답 view 타입은 백엔드 OpenAPI 응답 정의가 보강되면 생성 타입(`Schemas['...']`)으로
> 대체될 임시 계약이다(GAP-007-01 / 006 GAP-006-01 / 004 GAP-004-01 / 001 GAP-001-01 연속). 정의 위치는 공유
> 패키지(`shared-types`)이므로 백엔드 응답 DTO 보강 시 한 곳에서 교체 가능하다. 정산은 006 `SettlementView`
> 를 재사용하여 admin 정산 타입을 신규 정의하지 않았다.

---

## 테스트 전략

### SC↔검증 매핑 (요약)

| SC 식별자 | 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | typecheck/build | 통계 렌더 | StatCard 5개·formatKRW | console typecheck/build | `/admin/stats` 컴파일·5 지표 표기 |
| SC-002 | typecheck/build | 정산 렌더 | Table·상태 Badge·formatKRW | console typecheck/build | `/admin/settlements` 컴파일·지급완료/정산대기 |
| SC-003 | static/typecheck/build | 사용자 무한스크롤 | useInfiniteQuery·flatMap·더 보기 | users/page.tsx 리뷰 + console build | `/admin/users` 컴파일·cursor 페이지 |
| SC-004 | typecheck/build | 감사 로그 렌더 | Table·action Badge | console typecheck/build | `/admin/audit-logs` 컴파일 |
| SC-005 | static | 판매자 승인 | pendingSellers·approveSeller·invalidate | sellers/page.tsx 리뷰 | 승인 mutation·행 비활성화 |
| SC-006 | static/typecheck/build | 배너 CRUD | banners·CreateBannerDialog·toggle·delete·invalidate | banners/page.tsx 리뷰 + console build | `/admin/banners` 컴파일·CRUD mutation |
| SC-007 | static/typecheck | view 타입·facade | view 타입 9종·admin facade 10 메서드 | shared-types·api-client 리뷰 | 금전 string·facade 10종 |
| SC-008 | static/typecheck/build | 네비·회귀 | 네비 5개·22 라우트 | layout·console typecheck/build | 네비 추가·회귀 0 |

### smoke_tests

- 필요 여부: N(별도 부팅 스모크 불필요). 본 차수는 UI 화면으로, 검증은 **타입체크(`console typecheck`) +
  console 빌드(신규 5 라우트 컴파일 — `/admin/stats`·`/admin/settlements`·`/admin/users`·`/admin/audit-logs`·
  `/admin/banners`) + 정적 구조 검증(승인 mutation·배너 CRUD·view 타입·facade·금전 포맷·네비)** 으로 갈음한다.
  별도 e2e/단위 테스트 스위트는 작성하지 않으며, 기존 console 빌드·타입체크가 회귀 0 으로 유지된다. e2e·배너
  삭제 확인·낙관적 업데이트 테스트는 후속 권고(GAP-007-01).

---

## 보안 노트

> Security Agent: N(selection-phases.md). 본 절로 보안 영향 분석을 갈음한다.

- **권한 강제는 백엔드 AdminGuard(핵심)**: 본 화면은 클라이언트이며 실제 인가는 백엔드 `AdminGuard` 가 전 admin
  라우트에 강제한다. UI 의 admin 네비는 권한 필터 없이 노출되나, 비관리자가 라우트에 직접 접근하거나 facade 를
  호출해도 백엔드가 403 으로 차단한다(NFR-001). 클라이언트 권한 노출 차단(`isAdmin` UI 분기)은 표시 편의일 뿐
  데이터 보호가 아니므로 후속 보강 대상이다(gaps — 데이터 보호 결함 아님).
- **금전 정합성(P-005)**: 화면은 금전·정산 상태를 변경하지 않고 표시만 하며, Decimal 을 문자열로 받아
  부동소수점 연산 없이 표기한다(`formatKRW`). 결제·정산 상태 변경 로직 0. 판매자 승인·배너 CRUD 는 결제·정산
  outbox/멱등성 경로와 무관하다.
- **파괴적 조치(배너 삭제)**: 배너 삭제는 확인 다이얼로그 없이 즉시 수행된다. 실수 삭제 위험은 있으나 배너는
  재생성 가능하고 백엔드가 권한을 강제하므로 데이터 무결성 위협은 낮다. AlertDialog 재확인은 후속(gaps).
- **신규 공격 표면**: 신규 의존성 0, 신규 네트워크 엔드포인트 0(기존 백엔드 admin 라우트 소비). 배너 생성 폼은
  제어 컴포넌트로 입력을 백엔드 DTO(class-validator)에 위임한다. OWASP Top 10 관점의 신규 공격 표면 없음.
- **결론**: 인가는 백엔드 `AdminGuard` 위임(UI 표시·권한 필터 미적용 — 후속 보강), 금전은 표시 전용·부동소수점
  미연산, 배너 삭제 즉시 수행(낮은 위험·후속 확인 다이얼로그). 보안 감사 대상 부재(Security Agent: N —
  selection-phases.md).

---

## 기타 고려사항

- **응답 타입 처리(핵심)**: 관리자 엔드포인트는 백엔드가 Prisma 엔티티를 반환하고 OpenAPI 에 응답 스키마가
  미정의다(001 coverage-gap). 따라서 003 의 타입드 client 는 응답 타입이 비어 본 화면에서 이점이 적어,
  `api.http` 기반 admin facade + `@doa/shared-types` 전이형 view 타입을 채택했다(ADR-001·004·006 연속). 요청
  측(params·body)은 정확하나 응답은 한시 view 타입이며, 백엔드 응답 DTO + `@ApiResponse({ type })` 보강 후
  코드젠 재생성하면 생성 타입으로 대체 가능하다(GAP-007-01).
- **정산 타입 재사용**: admin 전체 정산은 006 의 `SettlementView`(id·sellerId·periodStart/End·totalSales·
  commission·payoutAmount·status·createdAt)를 그대로 재사용한다. admin 화면은 판매자별 정산을 보여주므로
  `sellerId` 컬럼을 표시하나(판매자 본인 화면은 기간을 표시), 타입 구조가 동일하여 신규 정의를 만들지 않았다
  (ADR-003).
- **사용자 cursor 무한 스크롤**: `useInfiniteQuery` 로 `CursorPage<AdminUser>` 를 페이지 단위 누적하고
  `pages.flatMap(items)` 로 평탄화한다. `getNextPageParam` 은 `last.nextCursor ?? undefined` 이며, 화면은
  facade 의 `limit` 인자를 전달하지 않아 백엔드 기본 페이지 크기를 사용한다.
- **판매자 승인 처리 중 식별**: `approve.variables === s.id` 로 현재 처리 중인 행만 식별하여 해당 버튼만
  비활성화·"처리 중…" 라벨을 전환한다(다른 행은 계속 조작 가능). 승인 성공 시 목록 invalidate 로 처리된
  판매자가 대기 목록에서 사라진다.
- **배너 삭제 즉시 수행**: 삭제 `danger` 버튼은 확인 다이얼로그 없이 `deleteBanner` 를 즉시 호출한다(범위 외 —
  AlertDialog 후속). 활성 토글·삭제·생성 세 mutation 모두 성공 시 `['admin','banners']` 를 invalidate 하여
  목록을 갱신한다.
- **클라이언트 권한 노출**: admin 네비는 모든 인증 사용자에게 노출된다(현 `visible` 필터는 seller 섹션만
  `isSeller` 로 가림). 백엔드 `AdminGuard` 가 최종 강제하므로 데이터는 보호되나, 비관리자에게 admin 메뉴가
  보이는 UX 결함이 있다(후속 — `isAdmin` 필터 추가, GAP-007-01).
- **신규 의존 0**: 본 차수는 기존 패키지(TanStack Query·Radix Dialog·`@doa/ui`·`@doa/api-client`·
  `@doa/shared-types`)만 사용하며 `package.json` 변경이 없다(P-002 무저촉 자명, NFR-005 회귀 0 유리).
