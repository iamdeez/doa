---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-28 18:23
상태: 확정
---

# Test Cases: 002-catalog

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
  - [user 모듈 (SC-001~012)](#user-모듈-sc-001012)
  - [seller 모듈 (SC-013~018)](#seller-모듈-sc-013018)
  - [product 모듈 (SC-019~040)](#product-모듈-sc-019040)
  - [inventory 모듈 (SC-041~046)](#inventory-모듈-sc-041046)
  - [비기능 요구사항 (SC-047~051)](#비기능-요구사항-sc-047051)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류 — 4-카테고리)](#미커버-항목-사전-분류--4-카테고리)

---

## SC × 시나리오 매트릭스

### user 모듈 (SC-001~012)

| SC-ID | 수용 기준 | Happy | Edge | Error | 테스트 파일·함수 | env |
|---|---|---|---|---|---|---|
| SC-001 | GET /users/me {id,email,name,phone} password 제외 | when_get_me_then_profile_without_password | — | — | src/modules/user/user.service.spec.ts | unit |
| SC-002 | 비인증 GET /users/me 401 | — | — | when_no_token_then_users_me_401 | src/modules/user/user.controller.spec.ts | unit |
| SC-003 | PATCH /users/me {name,phone} DB 반영 | when_update_profile_then_persisted | — | — | src/modules/user/user.service.spec.ts | unit |
| SC-004 | POST addresses 201 생성 | when_create_address_then_201_created | — | — | src/modules/user/user.service.spec.ts | unit |
| SC-005 | 본인 주소 수정 OK / 타인 403 | when_update_own_address_then_ok | — | when_update_others_address_then_403 | src/modules/user/user.service.spec.ts | unit |
| SC-006 | 기본배송지 삭제 → 최근 생성 자동 재지정 | — | when_delete_default_address_then_reassign_latest | — | src/modules/user/user.service.spec.ts | unit |
| SC-007 | 기본배송지 지정 → 이전 기본 해제 | when_set_default_then_previous_unset | — | — | src/modules/user/user.service.spec.ts | unit |
| SC-008 | 찜 추가 / 중복 409 | when_add_wishlist_then_added | — | when_add_wishlist_dup_then_conflict_409 | src/modules/user/user.service.spec.ts | unit |
| SC-009 | 찜 제거 204 | when_remove_wishlist_then_204 | — | — | src/modules/user/user.service.spec.ts | unit |
| SC-010 | 찜 목록 반환 | when_list_wishlist_then_items | — | — | src/modules/user/user.service.spec.ts | unit |
| SC-011 | product.viewed → product_views upsert | when_product_viewed_then_view_upserted | — | — | src/modules/user/user.events.spec.ts | unit |
| SC-012 | 최근본상품 최신순 50 상한 | — | when_views_over_50_then_latest_50 | — | src/modules/user/user.service.spec.ts | unit |

### seller 모듈 (SC-013~018)

| SC-ID | 수용 기준 | Happy | Edge | Error | 테스트 파일·함수 | env |
|---|---|---|---|---|---|---|
| SC-013 | 판매자 등록 PENDING / 중복 409 | when_register_seller_then_pending | — | when_register_seller_dup_then_conflict_409 | src/modules/seller/seller.service.spec.ts | unit |
| SC-014 | GET /sellers/me 프로필 반환 | when_get_my_seller_then_profile | — | — | src/modules/seller/seller.service.spec.ts | unit |
| SC-015 | PATCH /sellers/me 수정 DB 반영 | when_update_my_seller_then_persisted | — | — | src/modules/seller/seller.service.spec.ts | unit |
| SC-016 | GET /sellers/me/status {status,rejectReason} | when_get_status_then_status_and_reason | — | — | src/modules/seller/seller.service.spec.ts | unit |
| SC-017 | approve → APPROVED | when_approve_then_status_approved | — | — | src/modules/seller/seller.service.spec.ts | unit |
| SC-018 | reject → REJECTED + rejectReason | when_reject_then_rejected_with_reason | — | — | src/modules/seller/seller.service.spec.ts | unit |

### product 모듈 (SC-019~040)

| SC-ID | 수용 기준 | Happy | Edge | Error | 테스트 파일·함수 | env |
|---|---|---|---|---|---|---|
| SC-019 | PENDING 판매자 POST /products 403 | — | — | when_pending_seller_create_product_then_403 | src/modules/product/product.service.spec.ts | unit |
| SC-020 | REJECTED 판매자 POST /products 403 | — | — | when_rejected_seller_create_product_then_403 | src/modules/product/product.service.spec.ts | unit |
| SC-021 | GET /categories 비인증 목록 | when_get_categories_then_list | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-022 | APPROVED POST /products DRAFT | when_approved_create_product_then_draft | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-023 | 비승인 POST /products 403 | — | — | when_unapproved_create_product_then_403 | src/modules/product/product.service.spec.ts | unit |
| SC-024 | 본인 상품 수정 반영 | when_update_own_product_then_persisted | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-025 | 타인 상품 수정 403 | — | — | when_update_others_product_then_403 | src/modules/product/product.service.spec.ts | unit |
| SC-026 | publish DRAFT→ACTIVE | when_publish_draft_then_active | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-027 | publish INACTIVE→ACTIVE | when_publish_inactive_then_active | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-028 | deactivate ACTIVE→INACTIVE | when_deactivate_active_then_inactive | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-029 | deactivate OUT_OF_STOCK→INACTIVE | when_deactivate_oos_then_inactive | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-030 | 재고0 자동 OUT_OF_STOCK | — | when_stock_zero_active_then_out_of_stock | — | src/modules/product/product.events.spec.ts | unit |
| SC-031 | 재고복구 자동 ACTIVE | — | when_stock_positive_oos_then_active | — | src/modules/product/product.events.spec.ts | unit |
| SC-032 | variant 생성 + initStock 호출 | when_create_variant_then_init_stock_called | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-033 | variant 수정 반영 | when_update_variant_then_persisted | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-034 | variant 삭제 | when_delete_variant_then_removed | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-035 | 이미지 추가 생성 | when_add_image_then_created | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-036 | 이미지 10초과 400 | — | when_image_over_10_then_400 | — | src/modules/product/product.service.spec.ts | unit |
| SC-037 | 이미지 삭제 | when_delete_image_then_removed | — | — | src/modules/product/product.service.spec.ts | unit |
| SC-038 | GET /products cursor·ACTIVE+OOS 필터 | when_list_products_then_cursor_active_oos_only | when_list_products_first_page_no_cursor | — | src/modules/product/product.service.spec.ts | unit |
| SC-039 | 단건 ACTIVE/OOS 상세 OK / DRAFT·INACTIVE 404 | when_get_detail_visible_then_ok | — | when_get_detail_invisible_then_404 | src/modules/product/product.service.spec.ts | unit |
| SC-040 | 본인 전체상태 목록 | when_list_my_products_then_all_statuses | — | — | src/modules/product/product.service.spec.ts | unit |

### inventory 모듈 (SC-041~046)

| SC-ID | 수용 기준 | Happy | Edge | Error | 테스트 파일·함수 | env |
|---|---|---|---|---|---|---|
| SC-041 | stock-in 재고 증가 + log(IN) | when_stock_in_then_increment_and_log | — | — | src/modules/inventory/inventory.service.spec.ts | unit |
| SC-042 | 재고 조회 수량 반환 | when_get_stock_then_quantity | — | — | src/modules/inventory/inventory.service.spec.ts | unit |
| SC-043 | inventory_logs append-only (update/delete 부재) | when_inventory_repo_then_no_log_mutation_methods | — | — | test/static/inventory-log-append-only.spec.ts | static |
| SC-044 | checkAvailability 시그니처 존재 | when_inventory_service_then_check_availability_signature | — | — | test/static/inventory-service-signature.spec.ts | static |
| SC-045 | decreaseStock 시그니처 존재 | when_inventory_service_then_decrease_stock_signature | — | — | test/static/inventory-service-signature.spec.ts | static |
| SC-046 | 재고 부족 InsufficientStockException | — | — | when_decrease_insufficient_then_exception | src/modules/inventory/inventory.service.spec.ts | unit |

### 비기능 요구사항 (SC-047~051)

| SC-ID | 수용 기준 | Happy | Edge | Error | 테스트 파일·함수 | env |
|---|---|---|---|---|---|---|
| SC-047 | GET /products P95 ≤500ms | — | when_50_list_requests_then_p95_under_500ms | — | test/products.e2e-spec.ts | integration |
| SC-048 | 인증필수 endpoint 토큰없음 401 (가드 메타데이터) | when_protected_routes_then_jwt_guard_present | — | — | test/static/auth-required-guards.spec.ts | unit/static |
| SC-049 | cross-schema Prisma 모델 미참조 | when_repositories_then_no_foreign_schema_model_ref | — | — | test/static/cross-schema.spec.ts | static |
| SC-050 | price Decimal 선언 | when_schema_prisma_then_price_decimal | — | — | test/static/schema-decimal.spec.ts | static |
| SC-051 | @aws-sdk/* 신규 0 | when_package_json_then_no_new_aws_sdk | — | — | test/static/package-no-aws.spec.ts | static |

---

## 외부 의존성 명시

### unit 테스트

- fixture: 고정 ID 픽스처 (user-id, seller-id, product-id, variant-id)
- mock:
  - UserRepository (findUserById, updateUser, address CRUD, wishlist CRUD, productView upsert/findRecent)
  - SellerRepository (createSeller, findByUserId, findById, updateSeller, updateStatus)
  - ProductRepository (findCategories, findCategoryById, createProduct, findById, updateProduct, updateStatus, listPublic, listBySeller, createVariant, updateVariant, deleteVariant, findVariantById, countImages, createImage, deleteImage)
  - InventoryRepository (findByVariant, createInventory, increment, conditionalDecrement, appendLog, sumQuantityByProduct)
  - SellerService.getApprovedSeller (product 모듈에서 DI)
  - InventoryService.initStock (product 모듈에서 DI)
  - EventEmitter2 (emit)
- 환경 변수: 없음 (단위 테스트 — NestJS TestingModule mock 전용)
- 외부 서비스: 없음

### static 테스트

- 파일 시스템: apps/backend/src/, apps/backend/prisma/schema.prisma, apps/backend/package.json
- mock: 없음 (fs 모듈로 소스 코드 파싱)

### integration 테스트 (SC-047)

- Docker Compose PostgreSQL (로컬 실행)
- prisma migrate dev + seed 완료 상태
- NestJS 앱 기동 (포트 3000)
- supertest HTTP 클라이언트

---

## 미커버 항목 (사전 분류 — 4-카테고리)

단위테스트로 검증 불가능한 SC를 사전 분류하여 5b의 coverage-gap.md 작성에 참조한다.

| SC-ID | 미커버 사유 | 카테고리 | 권장 검증 방법 |
|---|---|---|---|
| SC-047 | Docker Compose + 실제 PostgreSQL 필요. P95 성능은 실제 DB 환경에서만 측정 가능 | (3) 운영 환경 권장 | 옵션 A: main이 Docker Compose + prisma migrate dev + seed + 앱 기동 절차 제시 → 사용자 실행 → P95 결과 전달 → Test Agent(EXECUTION) 검증 |

> SC-047 외 SC-001~046, SC-048~051은 모두 unit 또는 static으로 직접 검증 가능.
> 카테고리 (1) 항목 0건 — Development Agent 복귀 불필요.
