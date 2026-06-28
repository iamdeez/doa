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

```diff
diff --git a/apps/backend/prisma/migrations/migration_lock.toml b/apps/backend/prisma/migrations/migration_lock.toml
index 99e4f20..044d57c 100644
--- a/apps/backend/prisma/migrations/migration_lock.toml
+++ b/apps/backend/prisma/migrations/migration_lock.toml
@@ -1,3 +1,3 @@
 # Please do not edit this file manually
-# It should be added in your version-control system (i.e. Git)
+# It should be added in your version-control system (e.g., Git)
 provider = "postgresql"
diff --git a/apps/backend/prisma/schema.prisma b/apps/backend/prisma/schema.prisma
index 6a17c6f..13ec955 100644
--- a/apps/backend/prisma/schema.prisma
+++ b/apps/backend/prisma/schema.prisma
@@ -12,16 +12,22 @@ datasource db {
 }
 
 // ============================================================
-// users 스키마 — Stage 1 실체화 테이블
+// users 스키마 — Stage 1 + Stage 2 실체화 테이블
 // ============================================================
 
 /// 사용자 기본 정보. password 는 bcrypt 해시값만 저장 (NFR-005).
 model User {
-  id           String         @id @default(cuid())
-  email        String         @unique
-  password     String
-  createdAt    DateTime       @default(now())
+  id            String         @id @default(cuid())
+  email         String         @unique
+  password      String
+  name          String?
+  phone         String?
+  createdAt     DateTime       @default(now())
   refreshTokens RefreshToken[]
+  seller        Seller?
+  addresses     Address[]
+  wishlists     Wishlist[]
+  productViews  ProductView[]
 
   @@map("users")
   @@schema("users")
@@ -40,3 +46,193 @@ model RefreshToken {
   @@map("refresh_tokens")
   @@schema("users")
 }
+
+enum SellerStatus {
+  PENDING
+  APPROVED
+  REJECTED
+
+  @@schema("users")
+}
+
+/// 판매자 프로필. 사용자당 1건. 관리자 승인 후 상품 등록 가능.
+model Seller {
+  id                  String       @id @default(cuid())
+  userId              String       @unique
+  businessName        String
+  businessNumber      String
+  representativeName  String
+  contactPhone        String?
+  businessAddress     String?
+  status              SellerStatus @default(PENDING)
+  rejectReason        String?
+  createdAt           DateTime     @default(now())
+  user                User         @relation(fields: [userId], references: [id], onDelete: Cascade)
+
+  @@map("sellers")
+  @@schema("users")
+}
+
+/// 사용자 배송지 (최대 제한 없음, 기본 배송지 1건).
+model Address {
+  id            String   @id @default(cuid())
+  userId        String
+  recipientName String
+  phone         String
+  zipCode       String
+  address1      String
+  address2      String?
+  isDefault     Boolean  @default(false)
+  createdAt     DateTime @default(now())
+  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
+
+  @@index([userId])
+  @@map("addresses")
+  @@schema("users")
+}
+
+/// 찜 목록. productId 는 cross-schema plain String (FK 미선언, ADR-001, P-001).
+model Wishlist {
+  id        String   @id @default(cuid())
+  userId    String
+  /// cross-schema plain String — products.products.id 참조하지만 FK 미선언 (P-001 경계)
+  productId String
+  createdAt DateTime @default(now())
+  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
+
+  @@unique([userId, productId])
+  @@map("wishlists")
+  @@schema("users")
+}
+
+/// 최근 본 상품 기록. upsert 로 viewedAt 갱신. productId cross-schema plain String.
+model ProductView {
+  id        String   @id @default(cuid())
+  userId    String
+  /// cross-schema plain String — products.products.id 참조하지만 FK 미선언 (P-001 경계)
+  productId String
+  viewedAt  DateTime @default(now())
+  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
+
+  @@unique([userId, productId])
+  @@index([userId, viewedAt(sort: Desc)])
+  @@map("product_views")
+  @@schema("users")
+}
+
+// ============================================================
+// products 스키마 — Stage 2 실체화 테이블
+// ============================================================
+
+enum ProductStatus {
+  DRAFT
+  ACTIVE
+  OUT_OF_STOCK
+  INACTIVE
+
+  @@schema("products")
+}
+
+enum InventoryLogType {
+  STOCK_IN
+  DECREASE
+  INIT
+
+  @@schema("products")
+}
+
+/// 상품 카테고리. seed 데이터로 초기 8건 삽입 (ADR-010).
+model Category {
+  id           String    @id @default(cuid())
+  name         String
+  slug         String    @unique
+  displayOrder Int       @default(0)
+  products     Product[]
+
+  @@map("categories")
+  @@schema("products")
+}
+
+/// 상품. sellerId 는 cross-schema plain String (FK 미선언, ADR-001, P-001).
+model Product {
+  id          String         @id @default(cuid())
+  /// cross-schema plain String — users.sellers.id 참조하지만 FK 미선언 (P-001 경계)
+  sellerId    String
+  categoryId  String
+  title       String
+  description String?
+  /// 금전 필드 — 부동소수점 금지 (P-005, NFR-004)
+  price       Decimal        @db.Decimal(12, 2)
+  status      ProductStatus  @default(DRAFT)
+  createdAt   DateTime       @default(now())
+  category    Category       @relation(fields: [categoryId], references: [id])
+  images      ProductImage[]
+  variants    Variant[]
+  inventories Inventory[]
+
+  @@index([status, createdAt(sort: Desc), id(sort: Desc)])
+  @@map("products")
+  @@schema("products")
+}
+
+/// 상품 이미지. 상품당 최대 10개 (앱 레벨 검사, ADR-011).
+model ProductImage {
+  id           String  @id @default(cuid())
+  productId    String
+  url          String
+  displayOrder Int     @default(0)
+  product      Product @relation(fields: [productId], references: [id], onDelete: Cascade)
+
+  @@index([productId])
+  @@map("product_images")
+  @@schema("products")
+}
+
+/// 상품 옵션 변형. stock 컬럼 없음 — 재고는 Inventory 소유 (ADR-003).
+model Variant {
+  id          String      @id @default(cuid())
+  productId   String
+  optionName  String
+  optionValue String
+  sku         String      @unique
+  /// 금전 필드 — 부동소수점 금지 (P-005, NFR-004)
+  price       Decimal     @db.Decimal(12, 2)
+  product     Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
+  inventory   Inventory?
+
+  @@index([productId])
+  @@map("variants")
+  @@schema("products")
+}
+
+/// 재고 수량. variant 당 1행. quantity >= 0 보장 (조건부 감소 ADR-005).
+model Inventory {
+  id        String  @id @default(cuid())
+  variantId String  @unique
+  productId String
+  quantity  Int     @default(0)
+  variant   Variant @relation(fields: [variantId], references: [id], onDelete: Cascade)
+  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
+
+  @@index([productId])
+  @@map("inventory")
+  @@schema("products")
+}
+
+/// 재고 변동 이력. append-only — UPDATE/DELETE 미사용 (FR-032, SC-043).
+/// variantId/productId 는 plain String (이력 보존 우선, 삭제된 variant/product 이력도 보존).
+model InventoryLog {
+  id        String           @id @default(cuid())
+  /// plain String — append-only 이력 보존용. Cascade 미적용 (의도적).
+  variantId String
+  /// plain String — append-only 이력 보존용.
+  productId String
+  type      InventoryLogType
+  delta     Int
+  orderId   String?
+  createdAt DateTime         @default(now())
+
+  @@index([variantId, createdAt(sort: Desc)])
+  @@map("inventory_logs")
+  @@schema("products")
+}
diff --git a/apps/backend/src/modules/inventory/inventory.controller.ts b/apps/backend/src/modules/inventory/inventory.controller.ts
index e3d1cfc..baf385a 100644
--- a/apps/backend/src/modules/inventory/inventory.controller.ts
+++ b/apps/backend/src/modules/inventory/inventory.controller.ts
@@ -1,4 +1,48 @@
-import { Controller } from '@nestjs/common';
+import {
+  Body,
+  Controller,
+  Get,
+  HttpCode,
+  HttpStatus,
+  Param,
+  Post,
+  UseGuards,
+} from '@nestjs/common';
+import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
+import { CurrentUser } from '../../shared/auth/current-user.decorator';
+import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
+import { SellerService } from '../seller/seller.service';
+import { StockInDto } from './dto/stock-in.dto';
+import { InventoryService } from './inventory.service';
 
 @Controller('inventory')
-export class InventoryController {}
+@UseGuards(JwtAuthGuard)
+export class InventoryController {
+  constructor(
+    private readonly inventoryService: InventoryService,
+    private readonly sellerService: SellerService,
+  ) {}
+
+  /** POST /inventory/:variantId/stock-in — 재고 입고 (APPROVED 판매자만, FR-030, SC-041) */
+  @Post(':variantId/stock-in')
+  @HttpCode(HttpStatus.OK)
+  async stockIn(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('variantId') variantId: string,
+    @Body() dto: StockInDto,
+  ) {
+    // APPROVED 판매자 검증 — 비승인 시 ForbiddenException
+    await this.sellerService.getApprovedSeller(user.userId);
+    return this.inventoryService.stockIn(variantId, dto.quantity);
+  }
+
+  /** GET /inventory/:variantId/stock — 재고 수량 조회 (APPROVED 판매자만, FR-031, SC-042) */
+  @Get(':variantId/stock')
+  async getStock(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('variantId') variantId: string,
+  ) {
+    await this.sellerService.getApprovedSeller(user.userId);
+    return this.inventoryService.getStock(variantId);
+  }
+}
diff --git a/apps/backend/src/modules/inventory/inventory.events.ts b/apps/backend/src/modules/inventory/inventory.events.ts
index ca76aad..317498e 100644
--- a/apps/backend/src/modules/inventory/inventory.events.ts
+++ b/apps/backend/src/modules/inventory/inventory.events.ts
@@ -1 +1,3 @@
-// Inventory domain events scaffold (in-process via @nestjs/event-emitter)
+// inventory.stock-changed 이벤트는 InventoryService.emitStockChanged 에서 직접 emit.
+// ProductEventsHandler(product 모듈)가 구독하여 상품 상태 자동 전이 처리 (ADR-004·014).
+// 별도 이벤트 핸들러 클래스 불필요 — InventoryService 가 발행 주체.
diff --git a/apps/backend/src/modules/inventory/inventory.module.ts b/apps/backend/src/modules/inventory/inventory.module.ts
index 1d24587..2aa9602 100644
--- a/apps/backend/src/modules/inventory/inventory.module.ts
+++ b/apps/backend/src/modules/inventory/inventory.module.ts
@@ -1,10 +1,14 @@
 import { Module } from '@nestjs/common';
+import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
+import { SellerModule } from '../seller/seller.module';
 import { InventoryController } from './inventory.controller';
 import { InventoryRepository } from './inventory.repository';
 import { InventoryService } from './inventory.service';
 
 @Module({
+  imports: [SellerModule, AuthSharedModule],
   controllers: [InventoryController],
   providers: [InventoryService, InventoryRepository],
+  exports: [InventoryService],
 })
 export class InventoryModule {}
diff --git a/apps/backend/src/modules/inventory/inventory.repository.ts b/apps/backend/src/modules/inventory/inventory.repository.ts
index 9896515..b6ec027 100644
--- a/apps/backend/src/modules/inventory/inventory.repository.ts
+++ b/apps/backend/src/modules/inventory/inventory.repository.ts
@@ -1,4 +1,61 @@
 import { Injectable } from '@nestjs/common';
+import { Inventory, InventoryLog, InventoryLogType } from '@prisma/client';
+import { PrismaService } from '../../shared/prisma/prisma.service';
+
+// P-001: products 스키마(products.inventory, products.inventory_logs)에만 접근.
+// append-only 규칙: inventory_logs 에 대한 update/delete 메서드 미존재 (FR-032, SC-043).
 
 @Injectable()
-export class InventoryRepository {}
+export class InventoryRepository {
+  constructor(private readonly prisma: PrismaService) {}
+
+  async findByVariant(variantId: string): Promise<Inventory | null> {
+    return this.prisma.inventory.findUnique({ where: { variantId } });
+  }
+
+  async createInventory(data: {
+    variantId: string;
+    productId: string;
+    quantity: number;
+  }): Promise<Inventory> {
+    return this.prisma.inventory.create({ data });
+  }
+
+  async increment(variantId: string, qty: number): Promise<Inventory> {
+    return this.prisma.inventory.update({
+      where: { variantId },
+      data: { quantity: { increment: qty } },
+    });
+  }
+
+  /**
+   * 조건부 원자 감소 (ADR-005, SC-045):
+   * WHERE quantity >= qty 조건으로 단일 statement UPDATE.
+   * 반환 count=0 → 재고 부족 의미.
+   */
+  async conditionalDecrement(variantId: string, qty: number): Promise<{ count: number }> {
+    return this.prisma.inventory.updateMany({
+      where: { variantId, quantity: { gte: qty } },
+      data: { quantity: { decrement: qty } },
+    });
+  }
+
+  async sumQuantityByProduct(productId: string): Promise<number> {
+    const result = await this.prisma.inventory.aggregate({
+      where: { productId },
+      _sum: { quantity: true },
+    });
+    return result._sum.quantity ?? 0;
+  }
+
+  /** append-only: 새 로그 행 추가만 허용. 기존 로그 수정/삭제 메서드 없음. */
+  async appendLog(data: {
+    variantId: string;
+    productId: string;
+    type: InventoryLogType;
+    delta: number;
+    orderId?: string;
+  }): Promise<InventoryLog> {
+    return this.prisma.inventoryLog.create({ data });
+  }
+}
diff --git a/apps/backend/src/modules/inventory/inventory.service.ts b/apps/backend/src/modules/inventory/inventory.service.ts
index 73134f6..3909672 100644
--- a/apps/backend/src/modules/inventory/inventory.service.ts
+++ b/apps/backend/src/modules/inventory/inventory.service.ts
@@ -1,4 +1,97 @@
-import { Injectable } from '@nestjs/common';
+import { BadRequestException, Injectable } from '@nestjs/common';
+import { EventEmitter2 } from '@nestjs/event-emitter';
+import { InventoryLogType } from '@prisma/client';
+import { InsufficientStockException } from './inventory.exception';
+import { InventoryRepository } from './inventory.repository';
+
+export interface StockChangedEvent {
+  productId: string;
+  totalStock: number;
+}
 
 @Injectable()
-export class InventoryService {}
+export class InventoryService {
+  constructor(
+    private readonly inventoryRepository: InventoryRepository,
+    private readonly eventEmitter: EventEmitter2,
+  ) {}
+
+  /**
+   * variant 생성 시 재고 행 초기화 (FR-030, plan 인터페이스 계약).
+   * quantity 음수 금지.
+   */
+  async initStock(variantId: string, productId: string, quantity: number): Promise<void> {
+    if (quantity < 0) {
+      throw new BadRequestException('Initial quantity must not be negative');
+    }
+    await this.inventoryRepository.createInventory({ variantId, productId, quantity });
+    await this.inventoryRepository.appendLog({
+      variantId,
+      productId,
+      type: InventoryLogType.INIT,
+      delta: quantity,
+    });
+  }
+
+  /** 재고 입고 + 이벤트 발행 (FR-030, SC-041) */
+  async stockIn(variantId: string, quantity: number): Promise<void> {
+    const inv = await this.inventoryRepository.findByVariant(variantId);
+    if (!inv) throw new BadRequestException('Inventory not found for variant');
+
+    await this.inventoryRepository.increment(variantId, quantity);
+    await this.inventoryRepository.appendLog({
+      variantId,
+      productId: inv.productId,
+      type: InventoryLogType.STOCK_IN,
+      delta: quantity,
+    });
+    await this.emitStockChanged(inv.productId);
+  }
+
+  /** 현재 재고 수량 조회 (FR-031, SC-042) */
+  async getStock(variantId: string): Promise<number> {
+    const inv = await this.inventoryRepository.findByVariant(variantId);
+    if (!inv) return 0;
+    return inv.quantity;
+  }
+
+  /**
+   * 가용 재고 확인 (FR-033, SC-044). 부수효과 없음.
+   * plan 인터페이스 계약: checkAvailability(variantId: string, quantity: number): Promise<boolean>
+   */
+  async checkAvailability(variantId: string, quantity: number): Promise<boolean> {
+    const inv = await this.inventoryRepository.findByVariant(variantId);
+    if (!inv) return false;
+    return inv.quantity >= quantity;
+  }
+
+  /**
+   * 원자적 재고 차감 (FR-034·035, SC-045·046).
+   * plan 인터페이스 계약: decreaseStock(variantId: string, quantity: number, orderId: string): Promise<void>
+   * count=0 → InsufficientStockException.
+   */
+  async decreaseStock(variantId: string, quantity: number, orderId: string): Promise<void> {
+    const inv = await this.inventoryRepository.findByVariant(variantId);
+    if (!inv) throw new InsufficientStockException();
+
+    const result = await this.inventoryRepository.conditionalDecrement(variantId, quantity);
+    if (result.count === 0) {
+      throw new InsufficientStockException();
+    }
+
+    await this.inventoryRepository.appendLog({
+      variantId,
+      productId: inv.productId,
+      type: InventoryLogType.DECREASE,
+      delta: -quantity,
+      orderId,
+    });
+    await this.emitStockChanged(inv.productId);
+  }
+
+  private async emitStockChanged(productId: string): Promise<void> {
+    const totalStock = await this.inventoryRepository.sumQuantityByProduct(productId);
+    const event: StockChangedEvent = { productId, totalStock };
+    this.eventEmitter.emit('inventory.stock-changed', event);
+  }
+}
diff --git a/apps/backend/src/modules/product/product.controller.ts b/apps/backend/src/modules/product/product.controller.ts
index eaa7234..5cc9a0f 100644
--- a/apps/backend/src/modules/product/product.controller.ts
+++ b/apps/backend/src/modules/product/product.controller.ts
@@ -1,4 +1,179 @@
-import { Controller } from '@nestjs/common';
+import {
+  Body,
+  Controller,
+  Delete,
+  Get,
+  HttpCode,
+  HttpStatus,
+  Param,
+  Patch,
+  Post,
+  Query,
+  UseGuards,
+} from '@nestjs/common';
+import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
+import { OptionalJwtAuthGuard } from '../../shared/auth/optional-jwt-auth.guard';
+import { CurrentUser } from '../../shared/auth/current-user.decorator';
+import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
+import { AddImageDto } from './dto/add-image.dto';
+import { CreateProductDto } from './dto/create-product.dto';
+import { CreateVariantDto } from './dto/create-variant.dto';
+import { ListProductsDto } from './dto/list-products.dto';
+import { UpdateProductDto } from './dto/update-product.dto';
+import { UpdateVariantDto } from './dto/update-variant.dto';
+import { ProductService } from './product.service';
 
-@Controller('product')
-export class ProductController {}
+/** /categories — 인증 불필요 */
+@Controller('categories')
+export class CategoriesController {
+  constructor(private readonly productService: ProductService) {}
+
+  @Get()
+  listCategories() {
+    return this.productService.listCategories();
+  }
+}
+
+/** /sellers/me/products — 승인 판매자 본인 상품 목록 */
+@Controller('sellers/me')
+@UseGuards(JwtAuthGuard)
+export class SellerProductController {
+  constructor(private readonly productService: ProductService) {}
+
+  @Get('products')
+  listMyProducts(@CurrentUser() user: AuthenticatedUser) {
+    return this.productService.listMyProducts(user.userId);
+  }
+}
+
+/** /products — 상품 CRUD 및 public 조회 */
+@Controller('products')
+export class ProductController {
+  constructor(private readonly productService: ProductService) {}
+
+  // ── Public endpoints (no auth) ───────────────────────────────────────
+
+  /** GET /products — cursor 기반 공개 목록 (ACTIVE+OUT_OF_STOCK) */
+  @Get()
+  listPublic(@Query() query: ListProductsDto) {
+    return this.productService.listPublic(query.cursor, query.limit);
+  }
+
+  /** GET /products/:id — 상세 조회, 인증 시 조회 기록 */
+  @Get(':id')
+  @UseGuards(OptionalJwtAuthGuard)
+  getDetail(
+    @Param('id') productId: string,
+    @CurrentUser() user?: AuthenticatedUser,
+  ) {
+    return this.productService.getDetail(productId, user);
+  }
+
+  // ── Authenticated endpoints ──────────────────────────────────────────
+
+  /** POST /products — DRAFT 상품 생성 (APPROVED 판매자만) */
+  @Post()
+  @UseGuards(JwtAuthGuard)
+  @HttpCode(HttpStatus.CREATED)
+  createProduct(
+    @CurrentUser() user: AuthenticatedUser,
+    @Body() dto: CreateProductDto,
+  ) {
+    return this.productService.createProduct(user.userId, dto);
+  }
+
+  /** PATCH /products/:id — 상품 수정 (소유자만) */
+  @Patch(':id')
+  @UseGuards(JwtAuthGuard)
+  updateProduct(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('id') productId: string,
+    @Body() dto: UpdateProductDto,
+  ) {
+    return this.productService.updateProduct(user.userId, productId, dto);
+  }
+
+  /** PATCH /products/:id/publish — DRAFT/INACTIVE → ACTIVE */
+  @Patch(':id/publish')
+  @UseGuards(JwtAuthGuard)
+  publish(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('id') productId: string,
+  ) {
+    return this.productService.publish(user.userId, productId);
+  }
+
+  /** PATCH /products/:id/deactivate — ACTIVE/OUT_OF_STOCK → INACTIVE */
+  @Patch(':id/deactivate')
+  @UseGuards(JwtAuthGuard)
+  deactivate(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('id') productId: string,
+  ) {
+    return this.productService.deactivate(user.userId, productId);
+  }
+
+  // ── Variants ─────────────────────────────────────────────────────────
+
+  /** POST /products/:id/variants — variant 생성 + initStock */
+  @Post(':id/variants')
+  @UseGuards(JwtAuthGuard)
+  @HttpCode(HttpStatus.CREATED)
+  addVariant(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('id') productId: string,
+    @Body() dto: CreateVariantDto,
+  ) {
+    return this.productService.addVariant(user.userId, productId, dto);
+  }
+
+  /** PATCH /products/:id/variants/:variantId — variant 수정 */
+  @Patch(':id/variants/:variantId')
+  @UseGuards(JwtAuthGuard)
+  updateVariant(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('id') productId: string,
+    @Param('variantId') variantId: string,
+    @Body() dto: UpdateVariantDto,
+  ) {
+    return this.productService.updateVariant(user.userId, productId, variantId, dto);
+  }
+
+  /** DELETE /products/:id/variants/:variantId — variant 삭제 */
+  @Delete(':id/variants/:variantId')
+  @UseGuards(JwtAuthGuard)
+  @HttpCode(HttpStatus.NO_CONTENT)
+  deleteVariant(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('id') productId: string,
+    @Param('variantId') variantId: string,
+  ) {
+    return this.productService.deleteVariant(user.userId, productId, variantId);
+  }
+
+  // ── Images ───────────────────────────────────────────────────────────
+
+  /** POST /products/:id/images — 이미지 추가, 10개 초과 → 400 */
+  @Post(':id/images')
+  @UseGuards(JwtAuthGuard)
+  @HttpCode(HttpStatus.CREATED)
+  addImage(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('id') productId: string,
+    @Body() dto: AddImageDto,
+  ) {
+    return this.productService.addImage(user.userId, productId, dto);
+  }
+
+  /** DELETE /products/:id/images/:imageId — 이미지 삭제 */
+  @Delete(':id/images/:imageId')
+  @UseGuards(JwtAuthGuard)
+  @HttpCode(HttpStatus.NO_CONTENT)
+  deleteImage(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('id') productId: string,
+    @Param('imageId') imageId: string,
+  ) {
+    return this.productService.deleteImage(user.userId, productId, imageId);
+  }
+}
diff --git a/apps/backend/src/modules/product/product.events.ts b/apps/backend/src/modules/product/product.events.ts
index 7e57b93..83ad6db 100644
--- a/apps/backend/src/modules/product/product.events.ts
+++ b/apps/backend/src/modules/product/product.events.ts
@@ -1 +1,41 @@
-// Product domain events scaffold (in-process via @nestjs/event-emitter)
+import { Injectable, Logger } from '@nestjs/common';
+import { OnEvent } from '@nestjs/event-emitter';
+import { ProductStatus } from '@prisma/client';
+import { ProductRepository } from './product.repository';
+
+interface StockChangedEvent {
+  productId: string;
+  totalStock: number;
+}
+
+/**
+ * inventory.stock-changed 이벤트 구독 → 상품 상태 자동 전이 (FR-023·024, ADR-004·014).
+ * ACTIVE ↔ OUT_OF_STOCK 전이. DRAFT/INACTIVE 는 전이 없음.
+ * best-effort: 핸들러 예외가 발행 측 응답을 차단하지 않는다.
+ */
+@Injectable()
+export class ProductEventsHandler {
+  private readonly logger = new Logger(ProductEventsHandler.name);
+
+  constructor(private readonly productRepository: ProductRepository) {}
+
+  @OnEvent('inventory.stock-changed')
+  async handleStockChanged(event: StockChangedEvent): Promise<void> {
+    try {
+      const product = await this.productRepository.findById(event.productId);
+      if (!product) return;
+
+      const { status } = product;
+      const { totalStock } = event;
+
+      if (totalStock === 0 && status === ProductStatus.ACTIVE) {
+        await this.productRepository.updateStatus(event.productId, ProductStatus.OUT_OF_STOCK);
+      } else if (totalStock > 0 && status === ProductStatus.OUT_OF_STOCK) {
+        await this.productRepository.updateStatus(event.productId, ProductStatus.ACTIVE);
+      }
+      // DRAFT / INACTIVE — 전이 없음 (멱등)
+    } catch (err) {
+      this.logger.error('Failed to handle stock-changed event', err);
+    }
+  }
+}
diff --git a/apps/backend/src/modules/product/product.module.ts b/apps/backend/src/modules/product/product.module.ts
index bc264d5..cc25402 100644
--- a/apps/backend/src/modules/product/product.module.ts
+++ b/apps/backend/src/modules/product/product.module.ts
@@ -1,10 +1,19 @@
 import { Module } from '@nestjs/common';
-import { ProductController } from './product.controller';
+import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
+import { InventoryModule } from '../inventory/inventory.module';
+import { SellerModule } from '../seller/seller.module';
+import {
+  CategoriesController,
+  ProductController,
+  SellerProductController,
+} from './product.controller';
+import { ProductEventsHandler } from './product.events';
 import { ProductRepository } from './product.repository';
 import { ProductService } from './product.service';
 
 @Module({
-  controllers: [ProductController],
-  providers: [ProductService, ProductRepository],
+  imports: [SellerModule, InventoryModule, AuthSharedModule],
+  controllers: [ProductController, CategoriesController, SellerProductController],
+  providers: [ProductService, ProductRepository, ProductEventsHandler],
 })
 export class ProductModule {}
diff --git a/apps/backend/src/modules/product/product.repository.ts b/apps/backend/src/modules/product/product.repository.ts
index 3e948f9..186c1cd 100644
--- a/apps/backend/src/modules/product/product.repository.ts
+++ b/apps/backend/src/modules/product/product.repository.ts
@@ -1,4 +1,137 @@
 import { Injectable } from '@nestjs/common';
+import {
+  Category,
+  Prisma,
+  Product,
+  ProductImage,
+  ProductStatus,
+  Variant,
+} from '@prisma/client';
+import { PrismaService } from '../../shared/prisma/prisma.service';
+
+// P-001: products 스키마(products.categories, products.products, products.product_images, products.variants)에만 접근.
+// inventory 접근은 InventoryService DI 경유. user/seller 직접 접근 없음.
 
 @Injectable()
-export class ProductRepository {}
+export class ProductRepository {
+  constructor(private readonly prisma: PrismaService) {}
+
+  // ── Category ──────────────────────────────────────────────────────
+
+  async findCategories(): Promise<Category[]> {
+    return this.prisma.category.findMany({ orderBy: { displayOrder: 'asc' } });
+  }
+
+  async findCategoryById(id: string): Promise<Category | null> {
+    return this.prisma.category.findUnique({ where: { id } });
+  }
+
+  // ── Product ───────────────────────────────────────────────────────
+
+  async createProduct(data: {
+    sellerId: string;
+    categoryId: string;
+    title: string;
+    description?: string;
+    price: Prisma.Decimal | number | string;
+  }): Promise<Product> {
+    return this.prisma.product.create({ data: { ...data, status: ProductStatus.DRAFT } });
+  }
+
+  async findById(id: string): Promise<(Product & { images: ProductImage[]; variants: Variant[] }) | null> {
+    return this.prisma.product.findUnique({
+      where: { id },
+      include: { images: { orderBy: { displayOrder: 'asc' } }, variants: true },
+    });
+  }
+
+  async updateProduct(
+    id: string,
+    data: {
+      categoryId?: string;
+      title?: string;
+      description?: string | null;
+      price?: Prisma.Decimal | number | string;
+    },
+  ): Promise<Product> {
+    return this.prisma.product.update({ where: { id }, data });
+  }
+
+  async updateStatus(id: string, status: ProductStatus): Promise<Product> {
+    return this.prisma.product.update({ where: { id }, data: { status } });
+  }
+
+  /**
+   * 공개 상품 목록 (cursor 기반 페이지네이션, ADR-007, NFR-001):
+   * status IN [ACTIVE, OUT_OF_STOCK], orderBy [createdAt desc, id desc].
+   */
+  async listPublic(
+    cursor: string | undefined,
+    take: number,
+  ): Promise<Product[]> {
+    return this.prisma.product.findMany({
+      where: { status: { in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK] } },
+      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
+      cursor: cursor ? { id: cursor } : undefined,
+      skip: cursor ? 1 : 0,
+      take,
+    });
+  }
+
+  async listBySeller(sellerId: string): Promise<Product[]> {
+    return this.prisma.product.findMany({
+      where: { sellerId },
+      orderBy: { createdAt: 'desc' },
+    });
+  }
+
+  // ── Variant ───────────────────────────────────────────────────────
+
+  async findVariantById(id: string): Promise<Variant | null> {
+    return this.prisma.variant.findUnique({ where: { id } });
+  }
+
+  async createVariant(data: {
+    productId: string;
+    optionName: string;
+    optionValue: string;
+    sku: string;
+    price: Prisma.Decimal | number | string;
+  }): Promise<Variant> {
+    return this.prisma.variant.create({ data });
+  }
+
+  async updateVariant(
+    id: string,
+    data: {
+      optionName?: string;
+      optionValue?: string;
+      sku?: string;
+      price?: Prisma.Decimal | number | string;
+    },
+  ): Promise<Variant> {
+    return this.prisma.variant.update({ where: { id }, data });
+  }
+
+  async deleteVariant(id: string): Promise<void> {
+    await this.prisma.variant.delete({ where: { id } });
+  }
+
+  // ── ProductImage ─────────────────────────────────────────────────
+
+  async countImages(productId: string): Promise<number> {
+    return this.prisma.productImage.count({ where: { productId } });
+  }
+
+  async createImage(data: {
+    productId: string;
+    url: string;
+    displayOrder?: number;
+  }): Promise<ProductImage> {
+    return this.prisma.productImage.create({ data });
+  }
+
+  async deleteImage(id: string): Promise<void> {
+    await this.prisma.productImage.delete({ where: { id } });
+  }
+}
diff --git a/apps/backend/src/modules/product/product.service.ts b/apps/backend/src/modules/product/product.service.ts
index 9cad81a..746655a 100644
--- a/apps/backend/src/modules/product/product.service.ts
+++ b/apps/backend/src/modules/product/product.service.ts
@@ -1,4 +1,238 @@
-import { Injectable } from '@nestjs/common';
+import {
+  BadRequestException,
+  ForbiddenException,
+  Injectable,
+  NotFoundException,
+} from '@nestjs/common';
+import { EventEmitter2 } from '@nestjs/event-emitter';
+import { Prisma, ProductStatus } from '@prisma/client';
+import { InventoryService } from '../inventory/inventory.service';
+import { SellerService } from '../seller/seller.service';
+import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, MAX_PRODUCT_IMAGES } from './product.constants';
+import { ProductRepository } from './product.repository';
+
+export interface ProductListResult {
+  items: unknown[];
+  nextCursor: string | null;
+}
 
 @Injectable()
-export class ProductService {}
+export class ProductService {
+  constructor(
+    private readonly productRepository: ProductRepository,
+    private readonly sellerService: SellerService,
+    private readonly inventoryService: InventoryService,
+    private readonly eventEmitter: EventEmitter2,
+  ) {}
+
+  // ── Category ──────────────────────────────────────────────────────
+
+  async listCategories() {
+    return this.productRepository.findCategories();
+  }
+
+  // ── Product CRUD ──────────────────────────────────────────────────
+
+  async createProduct(
+    userId: string,
+    data: {
+      categoryId: string;
+      title: string;
+      description?: string;
+      price: number | string;
+    },
+  ) {
+    const seller = await this.sellerService.getApprovedSeller(userId);
+    const category = await this.productRepository.findCategoryById(data.categoryId);
+    if (!category) throw new BadRequestException('Category not found');
+
+    return this.productRepository.createProduct({
+      sellerId: seller.id,
+      ...data,
+      price: new Prisma.Decimal(data.price),
+    });
+  }
+
+  async updateProduct(
+    userId: string,
+    productId: string,
+    data: {
+      categoryId?: string;
+      title?: string;
+      description?: string | null;
+      price?: number | string;
+    },
+  ) {
+    const product = await this.productRepository.findById(productId);
+    if (!product) throw new NotFoundException('Product not found');
+
+    await this.assertOwner(userId, product.sellerId);
+
+    const updateData: Parameters<ProductRepository['updateProduct']>[1] = { ...data };
+    if (data.price !== undefined) {
+      updateData.price = new Prisma.Decimal(data.price);
+    }
+    return this.productRepository.updateProduct(productId, updateData);
+  }
+
+  async publish(userId: string, productId: string) {
+    const product = await this.productRepository.findById(productId);
+    if (!product) throw new NotFoundException('Product not found');
+    await this.assertOwner(userId, product.sellerId);
+
+    if (product.status !== ProductStatus.DRAFT && product.status !== ProductStatus.INACTIVE) {
+      throw new BadRequestException(`Cannot publish product with status ${product.status}`);
+    }
+    return this.productRepository.updateStatus(productId, ProductStatus.ACTIVE);
+  }
+
+  async deactivate(userId: string, productId: string) {
+    const product = await this.productRepository.findById(productId);
+    if (!product) throw new NotFoundException('Product not found');
+    await this.assertOwner(userId, product.sellerId);
+
+    if (
+      product.status !== ProductStatus.ACTIVE &&
+      product.status !== ProductStatus.OUT_OF_STOCK
+    ) {
+      throw new BadRequestException(`Cannot deactivate product with status ${product.status}`);
+    }
+    return this.productRepository.updateStatus(productId, ProductStatus.INACTIVE);
+  }
+
+  // ── Variant ───────────────────────────────────────────────────────
+
+  async addVariant(
+    userId: string,
+    productId: string,
+    data: {
+      optionName: string;
+      optionValue: string;
+      sku: string;
+      price: number | string;
+      initialStock?: number;
+    },
+  ) {
+    const product = await this.productRepository.findById(productId);
+    if (!product) throw new NotFoundException('Product not found');
+    await this.assertOwner(userId, product.sellerId);
+
+    const variant = await this.productRepository.createVariant({
+      productId,
+      optionName: data.optionName,
+      optionValue: data.optionValue,
+      sku: data.sku,
+      price: new Prisma.Decimal(data.price),
+    });
+
+    const initialStock = data.initialStock ?? 0;
+    await this.inventoryService.initStock(variant.id, productId, initialStock);
+
+    return variant;
+  }
+
+  async updateVariant(
+    userId: string,
+    productId: string,
+    variantId: string,
+    data: {
+      optionName?: string;
+      optionValue?: string;
+      sku?: string;
+      price?: number | string;
+    },
+  ) {
+    const product = await this.productRepository.findById(productId);
+    if (!product) throw new NotFoundException('Product not found');
+    await this.assertOwner(userId, product.sellerId);
+
+    const variant = await this.productRepository.findVariantById(variantId);
+    if (!variant || variant.productId !== productId) throw new NotFoundException('Variant not found');
+
+    const updateData: Parameters<ProductRepository['updateVariant']>[1] = { ...data };
+    if (data.price !== undefined) {
+      updateData.price = new Prisma.Decimal(data.price);
+    }
+    return this.productRepository.updateVariant(variantId, updateData);
+  }
+
+  async deleteVariant(userId: string, productId: string, variantId: string) {
+    const product = await this.productRepository.findById(productId);
+    if (!product) throw new NotFoundException('Product not found');
+    await this.assertOwner(userId, product.sellerId);
+
+    const variant = await this.productRepository.findVariantById(variantId);
+    if (!variant || variant.productId !== productId) throw new NotFoundException('Variant not found');
+
+    await this.productRepository.deleteVariant(variantId);
+  }
+
+  // ── Image ─────────────────────────────────────────────────────────
+
+  async addImage(
+    userId: string,
+    productId: string,
+    data: { url: string; displayOrder?: number },
+  ) {
+    const product = await this.productRepository.findById(productId);
+    if (!product) throw new NotFoundException('Product not found');
+    await this.assertOwner(userId, product.sellerId);
+
+    const count = await this.productRepository.countImages(productId);
+    if (count >= MAX_PRODUCT_IMAGES) {
+      throw new BadRequestException(`Maximum ${MAX_PRODUCT_IMAGES} images per product`);
+    }
+    return this.productRepository.createImage({ productId, ...data });
+  }
+
+  async deleteImage(userId: string, productId: string, imageId: string) {
+    const product = await this.productRepository.findById(productId);
+    if (!product) throw new NotFoundException('Product not found');
+    await this.assertOwner(userId, product.sellerId);
+    await this.productRepository.deleteImage(imageId);
+  }
+
+  // ── Public listing ────────────────────────────────────────────────
+
+  async listPublic(cursor: string | undefined, limit: number | undefined): Promise<ProductListResult> {
+    const take = Math.min(Math.max(limit ?? DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);
+    const items = await this.productRepository.listPublic(cursor, take);
+    const nextCursor = items.length === take ? items[items.length - 1].id : null;
+    return { items, nextCursor };
+  }
+
+  async getDetail(productId: string, user?: { userId: string }) {
+    const product = await this.productRepository.findById(productId);
+    if (
+      !product ||
+      (product.status !== ProductStatus.ACTIVE && product.status !== ProductStatus.OUT_OF_STOCK)
+    ) {
+      throw new NotFoundException('Product not found');
+    }
+
+    if (user) {
+      this.eventEmitter.emit('product.viewed', { userId: user.userId, productId });
+    }
+
+    return product;
+  }
+
+  async listMyProducts(userId: string) {
+    const seller = await this.sellerService.getApprovedSeller(userId);
+    return this.productRepository.listBySeller(seller.id);
+  }
+
+  // ── Private helpers ───────────────────────────────────────────────
+
+  /**
+   * 상품 소유 검증: 현재 사용자의 sellerId 가 product.sellerId 와 일치해야 함 (cross-schema plain String 비교).
+   * 불일치 시 ForbiddenException.
+   */
+  private async assertOwner(userId: string, productSellerId: string): Promise<void> {
+    // sellerId 는 cross-schema plain String — SellerService DI 로 검증
+    const seller = await this.sellerService.getApprovedSeller(userId);
+    if (seller.id !== productSellerId) {
+      throw new ForbiddenException('You do not own this product');
+    }
+  }
+}
diff --git a/apps/backend/src/modules/seller/seller.controller.ts b/apps/backend/src/modules/seller/seller.controller.ts
index 22ae719..bf7ae9f 100644
--- a/apps/backend/src/modules/seller/seller.controller.ts
+++ b/apps/backend/src/modules/seller/seller.controller.ts
@@ -1,4 +1,79 @@
-import { Controller } from '@nestjs/common';
+import {
+  Body,
+  Controller,
+  Get,
+  HttpCode,
+  HttpStatus,
+  Param,
+  Patch,
+  Post,
+  UseGuards,
+} from '@nestjs/common';
+import { AdminGuard } from '../../shared/auth/admin.guard';
+import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
+import { CurrentUser } from '../../shared/auth/current-user.decorator';
+import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
+import { RegisterSellerDto } from './dto/register-seller.dto';
+import { RejectSellerDto } from './dto/reject-seller.dto';
+import { UpdateSellerDto } from './dto/update-seller.dto';
+import { SellerService } from './seller.service';
 
-@Controller('seller')
-export class SellerController {}
+@Controller('sellers')
+@UseGuards(JwtAuthGuard)
+export class SellerController {
+  constructor(private readonly sellerService: SellerService) {}
+
+  /** 판매자 등록 (FR-011, SC-013) */
+  @Post('register')
+  @HttpCode(HttpStatus.CREATED)
+  async register(
+    @CurrentUser() user: AuthenticatedUser,
+    @Body() dto: RegisterSellerDto,
+  ) {
+    return this.sellerService.register(user.userId, dto);
+  }
+
+  /** 내 판매자 프로필 조회 (FR-012, SC-014) */
+  @Get('me')
+  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
+    return this.sellerService.getMyProfile(user.userId);
+  }
+
+  /** 내 판매자 프로필 수정 (FR-013, SC-015) */
+  @Patch('me')
+  async updateMyProfile(
+    @CurrentUser() user: AuthenticatedUser,
+    @Body() dto: UpdateSellerDto,
+  ) {
+    return this.sellerService.updateMyProfile(user.userId, dto);
+  }
+
+  /** 심사 상태 조회 (FR-014, SC-016) */
+  @Get('me/status')
+  async getStatus(@CurrentUser() user: AuthenticatedUser) {
+    return this.sellerService.getStatus(user.userId);
+  }
+
+  /**
+   * 승인 (FR-015, SC-017) — SEC-001 수정: AdminGuard 적용.
+   * ADMIN_USER_IDS 미포함 사용자 → 403. fail-closed(미설정 시 전원 거부).
+   */
+  @Patch(':id/approve')
+  @UseGuards(AdminGuard)
+  async approve(@Param('id') sellerId: string) {
+    return this.sellerService.approve(sellerId);
+  }
+
+  /**
+   * 거부 (FR-016, SC-018) — SEC-001 수정: AdminGuard 적용.
+   * ADMIN_USER_IDS 미포함 사용자 → 403. fail-closed(미설정 시 전원 거부).
+   */
+  @Patch(':id/reject')
+  @UseGuards(AdminGuard)
+  async reject(
+    @Param('id') sellerId: string,
+    @Body() dto: RejectSellerDto,
+  ) {
+    return this.sellerService.reject(sellerId, dto.rejectReason);
+  }
+}
diff --git a/apps/backend/src/modules/seller/seller.module.ts b/apps/backend/src/modules/seller/seller.module.ts
index e4a6a6c..6582558 100644
--- a/apps/backend/src/modules/seller/seller.module.ts
+++ b/apps/backend/src/modules/seller/seller.module.ts
@@ -1,10 +1,13 @@
 import { Module } from '@nestjs/common';
+import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
 import { SellerController } from './seller.controller';
 import { SellerRepository } from './seller.repository';
 import { SellerService } from './seller.service';
 
 @Module({
+  imports: [AuthSharedModule],
   controllers: [SellerController],
   providers: [SellerService, SellerRepository],
+  exports: [SellerService],
 })
 export class SellerModule {}
diff --git a/apps/backend/src/modules/seller/seller.repository.ts b/apps/backend/src/modules/seller/seller.repository.ts
index bc9e7d2..ba950b9 100644
--- a/apps/backend/src/modules/seller/seller.repository.ts
+++ b/apps/backend/src/modules/seller/seller.repository.ts
@@ -1,4 +1,53 @@
 import { Injectable } from '@nestjs/common';
+import { Seller, SellerStatus } from '@prisma/client';
+import { PrismaService } from '../../shared/prisma/prisma.service';
+
+// P-001: users 스키마(users.sellers)에만 접근. 타 스키마 미접근.
 
 @Injectable()
-export class SellerRepository {}
+export class SellerRepository {
+  constructor(private readonly prisma: PrismaService) {}
+
+  async createSeller(data: {
+    userId: string;
+    businessName: string;
+    businessNumber: string;
+    representativeName: string;
+    contactPhone?: string;
+    businessAddress?: string;
+  }): Promise<Seller> {
+    return this.prisma.seller.create({ data });
+  }
+
+  async findByUserId(userId: string): Promise<Seller | null> {
+    return this.prisma.seller.findUnique({ where: { userId } });
+  }
+
+  async findById(id: string): Promise<Seller | null> {
+    return this.prisma.seller.findUnique({ where: { id } });
+  }
+
+  async updateSeller(
+    id: string,
+    data: {
+      businessName?: string;
+      businessNumber?: string;
+      representativeName?: string;
+      contactPhone?: string | null;
+      businessAddress?: string | null;
+    },
+  ): Promise<Seller> {
+    return this.prisma.seller.update({ where: { id }, data });
+  }
+
+  async updateStatus(
+    id: string,
+    status: SellerStatus,
+    rejectReason?: string | null,
+  ): Promise<Seller> {
+    return this.prisma.seller.update({
+      where: { id },
+      data: { status, rejectReason: rejectReason ?? null },
+    });
+  }
+}
diff --git a/apps/backend/src/modules/seller/seller.service.ts b/apps/backend/src/modules/seller/seller.service.ts
index 14ba0aa..7c889eb 100644
--- a/apps/backend/src/modules/seller/seller.service.ts
+++ b/apps/backend/src/modules/seller/seller.service.ts
@@ -1,4 +1,108 @@
-import { Injectable } from '@nestjs/common';
+import {
+  ConflictException,
+  ForbiddenException,
+  Injectable,
+  NotFoundException,
+} from '@nestjs/common';
+import { Prisma, SellerStatus } from '@prisma/client';
+import { SellerRepository } from './seller.repository';
+
+export interface SellerProfile {
+  id: string;
+  userId: string;
+  businessName: string;
+  businessNumber: string;
+  representativeName: string;
+  contactPhone: string | null;
+  businessAddress: string | null;
+  status: SellerStatus;
+  rejectReason: string | null;
+  createdAt: Date;
+}
+
+export interface SellerStatusResult {
+  status: SellerStatus;
+  rejectReason: string | null;
+}
+
+/** product 모듈이 DI 소비하는 공개 인터페이스 (plan 인터페이스 계약) */
+export interface ApprovedSeller {
+  id: string;
+  userId: string;
+}
 
 @Injectable()
-export class SellerService {}
+export class SellerService {
+  constructor(private readonly sellerRepository: SellerRepository) {}
+
+  async register(
+    userId: string,
+    data: {
+      businessName: string;
+      businessNumber: string;
+      representativeName: string;
+      contactPhone?: string;
+      businessAddress?: string;
+    },
+  ): Promise<SellerProfile> {
+    try {
+      return await this.sellerRepository.createSeller({ userId, ...data });
+    } catch (err) {
+      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
+        throw new ConflictException('Seller profile already exists');
+      }
+      throw err;
+    }
+  }
+
+  async getMyProfile(userId: string): Promise<SellerProfile> {
+    const seller = await this.sellerRepository.findByUserId(userId);
+    if (!seller) throw new NotFoundException('Seller profile not found');
+    return seller;
+  }
+
+  async updateMyProfile(
+    userId: string,
+    data: {
+      businessName?: string;
+      businessNumber?: string;
+      representativeName?: string;
+      contactPhone?: string | null;
+      businessAddress?: string | null;
+    },
+  ): Promise<SellerProfile> {
+    const seller = await this.sellerRepository.findByUserId(userId);
+    if (!seller) throw new NotFoundException('Seller profile not found');
+    return this.sellerRepository.updateSeller(seller.id, data);
+  }
+
+  async getStatus(userId: string): Promise<SellerStatusResult> {
+    const seller = await this.sellerRepository.findByUserId(userId);
+    if (!seller) throw new NotFoundException('Seller profile not found');
+    return { status: seller.status, rejectReason: seller.rejectReason };
+  }
+
+  async approve(sellerId: string): Promise<SellerProfile> {
+    const seller = await this.sellerRepository.findById(sellerId);
+    if (!seller) throw new NotFoundException('Seller not found');
+    return this.sellerRepository.updateStatus(sellerId, SellerStatus.APPROVED, null);
+  }
+
+  async reject(sellerId: string, rejectReason: string): Promise<SellerProfile> {
+    const seller = await this.sellerRepository.findById(sellerId);
+    if (!seller) throw new NotFoundException('Seller not found');
+    return this.sellerRepository.updateStatus(sellerId, SellerStatus.REJECTED, rejectReason);
+  }
+
+  /**
+   * 공개 메서드: product 모듈이 DI 소비 (plan 인터페이스 계약 고정).
+   * 미등록 또는 APPROVED 아닌 판매자 → ForbiddenException (FR-017/019, SC-019·020·023).
+   */
+  async getApprovedSeller(userId: string): Promise<ApprovedSeller> {
+    const seller = await this.sellerRepository.findByUserId(userId);
+    if (!seller || seller.status !== SellerStatus.APPROVED) {
+      throw new ForbiddenException('Seller is not approved');
+    }
+    return { id: seller.id, userId: seller.userId };
+  }
+}
diff --git a/apps/backend/src/modules/user/user.controller.ts b/apps/backend/src/modules/user/user.controller.ts
index ad8c2a6..26a587e 100644
--- a/apps/backend/src/modules/user/user.controller.ts
+++ b/apps/backend/src/modules/user/user.controller.ts
@@ -1,4 +1,116 @@
-import { Controller } from '@nestjs/common';
+import {
+  Body,
+  Controller,
+  Delete,
+  Get,
+  HttpCode,
+  HttpStatus,
+  Param,
+  Patch,
+  Post,
+  UseGuards,
+} from '@nestjs/common';
+import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
+import { CurrentUser } from '../../shared/auth/current-user.decorator';
+import { AuthenticatedUser } from '../../shared/auth/jwt.strategy';
+import { AddWishlistDto } from './dto/add-wishlist.dto';
+import { CreateAddressDto } from './dto/create-address.dto';
+import { UpdateAddressDto } from './dto/update-address.dto';
+import { UpdateProfileDto } from './dto/update-profile.dto';
+import { UserService } from './user.service';
 
-@Controller('user')
-export class UserController {}
+@Controller('users')
+@UseGuards(JwtAuthGuard)
+export class UserController {
+  constructor(private readonly userService: UserService) {}
+
+  // ── Profile ───────────────────────────────────────────────────────
+
+  @Get('me')
+  async getMe(@CurrentUser() user: AuthenticatedUser) {
+    return this.userService.getProfile(user.userId);
+  }
+
+  @Patch('me')
+  async updateMe(
+    @CurrentUser() user: AuthenticatedUser,
+    @Body() dto: UpdateProfileDto,
+  ) {
+    return this.userService.updateProfile(user.userId, dto);
+  }
+
+  // ── Address ───────────────────────────────────────────────────────
+
+  @Get('me/addresses')
+  async listAddresses(@CurrentUser() user: AuthenticatedUser) {
+    return this.userService.listAddresses(user.userId);
+  }
+
+  @Post('me/addresses')
+  @HttpCode(HttpStatus.CREATED)
+  async createAddress(
+    @CurrentUser() user: AuthenticatedUser,
+    @Body() dto: CreateAddressDto,
+  ) {
+    return this.userService.createAddress(user.userId, dto);
+  }
+
+  @Patch('me/addresses/:id')
+  async updateAddress(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('id') id: string,
+    @Body() dto: UpdateAddressDto,
+  ) {
+    return this.userService.updateAddress(user.userId, id, dto);
+  }
+
+  @Delete('me/addresses/:id')
+  @HttpCode(HttpStatus.NO_CONTENT)
+  async deleteAddress(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('id') id: string,
+  ) {
+    await this.userService.deleteAddress(user.userId, id);
+  }
+
+  @Patch('me/addresses/:id/default')
+  async setDefaultAddress(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('id') id: string,
+  ) {
+    await this.userService.setDefaultAddress(user.userId, id);
+    return { ok: true };
+  }
+
+  // ── Wishlist ──────────────────────────────────────────────────────
+
+  @Get('me/wishlist')
+  async listWishlist(@CurrentUser() user: AuthenticatedUser) {
+    return this.userService.listWishlist(user.userId);
+  }
+
+  @Post('me/wishlist')
+  @HttpCode(HttpStatus.CREATED)
+  async addWishlist(
+    @CurrentUser() user: AuthenticatedUser,
+    @Body() dto: AddWishlistDto,
+  ) {
+    return this.userService.addWishlist(user.userId, dto.productId);
+  }
+
+  @Delete('me/wishlist/:productId')
+  @HttpCode(HttpStatus.NO_CONTENT)
+  async removeWishlist(
+    @CurrentUser() user: AuthenticatedUser,
+    @Param('productId') productId: string,
+  ) {
+    await this.userService.removeWishlist(user.userId, productId);
+  }
+
+  // ── Recent views ──────────────────────────────────────────────────
+
+  @Get('me/recent-views')
+  async listRecentViews(@CurrentUser() user: AuthenticatedUser) {
+    return this.userService.listRecentViews(user.userId);
+  }
+}
diff --git a/apps/backend/src/modules/user/user.events.ts b/apps/backend/src/modules/user/user.events.ts
index 087f457..0989b42 100644
--- a/apps/backend/src/modules/user/user.events.ts
+++ b/apps/backend/src/modules/user/user.events.ts
@@ -1 +1,28 @@
-// User domain events scaffold (in-process via @nestjs/event-emitter)
+import { Injectable, Logger } from '@nestjs/common';
+import { OnEvent } from '@nestjs/event-emitter';
+import { UserService } from './user.service';
+
+interface ProductViewedEvent {
+  userId: string;
+  productId: string;
+}
+
+/**
+ * product.viewed 이벤트 구독 → 최근 본 상품 기록 저장 (FR-009, ADR-002·014).
+ * best-effort: 핸들러 예외가 발행 측 응답을 차단하지 않는다.
+ */
+@Injectable()
+export class UserEventsHandler {
+  private readonly logger = new Logger(UserEventsHandler.name);
+
+  constructor(private readonly userService: UserService) {}
+
+  @OnEvent('product.viewed')
+  async handleProductViewed(event: ProductViewedEvent): Promise<void> {
+    try {
+      await this.userService.recordProductView(event.userId, event.productId);
+    } catch (err) {
+      this.logger.error('Failed to record product view', err);
+    }
+  }
+}
diff --git a/apps/backend/src/modules/user/user.module.ts b/apps/backend/src/modules/user/user.module.ts
index 31e292b..9f8d2a0 100644
--- a/apps/backend/src/modules/user/user.module.ts
+++ b/apps/backend/src/modules/user/user.module.ts
@@ -1,10 +1,13 @@
 import { Module } from '@nestjs/common';
+import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
 import { UserController } from './user.controller';
+import { UserEventsHandler } from './user.events';
 import { UserRepository } from './user.repository';
 import { UserService } from './user.service';
 
 @Module({
+  imports: [AuthSharedModule],
   controllers: [UserController],
-  providers: [UserService, UserRepository],
+  providers: [UserService, UserRepository, UserEventsHandler],
 })
 export class UserModule {}
diff --git a/apps/backend/src/modules/user/user.repository.ts b/apps/backend/src/modules/user/user.repository.ts
index fcbca66..ecc9b40 100644
--- a/apps/backend/src/modules/user/user.repository.ts
+++ b/apps/backend/src/modules/user/user.repository.ts
@@ -1,4 +1,140 @@
 import { Injectable } from '@nestjs/common';
+import { Address, Prisma, ProductView, User, Wishlist } from '@prisma/client';
+import { PrismaService } from '../../shared/prisma/prisma.service';
+
+// P-001: users 스키마(users.users, users.addresses, users.wishlists, users.product_views)에만 접근.
 
 @Injectable()
-export class UserRepository {}
+export class UserRepository {
+  constructor(private readonly prisma: PrismaService) {}
+
+  // ── User ──────────────────────────────────────────────────────────
+
+  async findUserById(id: string): Promise<User | null> {
+    return this.prisma.user.findUnique({ where: { id } });
+  }
+
+  async updateUser(id: string, data: { name?: string; phone?: string }): Promise<User> {
+    return this.prisma.user.update({ where: { id }, data });
+  }
+
+  // ── Address ──────────────────────────────────────────────────────
+
+  async findAddressById(id: string): Promise<Address | null> {
+    return this.prisma.address.findUnique({ where: { id } });
+  }
+
+  async findAddressesByUser(userId: string): Promise<Address[]> {
+    return this.prisma.address.findMany({
+      where: { userId },
+      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
+    });
+  }
+
+  async createAddress(
+    userId: string,
+    data: {
+      recipientName: string;
+      phone: string;
+      zipCode: string;
+      address1: string;
+      address2?: string;
+      isDefault?: boolean;
+    },
+  ): Promise<Address> {
+    return this.prisma.address.create({ data: { userId, ...data } });
+  }
+
+  async updateAddress(
+    id: string,
+    data: {
+      recipientName?: string;
+      phone?: string;
+      zipCode?: string;
+      address1?: string;
+      address2?: string | null;
+    },
+  ): Promise<Address> {
+    return this.prisma.address.update({ where: { id }, data });
+  }
+
+  async deleteAddress(id: string): Promise<void> {
+    await this.prisma.address.delete({ where: { id } });
+  }
+
+  /**
+   * 기본 배송지 단일성 보장 트랜잭션 (ADR-009):
+   * 현재 기본 배송지를 false 로 일괄 해제 → 대상 배송지를 true 로 설정.
+   */
+  async setDefaultTx(userId: string, addressId: string): Promise<void> {
+    await this.prisma.$transaction([
+      this.prisma.address.updateMany({
+        where: { userId, isDefault: true },
+        data: { isDefault: false },
+      }),
+      this.prisma.address.update({
+        where: { id: addressId },
+        data: { isDefault: true },
+      }),
+    ]);
+  }
+
+  /**
+   * 기본 배송지 삭제 + 잔여 최신 1건 재지정 트랜잭션 (ADR-008).
+   * 잔여 배송지 없으면 재지정 생략.
+   */
+  async deleteAddressWithReassign(
+    userId: string,
+    addressId: string,
+    wasDefault: boolean,
+  ): Promise<void> {
+    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
+      await tx.address.delete({ where: { id: addressId } });
+
+      if (wasDefault) {
+        const next = await tx.address.findFirst({
+          where: { userId },
+          orderBy: { createdAt: 'desc' },
+        });
+        if (next) {
+          await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
+        }
+      }
+    });
+  }
+
+  // ── Wishlist ──────────────────────────────────────────────────────
+
+  async findWishlistsByUser(userId: string): Promise<Wishlist[]> {
+    return this.prisma.wishlist.findMany({
+      where: { userId },
+      orderBy: { createdAt: 'desc' },
+    });
+  }
+
+  async createWishlist(userId: string, productId: string): Promise<Wishlist> {
+    return this.prisma.wishlist.create({ data: { userId, productId } });
+  }
+
+  async deleteWishlist(userId: string, productId: string): Promise<void> {
+    await this.prisma.wishlist.deleteMany({ where: { userId, productId } });
+  }
+
+  // ── ProductView ───────────────────────────────────────────────────
+
+  async upsertProductView(userId: string, productId: string): Promise<ProductView> {
+    return this.prisma.productView.upsert({
+      where: { userId_productId: { userId, productId } },
+      update: { viewedAt: new Date() },
+      create: { userId, productId },
+    });
+  }
+
+  async findRecentViews(userId: string, take: number): Promise<ProductView[]> {
+    return this.prisma.productView.findMany({
+      where: { userId },
+      orderBy: { viewedAt: 'desc' },
+      take,
+    });
+  }
+}
diff --git a/apps/backend/src/modules/user/user.service.ts b/apps/backend/src/modules/user/user.service.ts
index 668a7d6..e00af1c 100644
--- a/apps/backend/src/modules/user/user.service.ts
+++ b/apps/backend/src/modules/user/user.service.ts
@@ -1,4 +1,143 @@
-import { Injectable } from '@nestjs/common';
+import {
+  ConflictException,
+  ForbiddenException,
+  Injectable,
+  NotFoundException,
+} from '@nestjs/common';
+import { Prisma } from '@prisma/client';
+import { MAX_PRODUCT_VIEWS } from './user.constants';
+import { UserRepository } from './user.repository';
+
+export interface UserProfile {
+  id: string;
+  email: string;
+  name: string | null;
+  phone: string | null;
+}
+
+export interface AddressData {
+  id: string;
+  userId: string;
+  recipientName: string;
+  phone: string;
+  zipCode: string;
+  address1: string;
+  address2: string | null;
+  isDefault: boolean;
+  createdAt: Date;
+}
+
+export interface WishlistItem {
+  id: string;
+  userId: string;
+  productId: string;
+  createdAt: Date;
+}
+
+export interface RecentView {
+  id: string;
+  userId: string;
+  productId: string;
+  viewedAt: Date;
+}
 
 @Injectable()
-export class UserService {}
+export class UserService {
+  constructor(private readonly userRepository: UserRepository) {}
+
+  // ── Profile ───────────────────────────────────────────────────────
+
+  async getProfile(userId: string): Promise<UserProfile> {
+    const user = await this.userRepository.findUserById(userId);
+    if (!user) throw new NotFoundException('User not found');
+    return { id: user.id, email: user.email, name: user.name, phone: user.phone };
+  }
+
+  async updateProfile(userId: string, data: { name?: string; phone?: string }): Promise<UserProfile> {
+    const user = await this.userRepository.updateUser(userId, data);
+    return { id: user.id, email: user.email, name: user.name, phone: user.phone };
+  }
+
+  // ── Address ───────────────────────────────────────────────────────
+
+  async listAddresses(userId: string): Promise<AddressData[]> {
+    return this.userRepository.findAddressesByUser(userId);
+  }
+
+  async createAddress(
+    userId: string,
+    data: {
+      recipientName: string;
+      phone: string;
+      zipCode: string;
+      address1: string;
+      address2?: string;
+      isDefault?: boolean;
+    },
+  ): Promise<AddressData> {
+    return this.userRepository.createAddress(userId, data);
+  }
+
+  async updateAddress(
+    userId: string,
+    addressId: string,
+    data: {
+      recipientName?: string;
+      phone?: string;
+      zipCode?: string;
+      address1?: string;
+      address2?: string | null;
+    },
+  ): Promise<AddressData> {
+    const address = await this.userRepository.findAddressById(addressId);
+    if (!address) throw new NotFoundException('Address not found');
+    if (address.userId !== userId) throw new ForbiddenException('Access denied');
+    return this.userRepository.updateAddress(addressId, data);
+  }
+
+  async deleteAddress(userId: string, addressId: string): Promise<void> {
+    const address = await this.userRepository.findAddressById(addressId);
+    if (!address) throw new NotFoundException('Address not found');
+    if (address.userId !== userId) throw new ForbiddenException('Access denied');
+    await this.userRepository.deleteAddressWithReassign(userId, addressId, address.isDefault);
+  }
+
+  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
+    const address = await this.userRepository.findAddressById(addressId);
+    if (!address) throw new NotFoundException('Address not found');
+    if (address.userId !== userId) throw new ForbiddenException('Access denied');
+    await this.userRepository.setDefaultTx(userId, addressId);
+  }
+
+  // ── Wishlist ──────────────────────────────────────────────────────
+
+  async listWishlist(userId: string): Promise<WishlistItem[]> {
+    return this.userRepository.findWishlistsByUser(userId);
+  }
+
+  async addWishlist(userId: string, productId: string): Promise<WishlistItem> {
+    try {
+      return await this.userRepository.createWishlist(userId, productId);
+    } catch (err) {
+      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
+        throw new ConflictException('Already in wishlist');
+      }
+      throw err;
+    }
+  }
+
+  async removeWishlist(userId: string, productId: string): Promise<void> {
+    await this.userRepository.deleteWishlist(userId, productId);
+  }
+
+  // ── ProductView ───────────────────────────────────────────────────
+
+  async listRecentViews(userId: string): Promise<RecentView[]> {
+    return this.userRepository.findRecentViews(userId, MAX_PRODUCT_VIEWS);
+  }
+
+  /** product.viewed 이벤트 핸들러(UserEventsHandler)가 호출. */
+  async recordProductView(userId: string, productId: string): Promise<void> {
+    await this.userRepository.upsertProductView(userId, productId);
+  }
+}
diff --git a/apps/backend/src/shared/auth/auth-shared.module.ts b/apps/backend/src/shared/auth/auth-shared.module.ts
index 3a4dae2..ec6bee0 100644
--- a/apps/backend/src/shared/auth/auth-shared.module.ts
+++ b/apps/backend/src/shared/auth/auth-shared.module.ts
@@ -2,10 +2,11 @@ import { Module } from '@nestjs/common';
 import { PassportModule } from '@nestjs/passport';
 import { JwtAuthGuard } from './jwt-auth.guard';
 import { JwtStrategy } from './jwt.strategy';
+import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
 
 @Module({
   imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
-  providers: [JwtStrategy, JwtAuthGuard],
-  exports: [JwtAuthGuard, JwtStrategy],
+  providers: [JwtStrategy, JwtAuthGuard, OptionalJwtAuthGuard],
+  exports: [JwtAuthGuard, JwtStrategy, OptionalJwtAuthGuard],
 })
 export class AuthSharedModule {}
diff --git a/apps/backend/src/shared/auth/admin.guard.ts b/apps/backend/src/shared/auth/admin.guard.ts
new file mode 100644
index 0000000..0000000
--- /dev/null
+++ b/apps/backend/src/shared/auth/admin.guard.ts
@@ -0,0 +1,38 @@
+import {
+  CanActivate,
+  ExecutionContext,
+  ForbiddenException,
+  Injectable,
+} from '@nestjs/common';
+import { AuthenticatedUser } from './jwt.strategy';
+
+/**
+ * 환경변수 ADMIN_USER_IDS(콤마구분 user id 목록)에 포함된 사용자만 통과.
+ * ADMIN_USER_IDS 미설정 또는 빈 값 → 전원 거부(fail-closed).
+ * JwtAuthGuard 통과 이후(req.user 존재 전제)에 사용한다.
+ */
+@Injectable()
+export class AdminGuard implements CanActivate {
+  canActivate(context: ExecutionContext): boolean {
+    const request = context.switchToHttp().getRequest<{
+      user?: AuthenticatedUser;
+    }>();
+
+    const user = request.user;
+    if (!user) {
+      throw new ForbiddenException('Admin access required');
+    }
+
+    const raw = process.env['ADMIN_USER_IDS'] ?? '';
+    const adminIds = raw
+      .split(',')
+      .map((id) => id.trim())
+      .filter((id) => id.length > 0);
+
+    if (adminIds.length === 0 || !adminIds.includes(user.userId)) {
+      throw new ForbiddenException('Admin access required');
+    }
+
+    return true;
+  }
+}

diff --git a/apps/backend/src/shared/auth/admin.guard.spec.ts b/apps/backend/src/shared/auth/admin.guard.spec.ts
new file mode 100644
index 0000000..0000000
--- /dev/null
+++ b/apps/backend/src/shared/auth/admin.guard.spec.ts
@@ -0,0 +1,64 @@
+/**
+ * AdminGuard 단위 테스트 — SEC-001 회귀 방지
+ *
+ * SEC-001 (CVSS 7.7, High): approve/reject 자가 승인 가능 취약점 수정 검증.
+ * ADMIN_USER_IDS 기반 환경변수 admin 가드 동작 확인.
+ */
+
+import { ExecutionContext, ForbiddenException } from '@nestjs/common';
+import { AdminGuard } from './admin.guard';
+
+function makeCtx(userId: string | undefined): ExecutionContext {
+  return {
+    switchToHttp: () => ({
+      getRequest: () => ({
+        user: userId ? { userId, email: `${userId}@test.com` } : undefined,
+      }),
+    }),
+  } as unknown as ExecutionContext;
+}
+
+describe('AdminGuard — SEC-001 회귀', () => {
+  let guard: AdminGuard;
+
+  beforeEach(() => {
+    guard = new AdminGuard();
+  });
+
+  afterEach(() => {
+    delete process.env['ADMIN_USER_IDS'];
+  });
+
+  it('SEC-001 regression: when_non_admin_user_calls_approve_then_403', () => {
+    /**
+     * SEC-001: ADMIN_USER_IDS 에 포함되지 않은 사용자가
+     * approve/reject 엔드포인트 호출 시 ForbiddenException(403).
+     * 자가 승인 공격 차단 확인.
+     */
+    process.env['ADMIN_USER_IDS'] = 'admin-user-id-001';
+
+    const ctx = makeCtx('attacker-user-id');
+    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
+  });
+
+  it('when_admin_user_calls_approve_then_pass', () => {
+    /**
+     * ADMIN_USER_IDS 에 포함된 사용자 → 통과.
+     */
+    const adminId = 'admin-user-id-001';
+    process.env['ADMIN_USER_IDS'] = adminId;
+
+    const ctx = makeCtx(adminId);
+    expect(guard.canActivate(ctx)).toBe(true);
+  });
+
+  it('when_admin_user_ids_empty_then_all_403', () => {
+    /**
+     * ADMIN_USER_IDS 미설정(빈 값) 시 모든 사용자 거부 — fail-closed.
+     */
+    process.env['ADMIN_USER_IDS'] = '';
+
+    const ctx = makeCtx('any-user-id');
+    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
+  });
+});

diff --git a/apps/backend/.env.example b/apps/backend/.env.example
new file mode 100644
index 0000000..0000000
--- /dev/null
+++ b/apps/backend/.env.example
@@ -0,0 +1,9 @@
+DATABASE_URL=postgresql://user:password@localhost:5432/doa_next
+JWT_ACCESS_SECRET=your-access-secret-here
+JWT_ACCESS_TTL=900
+JWT_REFRESH_SECRET=your-refresh-secret-here
+JWT_REFRESH_TTL=30d
+NODE_ENV=development
+PORT=3000
+# 콤마구분 admin user id 목록. 미설정 시 approve/reject 전면 차단(fail-closed).
+ADMIN_USER_IDS=

```
