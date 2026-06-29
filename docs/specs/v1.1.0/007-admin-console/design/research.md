---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-30 02:10
상태: 확정 (retroactive)
---

# Research: 007-admin-console

## 목차

- [분석 우선순위 게이트 결과](#분석-우선순위-게이트-결과)
- [기존 코드베이스 분석](#기존-코드베이스-분석)
  - [console admin 영역 현황 (007 이전)](#console-admin-영역-현황-007-이전)
  - [백엔드 관리자 라우트 계약](#백엔드-관리자-라우트-계약)
- [응답 타입 처리 — 타입드 client vs facade+view 타입](#응답-타입-처리--타입드-client-vs-facadeview-타입)
- [판매자 승인 화면 — 플레이스홀더 실데이터화](#판매자-승인-화면--플레이스홀더-실데이터화)
- [사용자 cursor 무한 스크롤 — useInfiniteQuery](#사용자-cursor-무한-스크롤--useinfinitequery)
- [배너 관리 — CRUD + Radix Dialog 패턴](#배너-관리--crud--radix-dialog-패턴)
- [정산 타입 재사용 — 006 SettlementView](#정산-타입-재사용--006-settlementview)
- [AdminGuard UI 노출 정책](#adminguard-ui-노출-정책)
- [생성물·구조 검증 (직접 확인)](#생성물구조-검증-직접-확인)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 분석 우선순위 게이트 결과

- **변경 대상(plan §핵심 설계)**: console admin 화면 6개(`admin/stats`·`admin/settlements`·`admin/users`·
  `admin/audit-logs`·`admin/sellers`[실데이터화]·`admin/banners`)·`layout.tsx`(네비)·`api-client/index.ts`
  (facade)·`shared-types/index.ts`(view 타입). 백엔드·DB **변경 없음**(기존 라우트 소비).
- §A·B·C 분석은 위 변경 대상으로 한정.
- §D(다단계 병렬 파이프라인): 미해당.
- §E(동일 가드 결정 통합): 미해당.
- 외부 라이브러리 검증(§4): **신규 라이브러리 0건**(기존 TanStack Query·Radix Dialog[`@doa/ui`]·
  `@doa/api-client`·`@doa/shared-types` 만 사용).
- §F(production 시그니처 변경): **부분 해당** — `createApiClient` 반환에 `admin` facade **추가**(기존 facade·
  console 화면 불변 — 호출 측 영향 0). `@doa/shared-types` 기존 export 불변(admin view 타입 9종 추가, 006
  `SettlementView` 재사용). 판매자 승인 화면은 라우트 경로 불변·내부 구현만 플레이스홀더→실데이터.

---

## 기존 코드베이스 분석

> context.md 의 모노레포·공유 패키지 구조를 기준선. 본 절은 변경 대상 한정 정밀 분석.

### console admin 영역 현황 (007 이전)

- **구조**: console admin 영역(`(dashboard)/admin/`)에 판매자 승인(`/admin/sellers`)이 **플레이스홀더**(실데이터
  미연동)로만 존재. 플랫폼 통계·전체 정산·사용자·감사 로그·배너 관리 화면 부재. AppShell(`(dashboard)/layout.tsx`)
  의 `NAV` 관리자 섹션에 "판매자 승인" 1개만 등록.
- **공유 패키지**: 006 까지 `@doa/api-client` 에 도메인 facade(auth·user·seller·catalog·inventory·order·
  shipping·stats·settlement·coupon) + 타입드 client + `http`(저수준)를 제공. `admin` facade 는 부재.
  `@doa/shared-types` 에 admin view 타입 부재(`SettlementView` 는 006 에서 정의됨). `@doa/ui` 에 `StatCard`
  (`./card`)·`Select`(`./field`)·Table 프리미티브(`./table` — 004)·Dialog(`./dialog` — Radix 002)가 **이미
  존재**(본 차수에 `@doa/ui` 변경 0).
- **금전 헬퍼**: 004 가 `apps/console/lib/order.ts` 에 `formatKRW(amount: string)` 를 제공. 본 차수 통계·정산
  화면이 이를 재사용(신규 헬퍼 0).
- **네비 visible 필터**: `layout.tsx` 의 `visible = NAV.filter((n) => n.section !== 'seller' || isSeller)` 는
  seller 섹션만 `isSeller` 로 가리고 admin·common 섹션은 항상 노출한다. 따라서 admin 네비는 권한 필터 없이
  모든 인증 사용자에게 보인다(코드 주석: "admin 섹션은 백엔드 AdminGuard 가 최종 강제하므로 UI 에서는 항상
  노출(문서화된 갭)").

### 백엔드 관리자 라우트 계약

- 백엔드는 이미 다음 라우트를 제공한다(전부 `AdminGuard` 강제, 엔드포인트 경로 글로벌 프리픽스 없음 — facade
  컨벤션 동일): `GET /admin/stats/overview`(플랫폼 요약)·`GET /admin/settlements`(전체 정산)·`GET /admin/users`
  (cursor 사용자 목록)·`GET /admin/audit-logs`(013 감사 로그, 최신순)·`GET /admin/sellers/pending`(승인 대기)·
  `POST /admin/sellers/:id/approve`(판매자 승인)·`GET·POST·PATCH·DELETE /admin/banners`(배너 CRUD).
- **응답 스키마 미정의**: 위 라우트의 응답은 컨트롤러가 Prisma 엔티티를 반환하며 OpenAPI 응답 content 가
  미주석이다(001 coverage-gap — 004·006 와 동일). 따라서 003 의 타입드 client 는 이 라우트들의 response 타입이
  비어 본 화면에서 이점이 적다.

---

## 응답 타입 처리 — 타입드 client vs facade+view 타입

| 항목 | 003 타입드 client(`api.client.GET`) | facade + view 타입(007 채택) |
|---|---|---|
| 요청(params·body) 타입 | 생성 타입에서 자동 | view 타입 수기(`CreateBannerRequest` 등) |
| 응답 타입 | **비어 있음**(백엔드 응답 미정의 — 001 coverage-gap) | **전이형 view 타입**(`PlatformOverview`·`AdminUser`·`Banner` — 금전 string) |
| 금전 표기 | (응답 타입 부재로 미보장) | view 타입 금전 필드 `string`(Decimal→문자열, `formatKRW`) |
| 호출 형태 | `api.client.GET('/admin/stats/overview', ...)` | `api.admin.statsOverview()`(facade) |
| 한시성 | — | 백엔드 응답 DTO 보강 후 생성 타입 대체 |

> 채택: facade + view 타입(ADR-001·002 — 004·006 연속). 관리자 엔드포인트 응답이 OpenAPI 미정의(Prisma 엔티티
> 반환)여서 타입드 client 의 응답 타입이 비어 있다. `@doa/shared-types` 에 전이형 view 타입 9종(금전
> Decimal→문자열)을 정의하고 `api.http` 기반 admin facade(`api.admin.*`)로 호출하여 화면에서 응답 타입
> 안전성을 확보한다. 백엔드 응답 DTO + `@ApiResponse({ type })` 보강 후 코드젠 재생성하면 view 타입을 생성
> 타입(`Schemas['...']`)으로 대체할 수 있다(GAP-007-01 / 006 GAP-006-01 / 004 GAP-004-01 연속).

---

## 판매자 승인 화면 — 플레이스홀더 실데이터화

- **문제**: 기존 `/admin/sellers` 는 플레이스홀더(실데이터 미연동)로, 관리자가 승인 대기 판매자를 보거나 승인
  처리할 수 없었다.
- **해결(채택)**: `GET /admin/sellers/pending`(`api.admin.pendingSellers` — `AdminSeller[]`) 조회 + 각 행
  승인 `Button` 이 `POST /admin/sellers/:id/approve`(`api.admin.approveSeller` — `useMutation`)를 호출하도록
  실데이터화한다(ADR-005).

| 항목 | 내용 |
|---|---|
| 조회 | `useQuery(['admin','pendingSellers'], api.admin.pendingSellers)` → Table(상호·대표자·사업자번호·연락처·조치) |
| 승인 | `approve = useMutation(api.admin.approveSeller)`, `onSuccess` → `invalidateQueries(['admin','pendingSellers'])` |
| 처리 중 식별 | `disabled: approve.isPending && approve.variables === s.id` → 해당 행 버튼만 "처리 중…" |
| 에러 | `approve.error` → `ErrorText`(`ApiError` instanceof) |

- numstat 상 +72/-13(플레이스홀더 13줄 제거 + 실데이터 72줄 추가). 승인 성공 시 처리된 판매자가 대기 목록에서
  사라진다(invalidate).

---

## 사용자 cursor 무한 스크롤 — useInfiniteQuery

- **문제**: 사용자 목록은 규모가 클 수 있어 단일 조회가 부적합하다. 백엔드는 `CursorPage<AdminUser>`
  (`nextCursor`)를 반환한다.
- **해결(채택)**: `useInfiniteQuery` + cursor "더 보기"(ADR-004).

```tsx
useInfiniteQuery({
  queryKey: ['admin','users'],
  queryFn: ({ pageParam }) => api.admin.users(pageParam),   // pageParam = cursor
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});
const items = data?.pages.flatMap((p) => p.items) ?? [];
// hasNextPage 시 "더 보기" Button(onClick fetchNextPage·disabled isFetchingNextPage·"불러오는 중…")
```

- 화면은 facade 의 `limit` 인자를 전달하지 않아 백엔드 기본 페이지 크기를 사용한다. 빈 목록은 `!isLoading &&
  items.length === 0` → `EmptyState`("사용자 없음").

---

## 배너 관리 — CRUD + Radix Dialog 패턴

| 항목 | Radix Dialog 모달(007 채택) | 별도 라우트 페이지 |
|---|---|---|
| 접근성 | 포커스 트랩·ESC·ARIA 내장(002 산출) | 수동 구성 필요 |
| 흐름 | 목록 화면에서 즉시 생성 | 페이지 이동·복귀 |
| 의존성 | 0(기존 `@doa/ui` Dialog 재사용) | 신규 라우트 추가 |

> 채택: Radix `Dialog`(ADR-006). 002 가 제공한 `Dialog`(Root/Trigger/Content/Header/Title/Footer)를 재사용하여
> `CreateBannerDialog` 를 목록 화면 내 모달로 구성한다. 폼은 제목·이미지 URL·링크 URL(선택)·노출 위치(`Select`
> — `BannerPosition` 4종: MAIN_TOP/MAIN_MIDDLE/MAIN_BOTTOM/SIDEBAR)·정렬 순서(선택)이며 `canSubmit =
> !create.isPending && form.title && form.imageUrl`. 생성 성공 시 `onCreated()`(목록 invalidate)·다이얼로그
> 닫기·폼 reset.

- **활성 토글**: 각 행 ghost 버튼이 `updateBanner(b.id, { isActive: !b.isActive })`(PATCH) 호출, `onSuccess`
  invalidate. 활성 상태는 `Badge tone={b.isActive ? 'success' : 'neutral'}`.
- **삭제**: 각 행 `danger` 버튼이 `deleteBanner(b.id)`(DELETE) 즉시 호출(확인 다이얼로그 없음 — ADR-007 범위
  분리), `onSuccess` invalidate.

---

## 정산 타입 재사용 — 006 SettlementView

- **분석**: admin 전체 정산(`/admin/settlements`)이 보여줄 데이터(총 매출·수수료·지급액·상태)는 006 의
  `SettlementView`(id·sellerId·periodStart/End·totalSales·commission·payoutAmount·status·createdAt)와 구조가
  동일하다.
- **결정(채택)**: admin 전용 정산 타입을 신규 정의하지 않고 006 `SettlementView` 를 재사용한다(ADR-003).
  facade 는 `settlements: () => http.get<SettlementView[]>('/admin/settlements')`. admin 화면은 판매자별
  정산을 보여주므로 `sellerId`(앞 12자) 컬럼을 표시하며(판매자 본인 화면은 정산 기간을 표시), 타입 구조가
  동일하여 view 타입 중복을 회피한다.

---

## AdminGuard UI 노출 정책

- **현황**: `layout.tsx` 의 `visible` 필터는 seller 섹션만 `isSeller` 로 가리고 admin 섹션은 항상 노출한다.
  따라서 비관리자 사용자에게도 admin 네비(배너·전체 정산·플랫폼 통계·사용자·감사 로그·판매자 승인)가 보인다.
- **정책(현 구현)**: 실제 데이터 보호는 백엔드 `AdminGuard` 가 전 admin 라우트에 강제하며, 비관리자가
  라우트에 접근하거나 facade 를 호출하면 백엔드가 403 으로 차단한다(NFR-001, ADR-008). UI 의 네비 노출은
  표시 편의일 뿐 데이터 보호가 아니다.
- **갭(후속)**: 비관리자에게 admin 메뉴가 보이는 UX 결함이 있다. 후속에서 `useAuth` 의 `isAdmin`(또는 동등
  플래그)으로 admin 섹션을 가리는 필터를 추가한다(GAP-007-01 — 데이터 보호 결함 아닌 UX 보강).

---

## 생성물·구조 검증 (직접 확인)

> 변경 구조는 추측하지 않고 실제 파일·diff 를 직접 확인하여 확정했다(자가 보고 신뢰하지 않음).

| 대상 | 측정 | 값 | 측정 방법 |
|---|---|---|---|
| `banners/page.tsx` | 신규 라인 | +172 / -0 | `git diff --numstat 1a6d70d e7d8ebb` |
| `shared-types/index.ts` | 변경 | +77 / -0 | 동일(admin view 타입 9종) |
| `sellers/page.tsx` | 변경 | +72 / -13 | 동일(플레이스홀더→실데이터) |
| `users/page.tsx` | 신규 라인 | +71 / -0 | 동일 |
| `settlements/page.tsx` | 신규 라인 | +64 / -0 | 동일 |
| `audit-logs/page.tsx` | 신규 라인 | +61 / -0 | 동일 |
| `stats/page.tsx` | 신규 라인 | +32 / -0 | 동일 |
| `api-client/index.ts` | 변경 | +32 / -0 | 동일(admin facade 10 메서드) |
| `layout.tsx` | 변경 | +5 / -0 | 동일(네비 5개) |
| 합계 | 9 files | +586 / -13 | `git diff --numstat 1a6d70d e7d8ebb -- apps/console packages` |

- view 타입(직접 확인 — `shared-types/index.ts` L395~470): `PlatformOverview`(totalSales `string`)·`AdminUser`·
  `AdminAuditLog`·`SellerApprovalStatus`(PENDING/APPROVED/REJECTED/SUSPENDED)·`AdminSeller`·`BannerPosition`
  (MAIN_TOP/MAIN_MIDDLE/MAIN_BOTTOM/SIDEBAR)·`Banner`·`CreateBannerRequest`·`UpdateBannerRequest`
  (`Partial<CreateBannerRequest>`). 주석에 "admin (Phase 3 — 관리자 콘솔)" 명시.
- facade(직접 확인 — `api-client/index.ts` L199~243): `admin.{statsOverview,settlements,users,auditLogs,
  pendingSellers,approveSeller,banners,createBanner,updateBanner,deleteBanner}` — `http.get/post/patch/delete`
  기반, view 타입 응답 제네릭. `users` 는 `{ query: { cursor, limit } }`, `auditLogs` 는 `{ query: { limit } }`.
- 네비(직접 확인 — `layout.tsx` `NAV` at `e7d8ebb`): 관리자 섹션 = 판매자 승인(기존) + 배너·전체 정산·플랫폼
  통계·사용자·감사 로그(007 추가 5개). `/admin/coupons`·`/account/notifications` 는 `e7d8ebb` 에 부재(008/009
  후속 — 본 차수 범위 외).

---

## 엣지 케이스 및 한계

- **응답 타입 백엔드 의존(view 타입 한시성)**: 관리자 응답은 OpenAPI 미정의(Prisma 엔티티)여서 전이형 view
  타입으로 한시 정의했다. 백엔드 응답 DTO 보강 후 생성 타입 대체 예정(GAP-007-01 — 006 GAP-006-01 / 004
  GAP-004-01 / 001 GAP-001-01 연속).
- **클라이언트 권한 노출**: admin 네비가 비관리자에게도 노출된다(데이터는 백엔드 `AdminGuard` 강제로 보호).
  UI `isAdmin` 필터 추가는 후속(GAP-007-01 — UX 보강).
- **배너 삭제 즉시 수행**: 삭제 `danger` 버튼은 확인 다이얼로그 없이 즉시 삭제한다. AlertDialog 재확인은 후속.
- **배너 편집 미지원**: `updateBanner` facade 는 부분 갱신을 지원하나 화면은 활성 토글 외 필드 편집 UI 가
  없다(후속).
- **낙관적 업데이트·e2e 부재**: approveSeller·배너 mutation 은 서버 응답 후 invalidate 방식(낙관적 미적용)이며,
  관리자 화면에 e2e/단위 테스트가 없다(빌드/타입체크/정적/grep 갈음).
- **admin/coupons 별도 차수**: 관리자 전역 쿠폰 화면(`/admin/coupons`)은 008 로 분리되어 본 차수 facade·네비에
  포함되지 않는다.

가정-실제 불일치 현재 미발견(변경 구조·diff·view 타입·facade·네비를 실제 파일/numstat/`e7d8ebb` show 로 직접
확인).
