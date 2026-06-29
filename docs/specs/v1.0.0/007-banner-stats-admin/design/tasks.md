---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (retroactive — 전 태스크 구현 완료)
---

# Tasks: 007-banner-stats-admin

> Branch: 007-banner-stats-admin | Date: 2026-06-29 | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [Test Authoring Contract](#test-authoring-contract)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목 해소(미결 사항: 없음)
- [x] plan.md Constitution Gates(P-001~P-007) 통과(예외 0건, P-005 는 stats 매출 집계에 해당)
- [x] CHANGES.md 의 이전 작업(006-search-notification-file) "후속 작업 시 주의사항" 확인
- [x] **Database Design Agent** 가 `data-model.md` + 마이그레이션(admin 1테이블 `banners` + 1 enum `BannerPosition` + 조회 인덱스)을 확정하고 Prisma client 생성 완료

> A·B·C 레이어 = **4단계 Development Agent**. D 레이어 = **5a Test Agent(AUTHORING)**. 레이어 A→B→C 의존 순, `[P]` 는 병렬 가능.

---

## 태스크 목록

> 레이어: A 데이터(repository·schema 연동) / B 도메인(service·constants) / C 인터페이스(controller·dto·module wiring) / D 테스트(5a).

### Step 1. 도메인 모듈 — 007 집계 메서드 (additive, A·B)

- [x] **T001** — order.repository 집계 4종
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/order/order.repository.ts`
  - 관련 요구사항: FR-006·007
  - 상세: `countAll()`(order.count), `countCompleted()`(count where status=completed), `sumCompletedTotalAmount()`(aggregate `_sum.totalAmount` ?? `Decimal(0)`), `getSellerCompletedSummary(sellerId)`(completed 주문 + items where sellerId → `unitPrice.mul(quantity)` Decimal 누적, orderCount).
  - 완료 기준: orders 스키마만 접근(P-001). 매출 Decimal 정확.

- [x] **T002** — order.service 집계 4종
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/order/order.service.ts`
  - 관련 요구사항: FR-006·007
  - 상세: `countAllOrders`·`countCompletedOrders`·`sumCompletedSales(): Promise<Prisma.Decimal>`·`getSellerSalesSummary(sellerId)` — repository 위임(additive 공개).
  - 완료 기준: additive 공개. 기존 OrderService 시그니처 불변(003~006 회귀 0).

- [x] **T003** `[P]` — user.repository·service·module 집계
  - 레이어: A·B·C
  - 구현 파일: `apps/backend/src/modules/user/user.repository.ts`, `user.service.ts`, `user.module.ts`
  - 관련 요구사항: FR-006·010
  - 상세: repository `countAll()`(user.count)·`listPaginated(cursor, take)`(orderBy createdAt desc·id desc, cursor). service `countAllUsers()`·`listUsersForAdmin(cursor, take)`(AdminUserListItem — password 제외 매핑, nextCursor). module `exports: [UserService]`.
  - 완료 기준: users 스키마만(P-001). password 등 민감 필드 미노출. UserService export.

- [x] **T004** `[P]` — seller.repository·service 집계
  - 레이어: A·B
  - 구현 파일: `apps/backend/src/modules/seller/seller.repository.ts`, `seller.service.ts`
  - 관련 요구사항: FR-006·008
  - 상세: repository `countAll()`(seller.count)·`listByStatus(status)`(where status, createdAt desc). service `countAllSellers()`·`listByStatus(status)`. `approve` 는 기존 재사용(변경 없음).
  - 완료 기준: sellers 스키마만(P-001). approve 로직 불변(재사용).

### Step 2. banner 모듈 (admin.banners 소유)

- [x] **T010** — banner.repository
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/banner/banner.repository.ts`
  - 관련 요구사항: FR-001~005
  - 상세: `this.prisma.banner`(루트 직접) — `create(data)`, `findById(id)`, `update(id, data)`, `delete(id)`, `listAll()`(sortOrder asc·createdAt desc), `listActiveOrdered()`(where isActive=true, sortOrder asc·createdAt desc).
  - 완료 기준: admin.banners 만 접근(SC-011). standalone CRUD(ALS tx-aware 불요).

- [x] **T011** — banner.service
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/banner/banner.service.ts`
  - 관련 요구사항: FR-001~005
  - 상세: `create`(위임), `update(id, input)`(findById 없으면 404 → update), `remove(id)`(findById 없으면 404 → delete), `listAll`, `listPublic(now=new Date())`(listActiveOrdered → `isWithinPeriod` 필터). `isWithinPeriod`: `(startsAt===null||startsAt<=now)&&(endsAt===null||now<=endsAt)`.
  - 완료 기준: 404 정확. 노출기간 경계 포함. sortOrder 순.

- [x] **T012** `[P]` — banner dto + controller + module wiring
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/banner/dto/{create,update}-banner.dto.ts`, `banner.controller.ts`, `banner.module.ts`
  - 관련 요구사항: FR-001~005, SC-010(401/403)
  - 상세: `CreateBannerDto`(title·imageUrl `@IsString @IsNotEmpty`, linkUrl `@IsString`, position `@IsEnum(BannerPosition)`, sortOrder `@IsInt`, isActive `@IsBoolean`, startsAt·endsAt `@IsDateString`, 선택 `@IsOptional`). `UpdateBannerDto`(전 필드 optional). `AdminBannerController` `@Controller('admin/banners')` `@UseGuards(JwtAuthGuard, AdminGuard)`: POST(201)·PATCH `:id`·DELETE `:id`(204)·GET. `BannerController` `@Controller('banners')`(가드 없음): GET. `BannerModule`: imports `[AuthSharedModule]`, controllers `[AdminBannerController, BannerController]`, providers `[BannerService, BannerRepository]`, exports `[BannerService]`.
  - 완료 기준: 관리자 라우트 JwtAuthGuard+AdminGuard. 공개 GET /banners 무가드. PATCH 전달 키만 반영. presign-style Date 변환.

### Step 3. stats 모듈 (소유 테이블 없음)

- [x] **T020** `[P]` — stats.repository (빈 클래스)
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/stats/stats.repository.ts`
  - 관련 요구사항: FR-006·007(P-001)
  - 상세: `@Injectable() class StatsRepository {}` — 자체 테이블 없음. 집계는 도메인 Service DI 경유.
  - 완료 기준: 직접 Prisma 접근 0(SC-011).

- [x] **T021** — stats.service
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/stats/stats.service.ts`
  - 관련 요구사항: FR-006·007
  - 상세: `getOverview()` — `Promise.all([order.countAllOrders, order.countCompletedOrders, order.sumCompletedSales, user.countAllUsers, seller.countAllSellers])` → `PlatformOverview`(totalSales Decimal). `getSellerStats(userId)` — `seller.getApprovedSeller`(미승인 403) → `order.getSellerSalesSummary` → `SellerStatsSummary`(salesTotal Decimal·orderCount).
  - 완료 기준: 도메인 Service DI 만(P-001). 매출 Decimal. 본인 격리(403).

- [x] **T022** `[P]` — stats controller + module wiring
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/stats/stats.controller.ts`, `stats.module.ts`
  - 관련 요구사항: FR-006·007, SC-010(401/403)
  - 상세: `AdminStatsController` `@Controller('admin/stats')` `@UseGuards(JwtAuthGuard, AdminGuard)`: GET `overview`. `SellerStatsController` `@Controller('seller/stats')` `@UseGuards(JwtAuthGuard)`: GET `/`(`@CurrentUser()`). `StatsModule`: imports `[AuthSharedModule, OrderModule, UserModule, SellerModule]`, controllers, providers `[StatsService, StatsRepository]`.
  - 완료 기준: 관리자 overview JwtAuthGuard+AdminGuard. seller stats JwtAuthGuard 본인. DI 순환 0.

### Step 4. admin 모듈 (소유 테이블 없음)

- [x] **T030** — admin.constants + admin.repository (빈 클래스)
  - 레이어: B·A
  - 구현 파일: `apps/backend/src/modules/admin/admin.constants.ts`, `admin.repository.ts`
  - 관련 요구사항: FR-010(P-001)
  - 상세: `DEFAULT_USER_PAGE_LIMIT=20`, `MAX_USER_PAGE_LIMIT=100`. `@Injectable() class AdminRepository {}` — 자체 테이블 없음.
  - 완료 기준: 상수. 직접 Prisma 접근 0(SC-011).

- [x] **T031** — admin.service
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/admin/admin.service.ts`
  - 관련 요구사항: FR-008·009·010
  - 상세: `listPendingSellers()` — `seller.listByStatus(PENDING)`. `approveSeller(sellerId)` — `seller.approve`(재사용). `listUsers(cursor, limit)` — `take = min(max(limit ?? DEFAULT, 1), MAX)` → `user.listUsersForAdmin(cursor, take)`.
  - 완료 기준: 도메인 Service DI 만(P-001). approve 재사용. limit 클램프.

- [x] **T032** `[P]` — admin controller + module wiring
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/admin/admin.controller.ts`, `admin.module.ts`
  - 관련 요구사항: FR-008·009·010, SC-010(401/403)
  - 상세: `AdminController` `@Controller('admin')` `@UseGuards(JwtAuthGuard, AdminGuard)`: GET `sellers/pending`·POST `sellers/:id/approve`(200)·GET `users`(`@Query cursor·limit`). `AdminModule`: imports `[AuthSharedModule, SellerModule, UserModule]`, controllers `[AdminController]`, providers `[AdminService, AdminRepository]`.
  - 완료 기준: 관리자 라우트 JwtAuthGuard+AdminGuard. approve 200. DI 순환 0.

### Step 5. 테스트 (D 레이어 — 5a Test Agent AUTHORING)

> 본 Step 은 **5a Test Agent(AUTHORING)** 가 작성(TDD Red). 아래 [Test Authoring Contract](#test-authoring-contract) 가 입력.

- [x] **T040** — banner 단위 테스트 (`banner.service.spec.ts`) — SC-001·002·003·004 (11 케이스)
- [x] **T041** — stats 단위 테스트 (`stats.service.spec.ts`) — SC-005·006 (4 케이스)
- [x] **T042** — admin 단위 테스트 (`admin.service.spec.ts`) — SC-007·008·009 (5 케이스)
- [x] **T043** `[P]` — 통합 부팅 테스트 (`banner-admin.e2e-spec.ts`) — SC-010 (8 케이스)
- [x] **T044** `[P]` — 정적 테스트 확장 — `cross-schema.spec.ts`(Banner·Stats·AdminRepository 규칙, SC-011) + `auth-required-guards.spec.ts`(banner·stats·admin 컨트롤러 추가)

---

## Test Authoring Contract

> **5a Test Agent(AUTHORING) 입력 contract**. production canonical 심볼 명시(추측 단언 금지).

### Production canonical 심볼

| 심볼 | canonical 형태 |
|---|---|
| `BannerService` | `create(input)`·`update(id, input)`·`remove(id)`·`listAll()`·`listPublic(now?)` |
| `BannerRepository`(mock) | `create`·`findById`·`update`·`delete`·`listAll`·`listActiveOrdered` |
| `StatsService` | `getOverview(): PlatformOverview`·`getSellerStats(userId): SellerStatsSummary` |
| `OrderService`(mock) | `countAllOrders`·`countCompletedOrders`·`sumCompletedSales`·`getSellerSalesSummary` |
| `UserService`(mock) | `countAllUsers`·`listUsersForAdmin` |
| `SellerService`(mock) | `countAllSellers`·`getApprovedSeller`·`listByStatus`·`approve` |
| `AdminService` | `listPendingSellers()`·`approveSeller(id)`·`listUsers(cursor, limit)` |
| 상수 | `DEFAULT_USER_PAGE_LIMIT=20`·`MAX_USER_PAGE_LIMIT=100` |
| enum 리터럴 | `BannerPosition.MAIN_TOP` 등·`SellerStatus.PENDING/APPROVED` |
| 예외 리터럴 | `NotFoundException`(404, 미존재 배너)·`ForbiddenException`(403, 미승인 판매자) |
| Decimal 단언 | `Prisma.Decimal` — `totalSales`·`salesTotal` 타입·값 |

### mock 재현 규약

- **banner.service.spec**: `mockRepo`. create → `repository.create(input)` 반환. update `findById=existing`→`update(id, input)`; `findById=null`→`NotFoundException`. remove `findById=existing`→`delete(id)`; `null`→`NotFoundException`. listPublic → `listActiveOrdered` 반환 배열에 `isWithinPeriod` 적용: 기간 미설정(둘 다 null) 노출, now 가 [startsAt, endsAt] 내부 노출, startsAt>now 숨김, endsAt<now 숨김, 경계(startsAt==now·endsAt==now) 노출, 혼합(활성·기간 내만 sortOrder 순).
- **stats.service.spec**: `mockOrder`·`mockUser`·`mockSeller`. getOverview → 5 집계 `Promise.all` 조합·`totalSales` Decimal; 완료 0 → `Decimal(0)`. getSellerStats → `getApprovedSeller` 성공 시 `getSellerSalesSummary` 반환; `getApprovedSeller` throw `ForbiddenException` 시 전파.
- **admin.service.spec**: `mockSeller`·`mockUser`. listPendingSellers → `seller.listByStatus(PENDING)`. approveSeller → `seller.approve(id)` 반환. listUsers `limit=undefined`→`listUsersForAdmin(cursor, 20)`; `limit>MAX`→`take=100`; `limit<1`→`take=1`.
- **banner-admin.e2e**: `Test.createTestingModule({imports:[AppModule]})` + ValidationPipe. adminToken/userToken 발급. `GET /banners`(no auth) → 200 배열; `GET /admin/banners`(no token) → 401; `GET /admin/banners`(non-admin) → 403; admin 활성 배너 생성 → `GET /banners` 에 노출; admin 미래(startsAt 2999) 배너 → `GET /banners` 미노출; `GET /admin/stats/overview`(admin) → 200(totalOrders·totalSales·totalUsers·totalSellers); (non-admin) → 403; `GET /admin/sellers/pending`(admin) → 200 배열.

### SC → 테스트 매핑

| SC-ID | 수용 기준 | 테스트 파일·describe | 비고 |
|---|---|---|---|
| SC-001 | banner create 위임 | banner.service.spec.ts::create (1) | [env:unit] |
| SC-002 | banner update 부분/404 | banner.service.spec.ts::update (2) | [env:unit] |
| SC-003 | banner remove/404 | banner.service.spec.ts::remove (2) | [env:unit] |
| SC-004 | listPublic 노출기간 필터 | banner.service.spec.ts::listPublic (6) | [env:unit] |
| SC-005 | overview 조합·Decimal | stats.service.spec.ts::getOverview (2) | [env:unit] |
| SC-006 | seller stats 본인 격리 | stats.service.spec.ts::getSellerStats (2) | [env:unit] |
| SC-007 | listPendingSellers | admin.service.spec.ts::listPendingSellers (1) | [env:unit] |
| SC-008 | approveSeller 재사용 | admin.service.spec.ts::approveSeller (1) | [env:unit] |
| SC-009 | listUsers 클램프 | admin.service.spec.ts::listUsers (3) | [env:unit] |
| SC-010 | AppModule 부팅·라우트·노출기간·권한 | banner-admin.e2e-spec.ts (8) | [env:integration] |
| SC-011 | banner/stats/admin repo cross-schema 0 | cross-schema.spec.ts Banner·Stats·AdminRepository(007) | [env:static] |

---

## 구현 완료 기준

- [x] 모든 A·B·C 태스크 체크박스 완료(4단계), D 태스크 완료(5a)
- [x] `pnpm --filter backend test` 전체 PASSED — 002~006 회귀 0 + 007 신규 SC `[TypeScript/NestJS]`
- [x] `tsc --noEmit` 0 error — NestJS DI 순환(stats/admin → 도메인 단방향) 미발생
- [x] cross-schema(SC-011) 정적 PASS
- [x] AppModule 부팅 PASS — BannerModule·StatsModule·AdminModule DI 정상(SC-010)
- [x] `package.json` 신규 의존 0(NFR-002). AWS SDK 0
- [x] git status 의도치 않은 파일 없음
