---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 검토중
---

# Spec: 002-catalog

> Branch: 002-catalog | Date: 2026-06-28 | Version: v1.0.0

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

AWS 기반 MSA 18개 서비스(월 고정비 수백 달러)를 Fly.io 모듈러 모놀리스로 재구축하는
Stage 2 카탈로그 단계다. Stage 1(`001-skeleton-bootstrap`)에서 생성된 user·seller·product·inventory
4개 도메인 모듈의 빈 스텁을 실구현으로 채운다.

본 spec의 완료는 `003-commerce`(cart·order·payment 거래 E2E) 착수의 전제조건이다.
003에서 참조할 product 재고 조회 API, seller 정보 API, user 프로필 API 및
inventory 공개 인터페이스(`checkAvailability`, `decreaseStock`)가 이번 spec의 핵심 산출물이다.

기존 AWS MSA에서는 서비스별 RDS 7개 + DynamoDB 8개 테이블이 분산되어 있었으나,
신규 모놀리스에서는 단일 PostgreSQL 인스턴스의 `users` 스키마와 `products` 스키마로
통합된다(constitution P-003).

---

## 사용자 스토리

- **US-001**: 구매자로서, 내 프로필(이름·연락처)을 조회하고 싶다.
- **US-002**: 구매자로서, 내 프로필(이름·연락처)을 수정하고 싶다.
- **US-003**: 구매자로서, 배송지를 등록·수정·삭제하고 기본 배송지를 지정하고 싶다.
- **US-004**: 구매자로서, 관심 상품을 찜하고 찜 목록을 조회하고 싶다.
- **US-005**: 구매자로서, 최근 본 상품 목록을 조회하고 싶다.
- **US-006**: 사용자로서, 판매자 등록을 신청하고 심사 상태를 확인하고 싶다.
- **US-007**: 관리자로서, 판매자 신청을 승인하거나 거부하고 싶다.
- **US-008**: 승인된 판매자로서, 상품을 등록·수정하고 상태를 관리하고 싶다.
- **US-009**: 승인된 판매자로서, 상품 옵션과 변형(variant)을 관리하고 싶다.
- **US-010**: 승인된 판매자로서, 상품 이미지 URL을 등록하고 싶다.
- **US-011**: 구매자로서, 상품 목록을 무한스크롤(cursor 페이지네이션)로 조회하고 싶다.
- **US-012**: 구매자로서, 상품 상세 정보를 조회하고 싶다.
- **US-013**: 승인된 판매자로서, 재고를 입고하고 현재 재고를 조회하고 싶다.
- **US-014**: 003(거래) 모듈로서, 재고 가용 여부를 확인하고 차감하는 공개 인터페이스를 사용하고 싶다.

---

## 기능 요구사항

### [user 모듈] — users 스키마

- **FR-001**: 인증된 사용자는 자신의 프로필(id, email, name, phone)을 조회할 수 있다.
- **FR-002**: 인증된 사용자는 자신의 프로필(name, phone)을 수정할 수 있다.
- **FR-003**: 인증된 사용자는 배송지(recipientName, phone, zipCode, address1, address2)를 등록할 수 있다.
- **FR-004**: 인증된 사용자는 본인 배송지를 수정할 수 있다.
- **FR-005**: 인증된 사용자는 본인 배송지를 삭제할 수 있다.
  > 기본 배송지 삭제 시, 나머지 배송지 중 가장 최근 생성된 것이 자동으로 기본 배송지로 지정된다. 배송지가 1개일 경우 기본 배송지 여부와 무관하게 삭제 가능하다.
- **FR-006**: 인증된 사용자는 기본 배송지(isDefault)를 지정할 수 있다.
  > 기본 배송지 지정 시 이전 기본 배송지의 isDefault가 false로 해제된다.
- **FR-007**: 인증된 사용자는 상품을 찜 목록에 추가하거나 제거할 수 있다.
- **FR-008**: 인증된 사용자는 자신의 찜 목록을 조회할 수 있다.
- **FR-009**: 상품 단건 조회 시, 인증된 사용자의 product_views에 조회 기록이 생성되거나 갱신된다(viewedAt 최신화).
- **FR-010**: 인증된 사용자는 최근 본 상품 목록을 최신순으로 최대 50개까지 조회할 수 있다.

