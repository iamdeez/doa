---
작성: Docs Agent
버전: v1.1
최종 수정: 2026-06-28 20:27
상태: 확정
---

# Diff: 002-catalog

## 목차

- [커밋 메시지용 한 줄 요약](#커밋-메시지용-한-줄-요약)
- [변경 요약](#변경-요약)
- [변경 파일 및 라인 수](#변경-파일-및-라인-수)
- [Diff](#diff)

---

## 커밋 메시지용 한 줄 요약

(이 섹션은 커밋 메시지 작성 시 참고할 수 있도록 제공한다. 실제 커밋 메시지는 프로젝트 컨벤션에 맞춰 자유롭게 조정한다.)
- **KO**: feat: user·seller·product·inventory 4개 모듈 카탈로그 실구현 + SEC-001 AdminGuard 적용 (101테스트 PASS)
- **EN**: feat: implement catalog stage 2 — user/seller/product/inventory modules with AdminGuard for SEC-001 fix and 101 tests passing

---

## 변경 요약

### Prisma 스키마 확장 (apps/backend/prisma/)

- `schema.prisma`: users 스키마 — User 모델에 name·phone 필드 추가 및 Seller·Address·Wishlist·ProductView 관계 추가. Seller·Address·Wishlist·ProductView 4개 모델 + SellerStatus enum 신규. products 스키마 — Category·Product·ProductImage·Variant·Inventory·InventoryLog 6개 모델 + ProductStatus·InventoryLogType enum 신규. 총 10개 테이블 정의.
- `migrations/20260628092954_catalog/migration.sql`: users 스키마 신규 4테이블 + products 스키마 8테이블 DDL. 카테고리 seed 8개 포함.
- `migration_lock.toml`: 코멘트 문구 수정(i.e.→e.g.)

### shared/auth (SEC-001 수정 포함)

- `admin.guard.ts` (신규): `ADMIN_USER_IDS` 환경변수 기반 AdminGuard. 미설정 시 전원 거부(fail-closed). SEC-001(Seller 자가 승인 권한 상승, CVSS 7.7 High) 수정.
- `admin.guard.spec.ts` (신규): AdminGuard SEC-001 회귀 방지 테스트 3건(비admin→403, admin→pass, 미설정→전원403).
- `optional-jwt-auth.guard.ts` (신규): 토큰 없어도 통과, 있으면 검증 후 user 주입하는 guard.
- `auth-shared.module.ts`: OptionalJwtAuthGuard provider·export 추가.

### seller 모듈

- `seller.controller.ts`: 판매자 등록·프로필 조회·수정·상태 조회 구현. **approve/reject 엔드포인트에 AdminGuard 적용(SEC-001 수정)** — ADMIN_USER_IDS 미포함 사용자 403 반환.
- `seller.service.ts`: register·getMyProfile·updateMyProfile·getStatus·approve·reject 비즈니스 로직.
- `seller.repository.ts`: users.sellers 테이블 Prisma CRUD.
- `seller.module.ts`: SellerService·SellerRepository 등록.
- `dto/register-seller.dto.ts`, `dto/update-seller.dto.ts`, `dto/reject-seller.dto.ts`: 입력 DTO.
- `seller.service.spec.ts`: SellerService 테스트 (SC-013~018).

### user 모듈

- `user.service.ts`: 프로필 조회·수정, 배송지 CRUD·기본지정, wishlist 추가·제거·조회, 최근 본 상품 조회(50개 상한).
- `user.repository.ts`: users 스키마 Prisma CRUD.
- `user.controller.ts`: GET/PATCH /users/me, 배송지·wishlist·product-views 엔드포인트.
- `user.events.ts`: UserEventsHandler — product.viewed 이벤트 구독.
- `user.module.ts`: UserService·UserRepository·UserEventsHandler 등록.
- `user.constants.ts`: MAX_PRODUCT_VIEWS=50 상수.
- `dto/`: create-address, update-address, update-profile, add-wishlist.
- `user.service.spec.ts`, `user.events.spec.ts`, `user.controller.spec.ts`: 단위 테스트.

### product 모듈

- `product.service.ts`: 카테고리 목록, 상품 등록·수정·상태전환, variant CRUD, 이미지 추가·삭제, 상품 목록(cursor 페이지네이션), 상품 상세, 판매자 상품 목록.
- `product.repository.ts`: products 스키마 Prisma CRUD.
- `product.controller.ts`: 카테고리·상품·variant·이미지 전 엔드포인트.
- `product.events.ts`: ProductEventsHandler — stock.changed 구독, OUT_OF_STOCK/ACTIVE 자동 전환.
- `product.module.ts`, `product.constants.ts` (MAX_PRODUCT_IMAGES=10), `dto/`.
- `product.service.spec.ts`, `product.events.spec.ts`: 단위 테스트.

### inventory 모듈

- `inventory.service.ts`: initStock·stockIn·getStock·checkAvailability·decreaseStock(CAS). stock.changed 이벤트 발행.
- `inventory.repository.ts`: inventory·inventory_logs 테이블. appendLog append-only.
- `inventory.controller.ts`: POST /inventory/:variantId/stock-in, GET /inventory/:variantId/stock.
- `inventory.exception.ts`: InsufficientStockException.
- `inventory.module.ts`, `dto/stock-in.dto.ts`.
- `inventory.service.spec.ts`: 단위 테스트.

### 정적·통합 테스트

- `test/static/inventory-log-append-only.spec.ts`: SC-043 — log append-only 정적 검증.
- `test/static/inventory-service-signature.spec.ts`: SC-044~045 — checkAvailability·decreaseStock 시그니처.
- `test/static/auth-required-guards.spec.ts`: SC-048 — 인증 필수 엔드포인트 JwtAuthGuard 메타데이터.
- `test/static/cross-schema.spec.ts`: SC-049 — 모듈별 타 스키마 직접 참조 금지.
- `test/static/schema-decimal.spec.ts`: SC-050 — price 필드 Decimal 타입.
- `test/static/package-no-aws.spec.ts`: SC-051 — @aws-sdk/* 신규 의존 없음.
- `test/products.e2e-spec.ts`: SC-047 — GET /products P95≤500ms integration.

### .env.example

- `apps/backend/.env.example` (신규): ADMIN_USER_IDS 환경변수 추가 (SEC-001 AdminGuard 설정).

---

## 변경 파일 및 라인 수

| 파일 | 추가 | 삭제 |
|---|---|---|
| `apps/backend/prisma/migrations/migration_lock.toml` | +1 | -1 |
| `apps/backend/prisma/schema.prisma` | +201 | -5 |
| `apps/backend/src/modules/inventory/inventory.controller.ts` | +46 | -2 |
| `apps/backend/src/modules/inventory/inventory.events.ts` | +3 | -1 |
| `apps/backend/src/modules/inventory/inventory.module.ts` | +4 | -0 |
| `apps/backend/src/modules/inventory/inventory.repository.ts` | +58 | -1 |
| `apps/backend/src/modules/inventory/inventory.service.ts` | +95 | -2 |
| `apps/backend/src/modules/product/product.controller.ts` | +178 | -3 |
| `apps/backend/src/modules/product/product.events.ts` | +41 | -1 |
| `apps/backend/src/modules/product/product.module.ts` | +12 | -3 |
| `apps/backend/src/modules/product/product.repository.ts` | +134 | -1 |
| `apps/backend/src/modules/product/product.service.ts` | +236 | -2 |
| `apps/backend/src/modules/seller/seller.controller.ts` | +78 | -3 |
| `apps/backend/src/modules/seller/seller.module.ts` | +3 | -0 |
| `apps/backend/src/modules/seller/seller.repository.ts` | +50 | -1 |
| `apps/backend/src/modules/seller/seller.service.ts` | +106 | -2 |
| `apps/backend/src/modules/user/user.controller.ts` | +115 | -3 |
| `apps/backend/src/modules/user/user.events.ts` | +28 | -1 |
| `apps/backend/src/modules/user/user.module.ts` | +4 | -1 |
| `apps/backend/src/modules/user/user.repository.ts` | +137 | -1 |
| `apps/backend/src/modules/user/user.service.ts` | +141 | -2 |
| `apps/backend/src/shared/auth/auth-shared.module.ts` | +3 | -2 |
| `apps/backend/src/shared/auth/admin.guard.ts` | +38 | -0 |
| `apps/backend/src/shared/auth/admin.guard.spec.ts` | +64 | -0 |
| `apps/backend/.env.example` | +9 | -0 |

---


## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 이며 전체 캡처는 중복·비효율이다.
> 변경 내용은 위 "변경 요약" · "변경 파일 및 라인 수" 절로 추적하고, 라인 단위 diff 가 필요하면 아래로 재생성한다:
>
> ```bash
> git diff 407b9d4 (001 완료) -- apps   # base commit: 407b9d4 (001 완료)
> ```
