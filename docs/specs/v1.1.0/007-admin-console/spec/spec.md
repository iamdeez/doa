---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-30 02:10
상태: 확정 (구현 완료 — retroactive 문서화)
---

# Spec: 007-admin-console

> Branch: 007-admin-console | Date: 2026-06-30 | Version: v1.1.0
>
> 본 문서는 이미 구현·검증이 완료된 코드(커밋 `e7d8ebb` Phase 3 관리자 콘솔, base `1a6d70d`)를 근거로 정식
> SDD 포맷으로 retroactive 작성되었다. 모든 요구사항·수용 기준은 실제 구현된 console 관리자 화면 6종
> (`admin/stats`·`admin/settlements`·`admin/users`·`admin/audit-logs`·`admin/sellers`·`admin/banners`)·
> `@doa/api-client`(admin facade)·`@doa/shared-types`(admin view 타입)·AppShell `layout.tsx`(admin 네비 5종
> 추가)에서 확인한 사실을 기준으로 한다. **FRONTEND-PLAN Phase 3(관리자 운영 콘솔 — 플랫폼 통계·전체 정산·
> 사용자·감사 로그·판매자 승인·배너 관리)** 를 구현한다. 006(판매자 운영 화면) 위에 관리자 운영 화면을 올린다.

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

004·005·006 이 FRONTEND-PLAN **Phase 1~2(판매자 주문 이행 + 판매자 부가 운영 화면)** 를 완성했다. 그러나
플랫폼을 운영하는 **관리자(admin)** 가 사용할 운영 콘솔 화면 — 플랫폼 전체 매출 요약, 전체 판매자 정산 내역,
사용자 목록, 관리자 조치 감사 로그, 판매자 승인 처리, 노출 배너 관리 — 가 console 에 **부재** 했다. 백엔드는
관리자 전용 라우트(전부 `AdminGuard` 강제)를 이미 제공하나 소비 UI 가 없어 관리자가 운영 데이터를 확인하거나
판매자를 승인하거나 배너를 관리할 수 없었다.

- **기존 한계 (관리자 운영 화면 부재)**: console admin 영역에는 판매자 승인(`/admin/sellers`)이 **플레이스홀더**
  (실데이터 미연동)로만 존재했고, 플랫폼 통계·전체 정산·사용자·감사 로그·배너 관리 화면이 없었다. 백엔드는
  관리자 통계·정산·사용자·감사 로그·판매자 승인·배너 라우트를 이미 제공하나(소비 UI 부재), 관리자는 이를
  호출할 화면이 없어 플랫폼을 운영할 수 없었다.

- **백엔드 계약은 존재(소비 측 공백)**: 백엔드는 관리자 라우트를 제공한다 — `GET /admin/stats/overview`(플랫폼
  요약)·`GET /admin/settlements`(전체 정산)·`GET /admin/users`(cursor 사용자 목록)·`GET /admin/audit-logs`
  (013 감사 로그)·`GET /admin/sellers/pending` + `POST /admin/sellers/:id/approve`(007 판매자 승인)·
  `GET·POST·PATCH·DELETE /admin/banners`(배너 CRUD). 전 라우트가 `AdminGuard` 로 보호된다. 다만 이
  엔드포인트들의 **응답 스키마가 OpenAPI 에 미정의**(컨트롤러가 Prisma 엔티티 반환 — 001 coverage-gap)여서,
  003 의 타입드 client 는 응답 타입이 비어 본 화면에서 이점이 적다(004·006 과 동일 상황).