### [seller 모듈] — users 스키마

- **FR-011**: 인증된 사용자는 판매자 등록을 신청할 수 있다. 초기 상태는 PENDING이다.
- **FR-012**: 판매자는 자신의 판매자 프로필(businessName, businessNumber, representativeName, contactPhone, businessAddress)을 조회할 수 있다.
- **FR-013**: 판매자는 자신의 판매자 프로필을 수정할 수 있다.
- **FR-014**: 판매자는 자신의 심사 상태(PENDING / APPROVED / REJECTED + rejectReason)를 조회할 수 있다.
- **FR-015**: 승인 권한을 가진 사용자는 PENDING 판매자를 APPROVED 상태로 전환할 수 있다.
  > 이번 spec에서 admin role 검증은 JWT 인증 수준으로 간소화한다. admin 역할 기반 접근 제어는 후속 admin 모듈에서 추가된다(ASM-005).
- **FR-016**: 승인 권한을 가진 사용자는 판매자를 REJECTED 상태로 전환하면서 거부 사유(rejectReason)를 기록할 수 있다.
- **FR-017**: PENDING 또는 REJECTED 상태의 판매자는 상품을 등록할 수 없다.

### [product 모듈] — products 스키마

- **FR-018**: 인증 여부와 관계없이 모든 사용자는 카테고리 목록을 조회할 수 있다.
- **FR-019**: APPROVED 판매자는 카테고리를 지정하여 상품을 DRAFT 상태로 등록할 수 있다.
- **FR-020**: APPROVED 판매자는 자신이 등록한 상품의 정보(제목, 설명, 가격 등)를 수정할 수 있다. 타인 상품 수정은 금지된다.
- **FR-021**: APPROVED 판매자는 DRAFT 또는 INACTIVE 상태의 자신의 상품을 ACTIVE 상태로 전환(게시)할 수 있다.
- **FR-022**: APPROVED 판매자는 ACTIVE 또는 OUT_OF_STOCK 상태의 자신의 상품을 INACTIVE 상태로 전환(판매 종료)할 수 있다.
- **FR-023**: 해당 상품의 모든 variant 재고 합계가 0이 되면, 상품 상태가 자동으로 OUT_OF_STOCK으로 전환된다.
- **FR-024**: 재고가 복구되어 OUT_OF_STOCK 상품의 variant 재고 합계가 0 초과가 되면, 상품 상태가 자동으로 ACTIVE로 전환된다.
- **FR-025**: APPROVED 판매자는 자신의 상품에 옵션/variant(optionName, optionValue, sku, price, stock)를 추가·수정·삭제할 수 있다.
- **FR-026**: APPROVED 판매자는 자신의 상품에 이미지 URL과 표시 순서(displayOrder)를 추가·삭제할 수 있다. 상품당 이미지는 최대 10개까지 허용한다.
- **FR-027**: 모든 사용자는 상품 목록을 cursor 기반 페이지네이션(`after={cursor}&limit=N`)으로 조회할 수 있다. ACTIVE 및 OUT_OF_STOCK 상태 상품만 노출된다.
- **FR-028**: 모든 사용자는 상품 단건을 조회할 수 있다. ACTIVE 및 OUT_OF_STOCK 상태 상품만 조회 가능하며, DRAFT 또는 INACTIVE 상품은 404를 반환한다.
- **FR-029**: APPROVED 판매자는 자신의 상품 목록을 모든 상태를 포함하여 조회할 수 있다.

### [inventory 모듈] — products 스키마

- **FR-030**: APPROVED 판매자는 variant(SKU)별 재고를 입고(수량 증가)할 수 있다.
- **FR-031**: APPROVED 판매자는 variant별 현재 재고 수량을 조회할 수 있다.
- **FR-032**: 재고 입고 및 차감 시, inventory_logs에 이력이 append-only로 기록된다. 기존 로그는 수정·삭제할 수 없다.
- **FR-033**: InventoryService는 003(거래) 모듈이 NestJS DI를 통해 직접 호출할 수 있는 `checkAvailability(variantId: string, quantity: number): Promise<boolean>` 공개 메서드를 제공한다.
- **FR-034**: InventoryService는 003(거래) 모듈이 NestJS DI를 통해 직접 호출할 수 있는 `decreaseStock(variantId: string, quantity: number, orderId: string): Promise<void>` 공개 메서드를 제공한다. 이 메서드는 호출자의 트랜잭션 컨텍스트 내에서 실행됨을 전제로 한다.
- **FR-035**: `decreaseStock` 호출 시 현재 재고가 요청 수량보다 적으면 `InsufficientStockException`을 발생시킨다.

