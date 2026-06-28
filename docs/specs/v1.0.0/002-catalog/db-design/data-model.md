---
작성: Database Design Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# Data Model: 002-catalog

## 목차

- [DB 선택 및 근거](#db-선택-및-근거)
- [엔티티 관계도 (ERD)](#엔티티-관계도-erd)
- [테이블 정의](#테이블-정의)
  - [users 스키마](#users-스키마)
  - [products 스키마](#products-스키마)
- [인덱스 전략](#인덱스-전략)
- [데이터 무결성 규칙](#데이터-무결성-규칙)
- [마이그레이션 계획](#마이그레이션-계획)
- [롤백 전략](#롤백-전략)
- [카테고리 seed 데이터](#카테고리-seed-데이터)

---

## DB 선택 및 근거

- **DB**: PostgreSQL 16 (단일 인스턴스, Fly Postgres) — constitution P-003(단일 DB 원칙)
- **스키마 분리**: Prisma multiSchema GA (Prisma ^6.19.0, previewFeatures 불필요)
- **기존 확정 스택 그대로 재확정** — 001-skeleton-bootstrap 에서 PostgreSQL + Prisma multiSchema 검증 완료

---

## 엔티티 관계도 (ERD)

```
users 스키마
═══════════════════════════════════════════════════════════════

  users                 sellers                 addresses
  ─────                 ───────                 ─────────
  id (PK)  ◄──────────  userId (FK)             id (PK)
  email               ◄──────────               userId (FK) ──► users.id
  password            wishlists               recipientName
  name?               ─────────               phone
  phone?              id (PK)                 zipCode
  createdAt           userId (FK) ──► users.id address1
                      productId* [plain String] address2?
                      createdAt               isDefault
                                              createdAt

                      product_views
                      ─────────────
                      id (PK)
                      userId (FK) ──► users.id
                      productId* [plain String]
                      viewedAt

  * cross-schema 경계 — FK 미선언, plain String (ADR-001, P-001)

products 스키마
═══════════════════════════════════════════════════════════════

  categories           products                product_images
  ──────────           ────────                ──────────────
  id (PK)  ◄─────────  categoryId (FK)         id (PK)
  name               ◄──────────               productId (FK) ──► products.id
  slug                 id (PK)                 url
  displayOrder         sellerId† [plain String] displayOrder
                       title
                       description?
                       price Decimal(12,2)
                       status (enum)
                       createdAt

  variants             inventory               inventory_logs
  ────────             ─────────               ──────────────
  id (PK)  ◄─────────  variantId (FK, unique)  id (PK)
  productId (FK)       productId (FK)           variantId [plain String]†
           ──► products.id  ──► products.id     productId [plain String]†
  optionName           quantity Int             type (enum)
  optionValue          (재고 소유 — ADR-003)   delta Int
  sku (unique)                                  orderId?
  price Decimal(12,2)                           createdAt

  † cross-schema 경계 없음 — products 스키마 내부.
    inventory_logs 는 variantId/productId를 plain String으로 두는 이유:
    append-only 이력 테이블이므로 참조 무결성보다 이력 보존 우선 (ADR-003).
    실제로는 동일 스키마이므로 FK 선언도 가능하나,
    로그 레코드 삭제 방지를 위해 ON DELETE CASCADE 미사용 → 의도적 plain String.

cross-schema 참조 요약 (P-001 / NFR-003 / SC-049):
  wishlists.productId      ──► [products.products.id] — plain String
  product_views.productId  ──► [products.products.id] — plain String
  products.sellerId        ──► [users.sellers.id]     — plain String
```

---

## 테이블 정의

### users 스키마

#### users (기존 테이블 확장)

> 기존 `users.users` 테이블에 `name`·`phone` nullable 컬럼 추가 (ADR-013).
> additive 변경 — 기존 auth 32개 테스트 회귀 없음.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | PK, @default(cuid()) | 사용자 ID |
| email | String | UNIQUE, NOT NULL | 이메일 (로그인 키) |
| password | String | NOT NULL | bcrypt 해시 |
| name | String? | NULL 허용 | 실명 (FR-001·002) |
| phone | String? | NULL 허용 | 연락처 (FR-001·002) |
| createdAt | DateTime | NOT NULL, @default(now()) | 생성일시 |

#### sellers

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | PK, @default(cuid()) | 판매자 ID |
| userId | String | NOT NULL, FK→users.id ON DELETE CASCADE | 사용자 참조 |
| businessName | String | NOT NULL | 사업자명 |
| businessNumber | String | NOT NULL | 사업자등록번호 |
| representativeName | String | NOT NULL | 대표자명 |
| contactPhone | String? | NULL 허용 | 연락처 |
| businessAddress | String? | NULL 허용 | 사업장 주소 |
| status | SellerStatus | NOT NULL, DEFAULT 'PENDING' | 심사 상태 |
| rejectReason | String? | NULL 허용 | 거부 사유 (REJECTED 시) |
| createdAt | DateTime | NOT NULL, @default(now()) | 신청일시 |

- **UNIQUE**: `(userId)` — 사용자당 판매자 등록 1건 (SC-013 중복 409)
- **enum SellerStatus**: `PENDING`, `APPROVED`, `REJECTED`

#### addresses

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | PK, @default(cuid()) | 배송지 ID |
| userId | String | NOT NULL, FK→users.id ON DELETE CASCADE | 사용자 참조 |
| recipientName | String | NOT NULL | 수령인명 |
| phone | String | NOT NULL | 수령인 연락처 |
| zipCode | String | NOT NULL | 우편번호 |
| address1 | String | NOT NULL | 기본 주소 |
| address2 | String? | NULL 허용 | 상세 주소 |
| isDefault | Boolean | NOT NULL, DEFAULT false | 기본 배송지 여부 |
| createdAt | DateTime | NOT NULL, @default(now()) | 생성일시 |

- **INDEX**: `(userId)` — 사용자 배송지 목록 조회 최적화 (FR-003~006)

#### wishlists

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | PK, @default(cuid()) | 찜 ID |
| userId | String | NOT NULL, FK→users.id ON DELETE CASCADE | 사용자 참조 |
| productId | String | NOT NULL | 상품 ID (cross-schema plain String, FK 미선언) |
| createdAt | DateTime | NOT NULL, @default(now()) | 찜 일시 |

- **UNIQUE**: `(userId, productId)` — 중복 찜 방지 (SC-008 409)
- productId FK 미선언 이유: users↔products cross-schema 경계 (ADR-001, P-001). DB 레벨 참조 무결성 포기 허용 (research.md §인정되는 한계)

#### product_views

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | PK, @default(cuid()) | 조회 기록 ID |
| userId | String | NOT NULL, FK→users.id ON DELETE CASCADE | 사용자 참조 |
| productId | String | NOT NULL | 상품 ID (cross-schema plain String, FK 미선언) |
| viewedAt | DateTime | NOT NULL, @default(now()) | 최근 조회 일시 (upsert 시 갱신) |

- **UNIQUE**: `(userId, productId)` — upsert 멱등성 보장 (FR-009)
- **INDEX**: `(userId, viewedAt DESC)` — 최근 본 상품 최신순 조회 최적화 (FR-010, SC-012)
- productId FK 미선언 이유: wishlists 와 동일 (ADR-001)

---

### products 스키마

#### categories

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | PK, @default(cuid()) | 카테고리 ID |
| name | String | NOT NULL | 카테고리명 |
| slug | String | UNIQUE, NOT NULL | URL 슬러그 |
| displayOrder | Int | NOT NULL, DEFAULT 0 | 표시 순서 |

- seed 데이터로 초기 카테고리 삽입 (ADR-010). 카테고리 생성 API 범위 외 (admin 모듈).

#### products

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | PK, @default(cuid()) | 상품 ID |
| sellerId | String | NOT NULL | 판매자 ID (cross-schema plain String, FK 미선언) |
| categoryId | String | NOT NULL, FK→categories.id ON DELETE RESTRICT | 카테고리 참조 |
| title | String | NOT NULL | 상품명 |
| description | String? | NULL 허용 | 상품 설명 |
| price | Decimal(12,2) | NOT NULL | 판매가 (P-005, NFR-004, SC-050) |
| status | ProductStatus | NOT NULL, DEFAULT 'DRAFT' | 상품 상태 |
| createdAt | DateTime | NOT NULL, @default(now()) | 등록일시 |

- **INDEX**: `(status, createdAt DESC, id DESC)` — cursor 페이지네이션 + status 필터 (NFR-001, ADR-007)
- sellerId FK 미선언 이유: users.sellers↔products.products cross-schema 경계 (ADR-001, P-001)
- price Decimal(12,2): 정수부 10자리 + 소수부 2자리 (최대 9,999,999,999.99원)
- **enum ProductStatus**: `DRAFT`, `ACTIVE`, `OUT_OF_STOCK`, `INACTIVE`

#### product_images

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | PK, @default(cuid()) | 이미지 ID |
| productId | String | NOT NULL, FK→products.id ON DELETE CASCADE | 상품 참조 |
| url | String | NOT NULL | 이미지 URL |
| displayOrder | Int | NOT NULL, DEFAULT 0 | 표시 순서 |

- **INDEX**: `(productId)` — 상품별 이미지 목록 조회
- 앱 레벨 제한: 상품당 최대 10개 (ADR-011, SC-036). DB 트리거 미사용 (앱 레벨 count 검사)

#### variants

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | PK, @default(cuid()) | variant ID |
| productId | String | NOT NULL, FK→products.id ON DELETE CASCADE | 상품 참조 |
| optionName | String | NOT NULL | 옵션명 (예: "색상") |
| optionValue | String | NOT NULL | 옵션값 (예: "빨강") |
| sku | String | UNIQUE, NOT NULL | SKU 코드 |
| price | Decimal(12,2) | NOT NULL | variant 가격 (P-005, NFR-004) |

- **stock 컬럼 없음** — 재고는 inventory 모듈 소유 (ADR-003)
- **INDEX**: `(productId)` — 상품별 variant 목록 조회
- **UNIQUE**: `(sku)` — SKU 고유성 보장

#### inventory

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | PK, @default(cuid()) | 재고 ID |
| variantId | String | NOT NULL, FK→variants.id ON DELETE CASCADE | variant 참조 |
| productId | String | NOT NULL, FK→products.id ON DELETE CASCADE | 상품 참조 (합산용, ADR-003) |
| quantity | Int | NOT NULL, DEFAULT 0 | 현재 재고 수량 |

- **UNIQUE**: `(variantId)` — variant당 재고 1행 (1:1 관계)
- **INDEX**: `(productId)` — 상품 총재고 합산 (`sumQuantityByProduct`, FR-023/024)
- productId 보유 이유: inventory 모듈 내부에서 상품 총재고 합산 계산용 (FR-023/024 이벤트 payload 생성). products 스키마 동일 테이블 FK 선언.

#### inventory_logs

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | PK, @default(cuid()) | 로그 ID |
| variantId | String | NOT NULL | variant ID (plain String, FK 미선언) |
| productId | String | NOT NULL | 상품 ID (plain String, FK 미선언) |
| type | InventoryLogType | NOT NULL | 로그 유형 |
| delta | Int | NOT NULL | 변동 수량 (양수: 입고, 음수: 차감) |
| orderId | String? | NULL 허용 | 주문 ID (DECREASE 시 003에서 전달) |
| createdAt | DateTime | NOT NULL, @default(now()) | 기록 일시 |

- **append-only**: UPDATE·DELETE 문 미포함. 이력 수정·삭제 API 미노출 (FR-032, SC-043).
- **INDEX**: `(variantId, createdAt DESC)` — variant별 이력 조회 최적화
- variantId/productId FK 미선언 이유: append-only 이력 보존 우선. variant/product 삭제 시에도 이력은 보존되어야 하므로 CASCADE 적용 불가. 의도적 plain String.
- **enum InventoryLogType**: `STOCK_IN`, `DECREASE`, `INIT`

---

## 인덱스 전략

| 테이블 | 인덱스 | 목적 | 관련 쿼리 |
|---|---|---|---|
| `products.products` | `(status, createdAt DESC, id DESC)` | cursor 페이지네이션 + status 필터 | FR-027, NFR-001, SC-038·047 |
| `users.addresses` | `(userId)` | 사용자 배송지 목록 | FR-003~006 |
| `users.product_views` | `(userId, viewedAt DESC)` | 최근 본 상품 최신순 | FR-010, SC-012 |
| `products.product_images` | `(productId)` | 상품 이미지 목록 | FR-026 |
| `products.variants` | `(productId)` | 상품 variant 목록 | FR-025 |
| `products.inventory` | `(productId)` | 상품 총재고 합산 | FR-023/024 |
| `products.inventory_logs` | `(variantId, createdAt DESC)` | variant 이력 조회 | FR-032 |

**UNIQUE 제약 (인덱스 겸용)**:

| 테이블 | UNIQUE | 목적 |
|---|---|---|
| `users.sellers` | `(userId)` | 판매자 중복 등록 방지 (SC-013) |
| `users.wishlists` | `(userId, productId)` | 찜 중복 방지 (SC-008) |
| `users.product_views` | `(userId, productId)` | 조회 기록 upsert 멱등성 |
| `products.variants` | `(sku)` | SKU 고유성 |
| `products.inventory` | `(variantId)` | variant당 재고 1행 |
| `products.categories` | `(slug)` | 슬러그 고유성 |

---

## 데이터 무결성 규칙

### cross-schema 경계 (P-001 / NFR-003 / SC-049)

- `wishlists.productId`, `product_views.productId` → `products.products.id` 참조: **plain String, FK 미선언**
- `products.sellerId` → `users.sellers.id` 참조: **plain String, FK 미선언**
- Prisma `@relation` 미선언 → ORM 차원의 cross-schema JOIN 미생성 (SC-049 구조적 보장)
- 고아 레코드 허용 (삭제된 상품을 찜한 경우 등) — research.md §인정되는 한계 참조

### 동일 스키마 내 참조 무결성

| 관계 | ON DELETE | 이유 |
|---|---|---|
| sellers → users | CASCADE | 사용자 삭제 시 판매자 정보도 삭제 |
| addresses → users | CASCADE | 사용자 삭제 시 배송지도 삭제 |
| wishlists → users | CASCADE | 사용자 삭제 시 찜 목록도 삭제 |
| product_views → users | CASCADE | 사용자 삭제 시 조회 기록도 삭제 |
| products → categories | RESTRICT | 카테고리 삭제 시 상품 있으면 에러 (데이터 정합성) |
| product_images → products | CASCADE | 상품 삭제 시 이미지도 삭제 |
| variants → products | CASCADE | 상품 삭제 시 variant도 삭제 |
| inventory → variants | CASCADE | variant 삭제 시 재고 행도 삭제 |
| inventory → products | CASCADE | 상품 삭제 시 재고 집계 행도 삭제 |

### inventory_logs append-only (FR-032 / SC-043)

- inventory_logs 테이블에 대한 UPDATE·DELETE SQL 문 미작성
- InventoryRepository에 log 수정/삭제 메서드 미존재 (정적 검증 대상)
- 컨트롤러에 로그 수정/삭제 라우트 미노출

### 금전 필드 (P-005 / NFR-004 / SC-050)

- `products.price`: `Decimal(12,2)` — 부동소수점 금지
- `variants.price`: `Decimal(12,2)` — 부동소수점 금지
- Prisma `@db.Decimal(12,2)` 명시로 DB 레벨 타입 보장

### 재고 수량 음수 방지

- `inventory.quantity`: `Int @default(0)` — 조건부 감소 (`WHERE quantity >= qty`) 로 음수 불가 (ADR-005)
- DB CHECK 제약 대신 앱 레벨 조건부 감소로 원자성 보장

---

## 마이그레이션 계획

### 순서

| 마이그레이션 | 파일명 | 내용 |
|---|---|---|
| 001 (기존) | `20260628000001_init/migration.sql` | users 스키마 User + RefreshToken (001-skeleton-bootstrap 완료) |
| **002 (신규)** | `20260628000002_users_schema_extension.sql` | User ALTER (name·phone) + SellerStatus enum + sellers·addresses·wishlists·product_views |
| **003 (신규)** | `20260628000003_products_schema_extension.sql` | ProductStatus·InventoryLogType enum + categories·products·product_images·variants·inventory·inventory_logs + 카테고리 seed |

### 주의사항

- `CREATE SCHEMA` 불필요 — `users`·`products` 스키마 이미 존재 (001에서 선언됨)
- 002 마이그레이션: `users.users` 테이블에 `ALTER TABLE ADD COLUMN IF NOT EXISTS` 사용 — 기존 행 유지
- enum은 PostgreSQL `CREATE TYPE ... AS ENUM` 사용 (스키마 한정)
- 인덱스는 마이그레이션 SQL 내에 `CREATE INDEX IF NOT EXISTS` 포함

---

## 롤백 전략

각 마이그레이션 파일은 Up/Down 쌍으로 제공된다.

### 마이그레이션 002 롤백 (Down)

1. `product_views`, `wishlists`, `addresses`, `sellers` 테이블 DROP
2. `SellerStatus` enum type DROP
3. `users.users` 테이블에서 `name`, `phone` 컬럼 DROP

**주의**: 기존 데이터(name/phone 입력된 사용자, 등록된 판매자/배송지) 유실. 운영 환경 롤백 전 데이터 백업 필수.

### 마이그레이션 003 롤백 (Down)

1. `inventory_logs`, `inventory`, `variants`, `product_images`, `products`, `categories` 테이블 DROP
2. `ProductStatus`, `InventoryLogType` enum type DROP

**주의**: 등록된 상품·재고·이력 전체 유실. 운영 환경에서는 복구 불가한 데이터 손실이므로 Up 마이그레이션 적용 전 충분한 검증 필수.

---

## 카테고리 seed 데이터

마이그레이션 003 (Up) 끝에 포함되는 기본 카테고리 데이터 (ADR-010, GAP-001 해소):

| displayOrder | slug | name |
|---|---|---|
| 1 | electronics | 전자기기 |
| 2 | fashion | 패션·의류 |
| 3 | beauty | 뷰티·화장품 |
| 4 | home-living | 홈·리빙 |
| 5 | food | 식품·먹거리 |
| 6 | sports | 스포츠·레저 |
| 7 | books | 도서·문구 |
| 8 | etc | 기타 |

seed INSERT는 멱등 처리: `INSERT INTO ... ON CONFLICT (slug) DO NOTHING`