007 은 이 공백을 (1) console admin 영역에 **플랫폼 통계 화면**(`/admin/stats`)·**전체 정산 화면**
(`/admin/settlements`)·**사용자 화면**(`/admin/users` — cursor 무한 스크롤)·**감사 로그 화면**
(`/admin/audit-logs`)·**판매자 승인 화면**(`/admin/sellers` — 플레이스홀더를 실데이터+승인 mutation 으로
교체)·**배너 관리 화면**(`/admin/banners` — 목록 + 생성 다이얼로그 + 활성 토글 + 삭제) 6종을 추가하고,
(2) 응답 미정의 엔드포인트를 `@doa/shared-types` 의 **전이형 view 타입**(`PlatformOverview`·`AdminUser`·
`AdminAuditLog`·`AdminSeller`·`Banner` 등 — 금전 Decimal→문자열)으로 정의하여 `api.http` 기반 admin
facade(`api.admin.*`)로 호출하며, (3) AppShell 네비에 관리자 항목 5종을 추가하는 방식으로 해소한다.

> 설계 결정(FRONTEND-PLAN 연속): Phase 1~2(004·005·006) 위에 Phase 3(관리자 콘솔) 운영 화면을 올린다.
> 006 과 동일하게 응답 스키마가 미정의인 도메인이므로 타입드 client 대신 view 타입 + facade 를 채택한다.
> 권한 강제는 백엔드 `AdminGuard` 가 담당하며 UI 는 표시만 한다. admin/coupons 화면(008)·배너 삭제 확인
> 다이얼로그·낙관적 업데이트·e2e 는 후속(범위 외).

---

## 사용자 스토리

- **US-001**: 관리자로서, 플랫폼 전체 매출·주문·완료 주문·사용자·판매자 수를 요약 카드로 한눈에 확인하기를
  원한다.
- **US-002**: 관리자로서, 모든 판매자의 정산 내역(총 매출·수수료·지급액·상태)을 표로 조회하기를 원한다.
- **US-003**: 관리자로서, 전체 사용자 목록을 페이지 단위(cursor '더 보기')로 조회하기를 원한다.
- **US-004**: 관리자로서, 관리자 조치 감사 로그(누가·무엇을·어떤 대상에)를 시간순으로 조회하기를 원한다.
- **US-005**: 관리자로서, 승인 대기 판매자 목록을 보고 개별 판매자를 승인 처리하기를 원한다.
- **US-006**: 관리자로서, 노출 배너를 목록 조회하고 생성·활성/비활성 토글·삭제하기를 원한다.

---

## 기능 요구사항

- **FR-001** (플랫폼 통계 화면): `/admin/stats`(`stats/page.tsx`)가 `GET /admin/stats/overview`
  (`api.admin.statsOverview`)로 `PlatformOverview` 를 조회하여 `StatCard` 5개(총 매출(완료) —
  `formatKRW(totalSales)`·총 주문·완료 주문·총 사용자·총 판매자 — 각 `toLocaleString('ko-KR')`)로 렌더한다.
  `useQuery`(`['admin','stats']`)로 조회하며 로딩(`Loading`)·에러(`ErrorText`) 분기를 둔다.

- **FR-002** (전체 정산 화면): `/admin/settlements`(`settlements/page.tsx`)가 `GET /admin/settlements`
  (`api.admin.settlements`)로 전체 정산 목록(`SettlementView[]` — 006 정의 재사용)을 조회하여 Table(`@doa/ui`
  Table 프리미티브)로 렌더한다. 컬럼은 판매자(`sellerId` 앞 12자)·총 매출·수수료(`−` 표기)·지급액·상태다.
  상태는 `completed`→"지급완료"(`Badge` success)·그 외→"정산대기"(`Badge` warning)로 매핑한다. 로딩·에러·
  빈 목록(`EmptyState`) 분기를 둔다.

- **FR-003** (사용자 화면 — cursor 무한 스크롤): `/admin/users`(`users/page.tsx`)가 `GET /admin/users`
  (`api.admin.users(cursor)`, `CursorPage<AdminUser>`)를 `useInfiniteQuery` 로 조회하여 `pages.flatMap(items)`
  를 Table(이메일·이름·연락처·가입일)로 렌더한다. `getNextPageParam` 은 `last.nextCursor` 이며, `hasNextPage`
  시 "더 보기" `Button`(`fetchNextPage` — `isFetchingNextPage` 비활성화·"불러오는 중…" 라벨)을 노출한다.
  로딩·에러·빈 목록 분기를 둔다.