---

## 비기능 요구사항

- **NFR-001**: 상품 목록 조회 API(`GET /products`)의 P95 응답 시간은 500ms 이하여야 한다. (측정 조건: 로컬 docker-compose PostgreSQL 환경, 상품 데이터 1,000개 미만)
- **NFR-002**: 인증이 필요한 모든 엔드포인트는 유효하지 않거나 없는 JWT 토큰으로 요청 시 401을 반환해야 한다. (인증 불필요 endpoint: `GET /categories`, `GET /products`, `GET /products/:id`)
- **NFR-003**: 각 모듈(user·seller·product·inventory)은 자신의 스키마 테이블에만 Prisma Client로 직접 접근해야 한다. 타 도메인 스키마 테이블의 직접 쿼리는 금지된다(constitution P-001).
- **NFR-004**: 상품 가격(price) 및 금전 관련 수치 필드는 Prisma Decimal 타입을 사용해야 한다. 부동소수점(float) 타입 사용은 금지된다(constitution P-005 준용).
- **NFR-005**: 본 spec 구현에서 AWS 전용 SDK·서비스를 신규 의존으로 추가해서는 안 된다(constitution P-002).

---

## 수용 기준

> 환경 태그 규약: `[env:static]` 코드·설정 정적 검증 / `[env:unit]` 단위 테스트 / `[env:integration]` 앱 기동 후 검증

### user 모듈

- **SC-001** (FR-001): 인증된 사용자가 `GET /users/me` 호출 시 `{id, email, name, phone}` 필드를 포함한 응답이 반환된다. `[env:unit]`
- **SC-002** (FR-001): 비인증 요청으로 `GET /users/me` 호출 시 401이 반환된다. `[env:unit]`
- **SC-003** (FR-002): 인증된 사용자가 `PATCH /users/me` `{name, phone}`으로 수정 시, DB에 반영된 업데이트된 프로필이 반환된다. `[env:unit]`
- **SC-004** (FR-003): 인증된 사용자가 `POST /users/me/addresses` `{recipientName, phone, zipCode, address1}` 호출 시 201과 함께 새 배송지가 생성된다. `[env:unit]`
- **SC-005** (FR-004): 인증된 사용자가 `PATCH /users/me/addresses/:id`로 본인 배송지를 수정하면 DB에 반영된다. 타인 배송지 수정 시도 시 403이 반환된다. `[env:unit]`
- **SC-006** (FR-005): 인증된 사용자가 `DELETE /users/me/addresses/:id`로 본인 배송지를 삭제하면 204가 반환된다. 기본 배송지 삭제 시 나머지 배송지 중 가장 최근 생성된 것이 자동으로 기본 배송지로 지정된다. `[env:unit]`
- **SC-007** (FR-006): 인증된 사용자가 `PATCH /users/me/addresses/:id/default` 호출 시 해당 주소의 isDefault가 true가 되고, 이전 기본 배송지의 isDefault는 false로 해제된다. `[env:unit]`
- **SC-008** (FR-007): 인증된 사용자가 `POST /users/me/wishlist/:productId` 호출 시 찜이 추가된다. 이미 찜한 상품에 재요청 시 409가 반환된다. `[env:unit]`
- **SC-009** (FR-007): 인증된 사용자가 `DELETE /users/me/wishlist/:productId` 호출 시 찜이 제거되고 204가 반환된다. `[env:unit]`
- **SC-010** (FR-008): 인증된 사용자가 `GET /users/me/wishlist` 호출 시 찜 목록이 반환된다. `[env:unit]`
- **SC-011** (FR-009): 인증된 사용자가 `GET /products/:id` 호출 시 `users.product_views`에 해당 사용자·상품 조합의 레코드가 생성되거나 viewedAt이 갱신된다. `[env:unit]`
- **SC-012** (FR-010): 인증된 사용자가 `GET /users/me/product-views` 호출 시 최근 본 상품 목록이 최신순으로 최대 50개 반환된다. `[env:unit]`

