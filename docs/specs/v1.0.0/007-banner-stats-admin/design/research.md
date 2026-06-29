---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (retroactive)
---

# Research: 007-banner-stats-admin

## 목차

- [분석 우선순위 게이트 결과](#분석-우선순위-게이트-결과)
- [기존 코드베이스 분석](#기존-코드베이스-분석)
  - [클래스·모듈 계층 구조](#클래스모듈-계층-구조)
  - [영향 범위 분석 (호출 측 전수 목록)](#영향-범위-분석-호출-측-전수-목록)
  - [공유 상태·동시성 분석](#공유-상태동시성-분석)
- [영향 파일 목록](#영향-파일-목록)
- [외부 라이브러리 API 실제 동작 확인](#외부-라이브러리-api-실제-동작-확인)
- [기술 선택 조사](#기술-선택-조사)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 분석 우선순위 게이트 결과

- **변경 대상 모듈(plan §핵심 설계)**: `banner`(빈 스텁 실구현 + admin.banners 소유), `stats`(빈 스텁 실구현, 자체 테이블 없음), `admin`(빈 스텁 실구현, 자체 테이블 없음), `order`/`user`/`seller`(additive 집계 메서드 추가), `prisma`(ALS 재사용, 변경 0), `schema.prisma`(admin 1테이블 + 1 enum — Database Design Agent 소유).
- §A·B·C 분석은 위 모듈로 한정.
- §D(다단계 병렬 파이프라인): 미해당.
- §E(동일 가드 결정 통합): 관리자 엔드포인트의 AdminGuard 적용(banner CRUD·stats overview·admin 전체)에 적용 — 본문 [엣지 케이스](#엣지-케이스-및-한계) 참조.
- 외부 라이브러리 검증(§4): **신규 라이브러리 0건**. 기존 `Prisma.Decimal`(매출 집계)·`Prisma.aggregate`·cursor 페이지네이션만 신규 사용 — 아래 검증.
- §F(production 시그니처 변경): **해당 없음** — order/user/seller 모듈은 신규 공개 메서드 추가(additive)이며 기존 메서드 시그니처 변경 없음. 기존 호출 측 영향 0. `SellerService.approve` 는 기존 메서드 재사용(시그니처 불변).

---

## 기존 코드베이스 분석

> context.md §2 핵심 모듈 목록을 기준선. 본 절은 변경 대상 한정 정밀 분석.

### 클래스·모듈 계층 구조

- **OOP 상속/추상 클래스 없음**: 변경 대상은 전부 NestJS `@Injectable()` concrete 클래스. 신규 클래스(BannerService·StatsService·AdminService·BannerRepository 등)는 상속 없이 직접 인스턴스화(NestJS DI). `AdminGuard`·`JwtAuthGuard` 는 `CanActivate` 구현(기존 shared).
- **모듈 DI 토폴로지(실측)**:
  - `BannerService` 생성자(실측 `banner.service.ts`): `BannerRepository`. `BannerModule.imports`: `AuthSharedModule`, controllers `[AdminBannerController, BannerController]`, providers `[BannerService, BannerRepository]`, exports `[BannerService]`.
  - `StatsService` 생성자(실측 `stats.service.ts`): `OrderService`, `UserService`, `SellerService`. `StatsModule.imports`: `AuthSharedModule, OrderModule, UserModule, SellerModule`, controllers `[AdminStatsController, SellerStatsController]`, providers `[StatsService, StatsRepository]`(exports 없음).
  - `AdminService` 생성자(실측 `admin.service.ts`): `SellerService`, `UserService`. `AdminModule.imports`: `AuthSharedModule, SellerModule, UserModule`, controllers `[AdminController]`, providers `[AdminService, AdminRepository]`(exports 없음).
  - `OrderModule`·`SellerModule`(실측): 각 Service 를 exports(이미 존재 — stats/admin DI 소비 가능). `UserModule`: 007 에서 `exports [UserService]` 추가(이전엔 미export).

- **순환 DI 점검(신규 의존 관계)**:
  | 관계 | 방향 | 순환? |
  |---|---|---|
  | stats → order/user/seller | StatsModule imports, StatsService uses Service | 도메인 모듈은 stats 미import → **순환 없음** |
  | admin → seller/user | AdminModule imports, AdminService uses Service | 도메인 모듈은 admin 미import → **순환 없음** |
  | banner → (없음) | AuthSharedModule 만 | 순환 없음 |
  - 결론: **forwardRef 신규 도입 불필요**. stats·admin → 도메인은 단방향.

### 영향 범위 분석 (호출 측 전수 목록)

- **`OrderService` 집계 4종(신규 공개)**: 신규 추가이므로 기존 호출 측 0. stats 모듈만 호출(신규). 기존 OrderService 메서드 시그니처 불변 → 003~006 order 테스트 회귀 0.
- **`OrderRepository` 집계 4종(countAll·countCompleted·sumCompletedTotalAmount·getSellerCompletedSummary)**: 신규. OrderService 집계만 호출. 기존 repository 메서드 불변.
- **`UserService.countAllUsers`·`listUsersForAdmin`(신규 공개)**: stats·admin 모듈만 호출(신규). 기존 UserService 불변. `UserModule` exports 추가로 외부 DI 소비 가능화.
- **`SellerService.countAllSellers`·`listByStatus`(신규 공개)**: stats·admin 만 호출(신규). 기존 불변.
- **`SellerService.approve`(재사용)**: 007 이전 커밋(`f2f061a`) 시점부터 존재 — `PATCH /sellers/:id/approve`(seller 컨트롤러, JwtAuthGuard+AdminGuard) 가 기존 호출 측. 007 이 `AdminService.approveSeller` → `POST /admin/sellers/:id/approve` 신규 호출 측 추가(병렬 라우트 — OBS-007-01). 로직 변경 0.
- **banner/stats/admin 모듈**: 002~006 시점 빈 스텁(골격만) → 실구현. 기존 호출 측 0.
- **AppModule 와이어링**: BannerModule·StatsModule·AdminModule 이 AppModule imports 에 등록(부팅 시 DI 해석). `banner-admin.e2e-spec.ts` 로 부팅 검증.

### 공유 상태·동시성 분석

- **공유 자원**: `admin.banners`(배너 — banner 모듈 단독 소유). stats·admin 은 자체 자원 없음(read-only 집계).
- **Check-Then-Act 분석**:
  | 자원 | 위험 | 현재 안전망 | 근거 |
  |---|---|---|---|
  | banners (update/delete) | findById→update/delete 사이 레코드 변경/삭제 | findById 후 update/delete 단일 호출. 동시 삭제 시 두 번째 update/delete 가 P2025 가능 — 단 본 spec 별도 처리 없음(운영상 드묾) | FR-002·003 |
  | banners (listPublic) | 조회 중 배너 변경 | read-only — race 무관(스냅샷 일관성은 단일 findMany) | FR-005 |
  | order/user/seller 집계 | 집계 중 데이터 변경 | read-only 집계(count·aggregate·findMany) — 정합성 영향 없음(통계 근사 허용) | FR-006~010 |
- **Lock 범위**: 별도 비관 락 미사용. 배너 CRUD 는 단일 mutation. 통계는 read-only. Lock 내 네트워크/파일 I/O 없음.
- **트랜잭션 전파 주의**: `BannerRepository` 는 `this.prisma.banner`(루트 직접) 사용 — standalone CRUD 라 ALS tx-aware 불필요(002-catalog 동일 패턴). 통계 집계도 단일 read 쿼리.
- **캐싱 컴포넌트 없음**: in-memory 캐시 도입 없음 → 캐시 생명주기 검토 비해당. 통계는 매 호출 실시간 집계(스냅샷 캐시 미도입 — ADR-003).

---

## 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 | 레이어 |
|---|---|---|---|
| `prisma/schema.prisma` | 수정(DB Design 소유) | BannerPosition enum + Banner 모델(admin 스키마) | A |
| `prisma/migrations/20260629085122_007_banner_stats_admin/migration.sql` | 신규 | BannerPosition enum + banners 테이블 + index | A |
| `src/modules/banner/banner.repository.ts` | 신규 구현 | create·findById·update·delete·listAll·listActiveOrdered | A |
| `src/modules/banner/banner.service.ts` | 신규 구현 | create·update(404)·remove(404)·listAll·listPublic(isWithinPeriod) | B |
| `src/modules/banner/banner.controller.ts` | 신규 구현 | AdminBannerController·BannerController(공개) | C |
| `src/modules/banner/dto/{create,update}-banner.dto.ts` | 신규 | 배너 생성·부분 수정 검증 dto | C |
| `src/modules/banner/banner.module.ts` | 수정 | imports·providers·exports(BannerService) | C |
| `src/modules/stats/stats.repository.ts` | 신규(빈 클래스) | 자체 테이블 없음 | A |
| `src/modules/stats/stats.service.ts` | 신규 구현 | getOverview·getSellerStats(본인 격리) | B |
| `src/modules/stats/stats.controller.ts` | 신규 구현 | AdminStatsController·SellerStatsController | C |
| `src/modules/stats/stats.module.ts` | 수정 | imports(Order·User·Seller)·providers | C |
| `src/modules/admin/admin.repository.ts` | 신규(빈 클래스) | 자체 테이블 없음 | A |
| `src/modules/admin/admin.service.ts` | 신규 구현 | listPendingSellers·approveSeller(재사용)·listUsers(클램프) | B |
| `src/modules/admin/admin.controller.ts` | 신규 구현 | AdminController | C |
| `src/modules/admin/admin.constants.ts` | 신규 | DEFAULT/MAX_USER_PAGE_LIMIT | B |
| `src/modules/admin/admin.module.ts` | 수정 | imports(Seller·User)·providers | C |
| `src/modules/order/order.service.ts` | 수정(additive) | 집계 4종 공개 | B |
| `src/modules/order/order.repository.ts` | 수정(additive) | 집계 4종(Decimal) | A |
| `src/modules/user/user.service.ts` | 수정(additive) | countAllUsers·listUsersForAdmin | B |
| `src/modules/user/user.repository.ts` | 수정(additive) | countAll·listPaginated | A |
| `src/modules/user/user.module.ts` | 수정 | exports(UserService) | C |
| `src/modules/seller/seller.service.ts` | 수정(additive) | countAllSellers·listByStatus | B |
| `src/modules/seller/seller.repository.ts` | 수정(additive) | countAll·listByStatus | A |
| `test/static/cross-schema.spec.ts` | 수정(확장) | Banner·Stats·AdminRepository 규칙(SC-011) | D |
| `test/static/auth-required-guards.spec.ts` | 수정(확장) | banner·stats·admin 컨트롤러 JwtAuthGuard 정적 검증 대상 추가 | D |
| `test/banner-admin.e2e-spec.ts` | 신규 | AppModule 부팅·라우트·노출기간·권한 검증(SC-010) | D |

> `package.json` 변경 0건(신규 npm 의존 없음 — NFR-002 자동 충족).

---

## 외부 라이브러리 API 실제 동작 확인

- **신규 외부 라이브러리: 없음 — 해당 없음**. selection-phases.md 자가 점검 결과 신규 npm 0건.
- **`Prisma.Decimal`(decimal.js) — 매출 집계**: `OrderRepository.sumCompletedTotalAmount` 가 `prisma.order.aggregate({ where: {status: completed}, _sum: { totalAmount: true } })` 의 `_sum.totalAmount`(Decimal | null)를 `?? new Prisma.Decimal(0)` 로 방어. `getSellerCompletedSummary` 는 `new Prisma.Decimal(item.unitPrice).mul(item.quantity)` 를 `add` 로 누적(부동소수점 회피). 금전 산술이 있으나 *읽기 집계*이며 신규 금전 상태 변경 없음(P-005 Decimal 정확성 적용).
- **`prisma.{model}.count` / `aggregate`**: `order.count()`·`order.count({where:{status:completed}})`·`user.count()`·`seller.count()` 표준. `aggregate _sum` 표준.
- **cursor 페이지네이션(user)**: `prisma.user.findMany({ orderBy:[{createdAt:desc},{id:desc}], cursor: cursor?{id}:undefined, skip: cursor?1:0, take })` — Prisma cursor 표준. `nextCursor` 는 `rows.length === take ? rows.at(-1).id : null`.
- **`@IsDateString`(class-validator) → `new Date()`**: 컨트롤러가 dto 의 ISO 문자열을 `new Date(...)` 로 변환하여 service 에 `Date` 전달. PATCH 시 `null` 은 노출기간 해제로 전달.

가정-실제 불일치 현재 미발견.

---

## 기술 선택 조사

| 결정 | 채택 | 근거 |
|---|---|---|
| 배너 테이블 스키마 | 신규 `admin` 스키마 `banners` | 도메인 경계 명확화(ADR-001). admin 스키마는 datasource 에 기존 선언 |
| 배너 노출기간 필터 | 애플리케이션 레벨(`listActiveOrdered` 후 `isWithinPeriod`) | 배너 수 적어 in-memory 충분(ADR-002). **한계: DB 푸시다운 후속(GAP-007-02)** |
| stats 데이터 소유 | 자체 테이블 없음 — 도메인 Service DI 조합. StatsRepository 빈 클래스 | P-001 모듈 경계(ADR-003). 집계 캐시 대비 데이터 중복·정합성 비용 회피. SC-011 정적 검사 |
| admin 데이터 소유 | 자체 테이블 없음 — 도메인 Service DI 조합. AdminRepository 빈 클래스 | P-001(ADR-004). audit log 등 자체 테이블은 범위 외(GAP-007-01) |
| 판매자 승인 | 기존 `SellerService.approve` 재사용 | 로직 중복 회피(ADR-005). **병렬 라우트: OBS-007-01** |
| 매출 집계 타입 | `Prisma.Decimal`(aggregate `_sum`·`mul`/`add`) | P-005 금전 정확성(ADR-006). number 부동소수점 회피 |
| admin 사용자 목록 | cursor + 민감 필드(password) 제외 | 정보 노출 방지(ADR-007). full row·offset 대비 안전 |
| 배너 부분 수정 | PATCH — 전달 키만 갱신, startsAt/endsAt null 해제 | 부분 갱신 시맨틱(ADR-008) |

---

## 엣지 케이스 및 한계

- **§E 동일 가드 조건 통합(AdminGuard)**: banner CRUD(`AdminBannerController`)·stats overview(`AdminStatsController`)·admin 전체(`AdminController`)가 동일 패턴 — `@UseGuards(JwtAuthGuard, AdminGuard)`. AdminGuard 는 `ADMIN_USER_IDS` env 미설정/미포함 시 403(fail-closed). `auth-required-guards.spec.ts` 가 banner·stats·admin 컨트롤러의 JwtAuthGuard 적용을 정적 검증(공개 `BannerController GET /banners` 는 의도적 무가드로 목록 외).
- **배너 노출기간 경계값**: `isWithinPeriod` 가 `startsAt <= now`·`now <= endsAt`(양 끝 포함). 경계값(`startsAt==now`/`endsAt==now`)에서 노출(테스트 `when_boundary_equals_now_then_visible`). 시작 전(`startsAt > now`) 숨김, 종료 후(`endsAt < now`) 숨김.
- **배너 PATCH 시맨틱**: 컨트롤러가 `dto.X !== undefined` 인 키만 `input` 에 복사 → 미전달 필드 보존. `startsAt`/`endsAt` 는 `null`(해제) vs 값(`new Date`) 구분.
- **통계 빈 데이터**: 완료 주문 0건 → `sumCompletedTotalAmount` 가 `new Prisma.Decimal(0)`(테스트 `when_no_completed_orders_then_zero_decimal_sales`).
- **seller stats 본인 격리**: `getApprovedSeller(userId)` 가 미등록/미승인 판매자에 `ForbiddenException` → `getSellerStats` 가 본인 sellerId 외 접근 구조적 차단(테스트 `when_not_approved_seller_then_ForbiddenException`).
- **admin listUsers 클램프**: `take = min(max(limit ?? 20, 1), 100)` — undefined→20, 초과→100, 1미만→1(테스트 3종).
- **판매자 승인 병렬 라우트(한계)**: `SellerService.approve` 가 seller·admin 두 라우트에서 호출(OBS-007-01). 로직 중복 아님, 라우트 표면 둘. 운영 일원화 후속.
- **관리자 audit log 부재(한계)**: 승인·삭제 추적 테이블 없음(GAP-007-01).
- **배너 노출 필터 in-memory(한계)**: `listActiveOrdered` 후 애플리케이션 필터(GAP-007-02). 배너 수 증가 시 DB 푸시다운.
- **banner.events·stats.events·admin.events 스캐폴드**: 세 `*.events.ts` 는 빈 스캐폴드 주석 파일(이벤트 미발행).