- **FR-004** (감사 로그 화면): `/admin/audit-logs`(`audit-logs/page.tsx`)가 `GET /admin/audit-logs`
  (`api.admin.auditLogs`, `AdminAuditLog[]`)로 관리자 조치 감사 로그를 조회하여 Table(일시·관리자(`adminId`
  앞 12자)·조치(`action` `Badge` info)·대상(`targetType` · `targetId` 앞 12자))로 렌더한다. 로딩·에러·빈
  목록(`EmptyState`) 분기를 둔다. 감사 로그는 append-only(013).

- **FR-005** (판매자 승인 화면 — 플레이스홀더 실데이터화): `/admin/sellers`(`sellers/page.tsx`)가 기존
  플레이스홀더를 실데이터로 교체한다. `GET /admin/sellers/pending`(`api.admin.pendingSellers`, `AdminSeller[]`)
  로 승인 대기 판매자를 조회하여 Table(상호·대표자·사업자번호·연락처·조치)로 렌더하고, 각 행의 승인 `Button`
  이 `POST /admin/sellers/:id/approve`(`api.admin.approveSeller` — `useMutation`)를 호출하여 승인한다. 성공 시
  `invalidateQueries(['admin','pendingSellers'])`로 목록을 갱신한다. 처리 중 행은 `approve.variables === s.id`
  로 식별하여 해당 버튼만 비활성화·"처리 중…" 라벨 전환한다. 로딩·에러·빈 목록 분기를 둔다.

- **FR-006** (배너 관리 화면 — CRUD): `/admin/banners`(`banners/page.tsx`)가 `GET /admin/banners`
  (`api.admin.banners`, `Banner[]`)로 전체 배너(활성/비활성)를 조회하여 Table(제목·위치·순서·활성 `Badge`·
  조치)로 렌더한다. `CreateBannerDialog`(Radix `Dialog`)가 제목·이미지 URL·링크 URL(선택)·노출 위치
  (`Select` — `BannerPosition` 4종)·정렬 순서(선택) 입력으로 `POST /admin/banners`(`api.admin.createBanner` —
  `CreateBannerRequest`)를 호출하며, 성공 시 목록 invalidate·다이얼로그 닫기·폼 reset 한다. 각 행은 활성
  토글(`PATCH /admin/banners/:id` — `api.admin.updateBanner({ isActive: !b.isActive })`)·삭제 `danger` 버튼
  (`DELETE /admin/banners/:id` — `api.admin.deleteBanner`)을 제공하며 두 mutation 모두 성공 시 목록 invalidate
  한다. 로딩·에러·빈 목록 분기를 둔다.

- **FR-007** (응답 view 타입 정의): 응답 스키마가 OpenAPI 에 미정의인 관리자 엔드포인트를 위해
  `@doa/shared-types` 에 admin view 타입(`PlatformOverview`·`AdminUser`·`AdminAuditLog`·`SellerApprovalStatus`·
  `AdminSeller`·`BannerPosition`·`Banner`·`CreateBannerRequest`·`UpdateBannerRequest`)을 정의한다. 금전 필드
  (`PlatformOverview.totalSales`)는 Decimal→JSON 직렬화상 **문자열**이다. 정산 응답은 006 의 `SettlementView`
  를 재사용한다(신규 정의 없음).

- **FR-008** (admin facade 추가): `@doa/api-client` 의 `createApiClient` 반환에 `admin` facade
  (`statsOverview`·`settlements`·`users`·`auditLogs`·`pendingSellers`·`approveSeller`·`banners`·
  `createBanner`·`updateBanner`·`deleteBanner` — 10 메서드)를 추가한다. `api.http`(저수준 HttpClient) 기반이며
  view 타입을 응답 제네릭으로 사용한다.

