---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (retroactive)
---

# Plan: 007-banner-stats-admin

> Branch: 007-banner-stats-admin | Date: 2026-06-29 | Spec: [../spec/spec.md](../spec/spec.md)

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [사전 영향도 분석 결과](#사전-영향도-분석-결과)
- [핵심 설계](#핵심-설계)
- [결정 기록 (ADRs)](#결정-기록-adrs)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> `constitution.md`(P-001~P-007) 존재 → 해당 조항을 Gates 로 사용한다(constitution 우선). spec.md NFR(NFR-001~005)은 P-001·P-002·P-005 를 하위 구체화하며 충돌(완화) 없음.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: banner/stats/admin 모듈이 자기 소유 테이블 외 타 도메인 모델을 직접 참조·쿼리하지 않음 — SC-011 정적 검증]
  → PASS. (1) `banner` 모듈은 `admin.banners` 단독 소유 — `BannerRepository` 가 `this.prisma.banner` 로만 접근. (2) `stats`·`admin` 모듈은 **자체 소유 트랜잭션 테이블이 없다** — 모든 데이터 접근은 `OrderService`/`UserService`/`SellerService` 공개 메서드 DI 경유. `StatsRepository`·`AdminRepository` 는 빈 클래스(4계층 골격 유지용). (3) 도메인 모듈에 추가된 additive 집계 메서드(order/user/seller)는 전부 자기 스키마 내 집계(`this.prisma.order|user|seller`). (4) cross-schema 참조(sellerId 등)는 plain String. SC-011(cross-schema.spec BannerRepository(007)·StatsRepository(007)·AdminRepository(007) 규칙) 정적 검증 대상.
- [x] **P-002 AWS 의존 금지 / 외부 의존 추상화 원칙**: [Pass 기준: `@aws-sdk/*` 및 신규 npm 의존 0건]
  → PASS. 신규 npm 의존 0건(`package.json` 변경 없음). AWS 전용 SDK·외부 서비스 미사용. 배너·통계·운영은 표준 Prisma + NestJS + class-validator 만 사용.
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 외부 저장소 0건]
  → PASS. 신규 1테이블(`admin.banners`)을 기존 PostgreSQL 인스턴스에 추가(`admin` 스키마는 datasource 에 이미 선언됨). stats·admin 은 신규 테이블 0. 외부 저장소·캐시·브로커 0.
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: 클라우드 전용 API 결합 0건]
  → PASS. 표준 Prisma + PostgreSQL + NestJS DI 만. 클라우드 전용 SDK·API 미사용.
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: 금전 수치 Decimal — **stats 한정 해당**]
  → PASS (stats 한정 해당). stats 매출 집계는 전부 `Prisma.Decimal`: `OrderRepository.sumCompletedTotalAmount`(`aggregate _sum.totalAmount`, 없으면 `new Prisma.Decimal(0)`), `getSellerCompletedSummary`(`unitPrice.mul(quantity)` 를 `Decimal` 로 누적), `StatsService.PlatformOverview.totalSales`·`SellerStatsSummary.salesTotal` 타입 `Prisma.Decimal`. **banner 테이블에는 금전 필드가 없다**(P-005 해당 없음 — banner 한정). 본 spec 은 신규 금전 *상태 변경*(결제·정산)을 만들지 않고 기존 003 주문 금액을 **읽기 집계**만 하므로 outbox/멱등키 조항은 비적용.
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건]
  → PASS. FR-001~010·NFR-001~005 전부 SC 매핑 존재(spec.md 매트릭스 역방향 검증 완료). FR-004(admin listAll)는 SC-010 통합 부팅으로 라우트 등록 간접 확인(직접 단언 부재는 coverage-gap 기록).
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건]
  → PASS. 변경 범위 = banner·stats·admin 3개 스텁 실구현 + order/user/seller 모듈 additive 집계 메서드(전부 FR-006~010 추적 가능). spec.md 범위 외 리팩토링 0. user.module 의 UserService export 추가(stats·admin DI 소비 위함)도 FR-006·010 추적 가능.

**스코프 추적 (P-007 — 도메인 모듈 cross-cutting 변경의 FR 근거)**:

| 변경 대상 | 변경 성격 | 근거 FR | 비파괴성 |
|---|---|---|---|
| `order.service.ts`/`order.repository.ts` 집계 4종 | countAll·countCompleted·sumCompletedTotalAmount(Decimal)·getSellerCompletedSummary(Decimal) | FR-006·007 | additive 공개 — 기존 주문 흐름 불변 |
| `user.service.ts`/`user.repository.ts` 집계 2종 | countAll·listPaginated(민감 필드 제외 cursor) | FR-006·010 | additive — users 자기 스키마 |
| `seller.service.ts`/`seller.repository.ts` 집계 2종 | countAll·listByStatus | FR-006·008 | additive — sellers 자기 스키마. approve 는 기존 재사용 |
| `user.module.ts` exports UserService | DI 소비 가능화 | FR-006·010 | additive — providers 불변 |

> **예외 사항**: 없음. P-001~P-007 전부 통과(P-005 는 stats 매출 집계에 해당, banner 는 금전 필드 부재로 비적용).

> **Gates 판정**: P-001~P-007 전부 통과(예외 0건). Design Agent(3단계) 진입 가능.

---

## 기술 컨텍스트

> 002~006 의 확정 스택을 재확정. 007 고유 신규 결정만 명시.

- **언어 / 런타임**: TypeScript 5.4 / Node.js 20.x. pnpm + Turborepo.
- **백엔드 프레임워크**: NestJS 11.x. 4계층(controller·service·repository·events). stats·admin 은 자체 테이블이 없어 repository 가 빈 클래스.
- **ORM / DB**: Prisma `^6.19.0` multiSchema + PostgreSQL 16. 신규 `admin` 스키마 `banners` 테이블 추가(`admin` 스키마는 datasource `schemas` 배열에 기존 선언됨). stats·admin 은 신규 테이블 0.
- **인증/인가**: 기존 `shared/auth` 재사용 — `JwtAuthGuard`·`AdminGuard`(fail-closed, `ADMIN_USER_IDS` env)·`@CurrentUser()`·`AuthenticatedUser`. 관리자 엔드포인트는 `@UseGuards(JwtAuthGuard, AdminGuard)`. 판매자 통계는 `JwtAuthGuard` + `getApprovedSeller` 본인 격리. `GET /banners` 는 공개(가드 없음).
- **배너 데이터 접근**: `BannerRepository` 가 `this.prisma.banner`(루트 클라이언트 직접) 로 CRUD/조회. standalone CRUD 라 ALS tx-aware(`this.prisma.tx`) 불필요(002-catalog 동일 패턴).
- **통계/운영 데이터 접근**: stats·admin 은 자체 테이블 없음 → 도메인 Service 공개 집계 메서드 DI 경유. order(orders 스키마)·user(users 스키마)·seller(users 스키마) 집계는 각 repository 가 자기 스키마 내에서 수행(P-001).
- **매출 집계 타입**: `Prisma.Decimal`. `sumCompletedTotalAmount`(`aggregate _sum`)·`getSellerCompletedSummary`(`unitPrice.mul(quantity)` 누적)·overview/seller 응답 타입(P-005).
- **입력 검증**: `class-validator` + 전역 `ValidationPipe`(whitelist·forbidNonWhitelisted·transform). `CreateBannerDto`(title·imageUrl `@IsString @IsNotEmpty`, linkUrl `@IsString`, position `@IsEnum(BannerPosition)`, sortOrder `@IsInt`, isActive `@IsBoolean`, startsAt·endsAt `@IsDateString`, 선택 필드 `@IsOptional`)·`UpdateBannerDto`(전 필드 optional). admin/stats 는 컨트롤러 `@Query`(cursor·limit) 직접 파싱.
- **테스트 프레임워크**: Jest(`*.spec.ts`, src rootDir) + 정적/통합(`test/`, jest-e2e.json rootDir). 단위([env:unit]) + 통합 부팅([env:integration] — SC-010) + 정적([env:static] — SC-011).
- **환경변수**: 기존 `DATABASE_URL`·`JWT_*`·`ADMIN_USER_IDS` 재사용. 신규 env 0.
- **신규 의존성**: 0건. 신규 npm 패키지 없음.

---

## 사전 영향도 분석 결과

> 상세는 [../design/research.md](../design/research.md) 참조. 본 절은 영향 파일 요약.

