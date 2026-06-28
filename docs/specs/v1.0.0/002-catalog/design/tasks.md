---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-28 18:10
상태: 확정
---

# Tasks: 002-catalog

> Branch: 002-catalog | Date: 2026-06-28 | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 분해 레이어 정의](#태스크-분해-레이어-정의)
- [태스크 목록](#태스크-목록)
  - [Layer A — 데이터 계층 (4단계 Development)](#layer-a--데이터-계층-4단계-development)
  - [Layer B — 도메인 계층 (4단계 Development)](#layer-b--도메인-계층-4단계-development)
  - [Layer C — 인터페이스 계층 (4단계 Development)](#layer-c--인터페이스-계층-4단계-development)
  - [Layer D — 테스트 계층 (5a Test AUTHORING)](#layer-d--테스트-계층-5a-test-authoring)
- [Test Authoring Contract](#test-authoring-contract)
- [FR 커버리지 역방향 검증](#fr-커버리지-역방향-검증)
- [태스크 입도 가이드](#태스크-입도-가이드)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목이 해소되었는가? → 0건(spec.md 미결 사항 없음).
- [x] plan.md 의 Constitution Gates(P-001~P-007)가 모두 통과되었는가? → 전체 PASS, 예외 0(plan.md 사전 검증).
- [x] CHANGES.md 에서 이전 작업의 "후속 작업 시 주의사항" 을 확인했는가? → v1.0.0 CHANGES.md(001) 확인. User 모델 additive 확장·EventEmitter 기등록 외 충돌 없음.

---

## 태스크 분해 레이어 정의

> 의존 순서: **A → B → C** (Development), **D** 는 PPG-1 병렬로 5a 가 작성(TDD Red). 의존 없는 태스크는 `[P]` 병렬.
> **PPG-1 책임 분할**: Layer A·B·C = **4단계 Development Agent**. Layer D = **5a Test Agent(AUTHORING)**. 두 Agent 는 동일 turn 동시 spawn 되어 본 tasks.md 를 공통 입력으로 병렬 진행한다(산출물 경로 비충돌: D 는 `*.spec.ts`/`test/` 만 생성).
> **Database Design Agent**(선택, 3단계 후/4단계 전, selection-phases Y)가 Layer A 의 Prisma 스키마 상세(컬럼 타입·인덱스·제약·enum·마이그레이션 순서·seed)를 `data-model.md` 로 확정한다. **Layer A 태스크는 `data-model.md` 를 권위 입력으로 소비한다.** data-model.md 부재 시 plan §데이터 모델 절을 fallback 으로 사용.

| 레이어 | 본 spec 대상 | 담당 |
|---|---|---|
| A. 데이터 계층 | Prisma schema 확장(User+10테이블+enum)·마이그레이션·prisma generate·카테고리 seed | 4단계 Development (data-model.md 소비) |
| B. 도메인 계층 | 4모듈 Repository·Service·Events·예외·상수 | 4단계 Development |
| C. 인터페이스 계층 | 4모듈 Controller·DTO·Module 결선·OptionalJwtAuthGuard | 4단계 Development |
| D. 테스트 계층 | SC-001~051 단위/정적/통합 테스트 | 5a Test(AUTHORING) |

> **모듈 간 의존(컴파일 순서)**: seller·user·inventory 는 product 비의존(독립). product 는 InventoryService·SellerService 를 DI(import) → **B 레이어에서 seller·inventory 를 product 보다 먼저**. 이벤트 구독(user←product, product←inventory)은 컴파일 의존이 아니므로 순서 무관(`@OnEvent` 디커플링).

---

## 태스크 목록

### Layer A — 데이터 계층 (4단계 Development)

- [x] **T-A1** — User 확장 + users 스키마 4 신규 테이블
  - 레이어: A
  - 구현 파일: `apps/backend/prisma/schema.prisma`
  - 관련 요구사항: FR-001·002·003·011·007·009·010, ADR-001·013
  - 상세(data-model.md 우선): `User` 에 `name String?`·`phone String?` additive 추가. 신규 모델 `Seller`(@@schema users, @@unique([userId]), status enum `SellerStatus` PENDING/APPROVED/REJECTED, rejectReason?), `Address`(userId FK 동일스키마, isDefault default false, index userId), `Wishlist`(productId **plain String** FK미선언, @@unique([userId,productId])), `ProductView`(productId plain String, @@unique([userId,productId]), index(userId,viewedAt desc)). cross-schema 경계(productId)는 `@relation` 미선언.
  - 완료 기준: `prisma validate` 통과. User nullable 확장으로 기존 auth 모델 호환. cross-schema FK 0(SC-049 구조 전제).

- [x] **T-A2** — products 스키마 6 신규 테이블 + enum
  - 레이어: A (T-A1 후, 동일 파일)
  - 구현 파일: `apps/backend/prisma/schema.prisma`
  - 관련 요구사항: FR-018·019·025·026·030·032, NFR-001·004, ADR-001·003·013
  - 상세(data-model.md 우선): `Category`(name·slug·displayOrder), `Product`(sellerId **plain String** FK미선언, categoryId 동일스키마 FK, title·description?, `price Decimal @db.Decimal(12,2)`, status enum `ProductStatus` DRAFT/ACTIVE/OUT_OF_STOCK/INACTIVE default DRAFT, **index([status,createdAt,id])** — NFR-001), `ProductImage`(productId FK, url·displayOrder, index(productId)), `Variant`(productId FK, optionName·optionValue·sku @@unique([sku])·`price Decimal`, **stock 컬럼 없음**), `Inventory`(variantId FK @@unique([variantId])·productId 동일스키마·`quantity Int @default(0)`·index(productId)), `InventoryLog`(variantId·productId·type enum `InventoryLogType` STOCK_IN/DECREASE/INIT·delta Int·orderId String?·createdAt, index([variantId,createdAt]), append-only).
  - 완료 기준: `prisma validate` 통과. price `Decimal` 선언(SC-050 전제). products(status,createdAt,id) 인덱스 존재(NFR-001). variant 에 stock 컬럼 부재(ADR-003).

- [x] **T-A3** — 마이그레이션 생성·적용 + prisma generate
  - 레이어: A (T-A2 후)
  - 구현 파일: `apps/backend/prisma/migrations/<ts>_catalog/migration.sql`
  - 관련 요구사항: FR-004~035 (테이블 실체화), PROC-003(스키마 확장 마이그레이션 검증)
  - 상세: `prisma migrate dev --name catalog` 로 마이그레이션 생성·로컬 적용. enum `CREATE TYPE` + 10 테이블 + User ALTER + 인덱스 포함 확인. `prisma generate` 로 신규 모델 클라이언트 재생성(Repository 타입 사용 전제). 기존 8 스키마 선언 불변(추가 CREATE SCHEMA 불필요 — users·products 기존재).
  - 완료 기준: `prisma migrate dev` 에러 0. PostgreSQL 에 users 4 + products 6 = 10 신규 테이블 생성. `@prisma/client` 에 신규 모델 타입 노출. 기존 users.users/refresh_tokens 무손상.

- [x] **T-A4** — 카테고리 seed
  - 레이어: A (T-A3 후)
  - 구현 파일: `apps/backend/prisma/seed.ts`(+ package.json `prisma.seed` 키) **또는** 마이그레이션 SQL `INSERT` (GAP-001 — DB Design Agent 메커니즘 확정)
  - 관련 요구사항: FR-018·019, ADR-010, SC-021
  - 상세: 기본 카테고리 N개(목록은 data-model.md 확정) 멱등 삽입. `prisma.seed` 키 방식 채택 시 ts-node(기존 devDep) 사용 — 신규 의존 0(SC-051 무영향). 마이그레이션 INSERT 방식 채택 시 package.json 무변경.
  - 완료 기준: seed 실행 후 `GET /categories` 가 카테고리 목록 반환(SC-021 데이터 전제). 멱등(중복 실행 안전).

### Layer B — 도메인 계층 (4단계 Development)

#### user 모듈 (FR-001~010)

- [x] **T-B1** `[P]` — user 상수 + UserRepository
  - 레이어: B (T-A3 후)
  - 구현 파일: `apps/backend/src/modules/user/user.constants.ts`, `user.repository.ts`
  - 관련 요구사항: FR-001~010, P-001, NFR-003
  - 상세: 상수 `MAX_PRODUCT_VIEWS=50`. UserRepository(**users 스키마 모델만**: user·address·wishlist·productView): `findUserById`, `updateUser(id,{name?,phone?})`, address CRUD(`createAddress`·`updateAddress`·`deleteAddress`·`findAddressById`·`findAddressesByUser`·`setDefaultTx`), wishlist(`createWishlist`·`deleteWishlist`·`findWishlistsByUser`), productView(`upsertProductView`·`findRecentViews(userId, take)`). 기본배송지 재지정·단일성은 `prisma.$transaction` 헬퍼.
  - 완료 기준: 자기 스키마 모델만 호출(SC-049). 트랜잭션 헬퍼 제공(ADR-008/009).

- [x] **T-B2** — UserService (프로필·배송지·찜·최근본상품)
  - 레이어: B (T-B1 후)
  - 구현 파일: `apps/backend/src/modules/user/user.service.ts`
  - 관련 요구사항: FR-001·002·003·004·005·006·007·008·010
  - 상세:
    - `getProfile(userId)` → `{id,email,name,phone}` (password 제외, FR-001).
    - `updateProfile(userId,{name?,phone?})` (FR-002).
    - `createAddress`(201, FR-003), `updateAddress`(본인 검증 `address.userId!==userId`→`ForbiddenException` 403, FR-004), `deleteAddress`(본인 검증→204, **기본배송지 삭제 시 단일 트랜잭션 내 잔여 `orderBy createdAt desc` 첫 행 isDefault=true, 잔여 0 이면 재지정 없음**, FR-005/ADR-008), `setDefaultAddress`(트랜잭션 내 기존 default updateMany false → 대상 update true, FR-006/ADR-009).
    - `addWishlist(userId,productId)`(@@unique 위반 P2002→`ConflictException` 409, productId 존재검증 안함, FR-007), `removeWishlist`(204, FR-007), `listWishlist`(FR-008).
    - `listRecentViews(userId)` → `findRecentViews(userId, MAX_PRODUCT_VIEWS)` 최신순(FR-010).
    - `recordProductView(userId,productId)` → upsertProductView(viewedAt=now). (T-B3 핸들러가 호출, FR-009)
  - 완료 기준: 각 FR 분기 동작. 본인 소유 검증 403. 동일 가드 조건(기본배송지 삭제/지정) 트랜잭션 통합(§E).

- [x] **T-B3** — user.events (product.viewed 구독)
  - 레이어: B (T-B2 후)
  - 구현 파일: `apps/backend/src/modules/user/user.events.ts`
  - 관련 요구사항: FR-009, ADR-002·014, SC-011
  - 상세: `@Injectable()` `UserEventsHandler` + `@OnEvent('product.viewed')` `handle({userId,productId})` → `UserService.recordProductView`. 내부 try/catch + 로깅(best-effort, 주 응답 비차단). UserService 만 주입(cross-schema DI 없음).
  - 완료 기준: product.viewed 발행 시 product_views upsert(SC-011). 핸들러 예외가 발행 측 응답 차단 안 함.

#### seller 모듈 (FR-011~017) — product 보다 먼저

- [x] **T-B4** `[P]` — SellerRepository
  - 레이어: B (T-A3 후)
  - 구현 파일: `apps/backend/src/modules/seller/seller.repository.ts`
  - 관련 요구사항: FR-011~017, P-001
  - 상세: **users 스키마 seller 모델만**: `createSeller`, `findByUserId`, `findById`, `updateSeller`, `updateStatus(id,status,rejectReason?)`. @@unique([userId]) 위반 감지.
  - 완료 기준: 자기 스키마만 접근(SC-049).

- [x] **T-B5** — SellerService (등록·프로필·심사·승인/거부 + 공개 getApprovedSeller)
  - 레이어: B (T-B4 후)
  - 구현 파일: `apps/backend/src/modules/seller/seller.service.ts`
  - 관련 요구사항: FR-011·012·013·014·015·016·017, ADR-006
  - 상세:
    - `register(userId,dto)` → status=PENDING 생성. 중복 신청(@@unique 위반)→`ConflictException` 409(FR-011/SC-013).
    - `getMyProfile(userId)`(FR-012), `updateMyProfile`(FR-013), `getStatus(userId)`→`{status,rejectReason}`(FR-014).
    - `approve(sellerId)`→status APPROVED(FR-015), `reject(sellerId,rejectReason)`→REJECTED+rejectReason(FR-016). RBAC 미적용(ASM-005, 컨트롤러 가드 자리만 확보).
    - **공개 메서드** `getApprovedSeller(userId): Promise<{id,userId}>` — findByUserId 후 status≠APPROVED 면 `ForbiddenException`(403). product 모듈이 DI 소비(FR-017/019, SC-019·020·023).
  - 완료 기준: 인터페이스 계약(plan)대로 메서드 시그니처. SellerModule 이 SellerService export.

#### inventory 모듈 (FR-030~035) — product 보다 먼저

- [x] **T-B6** `[P]` — InsufficientStockException + InventoryRepository
  - 레이어: B (T-A3 후)
  - 구현 파일: `apps/backend/src/modules/inventory/inventory.exception.ts`, `inventory.repository.ts`
  - 관련 요구사항: FR-030·031·032·033·034·035, P-001, ADR-005
  - 상세: `InsufficientStockException extends HttpException`(409 또는 422 — data-model/plan 기준 409). InventoryRepository(**products 스키마 inventory·inventoryLog 모델만**): `findByVariant`, `createInventory`(initStock용), `increment(variantId,qty)`(stock-in), `conditionalDecrement(variantId,qty): Promise<{count}>`(`updateMany where quantity>=qty decrement`), `appendLog({variantId,productId,type,delta,orderId?})`, `sumQuantityByProduct(productId)`(총재고 합산). **log update/delete 메서드 미존재**(append-only, SC-043).
  - 완료 기준: 조건부 감소 단일 statement. 로그 수정/삭제 메서드 부재(정적 검증 대상). 자기 스키마만(SC-049).

- [x] **T-B7** — InventoryService + inventory.events (stock-changed 발행)
  - 레이어: B (T-B6 후)
  - 구현 파일: `apps/backend/src/modules/inventory/inventory.service.ts`, `inventory.events.ts`
  - 관련 요구사항: FR-030·031·032·033·034·035, ADR-004·005·014, NFR-003
  - 상세(공개 메서드 시그니처 plan 인터페이스 계약 고정):
    - `initStock(variantId,productId,quantity)` → Inventory row 생성(quantity, 음수 금지 400) + log(INIT). product variant 생성 시 DI 호출(FR-025 보조).
    - `stockIn(variantId,quantity)` → increment + log(STOCK_IN) + `emitStockChanged(productId)`(FR-030/SC-041).
    - `getStock(variantId)` → 현재 quantity(FR-031/SC-042).
    - `checkAvailability(variantId,quantity): Promise<boolean>` → quantity 이상 여부, 부수효과 없음(FR-033/SC-044).
    - `decreaseStock(variantId,quantity,orderId): Promise<void>` → conditionalDecrement → `count===0` 시 `InsufficientStockException` throw, 성공 시 log(DECREASE,-qty,orderId) + emitStockChanged(FR-034·035/SC-045·046). tx 파라미터 없음(003 컨텍스트 전파 전제).
    - private `emitStockChanged(productId)` → `sumQuantityByProduct` → `eventEmitter.emit('inventory.stock-changed',{productId,totalStock})`.
  - 완료 기준: 공개 메서드 시그니처 정확(SC-044/045 정적). 재고 부족 throw(SC-046). stock-in 시 stock-changed 발행. InventoryModule 이 InventoryService export.

#### product 모듈 (FR-018~029) — inventory·seller DI

- [x] **T-B8** `[P]` — product 상수 + ProductRepository
  - 레이어: B (T-A3 후)
  - 구현 파일: `apps/backend/src/modules/product/product.constants.ts`, `product.repository.ts`
  - 관련 요구사항: FR-018~029, NFR-001, P-001, ADR-007·011
  - 상세: 상수 `MAX_PRODUCT_IMAGES=10`·`DEFAULT_PAGE_LIMIT=20`·`MAX_PAGE_LIMIT=100`. ProductRepository(**products 스키마 category·product·productImage·variant 모델만**): category(`findCategories`·`findCategoryById`), product(`createProduct`·`findById`·`updateProduct`·`updateStatus`·`listPublic(cursor,take)`·`listBySeller(sellerId)`), variant(`createVariant`·`updateVariant`·`deleteVariant`·`findVariantById`), image(`countImages(productId)`·`createImage`·`deleteImage`). `listPublic` = `where status in [ACTIVE,OUT_OF_STOCK]`, cursor=id, `skip: cursor?1:0`, `orderBy:[{createdAt:desc},{id:desc}]`, `take`.
  - 완료 기준: 자기 스키마만(SC-049). cursor 페이지네이션 쿼리(ADR-007). inventory 직접 미접근(재고는 InventoryService DI).

- [x] **T-B9** — ProductService (상품·variant·이미지·목록·상세 + product.viewed 발행)
  - 레이어: B (T-B5·T-B7·T-B8 후 — SellerService·InventoryService DI)
  - 구현 파일: `apps/backend/src/modules/product/product.service.ts`
  - 관련 요구사항: FR-018·019·020·021·022·025·026·027·028·029·009
  - 상세:
    - `listCategories()`(FR-018/SC-021).
    - `createProduct(userId,dto)` → `SellerService.getApprovedSeller(userId)`(비승인 403, SC-023/019/020) → categoryId 존재검증(부재 400) → DRAFT 생성, sellerId(plain String) 저장(FR-019/SC-022).
    - `updateProduct(userId,id,dto)` → 소유 검증(product.sellerId vs 사용자 sellerId 불일치 403, SC-025) → 수정(FR-020/SC-024).
    - `publish(userId,id)`: status∈{DRAFT,INACTIVE}→ACTIVE(FR-021/SC-026·027). `deactivate`: status∈{ACTIVE,OUT_OF_STOCK}→INACTIVE(FR-022/SC-028·029). 소유 검증 공통.
    - `addVariant(userId,id,dto)` → 소유 검증 → variant 생성 후 `InventoryService.initStock(variantId,productId,stock)` DI(FR-025/SC-032). `updateVariant`(SC-033)·`deleteVariant`(SC-034).
    - `addImage(userId,id,dto)` → 소유 검증 → `countImages>=MAX_PRODUCT_IMAGES(10)`→400(SC-036) → 생성(SC-035). `deleteImage`(SC-037).
    - `listPublic(cursor,limit)` → limit clamp [1,MAX_PAGE_LIMIT], 기본 DEFAULT_PAGE_LIMIT → `{items,nextCursor}`(FR-027/SC-038).
    - `getDetail(id, user?)` → status∉{ACTIVE,OUT_OF_STOCK}→`NotFoundException` 404(FR-028/SC-039). user 존재 시 `eventEmitter.emit('product.viewed',{userId:user.userId,productId:id})`(FR-009/SC-011).
    - `listMyProducts(userId)` → getApprovedSeller → `listBySeller(sellerId)` 전체 상태(FR-029/SC-040).
  - 완료 기준: 각 FR 분기·상태머신·소유/승인 가드 동작. variant 생성 시 initStock DI. 상세 조회 시 옵셔널 인증 emit.

- [x] **T-B10** — product.events (inventory.stock-changed 구독 → 자동 상태 전이)
  - 레이어: B (T-B9 후)
  - 구현 파일: `apps/backend/src/modules/product/product.events.ts`
  - 관련 요구사항: FR-023·024, ADR-004·014, SC-030·031
  - 상세: `@Injectable()` `ProductEventsHandler` + `@OnEvent('inventory.stock-changed')` `handle({productId,totalStock})` → 현재 status 조회 → `totalStock===0 && status===ACTIVE`→OUT_OF_STOCK / `totalStock>0 && status===OUT_OF_STOCK`→ACTIVE. DRAFT/INACTIVE 비전이. 멱등(현재 status 비교). 내부 try/catch + 로깅(best-effort). ProductService(또는 ProductRepository.updateStatus) 만 주입.
  - 완료 기준: totalStock 임계값 0 기준 ACTIVE↔OUT_OF_STOCK 전이(SC-030/031). DRAFT/INACTIVE 무전이.

### Layer C — 인터페이스 계층 (4단계 Development)

- [x] **T-C1** `[P]` — OptionalJwtAuthGuard (shared/auth)
  - 레이어: C
  - 구현 파일: `apps/backend/src/shared/auth/optional-jwt-auth.guard.ts`, `auth-shared.module.ts`(수정)
  - 관련 요구사항: FR-009·028, NFR-002, ADR-012
  - 상세: `OptionalJwtAuthGuard extends AuthGuard('jwt')` + `handleRequest(err,user)` override → 토큰 부재/무효 시 throw 대신 `user ?? undefined` 반환(401 미발생). AuthSharedModule providers/exports 에 추가(비파괴적, 기존 JwtAuthGuard 무변경).
  - 완료 기준: 토큰 없이 통과(user=undefined), 유효 토큰 시 user 추출. GET /products/:id 가 주입 가능.

- [x] **T-C2** — user.controller + DTO + 모듈 결선
  - 레이어: C (T-B2·T-B3 후)
  - 구현 파일: `apps/backend/src/modules/user/user.controller.ts`, `dto/{update-profile,create-address,update-address}.dto.ts`, `user.module.ts`(수정)
  - 관련 요구사항: FR-001~010, NFR-002, SC-001~010·012
  - 상세: 10 엔드포인트(plan §1 표) 전부 `@UseGuards(JwtAuthGuard)`+`@CurrentUser()`. DTO `class-validator`(name/phone optional, address 필수 필드). HTTP 상태: POST address 201, DELETE 204, 찜중복 409, 타인주소 403. user.module 에 controller·UserService·UserRepository·UserEventsHandler provider 등록(AuthSharedModule import).
  - 완료 기준: 인터페이스 계약 표대로 상태코드·응답(password 제외). 비인증 401(SC-002).

- [x] **T-C3** — seller.controller + DTO + 모듈 결선
  - 레이어: C (T-B5 후)
  - 구현 파일: `apps/backend/src/modules/seller/seller.controller.ts`, `dto/{register-seller,update-seller,reject-seller}.dto.ts`, `seller.module.ts`(수정)
  - 관련 요구사항: FR-011~016, SC-013~018
  - 상세: 6 엔드포인트(plan §2 표). 전부 `@UseGuards(JwtAuthGuard)`(approve/reject 는 ASM-005 — JWT 만, **후속 RBAC Guard 데코레이터 자리 주석 확보**). register DTO(businessName·businessNumber·representativeName 필수, contactPhone·businessAddress optional), reject DTO(rejectReason). seller.module 에 controller·SellerService·SellerRepository 등록 + **SellerService exports**(product DI), AuthSharedModule import.
  - 완료 기준: 상태코드·응답(plan). SellerModule exports SellerService.

- [x] **T-C4** — product.controller(+category) + DTO + 모듈 결선
  - 레이어: C (T-B9·T-B10·T-C1 후)
  - 구현 파일: `apps/backend/src/modules/product/product.controller.ts`(또는 category 별도 라우트), `dto/{create-product,update-product,create-variant,update-variant,create-image,list-products}.dto.ts`, `product.module.ts`(수정)
  - 관련 요구사항: FR-018~029, NFR-002, SC-021~040
  - 상세: plan §3 표 엔드포인트. 가드: `GET /categories`·`GET /products` 무가드, `GET /products/:id` `OptionalJwtAuthGuard`, 나머지 `JwtAuthGuard`. list DTO(after?·limit? `@IsInt @Min @Max`). product.module 에 controller·ProductService·ProductRepository·ProductEventsHandler 등록 + **`imports:[SellerModule, InventoryModule, AuthSharedModule]`**(DI). 순환 import 없음(research 검증).
  - 완료 기준: 가드 배치·상태코드(403/404/400). cursor 응답 `{items,nextCursor}`. variant 생성 시 initStock 연동.

- [x] **T-C5** `[P]` — inventory.controller + DTO + 모듈 결선
  - 레이어: C (T-B7 후)
  - 구현 파일: `apps/backend/src/modules/inventory/inventory.controller.ts`, `dto/stock-in.dto.ts`, `inventory.module.ts`(수정)
  - 관련 요구사항: FR-030·031, SC-041·042
  - 상세: 2 엔드포인트(`POST /inventory/:variantId/stock-in`·`GET /inventory/:variantId/stock`) `@UseGuards(JwtAuthGuard)` + 승인 판매자 검증(SellerService.getApprovedSeller 또는 컨트롤러 가드). stock-in DTO(`quantity @IsInt @Min(1)`). inventory.module 에 controller·InventoryService·InventoryRepository·InventoryEventsHandler 등록 + **InventoryService exports**(product DI) + SellerModule import(승인 검증 시), AuthSharedModule import.
  - 완료 기준: 상태코드·응답. InventoryModule exports InventoryService.

> **승인 판매자 검증 위치(inventory)**: FR-030/031 은 "APPROVED 판매자". inventory.controller 가 `SellerService.getApprovedSeller(userId)` DI 호출로 검증하거나, product 와 동일 패턴의 가드. InventoryModule 이 SellerModule import(seller 는 inventory 비의존 → 순환 없음). 구현 시 product 의 승인 검증과 일관 패턴 적용.

### Layer D — 테스트 계층 (5a Test AUTHORING)

> 본 레이어는 **5a Test Agent(AUTHORING)** 가 PPG-1 병렬로 작성(TDD Red). 4단계 Development 는 작성하지 않는다. 산출물은 `*.spec.ts`/`apps/backend/test/`. SC 매핑은 [Test Authoring Contract](#test-authoring-contract) 참조.

- [ ] **T-D1** — user 단위 테스트 ([env:unit])
  - 레이어: D | 검증 대상: SC-001·002·003·004·005·006·007·008·009·010·011·012
  - 테스트 파일: `src/modules/user/user.service.spec.ts`, `src/modules/user/user.events.spec.ts`, `src/modules/user/user.controller.spec.ts`
  - 상세: UserRepository·EventEmitter mock. 프로필 password 제외·타인주소 403·기본배송지 삭제 자동재지정·기본배송지 단일성·찜 중복 409·최근본상품 50 상한·product.viewed→upsert·비인증 401(가드 메타데이터).
  - 완료 기준: 각 SC 단위 단언 통과(production Green 후).

- [ ] **T-D2** — seller 단위 테스트 ([env:unit])
  - 레이어: D | 검증 대상: SC-013·014·015·016·017·018
  - 테스트 파일: `src/modules/seller/seller.service.spec.ts`
  - 상세: SellerRepository mock. 등록 PENDING·중복 409·프로필·심사상태·approve→APPROVED·reject→REJECTED+rejectReason·getApprovedSeller(비승인 ForbiddenException).
  - 완료 기준: 각 SC 단위 단언 통과.

- [ ] **T-D3** — product 단위 테스트 ([env:unit])
  - 레이어: D | 검증 대상: SC-019·020·021·022·023·024·025·026·027·028·029·030·031·032·033·034·035·036·037·038·039·040
  - 테스트 파일: `src/modules/product/product.service.spec.ts`, `src/modules/product/product.events.spec.ts`
  - 상세: ProductRepository·SellerService·InventoryService·EventEmitter mock. 비승인 403(getApprovedSeller throw)·카테고리목록·DRAFT 생성·타인수정 403·상태머신(publish/deactivate)·variant CRUD+initStock 호출·이미지 10초과 400·cursor 목록 필터·단건 404·본인 전체목록·자동전이(stock-changed totalStock 0/>0).
  - 완료 기준: 각 SC 단위 단언 통과.

- [ ] **T-D4** — inventory 단위 테스트 ([env:unit])
  - 레이어: D | 검증 대상: SC-041·042·046
  - 테스트 파일: `src/modules/inventory/inventory.service.spec.ts`
  - 상세: InventoryRepository·EventEmitter mock. stock-in 증가+log(IN)+stock-changed emit·재고조회·decreaseStock 부족 시 InsufficientStockException(conditionalDecrement count=0).
  - 완료 기준: 각 SC 단위 단언 통과.

- [ ] **T-D5** `[P]` — 정적·인증 횡단 테스트 ([env:static]/[env:unit])
  - 레이어: D | 검증 대상: SC-043·044·045·048·049·050·051
  - 테스트 파일: `test/static/inventory-log-append-only.spec.ts`, `test/static/inventory-service-signature.spec.ts`, `test/static/cross-schema.spec.ts`, `test/static/schema-decimal.spec.ts`, `test/static/package-no-aws.spec.ts`, `test/static/auth-required-guards.spec.ts`
  - 상세: (SC-043) inventory.repository/controller 에 log update/delete 메서드·라우트 부재 grep. (SC-044/045) InventoryService 에 checkAvailability/decreaseStock 시그니처 존재(reflect/소스 파싱). (SC-049) 각 repository 가 자기 스키마 외 Prisma 모델(`prisma.<타스키마모델>`) 직접 참조 0 — user/seller repo 는 product 계열 모델 미참조, product/inventory repo 는 user 계열 모델 미참조 grep. (SC-050) schema.prisma price `Decimal` 선언. (SC-051) package.json `@aws-sdk/*` 신규 0. (SC-048) 인증 필수 컨트롤러 메서드에 JwtAuthGuard 메타데이터 존재(reflect).
  - 완료 기준: 각 정적/메타데이터 단언 통과.

- [ ] **T-D6** — products 통합 테스트 ([env:integration], 옵션 A)
  - 레이어: D | 검증 대상: SC-047
  - 테스트 파일: `test/products.e2e-spec.ts`
  - 상세: supertest. 상품 <1000 seed 후 `GET /products?limit=20` 연속 측정 P95≤500ms(NFR-001). 실행은 **옵션 A**(plan 확정): main 이 Docker Compose+`prisma migrate dev`+seed+앱 기동+부하 측정 절차 제시 → 사용자 실행 → P95 결과 전달 → Test Agent(EXECUTION) 검증.
  - 완료 기준: SC-047 통합 단언(옵션 A 결과 기반).

---

## Test Authoring Contract

> **PPG-1 의 5a 단계 Test Agent(AUTHORING) 입력 contract.** 각 SC-XXX → 테스트 파일·함수명 후보 + 시나리오 유형 + 환경 태그.
> 함수명 규약: `when_<조건>_then_<결과>` (Jest `it('...')` 설명문 동등). Happy/Edge/Error 3유형 표기.

| SC-ID | 수용 기준(요약) | 유형 | 테스트 파일 경로 | it 후보 | env |
|---|---|---|---|---|---|
| SC-001 | GET /users/me {id,email,name,phone}(password 제외) | Happy | src/modules/user/user.service.spec.ts | when_get_me_then_profile_without_password | unit |
| SC-002 | 비인증 GET /users/me 401 | Error | src/modules/user/user.controller.spec.ts | when_no_token_then_users_me_401 | unit |
| SC-003 | PATCH /users/me {name,phone} 반영 | Happy | src/modules/user/user.service.spec.ts | when_update_profile_then_persisted | unit |
| SC-004 | POST addresses 201 | Happy | src/modules/user/user.service.spec.ts | when_create_address_then_201_created | unit |
| SC-005 | 본인 주소 수정 반영 / 타인 403 | Happy/Error | src/modules/user/user.service.spec.ts | when_update_own_address_then_ok_else_403 | unit |
| SC-006 | 기본배송지 삭제 자동 재지정 204 | Edge | src/modules/user/user.service.spec.ts | when_delete_default_address_then_reassign_latest | unit |
| SC-007 | 기본배송지 지정 단일성 | Happy | src/modules/user/user.service.spec.ts | when_set_default_then_previous_unset | unit |
| SC-008 | 찜 추가 / 중복 409 | Happy/Error | src/modules/user/user.service.spec.ts | when_add_wishlist_dup_then_conflict_409 | unit |
| SC-009 | 찜 제거 204 | Happy | src/modules/user/user.service.spec.ts | when_remove_wishlist_then_204 | unit |
| SC-010 | 찜 목록 반환 | Happy | src/modules/user/user.service.spec.ts | when_list_wishlist_then_items | unit |
| SC-011 | product.viewed → product_views upsert | Happy | src/modules/user/user.events.spec.ts | when_product_viewed_then_view_upserted | unit |
| SC-012 | 최근본상품 최신순 50 상한 | Edge | src/modules/user/user.service.spec.ts | when_views_over_50_then_latest_50 | unit |
| SC-013 | 판매자 등록 PENDING / 중복 409 | Happy/Error | src/modules/seller/seller.service.spec.ts | when_register_seller_dup_then_conflict_409 | unit |
| SC-014 | GET /sellers/me 프로필 | Happy | src/modules/seller/seller.service.spec.ts | when_get_my_seller_then_profile | unit |
| SC-015 | PATCH /sellers/me 반영 | Happy | src/modules/seller/seller.service.spec.ts | when_update_my_seller_then_persisted | unit |
| SC-016 | GET /sellers/me/status {status,rejectReason} | Happy | src/modules/seller/seller.service.spec.ts | when_get_status_then_status_and_reason | unit |
| SC-017 | approve → APPROVED | Happy | src/modules/seller/seller.service.spec.ts | when_approve_then_status_approved | unit |
| SC-018 | reject → REJECTED + rejectReason | Happy | src/modules/seller/seller.service.spec.ts | when_reject_then_rejected_with_reason | unit |
| SC-019 | PENDING 판매자 POST /products 403 | Error | src/modules/product/product.service.spec.ts | when_pending_seller_create_product_then_403 | unit |
| SC-020 | REJECTED 판매자 POST /products 403 | Error | src/modules/product/product.service.spec.ts | when_rejected_seller_create_product_then_403 | unit |
| SC-021 | GET /categories 비인증 목록 | Happy | src/modules/product/product.service.spec.ts | when_get_categories_then_list | unit |
| SC-022 | APPROVED POST /products DRAFT | Happy | src/modules/product/product.service.spec.ts | when_approved_create_product_then_draft | unit |
| SC-023 | 비승인 POST /products 403 | Error | src/modules/product/product.service.spec.ts | when_unapproved_create_product_then_403 | unit |
| SC-024 | 본인 상품 수정 반영 | Happy | src/modules/product/product.service.spec.ts | when_update_own_product_then_persisted | unit |
| SC-025 | 타인 상품 수정 403 | Error | src/modules/product/product.service.spec.ts | when_update_others_product_then_403 | unit |
| SC-026 | publish DRAFT→ACTIVE | Happy | src/modules/product/product.service.spec.ts | when_publish_draft_then_active | unit |
| SC-027 | publish INACTIVE→ACTIVE | Happy | src/modules/product/product.service.spec.ts | when_publish_inactive_then_active | unit |
| SC-028 | deactivate ACTIVE→INACTIVE | Happy | src/modules/product/product.service.spec.ts | when_deactivate_active_then_inactive | unit |
| SC-029 | deactivate OUT_OF_STOCK→INACTIVE | Happy | src/modules/product/product.service.spec.ts | when_deactivate_oos_then_inactive | unit |
| SC-030 | 재고0 자동 OUT_OF_STOCK | Edge | src/modules/product/product.events.spec.ts | when_stock_zero_active_then_out_of_stock | unit |
| SC-031 | 재고복구 자동 ACTIVE | Edge | src/modules/product/product.events.spec.ts | when_stock_positive_oos_then_active | unit |
| SC-032 | variant 생성 + initStock | Happy | src/modules/product/product.service.spec.ts | when_create_variant_then_init_stock_called | unit |
| SC-033 | variant 수정 반영 | Happy | src/modules/product/product.service.spec.ts | when_update_variant_then_persisted | unit |
| SC-034 | variant 삭제 | Happy | src/modules/product/product.service.spec.ts | when_delete_variant_then_removed | unit |
| SC-035 | 이미지 추가 | Happy | src/modules/product/product.service.spec.ts | when_add_image_then_created | unit |
| SC-036 | 이미지 10초과 400 | Edge | src/modules/product/product.service.spec.ts | when_image_over_10_then_400 | unit |
| SC-037 | 이미지 삭제 | Happy | src/modules/product/product.service.spec.ts | when_delete_image_then_removed | unit |
| SC-038 | 목록 cursor·ACTIVE+OOS 필터 | Happy/Edge | src/modules/product/product.service.spec.ts | when_list_products_then_cursor_active_oos_only | unit |
| SC-039 | 단건 ACTIVE/OOS 상세 / DRAFT·INACTIVE 404 | Happy/Error | src/modules/product/product.service.spec.ts | when_get_detail_visible_then_ok_else_404 | unit |
| SC-040 | 본인 전체상태 목록 | Happy | src/modules/product/product.service.spec.ts | when_list_my_products_then_all_statuses | unit |
| SC-041 | stock-in 증가 + log(IN) | Happy | src/modules/inventory/inventory.service.spec.ts | when_stock_in_then_increment_and_log | unit |
| SC-042 | 재고 조회 | Happy | src/modules/inventory/inventory.service.spec.ts | when_get_stock_then_quantity | unit |
| SC-043 | inventory_logs append-only(update/delete 부재) | Happy | test/static/inventory-log-append-only.spec.ts | when_inventory_repo_then_no_log_mutation_methods | static |
| SC-044 | checkAvailability 시그니처 | Happy | test/static/inventory-service-signature.spec.ts | when_inventory_service_then_check_availability_signature | static |
| SC-045 | decreaseStock 시그니처 | Happy | test/static/inventory-service-signature.spec.ts | when_inventory_service_then_decrease_stock_signature | static |
| SC-046 | 재고 부족 InsufficientStockException | Error | src/modules/inventory/inventory.service.spec.ts | when_decrease_insufficient_then_exception | unit |
| SC-047 | GET /products P95 ≤500ms | Edge(성능) | test/products.e2e-spec.ts | when_50_list_requests_then_p95_under_500ms | integration |
| SC-048 | 인증필수 endpoint 토큰없음 401 | Error | test/static/auth-required-guards.spec.ts | when_protected_routes_then_jwt_guard_present | unit |
| SC-049 | cross-schema Prisma 모델 미참조 | Happy | test/static/cross-schema.spec.ts | when_repositories_then_no_foreign_schema_model_ref | static |
| SC-050 | price Decimal 선언 | Happy | test/static/schema-decimal.spec.ts | when_schema_prisma_then_price_decimal | static |
| SC-051 | @aws-sdk/* 신규 0 | Happy | test/static/package-no-aws.spec.ts | when_package_json_then_no_new_aws_sdk | static |

> [env:integration] SC(SC-047)는 옵션 A(plan.md 확정)로 실행: main 이 절차 제시→사용자 실행→결과 전달→Test Agent(EXECUTION) 검증.
> [env:static]·[env:unit] SC(SC-047 외 50건)는 Test Agent 가 직접 실행·정적 검증.
> 외부 contract 공급(다른 agent/사용자/CI) 시 main 이 `ExternalAuthoring: YES` 로 5a 호출, 산출물(test 파일) 존재 확인 후 5b 진입.

---

## FR 커버리지 역방향 검증

> 모든 FR-001~035 가 ≥1 태스크에 매핑됨을 확인(근거 없는 태스크 0건).

| FR | 구현 태스크 | 테스트 태스크(SC) |
|---|---|---|
| FR-001·002 | T-B2/T-C2 | T-D1(SC-001·002·003) |
| FR-003·004·005·006 | T-B1/T-B2/T-C2 | T-D1(SC-004·005·006·007) |
| FR-007·008 | T-B2/T-C2 | T-D1(SC-008·009·010) |
| FR-009 | T-B9 발행 / T-B3 구독 | T-D1(SC-011) |
| FR-010 | T-B2/T-C2 | T-D1(SC-012) |
| FR-011·012·013·014·015·016 | T-B5/T-C3 | T-D2(SC-013~018) |
| FR-017 | T-B5 getApprovedSeller / T-B9 | T-D3(SC-019·020·023) |
| FR-018·019·020·021·022 | T-B8/T-B9/T-C4 | T-D3(SC-021~029) |
| FR-023·024 | T-B10 | T-D3(SC-030·031) |
| FR-025 | T-B9/T-C4 + T-B7 initStock | T-D3(SC-032·033·034) |
| FR-026 | T-B9/T-C4 | T-D3(SC-035·036·037) |
| FR-027·028·029 | T-B8/T-B9/T-C4 | T-D3(SC-038·039·040) |
| FR-030·031 | T-B7/T-C5 | T-D4(SC-041·042) |
| FR-032 | T-B6 (append-only repo) | T-D5(SC-043) |
| FR-033·034·035 | T-B7 | T-D4(SC-046)·T-D5(SC-044·045) |
| NFR-001 | T-A2(인덱스)/T-B8(cursor) | T-D6(SC-047) |
| NFR-002 | T-C1~C5(가드) | T-D5(SC-048)·T-D1(SC-002) |
| NFR-003 | 전 repository(자기 스키마) | T-D5(SC-049) |
| NFR-004 | T-A2(Decimal) | T-D5(SC-050) |
| NFR-005 | 신규 의존 0 | T-D5(SC-051) |

---

## 태스크 입도 가이드

- 1 태스크 ≈ 구현 파일 1~3개 + 대응 테스트 1개. Service 가 큰 모듈(user·product)은 repository/service/events 를 별 태스크로 분리해 SC 추적성 확보.
- 모듈 간 컴파일 의존: **seller·inventory(T-B5·T-B7) → product(T-B9)** 순서 준수(product 가 두 Service DI). user 는 product 비의존(독립 `[P]`).
- 이벤트 구독(T-B3·T-B10)은 `@OnEvent` 디커플링이라 발행 측과 컴파일 의존 없음 — 순서 자유.

---

## 구현 완료 기준

- [ ] 모든 태스크 체크박스 완료 (Layer A·B·C = 4단계, Layer D = 5a).
- [ ] [TypeScript] `turbo run lint` · `turbo run typecheck` 0 error.
- [ ] [TypeScript] `turbo run test`(단위·정적) 전체 PASS. integration(SC-047)은 옵션 A 결과로 검증.
- [ ] `prisma migrate dev` 에러 0 + users 4 + products 6 = 10 신규 테이블 생성. `prisma generate` 신규 모델 타입 노출.
- [ ] 기존 auth 32 테스트 회귀 0(User additive 확장 호환).
- [ ] cross-schema Prisma 모델 직접 참조 0(SC-049), price Decimal(SC-050), @aws-sdk 신규 0(SC-051).
- [ ] `git status` 의도치 않은 파일 없음.