- **FR-009** (네비게이션 추가): AppShell(`(dashboard)/layout.tsx`)의 관리자 섹션 네비게이션에 "배너"
  (`/admin/banners`)·"전체 정산"(`/admin/settlements`)·"플랫폼 통계"(`/admin/stats`)·"사용자"(`/admin/users`)·
  "감사 로그"(`/admin/audit-logs`) 5개 항목을 추가한다(기존 "판매자 승인" `/admin/sellers` 위에 누적).

---

## 비기능 요구사항

- **NFR-001** (권한 — AdminGuard 백엔드 강제): 본 화면은 관리자 전용이다. 실제 권한 강제는 백엔드
  `AdminGuard`(전 admin 라우트)가 담당하며, 비관리자가 라우트를 직접 호출하면 백엔드가 403 으로 차단한다. UI
  의 네비게이션은 admin 섹션을 권한 필터 없이 항상 노출하며(현재 `layout.tsx` 의 `visible` 필터는 seller
  섹션만 `isSeller` 로 가린다), 화면은 표시만 한다. 클라이언트 권한 노출 차단은 후속(범위 외 — gaps).

- **NFR-002** (금전 Decimal 문자열 표기): 플랫폼 매출·정산 금액은 Decimal→JSON 직렬화상 문자열로 전달되며,
  기존 `formatKRW(amount: string)`(`lib/order.ts` — 004 산출)이 부동소수점 연산 없이 `Number().
  toLocaleString('ko-KR')`로 원화 표기한다. view 타입의 금전 필드는 `string` 으로 정의된다(부동소수점 금지 —
  P-005 정합성). 신규 화면은 이 헬퍼를 재사용한다(신규 금전 헬퍼 없음).

- **NFR-003** (접근성·상태 분기): 배너 생성은 Radix `Dialog`(포커스 트랩·ESC·ARIA — 002 산출)로 구성한다.
  모든 화면은 로딩·에러·빈 상태를 명시적으로 분기하고, 에러는 `ApiError` instanceof 검사로 메시지를 노출하며,
  처리 중 버튼은 비활성화·라벨 전환("처리 중…"·"추가 중…"·"불러오는 중…")한다.

- **NFR-004** (응답 view 타입 한시 — OpenAPI 미정의): 통계·정산·사용자·감사 로그·판매자·배너 응답은 백엔드가
  Prisma 엔티티를 반환하고 OpenAPI 응답 content 가 미주석이다(001 coverage-gap). 따라서 003 타입드 client
  대신 `@doa/shared-types` 전이형 view 타입을 한시 정의하며, 백엔드 응답 DTO 보강 후 생성 타입으로 대체
  가능하다(004·006 GAP 연속).

- **NFR-005** (하위 호환 — console 회귀 0): 본 변경은 기존 console 화면의 타입체크·빌드를 깨뜨리지 않는다
  (`console typecheck` 0 error, `console build` 22 라우트 PASS). 신규 화면 5개 추가(`/admin/stats`·
  `/admin/settlements`·`/admin/users`·`/admin/audit-logs`·`/admin/banners`) + 판매자 승인 화면 1개 실데이터화,
  facade·view 타입 추가는 기존 export 비파괴(기존 화면 동작 회귀 0).

---

## 수용 기준

> **환경 태그 규약**:
> | 태그 | 의미 |
> |---|---|
> | `[env:static]` | 정적 코드/구조 검증(코드 리뷰·grep·분기 로직 확인)으로 판정 |
> | `[env:typecheck]` | TypeScript 타입체크(`console typecheck`) 통과로 판정 |
> | `[env:build]` | 빌드 산출(`console build` 라우트 컴파일) 성공으로 판정 |

- **SC-001** (`FR-001` 관련): `/admin/stats` 가 `api.admin.statsOverview()`로 `PlatformOverview` 를 조회하여
  `StatCard` 5개(총 매출(완료) `formatKRW`·총 주문·완료 주문·총 사용자·총 판매자 `toLocaleString`)로 렌더하고,
  로딩·에러 분기가 존재한다. console build 에서 `/admin/stats` 라우트가 컴파일된다. [env:typecheck] [env:build]