### seller 모듈

- **SC-013** (FR-011): 인증된 사용자가 `POST /sellers/register` `{businessName, businessNumber, representativeName}` 호출 시 sellers 레코드가 PENDING 상태로 생성된다. 동일 사용자의 중복 신청 시 409가 반환된다. `[env:unit]`
- **SC-014** (FR-012): APPROVED 판매자가 `GET /sellers/me` 호출 시 판매자 프로필이 반환된다. `[env:unit]`
- **SC-015** (FR-013): APPROVED 판매자가 `PATCH /sellers/me`로 프로필을 수정하면 DB에 반영된다. `[env:unit]`
- **SC-016** (FR-014): 판매자가 `GET /sellers/me/status` 호출 시 `{status, rejectReason}` 형태로 현재 심사 상태가 반환된다. `[env:unit]`
- **SC-017** (FR-015): `PATCH /sellers/:id/approve` 호출 시 해당 seller의 status가 APPROVED로 변경된다. `[env:unit]`
- **SC-018** (FR-016): `PATCH /sellers/:id/reject` `{rejectReason}` 호출 시 해당 seller의 status가 REJECTED로 변경되고 rejectReason이 저장된다. `[env:unit]`
- **SC-019** (FR-017): PENDING 상태의 판매자가 `POST /products` 호출 시 403이 반환된다. `[env:unit]`
- **SC-020** (FR-017): REJECTED 상태의 판매자가 `POST /products` 호출 시 403이 반환된다. `[env:unit]`

### product 모듈

- **SC-021** (FR-018): `GET /categories` 호출 시 인증 없이 카테고리 목록이 반환된다. `[env:unit]`
- **SC-022** (FR-019): APPROVED 판매자가 `POST /products` `{categoryId, title, description, price}` 호출 시 DRAFT 상태의 상품이 생성된다. `[env:unit]`
- **SC-023** (FR-019): 비승인 판매자(PENDING/REJECTED)가 `POST /products` 호출 시 403이 반환된다. `[env:unit]`
- **SC-024** (FR-020): APPROVED 판매자가 `PATCH /products/:id`로 본인 상품을 수정하면 DB에 반영된다. `[env:unit]`
- **SC-025** (FR-020): 판매자가 `PATCH /products/:id`로 타인 상품 수정 시도 시 403이 반환된다. `[env:unit]`
- **SC-026** (FR-021): APPROVED 판매자가 `PATCH /products/:id/publish` 호출 시 DRAFT 상태 상품이 ACTIVE로 전환된다. `[env:unit]`
- **SC-027** (FR-021): APPROVED 판매자가 `PATCH /products/:id/publish` 호출 시 INACTIVE 상태 상품이 ACTIVE로 전환된다. `[env:unit]`
- **SC-028** (FR-022): APPROVED 판매자가 `PATCH /products/:id/deactivate` 호출 시 ACTIVE 상태 상품이 INACTIVE로 전환된다. `[env:unit]`
- **SC-029** (FR-022): APPROVED 판매자가 `PATCH /products/:id/deactivate` 호출 시 OUT_OF_STOCK 상태 상품이 INACTIVE로 전환된다. `[env:unit]`
- **SC-030** (FR-023): 상품의 모든 variant 재고 합계가 0이 되는 시점에 해당 상품의 status가 OUT_OF_STOCK으로 자동 변경된다. `[env:unit]`
- **SC-031** (FR-024): OUT_OF_STOCK 상품의 variant에 재고가 입고되어 전체 합계가 0 초과가 되면 해당 상품의 status가 ACTIVE로 자동 변경된다. `[env:unit]`
- **SC-032** (FR-025): APPROVED 판매자가 `POST /products/:id/variants` `{optionName, optionValue, sku, price, stock}` 호출 시 variant가 생성된다. `[env:unit]`
- **SC-033** (FR-025): APPROVED 판매자가 `PATCH /products/:id/variants/:variantId`로 variant 정보를 수정하면 DB에 반영된다. `[env:unit]`
- **SC-034** (FR-025): APPROVED 판매자가 `DELETE /products/:id/variants/:variantId`로 variant를 삭제할 수 있다. `[env:unit]`
- **SC-035** (FR-026): APPROVED 판매자가 `POST /products/:id/images` `{url, displayOrder}` 호출 시 product_images 레코드가 생성된다. `[env:unit]`
- **SC-036** (FR-026): 동일 상품에 이미지가 10개인 상태에서 추가 요청 시 400이 반환된다. `[env:unit]`
- **SC-037** (FR-026): APPROVED 판매자가 `DELETE /products/:id/images/:imageId` 호출 시 이미지 URL이 삭제된다. `[env:unit]`
- **SC-038** (FR-027): `GET /products?limit=20&after={cursor}` 호출 시 ACTIVE 및 OUT_OF_STOCK 상태 상품 목록이 cursor 페이지네이션으로 반환된다. DRAFT 및 INACTIVE 상품은 목록에 포함되지 않는다. `[env:unit]`
- **SC-039** (FR-028): `GET /products/:id` 호출 시 ACTIVE 또는 OUT_OF_STOCK 상태 상품의 상세 정보가 반환된다. DRAFT 또는 INACTIVE 상품에 대한 요청은 404가 반환된다. `[env:unit]`
- **SC-040** (FR-029): APPROVED 판매자가 `GET /sellers/me/products` 호출 시 자신의 상품 목록이 DRAFT·ACTIVE·OUT_OF_STOCK·INACTIVE 전체 상태를 포함하여 반환된다. `[env:unit]`

