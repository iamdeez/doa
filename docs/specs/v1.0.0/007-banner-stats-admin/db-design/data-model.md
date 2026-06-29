---
작성: Database Design Agent
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (retroactive)
---

# Data Model: 007-banner-stats-admin

## 목차

- [DB 선택 및 근거](#db-선택-및-근거)
- [엔티티 관계도 (ERD)](#엔티티-관계도-erd)
- [테이블 정의](#테이블-정의)
  - [enum 정의](#enum-정의)
  - [banners](#banners)
- [인덱스 전략](#인덱스-전략)
- [데이터 무결성 규칙](#데이터-무결성-규칙)
- [stats·admin 자체 테이블 부재 명시](#statsadmin-자체-테이블-부재-명시)
- [금전 필드 부재 명시 (banner)](#금전-필드-부재-명시-banner)
- [마이그레이션 계획](#마이그레이션-계획)
- [롤백 전략](#롤백-전략)

---

## DB 선택 및 근거

- **DB**: PostgreSQL 16 — 단일 인스턴스(P-003). 002~006 과 동일 DB 인스턴스·Prisma multiSchema 구조 승계.
- **스키마**:
  - 배너 테이블(`banners`)은 신규 `admin` 스키마에 배치한다(ADR-001). `admin` 스키마는 datasource `schemas` 배열에 기존 선언되어 있다.
  - **stats·admin 모듈은 자체 소유 트랜잭션 테이블이 없다**. 통계·운영 조치는 도메인 Service(Order/User/Seller) DI 경유 read-only 집계·조회이므로 본 spec 의 DB 설계 대상은 `banners` 1테이블뿐이다.
- **ORM**: Prisma `^6.19.0` multiSchema — `@@schema("admin")` 태그.
- **cross-schema 참조 전략**: `banners` 테이블은 cross-schema 참조 컬럼이 없다(전역 운영 자원, 소유자 개념 없음). FK 도 없다(단일 테이블).
- **금전 필드 없음(banner)**: `banners` 테이블에 `Decimal` 금전 필드가 없다(P-005 banner 해당 없음). 상세는 [금전 필드 부재 명시](#금전-필드-부재-명시-banner).

---

## 엔티티 관계도 (ERD)

```
[admin 스키마 — banner 모듈 소유]

Banner (banners)
  │  id PK
  │  title: String              — 배너 제목
  │  imageUrl: String           — 배너 이미지 URL
  │  linkUrl: String?           — 클릭 이동 대상 URL (null=비링크 배너)
  │  position: BannerPosition   — MAIN_TOP | MAIN_MIDDLE | MAIN_BOTTOM | SIDEBAR (default MAIN_TOP)
  │  sortOrder: Int             — 동일 위치 내 정렬 순서 (default 0, 오름차순)
  │  isActive: Boolean          — 활성 여부 (default true)
  │  startsAt: DateTime?        — 노출 시작 (null=즉시)
  │  endsAt: DateTime?          — 노출 종료 (null=무제한)
  │  createdAt: DateTime        — 생성 일시 (default now)
  (단일 테이블 — FK 없음, cross-schema 참조 컬럼 없음)

[stats 모듈 / admin 모듈]
  자체 소유 트랜잭션 테이블 없음 — 도메인 Service(Order/User/Seller) DI 경유 집계·조회.
```

---

## 테이블 정의

### enum 정의

| enum | 스키마 | 값 | 근거 |
|---|---|---|---|
| `BannerPosition` | admin | `MAIN_TOP`, `MAIN_MIDDLE`, `MAIN_BOTTOM`, `SIDEBAR` | 배너 노출 위치. 공개 조회 시 위치별 그룹핑·정렬에 사용 |

### banners

운영 노출 배너. banner 모듈 소유, `admin` 스키마.

| 컬럼명 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | String | PK, `@default(cuid())` | 배너 ID |
| `title` | String | NOT NULL | 배너 제목 |
| `imageUrl` | String | NOT NULL | 배너 이미지 URL |
| `linkUrl` | String | NULLABLE | 클릭 이동 대상 URL (null=비링크 배너) |
| `position` | BannerPosition | NOT NULL, DEFAULT MAIN_TOP | 노출 위치 |
| `sortOrder` | Int | NOT NULL, DEFAULT 0 | 동일 위치 내 정렬 순서(오름차순) |
| `isActive` | Boolean | NOT NULL, DEFAULT true | 활성 여부 |
| `startsAt` | DateTime | NULLABLE | 노출 시작(null=즉시) |
| `endsAt` | DateTime | NULLABLE | 노출 종료(null=무제한) |
| `createdAt` | DateTime | NOT NULL, `@default(now())` | 생성 일시 |

```prisma
model Banner {
  id        String         @id @default(cuid())
  title     String
  imageUrl  String
  linkUrl   String?
  position  BannerPosition @default(MAIN_TOP)
  sortOrder Int            @default(0)
  isActive  Boolean        @default(true)
  startsAt  DateTime?
  endsAt    DateTime?
  createdAt DateTime       @default(now())

  @@index([isActive, position, sortOrder])
  @@map("banners")
  @@schema("admin")
}
```

---

## 인덱스 전략

| 인덱스 | 대상 테이블 | 컬럼 | 목적 | 관련 FR |
|---|---|---|---|---|
| `banners_isActive_position_sortOrder_idx` | banners | `(isActive, position, sortOrder)` | 공개 노출 조회 — 활성 배너를 위치·정렬순으로 스캔 | FR-005·SC-004 |

**선택 근거**:
- `(isActive, position, sortOrder)` 복합 인덱스: 공개 조회(`listActiveOrdered`)가 `WHERE isActive=true ORDER BY sortOrder` 패턴이며, 위치별 그룹핑·정렬을 동시에 지원한다. 노출기간(startsAt/endsAt) 필터는 애플리케이션 레벨(`isWithinPeriod`)에서 적용하므로 인덱스 대상이 아니다(GAP-007-02 — 향후 DB 푸시다운 시 인덱스 재검토).

---

## 데이터 무결성 규칙

### NOT NULL / DEFAULT

| 테이블 | 컬럼 | 규칙 |
|---|---|---|
| banners | title, imageUrl | NOT NULL |
| banners | position | DEFAULT 'MAIN_TOP' |
| banners | sortOrder | DEFAULT 0 |
| banners | isActive | DEFAULT true |
| banners | createdAt | DEFAULT now() |

> `linkUrl`·`startsAt`·`endsAt` 는 NULLABLE(비링크 배너·즉시/무제한 노출 표현).

### UNIQUE 제약

본 spec 의 `banners` 테이블에는 UNIQUE 제약을 선언하지 않는다(동일 제목·동일 위치 배너가 복수 가능 — 부재가 곧 상태).

### 참조 무결성 (FK)

본 spec 의 `banners` 테이블에는 FK 가 없다(전역 운영 자원, 소유자/외래 참조 개념 없음). cross-schema 참조 컬럼도 없다.

### CHECK 제약

- `sortOrder` 별도 DB CHECK 미선언(Prisma 미지원). 정렬 순서이며 음수 입력은 dto `@IsInt` 만 검증.

### 멱등/원자성 관련

- 배너 update·delete 는 단일 mutation. `findById`(없으면 404) 후 update/delete 호출. 다단계 트랜잭션 미사용. 공개 조회·통계 집계는 read-only.

---

## stats·admin 자체 테이블 부재 명시

stats·admin 모듈은 **자체 소유 트랜잭션 테이블이 없다**.

- **stats**: 플랫폼/판매자 요약은 `OrderService`·`UserService`·`SellerService` 공개 집계 메서드(`count`·`aggregate _sum`·`findMany`) DI 조합으로 산출한다. 집계 결과를 저장하는 캐시·스냅샷 테이블을 도입하지 않는다(ADR-003 — 데이터 중복·정합성 비용 회피). `StatsRepository` 는 빈 클래스다.
- **admin**: 판매자 승인(`SellerService.approve` 재사용)·승인 대기 조회(`listByStatus`)·사용자 목록(`UserService.listUsersForAdmin`)은 도메인 Service DI 경유다. admin 자체 테이블(예: audit log)은 본 spec 범위 외다(GAP-007-01). `AdminRepository` 는 빈 클래스다.

따라서 본 spec 의 DB Design 대상은 `admin.banners` 1테이블 + `BannerPosition` enum 뿐이다.

---

## 금전 필드 부재 명시 (banner)

`banners` 테이블에는 **금전(Decimal) 필드가 존재하지 않는다**(P-005 banner 해당 없음).

- 배너는 제목·이미지·링크·노출 메타(위치·정렬·활성·기간)만 갖는다.
- 단, **stats 모듈의 매출 집계는 P-005 가 적용된다**: `OrderRepository.sumCompletedTotalAmount`(`aggregate _sum.totalAmount`)·`getSellerCompletedSummary`(`unitPrice.mul(quantity)` 누적)·`StatsService.PlatformOverview.totalSales`·`SellerStatsSummary.salesTotal` 는 전부 `Prisma.Decimal` 이다. 이는 기존 003 `orders.totalAmount`(`@db.Decimal(12,2)`)·`order_items.unitPrice` 를 **읽기 집계**하는 것으로, 본 spec 이 신규 금전 필드를 생성하지 않는다.

따라서 P-005 의 `@db.Decimal` 신규 금전 *컬럼* 조항은 banner 테이블에 직접 적용되지 않으며, 매출 *집계* 정확성(Decimal 산술)은 order 도메인의 기존 Decimal 필드를 활용해 충족한다.

---

## 마이그레이션 계획

### 마이그레이션 파일

| 파일 | 위치 | 내용 |
|---|---|---|
| `20260629085122_007_banner_stats_admin/migration.sql` | `apps/backend/prisma/migrations/` | Up: `admin.BannerPosition` enum(MAIN_TOP·MAIN_MIDDLE·MAIN_BOTTOM·SIDEBAR) + `admin.banners` 테이블 + 인덱스 1종(`(isActive, position, sortOrder)`). 006 과 동일하게 단일 spec 마이그레이션이며 타 spec 드리프트 동반 없음. |

> db-design 산출물 SQL 사본은 본 spec 에서 별도 박제하지 않는다. 실제 적용 마이그레이션은 `apps/backend/prisma/migrations/20260629085122_007_banner_stats_admin/migration.sql` 이 SoT 다. 본 폴더의 [migrations/README.md](migrations/README.md) 가 그 경로·요약을 가리킨다(전체 SQL 중복 회피).

### 마이그레이션 순서

1. enum 생성 (`admin.BannerPosition`)
2. `admin.banners` 테이블 생성
3. 인덱스 1종 생성 (`banners(isActive, position, sortOrder)`)

> DOWN 시 역순. 단일 테이블이라 독립 DROP 가능. stats·admin 은 신규 테이블이 없어 마이그레이션 대상 0.

---

## 롤백 전략

### DB 레벨 롤백

마이그레이션 Down 으로 007 테이블·enum 을 제거하여 006 완료 기준으로 복원한다.

```sql
-- Down 실행 순서 (역순 DROP)
DROP TABLE "admin"."banners";
DROP TYPE "admin"."BannerPosition";
```

### 애플리케이션 레벨 롤백

- **비파괴성**: 신규 1테이블(`admin.banners`)이므로 기존 테이블에 영향 없음. stats·admin 은 자체 테이블이 없어 DB 변경 0. 도메인 모듈에 추가된 additive 집계 메서드는 기존 테이블 스키마를 변경하지 않는다.
- **하위 호환성**: schema.prisma 에서 `Banner` 모델·`BannerPosition` enum 제거 후 `prisma generate` 재실행하면 애플리케이션 코드가 007 이전으로 복원 가능(단 banner/stats/admin 모듈 코드 + order/user/seller additive 메서드도 함께 제거 필요).
- **데이터 손실 범위**: Down 실행 시 `banners` 의 모든 데이터 소실. 프로덕션 적용 전 백업 필수.
- **드리프트 없음**: 006 과 동일하게 007 마이그레이션은 단일 spec 산출물로 깔끔하다(타 spec 테이블 동반 캡처 없음).