- **SC-002** (`FR-002` 관련): `/admin/settlements` 가 `api.admin.settlements()`로 `SettlementView[]` 를
  조회하여 Table(판매자·총 매출·수수료·지급액·상태 Badge)로 렌더하고, 상태가 `completed`→"지급완료"(success)·
  그 외→"정산대기"(warning)로 매핑된다. 빈 목록 분기가 존재한다. console build 에서 `/admin/settlements`
  라우트가 컴파일된다. [env:typecheck] [env:build]

- **SC-003** (`FR-003` 관련): `/admin/users` 가 `useInfiniteQuery` + `api.admin.users(cursor)`
  (`CursorPage<AdminUser>`)로 조회하여 `pages.flatMap(items)` 를 Table 로 렌더하고, `getNextPageParam` =
  `last.nextCursor`·`hasNextPage` 시 "더 보기" Button(`fetchNextPage`·`isFetchingNextPage` 비활성화)을
  노출한다. console build 에서 `/admin/users` 라우트가 컴파일된다. [env:static] [env:typecheck] [env:build]

- **SC-004** (`FR-004` 관련): `/admin/audit-logs` 가 `api.admin.auditLogs()`로 `AdminAuditLog[]` 를 조회하여
  Table(일시·관리자·조치 Badge·대상)로 렌더하고, 빈 목록(`EmptyState`) 분기가 존재한다. console build 에서
  `/admin/audit-logs` 라우트가 컴파일된다. [env:typecheck] [env:build]

- **SC-005** (`FR-005` 관련): `/admin/sellers` 가 `api.admin.pendingSellers()`로 `AdminSeller[]` 를 조회하여
  Table 로 렌더하고, 각 행 승인 Button 이 `api.admin.approveSeller(s.id)`(`useMutation`)를 호출하며, 성공 시
  `invalidateQueries(['admin','pendingSellers'])`·처리 중 `approve.variables === s.id` 행만 비활성화·"처리
  중…" 라벨 전환한다. [env:static]

- **SC-006** (`FR-006` 관련): `/admin/banners` 가 `api.admin.banners()`로 `Banner[]` 를 조회하여 Table 로
  렌더하고, `CreateBannerDialog`(Radix Dialog — `Select` BannerPosition·`createBanner` `onSuccess` invalidate+
  닫기+reset)·활성 토글(`updateBanner({ isActive: !b.isActive })`)·삭제(`deleteBanner` danger 버튼) 세 mutation
  이 모두 성공 시 목록을 invalidate 한다. console build 에서 `/admin/banners` 라우트가 컴파일된다.
  [env:static] [env:typecheck] [env:build]

- **SC-007** (`FR-007`·`FR-008` 관련): `@doa/shared-types` 에 admin view 타입 9종(`PlatformOverview`·
  `AdminUser`·`AdminAuditLog`·`SellerApprovalStatus`·`AdminSeller`·`BannerPosition`·`Banner`·
  `CreateBannerRequest`·`UpdateBannerRequest`)이 정의되고(금전 필드 `string`, 정산은 006 `SettlementView`
  재사용), `@doa/api-client` 의 `createApiClient` 반환에 `admin` facade 10 메서드가 추가된다(view 타입을
  응답 제네릭으로 사용). [env:static] [env:typecheck]

- **SC-008** (`FR-009`·`NFR-005` 관련): AppShell 네비에 "배너"·"전체 정산"·"플랫폼 통계"·"사용자"·"감사 로그"
  5개가 관리자 섹션에 추가되고, `console typecheck` 0 error·`console build` 22 라우트 PASS(기존 화면 동작
  회귀 0). [env:static] [env:typecheck] [env:build]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건.