### inventory 모듈

- **SC-041** (FR-030): APPROVED 판매자가 `POST /inventory/:variantId/stock-in` `{quantity}` 호출 시 해당 variant의 재고가 증가하고 inventory_logs에 입고 로그가 생성된다. `[env:unit]`
- **SC-042** (FR-031): APPROVED 판매자가 `GET /inventory/:variantId/stock` 호출 시 현재 재고 수량이 반환된다. `[env:unit]`
- **SC-043** (FR-032): 재고 입고 또는 차감 시 inventory_logs에 로그가 append-only로 생성되며, 기존 로그를 수정하거나 삭제하는 API는 존재하지 않는다. `[env:static]`
- **SC-044** (FR-033): `InventoryService` 클래스에 `checkAvailability(variantId: string, quantity: number): Promise<boolean>` 시그니처의 공개 메서드가 존재한다. `[env:static]`
- **SC-045** (FR-034): `InventoryService` 클래스에 `decreaseStock(variantId: string, quantity: number, orderId: string): Promise<void>` 시그니처의 공개 메서드가 존재한다. `[env:static]`
- **SC-046** (FR-035): `decreaseStock` 호출 시 현재 재고가 요청 수량보다 적으면 `InsufficientStockException`이 throw된다. `[env:unit]`

### 비기능 요구사항

