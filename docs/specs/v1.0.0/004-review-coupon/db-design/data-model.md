---
작성: Database Design Agent
버전: v1.0
최종 수정: 2026-06-29 14:20
상태: 확정
---

# Data Model: 004-review-coupon

## 목차

- [DB 선택 및 근거](#db-선택-및-근거)
- [엔티티 관계도 (ERD)](#엔티티-관계도-erd)
- [테이블 정의](#테이블-정의)
  - [enum 정의](#enum-정의)
  - [coupons](#coupons)
  - [user_coupons](#user_coupons)
  - [reviews](#reviews)
- [인덱스 전략](#인덱스-전략)
- [데이터 무결성 규칙](#데이터-무결성-규칙)
- [마이그레이션 계획](#마이그레이션-계획)
- [롤백 전략](#롤백-전략)

---

## DB 선택 및 근거

- **DB**: PostgreSQL 16 — 단일 인스턴스(P-003, context.md §1). 기존 003-commerce 와 동일 DB 인스턴스·Prisma multiSchema 구조를 승계한다.
- **스키마**: `commerce` — 기존 `carts` 테이블과 같은 스키마. plan.md P-001 모듈 경계 원칙에 따라 `coupon`·`review` 모듈은 `commerce` 스키마 자기 테이블에만 Prisma 쿼리를 발행한다.
- **ORM**: Prisma `^6.19.0` multiSchema — `@@schema("commerce")` 태그로 스키마 분리.
- **cross-schema 참조 전략**: `users`·`orders`·`products` 스키마 테이블은 plain String 필드로만 참조하고 Prisma `@relation` 미선언(P-001·ADR-001·003 패턴 승계). 동일 `commerce` 스키마 내 FK(`user_coupons.couponId → coupons.id`)만 정식 선언한다.
- **금전 필드 타입**: `Decimal @db.Decimal(12,2)` 전용(P-005·NFR-001). `Float` 미사용. 할인 계산 중간 과정도 `Prisma.Decimal` 산술만 허용.

---

## 엔티티 관계도 (ERD)

도메인 용어는 context.md §5 용어 사전 기준으로 사용한다.

```
[commerce 스키마]

Coupon (coupons)
  │  id PK
  │  issuerType: CouponIssuerType  — 발급자 유형(ADMIN / SELLER)
  │  issuerId: String              — 발급자 ID (plain String, cross-schema: admin userId | seller.id)
  │  type: CouponType              — 할인 유형(FIXED / PERCENTAGE)
  │  discountValue: Decimal(12,2)  — 할인 금액 또는 할인율
  │  maxDiscountAmount: Decimal?   — PERCENTAGE 전용 상한
  │  minOrderAmount: Decimal?      — 최소 주문 금액
  │  expiresAt: DateTime           — 만료 일시
  │  totalQuantity: Int?           — 발급 한도 (null = 무제한)
  │  issuedCount: Int              — 현재 발급 수 (조건부 increment 가드, ADR-004)
  │  description: String?
  │  createdAt: DateTime
  │
  ├──1:N──▶ UserCoupon (user_coupons)
              id PK
              couponId FK → coupons.id  (동일 스키마 정식 FK, ON DELETE CASCADE)
              userId: String            (plain String, cross-schema: users.users.id)
              status: UserCouponStatus  — unused | used | expired
              usedOrderId: String?      (plain String, cross-schema: orders.orders.id)
              createdAt: DateTime

Review (reviews)
  id PK
  orderItemId: String @unique  (plain String, cross-schema: orders.order_items.id — 1 orderItem 1 리뷰 DB 보장)
  orderId: String              (plain String, cross-schema: orders.orders.id)
  userId: String               (plain String, cross-schema: users.users.id)
  productId: String            (plain String, cross-schema: products.products.id)
  sellerId: String             (plain String, cross-schema: users.sellers.id)
  rating: Int                  — 1~5 (앱 레벨 DTO 검증)
  content: String
  createdAt: DateTime
  updatedAt: DateTime @updatedAt

[cross-schema 의존 (plain String, FK 미선언)]
coupons.issuerId        → users.users.id (ADMIN) | users.sellers.id (SELLER)
user_coupons.userId     → users.users.id
user_coupons.usedOrderId→ orders.orders.id
reviews.orderItemId     → orders.order_items.id
reviews.orderId         → orders.orders.id
reviews.userId          → users.users.id
reviews.productId       → products.products.id
reviews.sellerId        → users.sellers.id
```

---

## 테이블 정의

### enum 정의

모두 `@@schema("commerce")` 태그 적용. Prisma 네이티브 enum 선언.

| enum | 값 | 근거 |
|---|---|---|
| `CouponIssuerType` | `ADMIN`, `SELLER` | FR-001(관리자 생성)·FR-002(판매자 생성). issuerType으로 발급자 유형 구분, issuerId로 실제 식별자 저장(ADR-010) |
| `CouponType` | `FIXED`, `PERCENTAGE` | FR-001(할인 유형). FIXED = 정액 할인, PERCENTAGE = 비율 할인(1~100%). 할인 계산 분기 기준(FR-012·ADR-005) |
| `UserCouponStatus` | `unused`, `used`, `expired` | FR-005 조회 필터·FR-011(a) 유효성 검증 기준. `used` 는 주문 생성 트랜잭션 내 조건부 UPDATE로 전이(ADR-002·FR-013). `expired` 는 조회 목적 저장 status(사용 시점 만료는 항상 expiresAt 동적 비교 — plan §기타 고려사항) |

### coupons

발급자(관리자·판매자)가 생성하는 쿠폰 마스터 레코드.

| 컬럼명 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | String | PK, `@default(cuid())` | 쿠폰 ID |
| `issuerType` | CouponIssuerType | NOT NULL | 발급자 유형. ADMIN: 관리자 발급(issuerId=admin userId). SELLER: 판매자 발급(issuerId=seller.id) |
| `issuerId` | String | NOT NULL | 발급자 식별자 — plain String (cross-schema: admin userId 또는 sellers.id, P-001) |
| `type` | CouponType | NOT NULL | 할인 유형(FIXED·PERCENTAGE) |
| `discountValue` | Decimal(12,2) | NOT NULL | FIXED: 할인 금액(원). PERCENTAGE: 할인율(1~100, 정수로 보관) |
| `maxDiscountAmount` | Decimal(12,2) | NULL 허용 | PERCENTAGE 전용 최대 할인 금액 상한. FIXED 쿠폰에는 의미 없음(무시, plan §핵심 설계 §1) |
| `minOrderAmount` | Decimal(12,2) | NULL 허용 | 최소 주문 금액 조건. NULL이면 조건 없음 |
| `expiresAt` | DateTime | NOT NULL | 만료 일시. 주문 시점 `expiresAt <= now`이면 422(FR-011c) |
| `totalQuantity` | Int | NULL 허용 | 발급 한도. NULL이면 무제한(FR-003) |
| `issuedCount` | Int | NOT NULL, DEFAULT 0 | 현재 발급 건수. 한도 가드를 위한 카운터(ADR-004). `$executeRaw` 조건부 increment로만 갱신 |
| `description` | String | NULL 허용 | 쿠폰 설명 |
| `createdAt` | DateTime | NOT NULL, `@default(now())` | 생성 일시 |

> **issuedCount 설계 근거(ADR-004)**: Prisma `updateMany`의 `where` 절은 상수 비교만 지원하며 컬럼-컬럼 비교(`issuedCount < totalQuantity`)를 지원하지 않는다. 따라서 발급 한도 원자 가드는 `$executeRaw` parameterized SQL로 수행한다. 발급 후 user_coupon 삭제 경로가 없으므로 issuedCount와 실제 user_coupon 수는 일치를 유지한다.

```prisma
model Coupon {
  id                String           @id @default(cuid())
  issuerType        CouponIssuerType
  /// cross-schema plain String — admin userId 또는 users.sellers.id (P-001 경계)
  issuerId          String
  type              CouponType
  /// 금전 필드 — 부동소수점 금지 (P-005, NFR-001)
  discountValue     Decimal          @db.Decimal(12, 2)
  /// 금전 필드 — PERCENTAGE 전용 최대 할인 상한 (P-005)
  maxDiscountAmount Decimal?         @db.Decimal(12, 2)
  /// 금전 필드 — 최소 주문 금액 조건 (P-005)
  minOrderAmount    Decimal?         @db.Decimal(12, 2)
  expiresAt         DateTime
  totalQuantity     Int?
  /// 조건부 increment 가드 — $executeRaw 전용. updateMany 컬럼-컬럼 비교 미지원으로 raw SQL 필수 (ADR-004)
  issuedCount       Int              @default(0)
  description       String?
  createdAt         DateTime         @default(now())
  userCoupons       UserCoupon[]

  /// 판매자 쿠폰 조회 (FR-006: GET /sellers/me/coupons) + 발급자 소유권 검증
  @@index([issuerType, issuerId])
  @@map("coupons")
  @@schema("commerce")
}
```

### user_coupons

고객에게 발급된 쿠폰 인스턴스(발급 레코드). 쿠폰 마스터(coupons)와 1:N 관계.

| 컬럼명 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | String | PK, `@default(cuid())` | 발급 ID |
| `couponId` | String | NOT NULL, FK → coupons.id | 발급된 쿠폰. 동일 commerce 스키마 내 정식 FK(ON DELETE CASCADE) |
| `userId` | String | NOT NULL | 보유 고객 ID — plain String (cross-schema: users.users.id, P-001) |
| `status` | UserCouponStatus | NOT NULL, DEFAULT unused | 쿠폰 상태. 조건부 UPDATE(`WHERE status='unused'`)로만 `used`로 전이(ADR-002·FR-013) |
| `usedOrderId` | String | NULL 허용 | 사용된 주문 ID — plain String (cross-schema: orders.orders.id, P-001). 복원 조회 인덱스 대상(FR-016) |
| `createdAt` | DateTime | NOT NULL, `@default(now())` | 발급 일시 |

```prisma
model UserCoupon {
  id          String           @id @default(cuid())
  couponId    String
  /// cross-schema plain String — users.users.id (P-001 경계)
  userId      String
  status      UserCouponStatus @default(unused)
  /// cross-schema plain String — orders.orders.id. 복원 조회용 (FR-016, P-001 경계)
  usedOrderId String?
  createdAt   DateTime         @default(now())
  coupon      Coupon           @relation(fields: [couponId], references: [id], onDelete: Cascade)

  /// 내 쿠폰 조회 필터 (FR-005: GET /users/me/coupons?status=...)
  @@index([userId, status])
  /// 주문 취소 시 쿠폰 복원 조회 (FR-016: WHERE usedOrderId=orderId)
  @@index([usedOrderId])
  @@map("user_coupons")
  @@schema("commerce")
}
```

### reviews

구매 완료 주문의 주문항목(orderItem) 단위 리뷰. `orderItemId @unique`로 1 orderItem 1 리뷰를 DB 수준에서 보장(ADR-009).

| 컬럼명 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | String | PK, `@default(cuid())` | 리뷰 ID |
| `orderItemId` | String | NOT NULL, UNIQUE | 리뷰 대상 주문항목 — plain String (cross-schema: orders.order_items.id). `@unique`으로 1 orderItem 1 리뷰 DB 제약(FR-021c·ADR-009) |
| `orderId` | String | NOT NULL | 주문 ID — plain String (cross-schema: orders.orders.id, P-001) |
| `userId` | String | NOT NULL | 작성자 고객 ID — plain String (cross-schema: users.users.id, P-001) |
| `productId` | String | NOT NULL | 상품 ID — plain String (cross-schema: products.products.id, P-001). 상품별 리뷰 조회(FR-025) |
| `sellerId` | String | NOT NULL | 판매자 ID — plain String (cross-schema: users.sellers.id, P-001). 향후 자기 상품 리뷰 제한 정책 지원 |
| `rating` | Int | NOT NULL | 평점(1~5). DB CHECK 제약 미선언 — DTO `@IsInt @Min(1) @Max(5)` 앱 레벨 검증(FR-022·SC-034) |
| `content` | String | NOT NULL | 리뷰 본문 |
| `createdAt` | DateTime | NOT NULL, `@default(now())` | 작성 일시 |
| `updatedAt` | DateTime | NOT NULL, `@updatedAt` | 수정 일시 (Prisma 자동 갱신) |

> **rating DB CHECK 미선언 근거**: Prisma는 현재 `@db.Check` 제약을 공식 지원하지 않는다. 1~5 범위 검증은 DTO `@IsInt @Min(1) @Max(5)` + 전역 `ValidationPipe`가 담당하며(FR-022·SC-034), raw SQL 삽입 경로가 없으므로 앱 레벨 검증으로 충분하다.

```prisma
model Review {
  /// cross-schema plain String — orders.order_items.id. @unique 으로 1 orderItem 1 리뷰 DB 보장 (FR-021c, ADR-009)
  orderItemId String   @unique
  /// cross-schema plain String — orders.orders.id (P-001 경계)
  orderId     String
  /// cross-schema plain String — users.users.id (P-001 경계)
  userId      String
  /// cross-schema plain String — products.products.id. 상품별 리뷰 조회 (FR-025, P-001 경계)
  productId   String
  /// cross-schema plain String — users.sellers.id (P-001 경계)
  sellerId    String
  /// 앱 레벨 @Min(1) @Max(5) 검증 (FR-022). DB CHECK 미선언: Prisma 미지원
  rating      Int
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  id          String   @id @default(cuid())

  /// 상품별 리뷰 cursor 페이지네이션 (FR-025: GET /products/:productId/reviews, 최신순)
  @@index([productId, createdAt(sort: Desc), id(sort: Desc)])
  /// 내 리뷰 cursor 페이지네이션 (FR-026: GET /reviews/me)
  @@index([userId, createdAt(sort: Desc), id(sort: Desc)])
  @@map("reviews")
  @@schema("commerce")
}
```

---

## 인덱스 전략

| 인덱스 | 대상 테이블 | 컬럼 | 목적 | 관련 FR |
|---|---|---|---|---|
| `coupons_issuerType_issuerId_idx` | coupons | `(issuerType, issuerId)` | 판매자 자기 쿠폰 목록 조회 · 발급자 소유권 검증 | FR-006·FR-004·FR-009 |
| `user_coupons_userId_status_idx` | user_coupons | `(userId, status)` | 내 쿠폰 조회 status 필터 (`?status=unused|used|expired|all`) | FR-005·SC-010 |
| `user_coupons_usedOrderId_idx` | user_coupons | `(usedOrderId)` | 주문 취소 시 쿠폰 복원 (`WHERE usedOrderId=orderId`) | FR-016·SC-023 |
| `reviews_productId_createdAt_id_idx` | reviews | `(productId, createdAt DESC, id DESC)` | 상품별 리뷰 최신순 cursor 페이지네이션 | FR-025·SC-039 |
| `reviews_userId_createdAt_id_idx` | reviews | `(userId, createdAt DESC, id DESC)` | 내 리뷰 cursor 페이지네이션 | FR-026·SC-040 |

**선택 근거**:
- `(userId, status)` 복합 인덱스: FR-005 조회가 항상 `WHERE userId=? AND status=?` 패턴이므로 복합 인덱스가 단일 인덱스보다 효율적. `all` 필터 시에는 `WHERE userId=?` 만으로도 인덱스 앞 컬럼 사용 가능.
- `(productId, createdAt DESC, id DESC)` cursor 인덱스: 최신순 정렬 + id 타이브레이커 포함. cursor 기반 페이지네이션의 `WHERE productId=? AND (createdAt, id) < (cursor_createdAt, cursor_id)` 패턴을 인덱스 스캔으로 처리.
- `usedOrderId` 단일 인덱스: `restoreForOrder(orderId)`가 `WHERE usedOrderId=?` 단일 조건이므로 단일 컬럼 인덱스로 충분.

**멱등·동시성 인덱스 지원**:
- `user_coupons.status` 조건부 UPDATE(`WHERE id=? AND status='unused'`)는 PK(`id`) 조회 → row 수준 락이므로 별도 인덱스 불필요.
- `reviews.orderItemId @unique` — 중복 리뷰 시도 시 PostgreSQL unique 제약이 P2002를 발생시켜 동시 insert race 방지(ADR-009).

---

## 데이터 무결성 규칙

### NOT NULL / DEFAULT

| 테이블 | 컬럼 | 규칙 |
|---|---|---|
| coupons | issuerType, issuerId, type, discountValue, expiresAt | NOT NULL |
| coupons | issuedCount | DEFAULT 0 |
| user_coupons | couponId, userId | NOT NULL |
| user_coupons | status | DEFAULT 'unused' |
| reviews | orderItemId, orderId, userId, productId, sellerId, rating, content | NOT NULL |

### UNIQUE 제약

| 테이블 | 컬럼 | 근거 |
|---|---|---|
| reviews | orderItemId | 1 orderItem 1 리뷰 — 두 번째 insert 시 P2002 → 409(FR-021c·ADR-009·SC-033) |

### 참조 무결성 (FK)

| 테이블 | FK 컬럼 | 참조 | ON DELETE | 근거 |
|---|---|---|---|---|
| user_coupons | couponId | `commerce.coupons.id` | CASCADE | 쿠폰 삭제 시 발급 인스턴스도 삭제(현재 쿠폰 삭제 API 없음 — 향후 대비) |

> **cross-schema 참조 무결성 부재**: `user_coupons.userId`·`usedOrderId`·`reviews.*Id`(6개 plain String 필드)는 DB FK 미선언(P-001·ADR-001·003 패턴 승계). 고아 레코드 방지는 앱 레벨 서비스 DI 경계로 관리.

### CHECK 제약

- `reviews.rating` 1~5 범위: DTO `@IsInt @Min(1) @Max(5)` 앱 레벨 강제(Prisma DB CHECK 미지원·raw SQL 삽입 경로 없음).
- `coupons.discountValue` 양수·PERCENTAGE 1~100: 쿠폰 생성 서비스 + DTO 레벨 검증.

### 롤백 관련 무결성

- 쿠폰 사용(`markUsed`)은 주문 생성 `runInTransaction` 내 단일 원자 연산. 주문 실패 시 `user_coupon.status=unused` 자동 복원(ROLLBACK).
- 주문 취소 시 `restoreForOrder(orderId)` — `WHERE usedOrderId=orderId AND status='used'` 조건부 UPDATE. 쿠폰 미적용 주문은 count=0 no-op.

---

## 마이그레이션 계획

### 마이그레이션 파일

| 파일 | 위치 | 내용 |
|---|---|---|
| `20260629000000_004_commerce_coupon_review.sql` | `db-design/migrations/` | Up: 3 enum + 3 table + FK + unique + 5 index. Down: 역순 DROP |

Prisma 마이그레이션을 직접 실행하는 형태로는 `prisma migrate dev --name 004_commerce_coupon_review` 를 사용한다. 본 spec의 SQL 파일은 DB Design Agent 산출물로 Development Agent가 schema.prisma에 반영 후 `prisma migrate dev`를 실행하면 Prisma가 마이그레이션 파일을 자동 생성한다.

> **schema.prisma 반영 대상**: `apps/backend/prisma/schema.prisma` commerce 스키마 섹션에 3 enum + 3 model 추가.

### 마이그레이션 순서

1. enum 3종 생성 (`CouponIssuerType`, `CouponType`, `UserCouponStatus`)
2. `coupons` 테이블 생성
3. `user_coupons` 테이블 생성 (couponId FK → coupons.id)
4. `reviews` 테이블 생성
5. 인덱스 5종 생성

> DOWN 시 역순 (인덱스 → table → enum). `user_coupons`는 `coupons` 참조 FK가 있으므로 `coupons` 보다 먼저 DROP.

---

## 롤백 전략

### DB 레벨 롤백 (마이그레이션 실패 시)

마이그레이션 파일의 Down 섹션을 실행하여 상태를 003-commerce 이후 기준으로 복원한다.

```sql
-- Down 실행 순서 (역순 DROP)
DROP INDEX "commerce"."reviews_userId_createdAt_id_idx";
DROP INDEX "commerce"."reviews_productId_createdAt_id_idx";
DROP INDEX "commerce"."user_coupons_usedOrderId_idx";
DROP INDEX "commerce"."user_coupons_userId_status_idx";
DROP INDEX "commerce"."coupons_issuerType_issuerId_idx";
DROP TABLE "commerce"."reviews";
DROP TABLE "commerce"."user_coupons";
DROP TABLE "commerce"."coupons";
DROP TYPE "commerce"."UserCouponStatus";
DROP TYPE "commerce"."CouponType";
DROP TYPE "commerce"."CouponIssuerType";
```

### 애플리케이션 레벨 롤백

- **비파괴성**: 신규 3테이블이므로 기존 19테이블(carts·orders·payments 등)에 영향 없음. Down 실행 시 기존 `commerce.carts` 및 타 스키마 테이블 보존.
- **하위 호환성**: Prisma schema.prisma에서 신규 모델 3개를 제거하고 `prisma generate` 재실행하면 애플리케이션 코드가 기존 상태로 복원 가능.
- **데이터 손실 범위**: Down 실행 시 `coupons`·`user_coupons`·`reviews` 테이블의 모든 데이터 소실. 프로덕션 적용 전 백업 필수.
- **롤백 불가 시나리오**: 운영 환경에서 쿠폰 발급·리뷰가 이미 생성된 상태라면 Down 실행 전 데이터 백업 후 별도 hotfix spec 처리.
