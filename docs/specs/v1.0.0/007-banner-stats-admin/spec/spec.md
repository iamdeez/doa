---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (구현 완료 — retroactive 문서화)
---

# Spec: 007-banner-stats-admin

> Branch: 007-banner-stats-admin | Date: 2026-06-29 | Version: v1.0.0
>
> 본 문서는 이미 구현·검증이 완료된 코드(커밋 `7a9ed2c`)를 근거로 정식 SDD 포맷으로 retroactive
> 작성되었다. 모든 요구사항·수용 기준은 실제 구현된 `banner`·`stats`·`admin` 모듈과
> `order`·`user`·`seller` 모듈의 additive 집계 메서드에서 확인한 사실을 기준으로 한다.

## 목차

- [배경 및 목적](#배경-및-목적)
- [선행 spec 영향 추적](#선행-spec-영향-추적)
- [사용자 스토리](#사용자-스토리)
- [기능 요구사항](#기능-요구사항)
- [비기능 요구사항](#비기능-요구사항)
- [수용 기준](#수용-기준)
- [요구사항 구조화 매트릭스](#요구사항-구조화-매트릭스)
- [권한 평가 결과](#권한-평가-결과)
- [범위 외](#범위-외)
- [미결 사항](#미결-사항)

---

## 배경 및 목적

003-commerce·004-review-coupon·005-shipping-settlement·006-search-notification-file 완료로 핵심 거래·
탐색·알림 도메인이 갖춰진 이후, 남은 운영 측 백엔드 도메인 3종(배너·통계·운영관리)을 구현한다.
오픈마켓 메인 화면에 노출할 운영 배너를 관리(생성·수정·삭제·노출기간 제어)하는 경로, 관리자·판매자가
플랫폼/본인 매출 요약을 조회하는 통계 경로, 그리고 판매자 승인 대기 목록·승인·사용자 목록 등 운영
조치를 모으는 관리자 진입점이 부재했다.

**배너 (Banner)**
- 관리자가 `POST/PATCH/DELETE /admin/banners` 로 노출 배너를 CRUD 하고, 구매자(비인증 포함)는
  `GET /banners` 로 활성·노출기간 내 배너만 정렬순으로 받는다.
- 배너는 신규 `admin` 스키마의 `banners` 테이블을 단독 소유한다(P-001). 노출기간 필터(`isActive=true`
  AND 시작·종료 시각 범위)는 repository 의 `listActiveOrdered` 조회 후 `BannerService.isWithinPeriod`
  애플리케이션 레벨에서 적용한다.
- 배너에는 금전(Decimal) 필드가 없다(P-005 해당 없음).

**통계 (Stats)**
- 관리자가 `GET /admin/stats/overview` 로 플랫폼 요약(총 주문수·완료 주문수·총 매출·총 사용자수·총
  판매자수)을, APPROVED 판매자가 `GET /seller/stats` 로 본인 completed 매출 요약을 조회한다.
- stats 모듈은 **자체 소유 트랜잭션 테이블이 없다**(P-001). 모든 집계는 `OrderService`·`UserService`·
  `SellerService` 의 공개 집계 메서드를 DI 경유로 호출해 조합하며, `StatsRepository` 는 빈 클래스(4계층
  골격 유지용)다.
- 매출 집계(`sumCompletedSales`·`getSellerSalesSummary`·`overview.totalSales`)는 전부 `Prisma.Decimal`
  로 처리한다(P-005).

**운영관리 (Admin)**
- 관리자가 `GET /admin/sellers/pending`(승인 대기 판매자)·`POST /admin/sellers/:id/approve`(승인)·
  `GET /admin/users`(사용자 목록 cursor 페이지네이션)를 호출한다.
- admin 모듈도 **자체 소유 트랜잭션 테이블이 없다**(P-001). 판매자 승인은 `SellerService.approve`
  (007 이전부터 존재) 재사용이며, 사용자 목록은 `UserService.listUsersForAdmin`(민감 필드 제외) DI
  경유다. `AdminRepository` 는 빈 클래스다.

---

## 선행 spec 영향 추적

| 선행 spec | 식별된 연동 항목 | 인지 시점 | 식별 경로 |
|---|---|---|---|
| v1.0.0/003-commerce | stats 가 orders 스키마 집계를 소비. 007 이 `OrderService.countAllOrders`·`countCompletedOrders`·`sumCompletedSales`·`getSellerSalesSummary` 신규 공개 메서드(additive)를 추가하여 주문 수·완료 매출(Decimal) 집계를 제공. stats 모듈은 이 메서드를 DI 경유로만 소비(P-001). | 2026-06-29 | 003 Order·OrderItem·OrderStatus |
| v1.0.0/003-commerce (seller) | admin 의 판매자 승인은 `SellerService.approve`(007 이전 커밋 `f2f061a` 시점부터 존재)를 **재사용**(로직 중복 없음). 007 은 `SellerService.countAllSellers`·`listByStatus` additive 공개 메서드만 추가. 기존 `PATCH /sellers/:id/approve`(seller) 와 신규 `POST /admin/sellers/:id/approve`(admin)가 동일 로직을 호출하는 **병렬 라우트**다(OBS-007-01). | 2026-06-29 | SellerService.approve·SellerStatus |
| v1.0.0/001-skeleton-bootstrap (user) | admin 사용자 목록·stats 사용자 수 집계가 users 스키마를 소비. 007 이 `UserService.countAllUsers`·`listUsersForAdmin`(password 등 민감 필드 제외 cursor 페이지네이션) additive 공개 메서드를 추가. UserModule 이 UserService 를 export(`+1` 변경). | 2026-06-29 | User 모델 |

---

## 사용자 스토리

- **US-001**: 관리자로서, 메인 노출 배너를 생성·수정·삭제하고 노출기간·정렬·활성 여부를 제어하고 싶다.
- **US-002**: 구매자(비인증 포함)로서, 현재 노출 중(활성·기간 내)인 배너만 정렬순으로 받아보고 싶다.
- **US-003**: 관리자로서, 플랫폼 요약 통계(주문·매출·사용자·판매자 수)를 한눈에 보고 싶다.
- **US-004**: APPROVED 판매자로서, 내 completed 매출 합계와 주문 건수를 보고 싶다(타 판매자 통계는
  볼 수 없기를 원한다).
- **US-005**: 관리자로서, 승인 대기 판매자를 조회하고 승인하며, 사용자 목록을 페이지 단위로 조회하고
  싶다.

---

## 기능 요구사항

### 배너 (Banner)

- **FR-001**: 관리자는 `POST /admin/banners`(JwtAuthGuard+AdminGuard, HTTP 201)로 배너를 생성한다.
  body 는 `{ title, imageUrl, linkUrl?, position?(BannerPosition), sortOrder?, isActive?, startsAt?,
  endsAt? }`(class-validator 검증)이며 `BannerService.create` 가 `BannerRepository.create` 에 위임한다.
  `startsAt`/`endsAt` 는 ISO 8601 문자열을 `Date` 로 변환한다.

- **FR-002**: 관리자는 `PATCH /admin/banners/:id`(JwtAuthGuard+AdminGuard)로 배너를 **부분 수정**한다.
  전달된 키만 갱신(PATCH 시맨틱, `undefined` 필드 미전파)하며, `startsAt`/`endsAt` 는 `null` 이면 해제,
  값이 있으면 `Date` 변환한다. 미존재 배너는 404(`NotFoundException`)다.

- **FR-003**: 관리자는 `DELETE /admin/banners/:id`(JwtAuthGuard+AdminGuard, HTTP 204)로 배너를
  삭제한다. 미존재 배너는 404 다.

- **FR-004**: 관리자는 `GET /admin/banners`(JwtAuthGuard+AdminGuard)로 전체 배너(활성·비활성 모두)를
  `sortOrder` 오름차순 → `createdAt` 내림차순으로 조회한다.

- **FR-005**: 비인증을 포함한 사용자는 `GET /banners`(공개, 가드 없음)로 노출 배너를 조회한다. 노출
  대상은 `isActive=true` AND (`startsAt` 이 null 이거나 `startsAt ≤ now`) AND (`endsAt` 이 null 이거나
  `now ≤ endsAt`) 를 모두 만족하는 배너이며, `sortOrder` 순(repository `listActiveOrdered` 후
  `isWithinPeriod` 애플리케이션 필터)으로 반환한다.

### 통계 (Stats)

- **FR-006**: 관리자는 `GET /admin/stats/overview`(JwtAuthGuard+AdminGuard)로 플랫폼 요약 통계를
  조회한다. 응답은 `{ totalOrders, completedOrders, totalSales(Prisma.Decimal), totalUsers,
  totalSellers }` 이며, 각 값은 `OrderService.countAllOrders`·`countCompletedOrders`·`sumCompletedSales`·
  `UserService.countAllUsers`·`SellerService.countAllSellers` 를 `Promise.all` 로 조합한다(P-001 DI).

- **FR-007**: APPROVED 판매자는 `GET /seller/stats`(JwtAuthGuard)로 본인 매출 요약을 조회한다.
  `SellerService.getApprovedSeller(userId)` 로 본인 확인(미승인 시 `ForbiddenException`) 후 본인 sellerId
  기준 `OrderService.getSellerSalesSummary` 로 `{ salesTotal(Prisma.Decimal), orderCount }` 를 집계한다.

### 운영관리 (Admin)

- **FR-008**: 관리자는 `GET /admin/sellers/pending`(JwtAuthGuard+AdminGuard)로 승인 대기(PENDING)
  판매자 목록을 조회한다. `AdminService.listPendingSellers` 가 `SellerService.listByStatus(PENDING)` 에
  위임한다.

- **FR-009**: 관리자는 `POST /admin/sellers/:id/approve`(JwtAuthGuard+AdminGuard, HTTP 200)로 판매자를
  승인한다. `AdminService.approveSeller` 는 **기존 `SellerService.approve`(PENDING→APPROVED) 를
  재사용**한다(로직 중복 없음). 기존 `PATCH /sellers/:id/approve` 와 동일 로직을 호출하는 병렬
  라우트다(OBS-007-01).

- **FR-010**: 관리자는 `GET /admin/users`(JwtAuthGuard+AdminGuard)로 사용자 목록을 cursor
  페이지네이션으로 조회한다. `AdminService.listUsers` 가 `limit` 을 `[1, MAX_USER_PAGE_LIMIT(100)]`
  범위로 클램프(기본 `DEFAULT_USER_PAGE_LIMIT(20)`)하여 `UserService.listUsersForAdmin(cursor, take)`
  에 위임하며, 응답은 `{ items(password 제외 안전 요약), nextCursor }` 다.

---

## 비기능 요구사항

- **NFR-001** (P-001 모듈 경계): `banner` 모듈 Repository 는 자신의 소유 테이블(`admin.banners`)에만
  접근한다. `stats`·`admin` 모듈은 **자체 소유 트랜잭션 테이블이 없으며**(StatsRepository·AdminRepository
  는 빈 클래스), 모든 데이터 접근은 도메인 Service(`Order`/`User`/`Seller`) 공개 메서드 DI 경유로
  수행한다. 도메인 모듈에 추가된 additive 집계 메서드는 전부 자기 스키마 내 집계다. cross-schema 참조는
  plain String 이다.

- **NFR-002** (P-002 외부 의존 금지): 신규 npm 의존성 0 건. `@aws-sdk/*` 등 AWS 전용 SDK·외부 서비스
  미사용. 배너·통계·운영은 표준 Prisma + NestJS + class-validator 만으로 구현한다.

- **NFR-003** (인증/인가): 관리자 엔드포인트(`admin/banners` 4종·`admin/stats/overview`·
  `admin/sellers/*`·`admin/users`)는 `JwtAuthGuard`+`AdminGuard`(fail-closed)로 보호된다. 판매자
  통계(`seller/stats`)는 `JwtAuthGuard` + 본인 격리(`getApprovedSeller`)다. `GET /banners` 는 공개(가드
  없음)다. 토큰 없는 관리자/판매자 요청 → 401, 비관리자 관리자 요청 → 403.

- **NFR-004** (자원 격리): 판매자 통계는 호출자 본인 sellerId 로만 집계한다(`getApprovedSeller` 가
  타인 sellerId 접근을 구조적으로 차단). 관리자 조치(승인·사용자 목록)는 AdminGuard 통과 사용자만
  수행한다.

- **NFR-005** (P-005 매출 Decimal): 통계 매출 집계(`sumCompletedTotalAmount`·`getSellerCompletedSummary`·
  `overview.totalSales`)는 `Prisma.Decimal` 로 산출하며 부동소수점을 사용하지 않는다(완료 주문이 없으면
  `new Prisma.Decimal(0)`). 배너 테이블에는 금전 필드가 없다(P-005 해당 없음 — banner 한정).

---

## 수용 기준

> **환경 태그 규약**:
> | 태그 | 의미 |
> |---|---|
> | `[env:static]` | 코드·설정·스키마 파일 존재·구조 검증만으로 판정 가능 |
> | `[env:unit]` | 단위 테스트(mock)로 판정 가능 |
> | `[env:integration]` | AppModule 부팅(DI 그래프) 기반 통합 부팅 테스트로 판정 |

### 배너 SC

- **SC-001** (`FR-001` 관련): `BannerService.create` 가 `repository.create` 에 위임하고 생성된 배너를
  반환한다. [env:unit]

- **SC-002** (`FR-002` 관련): `BannerService.update` 가 존재 배너에 부분 수정(`findById` 후
  `repository.update`)을, 미존재 배너에 `NotFoundException`(404)을 수행한다. [env:unit]

- **SC-003** (`FR-003` 관련): `BannerService.remove` 가 존재 배너에 삭제(`repository.delete`)를, 미존재
  배너에 `NotFoundException`(404)을 수행한다. [env:unit]

- **SC-004** (`FR-005`·`NFR-001` 관련): `BannerService.listPublic` 이 노출기간 필터를 적용한다 — 기간
  미설정 항상 노출, now 가 기간 내 노출, 시작 전 숨김, 종료 후 숨김, 경계값(`startsAt==now`/`endsAt==now`)
  노출, 혼합 입력 시 활성·기간 내만 정렬순. [env:unit]

### 통계 SC

- **SC-005** (`FR-006`·`NFR-005` 관련): `StatsService.getOverview` 가 5개 도메인 집계를 `Promise.all` 로
  조합하며 `totalSales` 를 `Prisma.Decimal` 로 반환한다(완료 주문 없으면 `Decimal(0)`). [env:unit]

- **SC-006** (`FR-007`·`NFR-004` 관련): `StatsService.getSellerStats` 가 APPROVED 판매자에 본인 매출
  요약(`getApprovedSeller` 후 `getSellerSalesSummary`)을, 미승인 판매자에 `ForbiddenException` 을
  반환한다. [env:unit]

### 운영관리 SC

- **SC-007** (`FR-008` 관련): `AdminService.listPendingSellers` 가 `SellerService.listByStatus(PENDING)`
  를 호출한다. [env:unit]

- **SC-008** (`FR-009` 관련): `AdminService.approveSeller` 가 `SellerService.approve` 를 재사용 호출하고
  결과를 반환한다. [env:unit]

- **SC-009** (`FR-010` 관련): `AdminService.listUsers` 가 `limit` 을 클램프한다 — `undefined`→기본 20,
  최대 초과→100, 1 미만→1 로 `take` 를 산정하여 `UserService.listUsersForAdmin` 에 전달한다. [env:unit]

### 통합·정적 SC

- **SC-010** (`FR-001~010`·`NFR-003` 관련): AppModule 이 `BannerModule`·`StatsModule`·`AdminModule` 을
  등록한 상태로 정상 부팅하며, `GET /banners`(토큰 없음) → 200(배열, 공개), `GET /admin/banners`(토큰
  없음) → 401, `GET /admin/banners`(비관리자) → 403, 관리자 배너 생성(활성/미래) → 공개 목록 노출/숨김,
  `GET /admin/stats/overview`(관리자) → 200(metrics)·(비관리자) → 403, `GET /admin/sellers/pending`
  (관리자) → 200(배열). 등록된 관리자 배너 라우트(`GET /admin/banners` listAll 포함)가 부팅된다.
  [env:integration]

- **SC-011** (`NFR-001` 관련): `banner`·`stats`·`admin` 모듈 Repository 구현 파일이 자신의 소유 스키마
  외 타 도메인 Prisma 모델(`product`·`user`·`seller`·`cart`·`order`·`payment` 등)을 `this.prisma.{model}`
  로 직접 참조하지 않는다(`cross-schema.spec.ts` 의 BannerRepository(007)·StatsRepository(007)·
  AdminRepository(007) 규칙). [env:static]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건.
> MoSCoW: Must / Should / Could / Won't

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-001 | FR-001 | NFR-003 | SC-001, SC-010 | unit·integration | Must |
| US-001 | FR-002 | NFR-003 | SC-002 | unit | Must |
| US-001 | FR-003 | NFR-003 | SC-003 | unit | Must |
| US-001 | FR-004 | NFR-003 | SC-010 | integration | Should |
| US-002 | FR-005 | NFR-001 | SC-004, SC-010 | unit·integration | Must |
| US-003 | FR-006 | NFR-005 | SC-005, SC-010 | unit·integration | Must |
| US-004 | FR-007 | NFR-004 | SC-006 | unit | Must |
| US-005 | FR-008 | NFR-003 | SC-007, SC-010 | unit·integration | Must |
| US-005 | FR-009 | NFR-003 | SC-008 | unit | Must |
| US-005 | FR-010 | NFR-004 | SC-009 | unit | Must |
| — | — | NFR-001 | SC-011 | static | Must |

> NFR-002(외부 의존 금지)는 신규 npm 의존 0건 확인(`package.json` 변경 0)으로 충족하며 별도 SC 없음(부재가
> 곧 상태). FR-004(admin listAll)는 thin delegation 으로 직접 단위 단언은 없고 모듈 부팅(SC-010)으로 라우트
> 등록을 간접 확인한다 — coverage-gap.md 에 기록.

---

## 권한 평가 결과

> 배너·통계·운영 엔드포인트에 대해 인가 3축(호출자 신원·자원 소유권·역할) 평가.

| 엔드포인트 | 위험도 | (a) 호출자 신원 | (b) 자원 소유권 | (c) 역할 | 대응 SC |
|---|---|---|---|---|---|
| `POST /admin/banners` | 중간 | JWT | — (전역 운영 자원) | AdminGuard | SC-001·010 |
| `PATCH /admin/banners/:id` | 중간 | JWT | — | AdminGuard | SC-002 |
| `DELETE /admin/banners/:id` | 중간 | JWT | — | AdminGuard | SC-003 |
| `GET /admin/banners` | 낮음 | JWT | — | AdminGuard | SC-010 |
| `GET /banners` | 낮음 | 없음(공개) | — (read-only, 활성·기간 내만) | — | SC-004·010 |
| `GET /admin/stats/overview` | 중간 | JWT | — (플랫폼 전역 집계) | AdminGuard | SC-005·010 |
| `GET /seller/stats` | 중간 | JWT | `getApprovedSeller(userId)` 본인 sellerId 만 | — (판매자 본인) | SC-006 |
| `GET /admin/sellers/pending` | 중간 | JWT | — | AdminGuard | SC-007·010 |
| `POST /admin/sellers/:id/approve` | 중간 | JWT | — | AdminGuard | SC-008·010 |
| `GET /admin/users` | 중간 | JWT | — (민감 필드 제외 요약) | AdminGuard | SC-009 |

**잠재 위험 기록 (허용·기록):**
- **판매자 승인 병렬 라우트(Low, OBS-007-01)**: `PATCH /sellers/:id/approve`(seller 컨트롤러,
  JwtAuthGuard+AdminGuard) 와 `POST /admin/sellers/:id/approve`(admin 컨트롤러, JwtAuthGuard+AdminGuard)
  가 동일 `SellerService.approve` 를 호출한다. 로직 중복은 아니나 라우트 표면이 둘이다. 두 경로 모두
  AdminGuard 로 보호되어 권한 상승 표면은 없으나, 운영 라우트를 admin 으로 일원화하는 후속 검토 권장.

---

## 범위 외

- **배너 노출기간 DB where 절 푸시다운**: 현재 노출기간 필터(`isWithinPeriod`)는 `listActiveOrdered`
  (isActive=true 조회) 후 애플리케이션 레벨 in-memory filter 다. 배너 수가 많아지면 `startsAt`/`endsAt`
  범위를 DB where 절로 푸시다운하는 최적화가 필요하다(GAP-007-02). 본 spec 은 애플리케이션 필터까지만.
- **관리자 액션 audit log**: 승인·삭제 등 관리자 조치를 추적하는 append-only 감사 로그 테이블 부재
  (GAP-007-01). 운영 추적 필요 시 후속 spec.
- **판매자 승인 라우트 일원화**: seller·admin 양쪽 병렬 approve 라우트(OBS-007-01)를 admin 으로 통합하는
  결정은 후속 운영 정책 spec.
- **배너 클릭/노출 집계(통계)**: 배너 노출수·클릭률 등 마케팅 지표 수집. 본 spec 의 stats 는 주문·매출·
  사용자·판매자 수 요약까지만.
- **통계 기간 필터·시계열**: overview·seller stats 는 누적 집계만 제공하며 기간(일/주/월)별 시계열·
  추이 분석은 범위 외.

---

## 미결 사항

없음 — 본 spec 은 구현 완료 코드를 기준으로 retroactive 작성되었으며, 모든 요구사항·수용 기준이 실제
구현과 대조 확인되었다. 식별된 공백·관찰은 [범위 외](#범위-외) 및 `gaps.md`(GAP-007-01·02, OBS-007-01)에
기록한다.