- **SC-047** (NFR-001): `GET /products?limit=20` 요청의 P95 응답 시간이 500ms 이하다. (조건: 로컬 docker-compose 환경, 상품 1,000개 미만) `[env:integration]`
- **SC-048** (NFR-002): JWT 없이 인증 필수 엔드포인트(예: `GET /users/me`, `POST /products` 등) 호출 시 401이 반환된다. `[env:unit]`
- **SC-049** (NFR-003): 각 모듈의 Repository 클래스가 자신의 스키마가 아닌 타 도메인 스키마 모델을 Prisma Client로 직접 참조하는 코드가 없음을 코드 정적 검사로 확인한다. `[env:static]`
- **SC-050** (NFR-004): `schema.prisma`에서 상품 price 필드가 `Decimal` 타입으로 선언되어 있음을 확인한다. `[env:static]`
- **SC-051** (NFR-005): `apps/backend/package.json`의 dependencies·devDependencies에 `@aws-sdk/*` 패키지가 신규로 추가되지 않았음을 확인한다. `[env:static]`

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건이다.

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-001 | FR-001 | — | SC-001, SC-002 | unit | Must |
| US-002 | FR-002 | — | SC-003 | unit | Must |
| US-003 | FR-003 | — | SC-004 | unit | Must |
| US-003 | FR-004 | — | SC-005 | unit | Must |
| US-003 | FR-005 | — | SC-006 | unit | Must |
| US-003 | FR-006 | — | SC-007 | unit | Must |
| US-004 | FR-007 | — | SC-008, SC-009 | unit | Should |
| US-004 | FR-008 | — | SC-010 | unit | Should |
| US-005 | FR-009 | — | SC-011 | unit | Should |
| US-005 | FR-010 | — | SC-012 | unit | Should |
| US-006 | FR-011 | — | SC-013 | unit | Must |
| US-006 | FR-012 | — | SC-014 | unit | Must |
| US-006 | FR-013 | — | SC-015 | unit | Must |
| US-006 | FR-014 | — | SC-016 | unit | Must |
| US-007 | FR-015 | — | SC-017 | unit | Must |
| US-007 | FR-016 | — | SC-018 | unit | Must |
| US-007, US-008 | FR-017 | — | SC-019, SC-020 | unit | Must |
| US-008, US-011, US-012 | FR-018 | — | SC-021 | unit | Must |
| US-008 | FR-019 | — | SC-022, SC-023 | unit | Must |
| US-008 | FR-020 | — | SC-024, SC-025 | unit | Must |
| US-008 | FR-021 | — | SC-026, SC-027 | unit | Must |
| US-008 | FR-022 | — | SC-028, SC-029 | unit | Must |
| US-008 | FR-023 | — | SC-030 | unit | Must |
| US-008 | FR-024 | — | SC-031 | unit | Must |
| US-009 | FR-025 | — | SC-032, SC-033, SC-034 | unit | Must |
| US-010 | FR-026 | — | SC-035, SC-036, SC-037 | unit | Must |
| US-011 | FR-027 | — | SC-038 | unit | Must |
| US-012 | FR-028 | — | SC-039 | unit | Must |
| US-008 | FR-029 | — | SC-040 | unit | Must |
| US-013 | FR-030 | — | SC-041 | unit | Must |
| US-013 | FR-031 | — | SC-042 | unit | Must |
| US-013 | FR-032 | — | SC-043 | static | Must |
| US-014 | FR-033 | — | SC-044 | static | Must |
| US-014 | FR-034 | — | SC-045 | static | Must |
| US-014 | FR-035 | — | SC-046 | unit | Must |
| — | — | NFR-001 | SC-047 | integration | Must |
| — | — | NFR-002 | SC-048 | unit | Must |
| — | — | NFR-003 | SC-049 | static | Must |
| — | — | NFR-004 | SC-050 | static | Must |
| — | — | NFR-005 | SC-051 | static | Must |

---

## 범위 외

다음 항목들은 이번 spec에서 의도적으로 제외한다.

**003(거래) 범위 — 다음 spec**
- cart(장바구니), order(주문), payment(결제·환불) 도메인 전체

**Stage 3 이후 부가 도메인**
- coupon(쿠폰), review(리뷰·평점), search(검색 인덱스·질의), notification(알림), file(파일 업로드 API),
  banner(배너), stats(통계), admin(공지·시스템 설정·운영) 도메인

**기능 제외**
- 실제 파일 업로드 API (Cloudflare R2 연동은 Stage 3 file 모듈 담당)
- admin 심사 UI (후속 admin 모듈에서 구현. seller 승인/거부 API 엔드포인트는 이번 포함)
- admin role 기반 접근 제어 (이번 spec에서 JWT 인증만 적용, RBAC은 admin 모듈 추가 시 구현)
- 상품 검색 기능 (search 모듈 — Stage 3)
- 판매자·구매자 알림 기능
- 결제·정산 관련 모든 기능

**사후 운영 검증 피드백 사이클 (PROC-014)**

본 spec 파이프라인 종료 후 운영 환경에서 점검이 필요한 시나리오:
1. Prisma 마이그레이션이 Fly 배포 release 단계에서 정상 실행되는지 검증
2. users 스키마 신규 테이블(sellers, addresses, wishlists, product_views)이 실제 Fly Postgres에 생성되는지 확인
3. products 스키마 신규 테이블(categories, products, variants, product_images, inventory, inventory_logs)이 생성되는지 확인

사후 결함 발견 시: spec.md "배경 및 목적" 절 또는 hotfix spec 입력 → main session의 "spec 수정" 이벤트 → 1단계 재진입.

---

## 미결 사항

[NEEDS CLARIFICATION] 항목 없음.

> 모든 결정 사항은 수집 과정에서 확정되었다. 설계 과정 중 발생하는 기술 결정(HOW)은 plan.md에서 다룬다.

---

*가정(ASM) 사항은 `/docs/specs/v1.0.0/002-catalog/spec/assumptions.md` 참조.*