### 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 | 레이어 |
|---|---|---|---|
| `prisma/schema.prisma` | 수정(DB Design 소유) | `BannerPosition` enum + `Banner` 모델(admin 스키마) | A |
| `prisma/migrations/20260629085122_007_banner_stats_admin/migration.sql` | 신규 | BannerPosition enum + banners 테이블 + index | A |
| `src/modules/banner/banner.repository.ts` | 신규 구현 | create·findById·update·delete·listAll·listActiveOrdered | A |
| `src/modules/banner/banner.service.ts` | 신규 구현 | create·update(404)·remove(404)·listAll·listPublic(isWithinPeriod) | B |
| `src/modules/banner/banner.controller.ts` | 신규 구현 | AdminBannerController(admin/banners)·BannerController(banners 공개) | C |
| `src/modules/banner/dto/create-banner.dto.ts` | 신규 | 배너 생성 검증 dto | C |
| `src/modules/banner/dto/update-banner.dto.ts` | 신규 | 배너 부분 수정 검증 dto | C |
| `src/modules/banner/banner.module.ts` | 수정 | imports(AuthShared)·providers·exports(BannerService) | C |
| `src/modules/stats/stats.repository.ts` | 신규(빈 클래스) | 자체 테이블 없음(providers 등록되나 무접근) | A |
| `src/modules/stats/stats.service.ts` | 신규 구현 | getOverview(Promise.all 조합)·getSellerStats(본인 격리) | B |
| `src/modules/stats/stats.controller.ts` | 신규 구현 | AdminStatsController(admin/stats/overview)·SellerStatsController(seller/stats) | C |
| `src/modules/stats/stats.module.ts` | 수정 | imports(AuthShared·Order·User·Seller)·providers | C |
| `src/modules/admin/admin.repository.ts` | 신규(빈 클래스) | 자체 테이블 없음 | A |
| `src/modules/admin/admin.service.ts` | 신규 구현 | listPendingSellers·approveSeller(재사용)·listUsers(클램프) | B |
| `src/modules/admin/admin.controller.ts` | 신규 구현 | AdminController(admin/sellers/*·admin/users) | C |
| `src/modules/admin/admin.constants.ts` | 신규 | DEFAULT/MAX_USER_PAGE_LIMIT | B |
| `src/modules/admin/admin.module.ts` | 수정 | imports(AuthShared·Seller·User)·providers | C |
| `src/modules/order/order.service.ts` | 수정(additive) | countAllOrders·countCompletedOrders·sumCompletedSales·getSellerSalesSummary | B |
| `src/modules/order/order.repository.ts` | 수정(additive) | countAll·countCompleted·sumCompletedTotalAmount(Decimal)·getSellerCompletedSummary(Decimal) | A |
| `src/modules/user/user.service.ts` | 수정(additive) | countAllUsers·listUsersForAdmin(AdminUserListItem) | B |
| `src/modules/user/user.repository.ts` | 수정(additive) | countAll·listPaginated(cursor) | A |
| `src/modules/user/user.module.ts` | 수정 | exports(UserService) | C |
| `src/modules/seller/seller.service.ts` | 수정(additive) | countAllSellers·listByStatus | B |
| `src/modules/seller/seller.repository.ts` | 수정(additive) | countAll·listByStatus | A |
| `test/static/cross-schema.spec.ts` | 수정(확장) | BannerRepository·StatsRepository·AdminRepository 규칙(SC-011) | D |
| `test/static/auth-required-guards.spec.ts` | 수정(확장) | banner·stats·admin 컨트롤러 JwtAuthGuard 정적 검증 대상 추가 | D |
| `test/banner-admin.e2e-spec.ts` | 신규 | AppModule 부팅 + 라우트·노출기간·권한 검증(SC-010) | D |

> `package.json` 변경 0건(신규 npm 의존 없음 — NFR-002 자동 충족). `SellerService.approve` 는 007 이전부터 존재(재사용, 신규 구현 아님). OrderModule·UserModule·SellerModule 은 각 Service 를 export 하여 stats·admin 이 DI 소비 가능(UserModule export 추가).

---

## 핵심 설계

> 작성 깊이: Design Agent 가 tasks.md 분해 가능한 수준. 변경 대상 모듈·인터페이스 시그니처·핵심 분기 로직 포함.

### 0. 모듈 간 통신 토폴로지 (P-001 / NFR-001 핵심)

```
[banner 모듈] admin.banners 스키마 단독 소유
   │   BannerRepository.this.prisma.banner (루트 직접, standalone CRUD)

[stats 모듈] 자체 트랜잭션 테이블 없음 (StatsRepository = 빈 클래스)
   │   OrderService.{countAllOrders, countCompletedOrders, sumCompletedSales, getSellerSalesSummary}  (DI)
   │   UserService.countAllUsers  (DI)
   │   SellerService.{countAllSellers, getApprovedSeller}  (DI)

[admin 모듈] 자체 트랜잭션 테이블 없음 (AdminRepository = 빈 클래스)
   │   SellerService.{listByStatus, approve}  (DI — approve 는 007 이전부터 존재, 재사용)
   │   UserService.listUsersForAdmin  (DI)
```

**규약**:
- stats·admin 의 데이터 획득은 직접 Prisma 쿼리 절대 금지, 도메인 Service 공개 DI 만(P-001, NFR-001).
- **순환 DI 회피**: stats → order/user/seller, admin → seller/user (단방향). 도메인 모듈은 stats·admin 을 import 하지 않음 → forwardRef 불요.

### 1. banner 모듈 (admin.banners 소유) — FR-001~005

**컨트롤러 라우팅**:

| 엔드포인트 | 인가 | 동작 | FR/SC |
|---|---|---|---|
| `POST /admin/banners` | JwtAuthGuard+AdminGuard (201) | dto → Date 변환 → `create` | FR-001 / SC-001·010 |
| `PATCH /admin/banners/:id` | JwtAuthGuard+AdminGuard | 전달 키만 input 구성 → `update`(404) | FR-002 / SC-002 |
| `DELETE /admin/banners/:id` | JwtAuthGuard+AdminGuard (204) | `remove`(404) | FR-003 / SC-003 |
| `GET /admin/banners` | JwtAuthGuard+AdminGuard | `listAll` | FR-004 / SC-010 |
| `GET /banners` | 없음(공개) | `listPublic` | FR-005 / SC-004·010 |

**핵심 분기 로직**:
- **update(FR-002)**: `findById(id)`(없으면 404) → `repository.update(id, input)`. 컨트롤러가 `dto !== undefined` 인 키만 input 에 복사(PATCH 시맨틱), startsAt/endsAt `null`→해제, 값→`new Date()`.
- **remove(FR-003)**: `findById(id)`(없으면 404) → `repository.delete(id)`.
- **listPublic(FR-005)**: `repository.listActiveOrdered()`(isActive=true, sortOrder asc·createdAt desc) → `.filter(isWithinPeriod(b, now))`. `isWithinPeriod`: `(startsAt===null || startsAt<=now) && (endsAt===null || now<=endsAt)`.

### 2. stats 모듈 (소유 테이블 없음) — FR-006·007

**컨트롤러 라우팅**:

| 엔드포인트 | 인가 | 동작 | FR/SC |
|---|---|---|---|
| `GET /admin/stats/overview` | JwtAuthGuard+AdminGuard | `getOverview` | FR-006 / SC-005·010 |
| `GET /seller/stats` | JwtAuthGuard | `getSellerStats(user.userId)` | FR-007 / SC-006 |

**핵심 분기 로직**:
- **getOverview(FR-006)**: `Promise.all([order.countAllOrders, order.countCompletedOrders, order.sumCompletedSales, user.countAllUsers, seller.countAllSellers])` → `{ totalOrders, completedOrders, totalSales(Decimal), totalUsers, totalSellers }`.
- **getSellerStats(FR-007)**: `seller.getApprovedSeller(userId)`(미승인 403) → `order.getSellerSalesSummary(seller.id)` → `{ salesTotal(Decimal), orderCount }`.

### 3. admin 모듈 (소유 테이블 없음) — FR-008~010

**컨트롤러 라우팅**(`@Controller('admin')` `@UseGuards(JwtAuthGuard, AdminGuard)`):

| 엔드포인트 | 인가 | 동작 | FR/SC |
|---|---|---|---|
| `GET /admin/sellers/pending` | JwtAuthGuard+AdminGuard | `listPendingSellers` | FR-008 / SC-007·010 |
| `POST /admin/sellers/:id/approve` | JwtAuthGuard+AdminGuard (200) | `approveSeller`(SellerService.approve 재사용) | FR-009 / SC-008·010 |
| `GET /admin/users` | JwtAuthGuard+AdminGuard | `listUsers(cursor, limit)` | FR-010 / SC-009 |

**핵심 분기 로직**:
- **listPendingSellers(FR-008)**: `seller.listByStatus(SellerStatus.PENDING)`.
- **approveSeller(FR-009)**: `seller.approve(sellerId)` 재사용(병렬 라우트 — OBS-007-01).
- **listUsers(FR-010)**: `take = min(max(limit ?? DEFAULT(20), 1), MAX(100))` → `user.listUsersForAdmin(cursor, take)` → `{ items, nextCursor }`.

### 4. 도메인 모듈 신규 공개 메서드 — FR-006~010 (stats·admin DI contract)

```ts
// OrderService (additive 공개)
countAllOrders(): Promise<number>;
countCompletedOrders(): Promise<number>;
sumCompletedSales(): Promise<Prisma.Decimal>;        // sumCompletedTotalAmount 위임
getSellerSalesSummary(sellerId: string): Promise<{ salesTotal: Prisma.Decimal; orderCount: number }>;
// UserService (additive 공개)
countAllUsers(): Promise<number>;
listUsersForAdmin(cursor: string | undefined, take: number):
  Promise<{ items: AdminUserListItem[]; nextCursor: string | null }>;   // password 제외
// SellerService (additive 공개)
countAllSellers(): Promise<number>;
listByStatus(status: SellerStatus): Promise<SellerProfile[]>;
approve(sellerId: string): Promise<SellerProfile>;   // 007 이전부터 존재 — 재사용
```

---

## 결정 기록 (ADRs)

| ADR-ID | 결정 항목 | 채택안 | 대안(검토했으나 미채택) | 근거(spec FR/NFR) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | 배너 테이블 스키마 위치 | 신규 `admin` 스키마 `banners`(banner 모듈 소유) | 기존 products/users 스키마 합류(도메인 경계 모호) | P-001, P-003 | schema.prisma, BannerRepository |
| ADR-002 | 배너 노출기간 필터 위치 | 애플리케이션 레벨(`listActiveOrdered` 후 `isWithinPeriod`) | DB where 절 푸시다운(현 시점 배너 수 적어 불필요) | FR-005 | banner.service. **한계: GAP-007-02** |
| ADR-003 | stats 데이터 소유 | 자체 테이블 없음 — 도메인 Service DI 조합. `StatsRepository` 빈 클래스 | 집계 캐시/스냅샷 테이블(데이터 중복·동기화·정합성 비용) | P-001, NFR-001 | stats.service, order/user/seller 집계 |
| ADR-004 | admin 데이터 소유 | 자체 테이블 없음 — 도메인 Service DI 조합. `AdminRepository` 빈 클래스 | admin 자체 테이블(audit log 등 — 본 spec 범위 외) | P-001, NFR-001 | admin.service. (audit log 한계: GAP-007-01) |
| ADR-005 | 판매자 승인 구현 | 기존 `SellerService.approve` 재사용 | admin 모듈 신규 승인 로직 구현(로직 중복) | FR-009 | admin.service. **병렬 라우트: OBS-007-01** |
| ADR-006 | 매출 집계 타입 | `Prisma.Decimal`(aggregate `_sum` / `mul`·`add` 누적) | number 부동소수점(금전 오차) | P-005, NFR-005 | order.repository, stats.service |
| ADR-007 | admin 사용자 목록 페이지네이션 | cursor(`createdAt desc, id desc`) + 민감 필드(password) 제외 안전 요약 | offset 페이지네이션 / full row 노출(정보 노출) | FR-010, NFR-004 | user.service/repository, admin.service |
| ADR-008 | 배너 부분 수정 시맨틱 | PATCH — 전달된 키만 갱신, startsAt/endsAt `null` 해제 지원 | PUT 전체 교체(부분 갱신 불가) | FR-002 | banner.controller, banner.service |

> **PATCH-003 (NFR 성능 직결 파라미터)**: 본 spec 은 P95 수치 NFR 없음. 배너 조회는 `banners(isActive, position, sortOrder)` 복합 인덱스로, 통계는 도메인 집계(주문 aggregate·count)로 충족. 배너 노출기간 필터는 in-memory(배너 수 적어 허용 — GAP-007-02).

---

## 인터페이스 계약

### 권한 엔드포인트 인가 3축

> 상세는 spec.md [권한 평가 결과](../spec/spec.md#권한-평가-결과) 참조.

| 엔드포인트 | (a) 호출자 신원 | (b) 자원 소유권 | (c) 역할 |
|---|---|---|---|
| `POST/PATCH/DELETE/GET /admin/banners` | JWT | — | AdminGuard |
| `GET /banners` | 없음(공개) | — (read-only) | — |
| `GET /admin/stats/overview` | JWT | — | AdminGuard |
| `GET /seller/stats` | JWT | `getApprovedSeller` 본인 sellerId | 판매자 본인 |
| `GET /admin/sellers/pending`·`POST /admin/sellers/:id/approve`·`GET /admin/users` | JWT | — | AdminGuard |

### 007 이 소비/재사용하는 기존 공개 인터페이스 (DI)

```ts
// SellerService — 003 실재(approve 재사용) + 007 신규(countAllSellers·listByStatus)
class SellerService {
  approve(sellerId: string): Promise<SellerProfile>;          // 007 이전 존재 — admin 재사용
  getApprovedSeller(userId: string): Promise<ApprovedSeller>; // 003 실재 — seller stats 본인 격리
  countAllSellers(): Promise<number>;                          // 007 신규
  listByStatus(status: SellerStatus): Promise<SellerProfile[]>; // 007 신규
}
// OrderService / UserService — 007 신규 additive 집계 (위 핵심 설계 §4)
```

### 007 신규 additive 공개 인터페이스 (9종 — stats·admin DI contract)

```ts
// OrderService
countAllOrders(): Promise<number>;
countCompletedOrders(): Promise<number>;
sumCompletedSales(): Promise<Prisma.Decimal>;
getSellerSalesSummary(sellerId: string): Promise<{ salesTotal: Prisma.Decimal; orderCount: number }>;
// UserService
countAllUsers(): Promise<number>;
listUsersForAdmin(cursor: string | undefined, take: number):
  Promise<{ items: AdminUserListItem[]; nextCursor: string | null }>;
// SellerService
countAllSellers(): Promise<number>;
listByStatus(status: SellerStatus): Promise<SellerProfile[]>;
// + SellerService.approve (재사용 — 기존)
```

> additive 9종 + 재사용 1종(approve). 전부 기존 메서드 시그니처 불변 → 002~006 회귀 0.

### 하위 호환성 / 방어 코드

- 도메인 모듈 신규 메서드는 additive 공개 → 002~006 기존 동작 불변.
- `banner.update`·`banner.remove` 는 `findById` null → `NotFoundException`(404) 방어.
- `stats.getSellerStats` 는 `getApprovedSeller` 가 미승인 → `ForbiddenException`(403) 방어(본인 격리).
- `admin.listUsers` 의 limit 클램핑(`min(max(limit, 1), MAX)`)으로 비정상 입력 방어.
- `sumCompletedTotalAmount` 는 완료 주문 0건 시 `new Prisma.Decimal(0)` 반환(null 방어).

---

## 데이터 모델

> 상세 컬럼·타입·인덱스·제약·마이그레이션은 **Database Design Agent**(selection-phases.md: Y)가 [../db-design/data-model.md](../db-design/data-model.md) 로 확정. 본 절은 plan 수준 목표 구조.

### admin 스키마 (배너 신규 1테이블)

| 테이블 | 핵심 필드 | 제약·인덱스 | 모듈 |
|---|---|---|---|
| `admin.banners` | `id`, `title`, `imageUrl`, `linkUrl?`, `position`(BannerPosition default MAIN_TOP), `sortOrder`(Int default 0), `isActive`(Bool default true), `startsAt?`, `endsAt?`, `createdAt` | index(isActive, position, sortOrder) — FR-005 공개 조회 | banner |

### stats / admin 스키마

자체 소유 트랜잭션 테이블 **없음**. 모든 데이터는 order/user/seller 도메인 테이블을 Service DI 경유로 조합.

### 스키마 enum 신규

| enum | 스키마 | 값 | 근거 |
|---|---|---|---|
| `BannerPosition` | admin | MAIN_TOP, MAIN_MIDDLE, MAIN_BOTTOM, SIDEBAR | 배너 노출 위치 — 공개 조회 시 위치별 그룹핑·정렬 |

> **금전 필드 없음(banner)**: `banners` 테이블에 `Decimal` 금전 필드가 없다(P-005 banner 해당 없음). stats 매출 집계(`Prisma.Decimal`)는 기존 003 `orders.totalAmount`(`@db.Decimal(12,2)`)를 **읽기 집계**한다.

---

## 테스트 전략

> 테스트 수준: 단위/통합 부팅/정적. 단위(SC-001·002·003·004·005·006·007·008·009), 통합 부팅(SC-010), 정적(SC-011 cross-schema).

### SC↔테스트 매핑 (요약)

| SC 식별자 | 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | 단위 | Happy | banner create 위임 | create(input) | repository.create 호출·반환 |
| SC-002 | 단위 | Happy/Error | banner update 부분/404 | exists/missing | partial update / NotFound |
| SC-003 | 단위 | Happy/Error | banner remove/404 | exists/missing | delete / NotFound |
| SC-004 | 단위 | Happy/Edge | listPublic 노출기간 필터 | 기간 미설정·내부·시작전·종료후·경계·혼합 | 노출/숨김/정렬순 |
| SC-005 | 단위 | Happy/Edge | overview 조합·Decimal | aggregate mock | 5 metrics·totalSales Decimal·0→Decimal(0) |
| SC-006 | 단위 | Happy/Error | seller stats 본인 격리 | approved/not-approved | summary / Forbidden |
| SC-007 | 단위 | Happy | listPendingSellers | — | listByStatus(PENDING) 호출 |
| SC-008 | 단위 | Happy | approveSeller 재사용 | sellerId | seller.approve 호출·반환 |
| SC-009 | 단위 | Happy/Edge | listUsers 클램프 | undefined/초과/1미만 | take 20/100/1 |
| SC-010 | 통합 | Happy/Error | AppModule 부팅·라우트·노출기간·권한 | GET /banners·/admin/* | 200/401/403·노출/숨김 |
| SC-011 | 정적 | — | banner/stats/admin repo cross-schema 0 | grep repository | 타 도메인 모델 미참조 |

### smoke_tests

- 필요 여부: Y (통합 부팅)
- 근거: 007 은 3개 신규 모듈을 AppModule 에 등록한다. `banner-admin.e2e-spec.ts` 가 AppModule 부팅(BannerModule·StatsModule·AdminModule DI 해석)을 검증하고 공개/인증/관리자 라우트(200/401/403)와 배너 노출기간 동작(활성→공개 노출, 미래→숨김)을 확인(SC-010). DB 의존 e2e 이므로 PostgreSQL 기동 전제.

---

## 기타 고려사항

- **판매자 승인 병렬 라우트(OBS-007-01)**: `SellerService.approve` 가 `PATCH /sellers/:id/approve`(seller 컨트롤러) 와 `POST /admin/sellers/:id/approve`(admin 컨트롤러) 양쪽에서 호출된다. 로직은 단일(재사용)이나 라우트 표면이 둘이다. 두 경로 모두 AdminGuard 보호로 권한 표면 동일. 운영 라우트 일원화는 후속 정책 spec.
- **관리자 audit log 부재(GAP-007-01)**: 승인·삭제 등 관리자 조치를 기록하는 append-only 감사 테이블이 없다. 운영 추적 필요 시 `admin_audit_logs` 후속 검토.
- **배너 노출기간 in-memory 필터(GAP-007-02)**: `listPublic` 이 `listActiveOrdered`(isActive=true) 조회 후 애플리케이션 레벨에서 노출기간을 필터한다. 배너 수가 많아지면 `startsAt`/`endsAt` 범위를 DB where 절로 푸시다운하는 최적화 필요.
- **stats·admin 빈 Repository**: `StatsRepository`·`AdminRepository` 는 4계층 골격 유지를 위해 클래스만 보존(`providers` 에 등록되나 DB 무접근). 자체 테이블이 정당화되기 전에는 확장하지 않는다(P-001).
- **매출 집계 Decimal 정확성**: `getSellerCompletedSummary` 는 `unitPrice` 를 `new Prisma.Decimal(...)` 로 변환해 `mul(quantity)` 후 `add` 누적한다(부동소수점 오차 회피, P-005).