> MoSCoW: Must / Should / Could / Won't

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-001 | FR-001 | NFR-002·NFR-003·NFR-004 | SC-001 | typecheck/build | Must |
| US-002 | FR-002 | NFR-002·NFR-003·NFR-004 | SC-002 | typecheck/build | Must |
| US-003 | FR-003 | NFR-003·NFR-004 | SC-003 | static/typecheck/build | Must |
| US-004 | FR-004 | NFR-003·NFR-004 | SC-004 | typecheck/build | Must |
| US-005 | FR-005 | NFR-001·NFR-003·NFR-004 | SC-005 | static | Must |
| US-006 | FR-006 | NFR-003·NFR-004 | SC-006 | static/typecheck/build | Must |
| US-001 | FR-007·FR-008 | NFR-002·NFR-004 | SC-007 | static/typecheck | Must |
| US-001~006 | FR-009 | NFR-001·NFR-005 | SC-008 | static/typecheck/build | Must |

> 모든 FR(FR-001~009)이 SC 로 대응된다(FR-001→SC-001, …, FR-005→SC-005, FR-006→SC-006, FR-007·008→SC-007,
> FR-009→SC-008). 매핑 누락 0건. SC-001·002·004 는 타입체크/빌드로, SC-003·006·008 은 정적+타입체크/빌드로,
> SC-005·007 은 정적 구조 검증(승인 mutation·view 타입·facade)으로 판정한다. 본 차수는 UI 화면이나 별도
> e2e/단위 테스트 스위트가 없으며, 검증은 **빌드/타입체크 + 정적 구조 검증**으로 갈음한다(plan.md 테스트
> 전략·NFR-005 참조).

---

## 범위 외

- **admin/coupons 화면(008)**: 관리자 전역 쿠폰 생성·발급 화면(`/admin/coupons`)은 별도 차수(008)로 분리된다.
  본 007 의 admin facade·네비에는 포함되지 않는다.
- **배너 삭제 확인 다이얼로그**: 배너 삭제는 현재 `danger` 버튼 클릭 시 **즉시 삭제**(`deleteBanner` 호출)된다.
  `AlertDialog`(파괴적 조치 재확인) 도입은 범위 외다(후속).
- **클라이언트 권한 노출 차단**: admin 네비게이션은 권한 필터 없이 모든 인증 사용자에게 노출되며(현재 `visible`
  필터는 seller 섹션만 `isSeller` 로 가림), 실제 인가는 백엔드 `AdminGuard` 가 강제한다. UI 레벨 `isAdmin`
  분기 추가는 범위 외다(후속 — gaps).
- **낙관적 업데이트(optimistic update)**: approveSeller·createBanner·updateBanner·deleteBanner mutation 은
  서버 응답 후 invalidate 방식이며 낙관적 업데이트를 적용하지 않는다(후속).
- **배너 수정(편집) 다이얼로그**: 배너는 생성·활성 토글·삭제만 화면에서 제공한다. `updateBanner` facade 는
  부분 갱신(`UpdateBannerRequest`)을 지원하나, 화면은 활성 토글 외 필드 편집 UI 를 제공하지 않는다(후속).
- **통계 기간 필터·차트**: 플랫폼 통계는 누적 요약 5개 지표를 렌더한다. 기간 선택·추세 차트는 범위 외다(후속).
- **e2e/단위 테스트**: 본 차수는 UI 화면이나 별도 e2e/단위 테스트 스위트가 없다. 검증은 console typecheck/
  build + 정적 구조 리뷰로 갈음한다(후속 권고).

---

## 미결 사항

없음 — 본 spec 은 구현 완료 코드를 기준으로 retroactive 작성되었으며, 모든 요구사항·수용 기준이 실제 구현
(admin 화면 6종·view 타입·admin facade·AppShell 네비 5종)과 대조 확인되었다. admin/coupons(008)·배너 삭제
확인 다이얼로그·클라이언트 권한 노출 차단·낙관적 업데이트·배너 편집·통계 차트·e2e 는 범위 외(후속)로 분리하되,
Phase 3 핵심 목표 — 관리자 플랫폼 통계·전체 정산·사용자·감사 로그·판매자 승인·배너 관리 화면 제공 — 은 console
typecheck 0·build 22 라우트 PASS 로 달성되었다. 응답 스키마 미정의(view 타입 한시)는 001/004/006 GAP 연속이며
gaps.md GAP-007-01 로 기록한다.
