---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 13:55
상태: 확정
---

# Tasks: 004-review-coupon

> Branch: 004-review-coupon | Date: 2026-06-29 | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [Test Authoring Contract](#test-authoring-contract)
- [태스크 입도 가이드](#태스크-입도-가이드)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목 해소(미결 사항: 없음)
- [x] plan.md Constitution Gates(P-001~P-007) 전부 통과(예외 0)
- [x] CHANGES.md 의 이전 작업(003-commerce) "후속 작업 시 주의사항" 확인 — order/payment additive 보정 시 003 회귀(101+177) 주의
- [x] **Database Design Agent** 가 `data-model.md` + 마이그레이션(commerce 3테이블 `coupons`·`user_coupons`·`reviews` + 3 enum + `reviews.orderItemId @unique` + 복합 인덱스 + `issuedCount`)을 확정하고 Prisma client 생성 완료(PPG-1 진입 전제 — selection-phases: DB Design Y)

> A·B·C 레이어 = **4단계 Development Agent**. D 레이어 = **5a Test Agent(AUTHORING)**. 양 Agent 동일 turn PPG-1 병렬. 레이어 A→B→C 의존 순, `[P]` 는 병렬 가능.

---

## 태스크 목록

> 레이어: A 데이터(repository·schema 연동) / B 도메인(service·events) / C 인터페이스(controller·dto·module wiring) / D 테스트(5a).
> 스키마·마이그레이션 자체는 Database Design Agent 소유 — A 레이어 repository 는 그 산출 client 를 소비.

### Step 1. coupon 모듈 — 데이터·도메인 (commerce 스키마)

- [x] **T001** — coupon.repository
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/coupon/coupon.repository.ts`
  - 관련 요구사항: FR-001·003·005·006·011·013·016
  - 상세: `this.prisma.tx.coupon`/`this.prisma.tx.userCoupon` 로 — `createCoupon(data)`, `findCouponById(couponId)`, `incrementIssuedCountConditional(couponId): Promise<number>`(`this.prisma.tx.$executeRaw` parameterized `UPDATE commerce.coupons SET issued_count = issued_count + 1 WHERE id = ${couponId} AND (total_quantity IS NULL OR issued_count < total_quantity)` → 영향 행 수 반환, ADR-004), `createUserCoupon(data)`, `findUserCouponWithCoupon(userCouponId)`(include coupon — 동일 스키마 FK), `listUserCoupons(userId, status?)`, `listCouponsByIssuer(issuerId, cursor, take)`(cursor `orderBy:[{createdAt:desc},{id:desc}]`), `markUserCouponUsed(userCouponId, orderId): Promise<number>`(`updateMany({where:{id, status:'unused'}, data:{status:'used', usedOrderId:orderId}})` → `count`), `restoreUserCouponsByOrder(orderId): Promise<number>`(`updateMany({where:{usedOrderId:orderId, status:'used'}, data:{status:'unused', usedOrderId:null}})` → `count`).
  - 완료 기준: commerce 스키마 모델(coupon·userCoupon)만 접근 — orders/users/products 모델 직접 참조 0(SC-054). `$executeRaw` 는 commerce.coupons 자기 테이블만 참조. tagged-template parameterized(injection 방어).

- [x] **T002** — coupon.service (생성·발급·조회·검증·사용·복원)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/coupon/coupon.service.ts`
  - 관련 요구사항: FR-001·002·003·004·005·006·011·012·013·016·017
  - 상세:
    - `createCoupon(input: {issuerType, issuerId, type, discountValue, expiresAt, description?, minOrderAmount?, maxDiscountAmount?, totalQuantity?}): Promise<Coupon>` — PERCENTAGE 면 discountValue 1~100 재검증(DTO 와 이중), FIXED 면 양수. maxDiscountAmount 는 PERCENTAGE 전용(FIXED 전달 시 무시). expiresAt 필수.
    - `issueByAdmin(couponId, userId): Promise<UserCoupon>` — `runInTransaction`: `incrementIssuedCountConditional` 결과 0 → `ConflictException(409)`(SC-007) → `createUserCoupon({couponId, userId, status:'unused'})`.
    - `issueBySeller(seller: {id}, couponId, userId): Promise<UserCoupon>` — `findCouponById` → `coupon.issuerType==='SELLER' && coupon.issuerId===seller.id` 아니면 `ForbiddenException(403)`(SC-009) → 이후 issueByAdmin 동일 원자 발급.
    - `listMyCoupons(userId, status?): Promise<UserCoupon[]>` — status 기본 'unused', 'all' 무필터.
    - `listSellerCoupons(sellerId, cursor?, limit?): Promise<{items, nextCursor}>`.
    - `validateAndCalculateDiscount(userCouponId, userId, orderTotal: Prisma.Decimal): Promise<{discountAmount: Prisma.Decimal; couponId: string}>` — `findUserCouponWithCoupon` (없으면 `NotFoundException(404)`). FR-011 순서: (a) `status!=='unused'` → `UnprocessableEntityException(422)`(SC-016) (b) `userId !== 요청자` → `ForbiddenException(403)`(SC-017) (c) `coupon.expiresAt <= now` → `UnprocessableEntityException(422)`(SC-015) (d) `coupon.minOrderAmount && orderTotal.lt(minOrderAmount)` → `UnprocessableEntityException(422)`(SC-018). FR-012 계산(§E 통합 분기, 전 과정 Decimal): FIXED → `Decimal.min(discountValue, orderTotal)`; PERCENTAGE → `base = orderTotal.mul(discountValue).div(100).floor()`, max 有 → `Decimal.min(base, maxDiscountAmount, orderTotal)`, max 無 → `Decimal.min(base, orderTotal)`.
    - `markUsed(input: {userCouponId, orderId, userId, discountAmount}): Promise<void>` — `count = markUserCouponUsed(userCouponId, orderId)`; `count===0` → `ConflictException(409)`(SC-020) → `prisma.onAfterCommit(()=>couponEvents.emitCouponUsed({userCouponId, couponId, orderId, userId, discountAmount}))`(FR-017). couponId 는 markUsed 전 조회 또는 input 확장(validateAndCalculateDiscount 가 반환한 couponId 를 order 가 markUsed 에 전달하도록 input 에 `couponId` 추가 가능 — Development 확정).
    - `restoreForOrder(orderId): Promise<void>` — `restoreUserCouponsByOrder(orderId)`(count 0 = no-op, SC-023).
  - 완료 기준: 금전 연산 전부 `Prisma.Decimal`(float 0, SC-050). FR-011 4xx 코드 정확. SellerService DI(issueBySeller 의 seller 는 컨트롤러가 getApprovedSeller 로 해석 후 전달 — service 는 seller.id 만 수신).

- [x] **T003** `[P]` — coupon.events (coupon.used 발행)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/coupon/coupon.events.ts`
  - 관련 요구사항: FR-017, SC-024
  - 상세: `EventEmitter2` 주입. `emitCouponUsed(payload: {userCouponId, couponId, orderId, userId, discountAmount})` → `emit('coupon.used', payload)`. discountAmount 는 string 또는 Decimal 직렬화(payload 5필드 고정).
  - 완료 기준: 이벤트명 `coupon.used`, payload 5필드(SC-024). markUsed 의 onAfterCommit 에서 호출(커밋 후 발행).

### Step 2. coupon 모듈 — 인터페이스 (C)

- [x] **T010** `[P]` — coupon dto
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/coupon/dto/{create-coupon,issue-coupon,list-coupon}.dto.ts`
  - 관련 요구사항: FR-001·002·003·004·005
  - 상세: `CreateCouponDto` — `type @IsEnum(CouponType)`, `discountValue`(양수; PERCENTAGE 1~100 — service 이중검증), `expiresAt @IsDateString`, `description? @IsString`, `minOrderAmount? @IsNumberString|@IsDecimal`, `maxDiscountAmount?`, `totalQuantity? @IsInt @Min(1)`. `IssueCouponDto` — `userId @IsString`. `ListCouponDto` — `status? @IsIn(['unused','used','expired','all'])`, `after? @IsString`, `limit? @IsInt`. 금전 필드는 string 수신 후 service 에서 Decimal 변환(부동소수점 회피).
  - 완료 기준: class-validator 데코레이터. 전역 ValidationPipe 400(SC-034 류 패턴 동형).

- [x] **T011** — coupon controllers (admin·seller·user) + module wiring
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/coupon/coupon.controller.ts`(또는 admin/seller/user 분리 파일), `apps/backend/src/modules/coupon/coupon.module.ts`
  - 관련 요구사항: FR-001~006, SC-001~011, SC-052
  - 상세:
    - `AdminCouponController` `@Controller('admin/coupons')` `@UseGuards(JwtAuthGuard, AdminGuard)`: `POST /`(201, issuerType=ADMIN issuerId=user.userId → createCoupon), `POST /:couponId/issue`(201, issueByAdmin).
    - `SellerCouponController` `@Controller('sellers/me/coupons')` `@UseGuards(JwtAuthGuard)`: `POST /`(201, `seller=getApprovedSeller(user.userId)` 미승인 403 → issuerType=SELLER issuerId=seller.id), `POST /:couponId/issue`(201, issueBySeller(seller,...)), `GET /`(listSellerCoupons(seller.id, cursor)).
    - `UserCouponController` `@Controller('users/me/coupons')` `@UseGuards(JwtAuthGuard)`: `GET /`(listMyCoupons(user.userId, status)).
    - `CouponModule`: `imports:[AuthSharedModule, SellerModule, EventEmitterModule(또는 forRoot 전역)]`, `controllers:[AdminCouponController, SellerCouponController, UserCouponController]`, `providers:[CouponService, CouponRepository, CouponEvents]`, `exports:[CouponService]`.
  - 완료 기준: 전체 경로 상이(`sellers/me/coupons` vs 기존 `sellers/*` 충돌 0). 비-admin `POST /admin/coupons` 403(SC-003). 비인증 401(SC-052). `exports:[CouponService]`(order DI 소비). NestJS DI 순환 0(coupon→seller 단방향).

### Step 3. order·payment 연동 보정 (additive)

- [x] **T020** `[P]` — order.repository.findOrderItemWithOrder (review DI 지원)
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/order/order.repository.ts`
  - 관련 요구사항: FR-021
  - 상세: `findOrderItemWithOrder(orderItemId): Promise<(OrderItem & {order: Order}) | null>` — `this.prisma.tx.orderItem.findUnique({where:{id:orderItemId}, include:{order:true}})`. orders 스키마 자기 테이블만(OrderItem→Order 동일 스키마 FK, P-001 무위반).
  - 완료 기준: cross-schema 정적 무위반(orders 스키마만). 미존재 → null.

- [x] **T021** — order.service createOrder 쿠폰 분기 + CouponService 의존
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/order/order.service.ts`
  - 관련 요구사항: FR-010·011·012·013·014·017, SC-012·019·021
  - 상세: 생성자에 `CouponService` 7번째 의존 추가. `createOrder(userId, {items, shippingAddress, userCouponId?})`:
    - totalAmount 산출(003 기존) 후, `let discountAmount = new Prisma.Decimal(0); let couponId: string | undefined;`
    - `if (userCouponId) { const r = await couponService.validateAndCalculateDiscount(userCouponId, userId, totalAmount); discountAmount = r.discountAmount; couponId = r.couponId; }`(tx 진입 전 — fast-fail 4xx).
    - `runInTransaction` 내: decreaseStock×N(003 기존) → `if (userCouponId) await couponService.markUsed({userCouponId, orderId, userId, discountAmount, couponId})`(count===0→409) → `createOrder({id:orderId, userId, totalAmount, discountAmount, ...})`(discountAmount 동적, 003 은 0 고정) → createItems/appendEvent/cart.removeItems(003 기존).
    - `userCouponId` 없으면 전부 skip → discountAmount=0(SC-021, 003 동작 불변).
  - 완료 기준: SEC-FIND-004 — discountAmount 는 서버 계산값만(클라 dto 필드 부재). userCouponId 미전달 시 CouponService 미호출. 003 createOrder 테스트(discountAmount=0 단언) 회귀 0.

- [x] **T022** — order.service cancel restoreForOrder + getOrderItemForReview
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/order/order.service.ts`
  - 관련 요구사항: FR-016·021, SC-023
  - 상세:
    - `cancel(userId, orderId)` 의 `runInTransaction` 내(003 환불·restoreStock·상태전이와 동일 tx)에 `await couponService.restoreForOrder(orderId)` 추가(쿠폰 미적용 주문이면 count=0 no-op). 위치는 restoreStock 루프와 같은 블록(순서 무관).
    - 신규 공개 `getOrderItemForReview(orderItemId): Promise<{orderId; orderUserId; orderStatus: OrderStatus; productId; sellerId} | null>` — `orderRepository.findOrderItemWithOrder(orderItemId)` → 없으면 null, 있으면 `{orderId: item.order.id, orderUserId: item.order.userId, orderStatus: item.order.status, productId: item.productId, sellerId: item.sellerId}`.
  - 완료 기준: 취소+환불+재고복원+쿠폰복원 동일 tx(SC-023). 취소 실패 시 전체 롤백. getOrderItemForReview 미존재 null.

- [x] **T023** `[P]` — create-order.dto userCouponId + order.module CouponModule import
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/order/dto/create-order.dto.ts`, `apps/backend/src/modules/order/order.module.ts`, `apps/backend/src/modules/order/order.controller.ts`
  - 관련 요구사항: FR-010·014
  - 상세: `CreateOrderDto` 에 `@IsOptional() @IsString() userCouponId?: string` 추가(discountAmount 필드 추가 금지 — SEC-FIND-004). order.controller `createOrder` 가 `dto.userCouponId` 를 service 로 전달. `OrderModule.imports` 에 `CouponModule` 추가(forwardRef 불요 — 단방향).
  - 완료 기준: 미전달 시 003 동작 불변(FR-014). DI 순환 0.

- [x] **T024** `[P]` — payment.service pay 청구액 보정
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/payment/payment.service.ts`
  - 관련 요구사항: FR-015, SC-022
  - 상세: `pay` 의 `const amount = new Prisma.Decimal(order.totalAmount.toString());` → `.minus(order.discountAmount)` 추가. `order` 는 이미 주입된 `orderRepository.findById(orderId)` 반환(discountAmount 필드 존재 — 003 schema). gateway.charge·payment.amount 모두 이 값.
  - 완료 기준: discountAmount=0 주문 결과 동일(003 회귀 0). `totalAmount - discountAmount ≥ 0`(FR-012 보장). 신규 의존 추가 0.

### Step 4. review 모듈 (commerce 스키마)

- [x] **T030** — review.repository
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/review/review.repository.ts`
  - 관련 요구사항: FR-020·021·023·024·025·026
  - 상세: `this.prisma.tx.review` 로 — `createReview(data: {orderItemId, orderId, userId, productId, sellerId, rating, content})`, `findReviewById(id)`, `updateReview(id, data: {rating?, content?})`, `deleteReview(id)`, `listByProduct(productId, cursor, take)`(`orderBy:[{createdAt:desc},{id:desc}]`, cursor=id), `listByUser(userId, cursor, take)`(동일 cursor).
  - 완료 기준: commerce.review 모델만 접근 — orders/users/products 모델 직접 참조 0(SC-054). cursor 페이지네이션.

- [x] **T031** — review.service (작성 권한 DI·수정·삭제·조회)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/review/review.service.ts`
  - 관련 요구사항: FR-020·021·023·024·025·026·027, SC-030~033·035~040
  - 상세:
    - `createReview(userId, dto: {orderItemId, rating, content}): Promise<Review>` — `ctx = await orderService.getOrderItemForReview(orderItemId)`(DI); null → `NotFoundException(404)`; `ctx.orderUserId !== userId` → `ForbiddenException(403)`(SC-032); `ctx.orderStatus !== 'completed'` → `UnprocessableEntityException(422)`(SC-031); `createReview({orderItemId, orderId:ctx.orderId, userId, productId:ctx.productId, sellerId:ctx.sellerId, rating, content})`; P2002(orderItemId unique) catch → `ConflictException(409)`(SC-033, ADR-009); 성공 후 `reviewEvents.emitReviewCreated({reviewId, orderItemId, orderId, productId, userId, rating})`(tx 미사용 단일 insert 후 직접 emit, FR-027).
    - `updateReview(userId, reviewId, dto: {rating?, content?}): Promise<Review>` — findReviewById 없으면 404; `review.userId !== userId` → `ForbiddenException(403)`(SC-036) → updateReview(rating·content만).
    - `deleteReview(userId, reviewId): Promise<void>` — 동일 소유권 403(SC-038) → deleteReview.
    - `listProductReviews(productId, cursor?, limit?): Promise<{items, nextCursor}>`(공개, SC-039).
    - `listMyReviews(userId, cursor?, limit?): Promise<{items, nextCursor}>`(SC-040).
  - 완료 기준: OrderService DI(getOrderItemForReview)로만 orders 컨텍스트 획득 — review repo 가 orders 미조회(P-001/NFR-005, SC-054). 권한 검증 순서 정확(404→403→422→409).

- [x] **T032** `[P]` — review.events (review.created 발행)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/review/review.events.ts`
  - 관련 요구사항: FR-027, SC-041
  - 상세: `EventEmitter2` 주입. `emitReviewCreated(payload: {reviewId, orderItemId, orderId, productId, userId, rating})` → `emit('review.created', payload)`.
  - 완료 기준: 이벤트명 `review.created`, payload 6필드(SC-041).

- [x] **T033** — review dto + controllers + module wiring
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/review/dto/{create-review,update-review,list-review}.dto.ts`, `apps/backend/src/modules/review/review.controller.ts`(Review·ProductReview 분리), `apps/backend/src/modules/review/review.module.ts`
  - 관련 요구사항: FR-020·022·023·024·025·026, SC-030·034·035·037·039·040·052
  - 상세:
    - `CreateReviewDto` — `orderItemId @IsString`, `rating @IsInt @Min(1) @Max(5)`(SC-034 → 400), `content @IsString`. `UpdateReviewDto` — `rating? @IsInt @Min(1) @Max(5)`, `content? @IsString`. `ListReviewDto` — `after? @IsString`, `limit? @IsInt`.
    - `ReviewController` `@Controller('reviews')` `@UseGuards(JwtAuthGuard)`: `POST /`(201, createReview), `PATCH /:id`(updateReview), `DELETE /:id`(204, deleteReview), `GET /me`(listMyReviews).
    - `ProductReviewController` `@Controller('products/:productId/reviews')`(가드 없음 — 공개): `GET /`(listProductReviews, JWT 무 200 SC-039).
    - `ReviewModule`: `imports:[AuthSharedModule, OrderModule, EventEmitterModule]`, `controllers:[ReviewController, ProductReviewController]`, `providers:[ReviewService, ReviewRepository, ReviewEvents]`.
  - 완료 기준: `GET /reviews/me` 와 `GET /reviews/:id`(부재) 충돌 0. 공개 조회 비인증 200(SC-039). 인증 필요 엔드포인트 비인증 401(SC-052). DI 순환 0(review→order 단방향).

### Step 5. 테스트 (D 레이어 — 5a Test Agent AUTHORING)

> 본 Step 은 **5a Test Agent(AUTHORING)** 가 PPG-1 시작 시 작성(TDD Red). Development(4단계)는 Step 1~4(A·B·C)만 진행. 아래 [Test Authoring Contract](#test-authoring-contract) 가 입력.

- [ ] **T040** — coupon 단위 테스트 (`coupon.service.spec.ts`) — SC-001~011·013~018·020·024 + SC-051(단위)
- [ ] **T041** — order.service.spec 확장 (쿠폰 연동) — SC-012·019·021·023 + **mockCouponService provider 등록(003 회귀 해소 — §F)**
- [ ] **T042** `[P]` — payment.service.spec 확장 — SC-022 (+ 003 amount 회귀 확인)
- [ ] **T043** — review 단위 테스트 (`review.service.spec.ts`) — SC-030~041
- [ ] **T044** `[P]` — 정적 테스트 확장 — `cross-schema.spec.ts`(coupon/review repo 규칙 + commerce 모델 목록 coupon·userCoupon·review 추가, SC-054), `schema-decimal.spec.ts`(discountValue·maxDiscountAmount·minOrderAmount Decimal, SC-050)
- [ ] **T045** `[P]` — 인증/IDOR/AWS 종합 — SC-052(401 가드)·SC-053(IDOR 403 종합: SC-017·032·036·038)·SC-055(`package-no-aws.spec.ts` 자동)·SC-051(조건부 UPDATE 정적 grep)
- [ ] **T046** `[P]` — 003 회귀 smoke — `order.service.spec`·`payment.service.spec`·기존 static green 유지(101+177 PASS)

---

## Test Authoring Contract

> **PPG-1 5a Test Agent(AUTHORING) 입력 contract**. (PROC-004) production canonical 심볼 명시 — AUTHORING 은 production 미열람 상태로 가정하므로 아래 시그니처·토큰을 권위값으로 사용(추측 단언 금지).

### Production canonical 심볼

| 심볼 | canonical 형태 |
|---|---|
| `CouponService` | `createCoupon({issuerType, issuerId, type, discountValue, expiresAt, description?, minOrderAmount?, maxDiscountAmount?, totalQuantity?})`·`issueByAdmin(couponId, userId)`·`issueBySeller({id}, couponId, userId)`·`listMyCoupons(userId, status?)`·`listSellerCoupons(sellerId, cursor?, limit?)`·`validateAndCalculateDiscount(userCouponId, userId, orderTotal: Prisma.Decimal): Promise<{discountAmount: Prisma.Decimal; couponId: string}>`·`markUsed({userCouponId, orderId, userId, discountAmount, couponId?}): Promise<void>`·`restoreForOrder(orderId): Promise<void>` |
| `CouponRepository` | `createCoupon`·`findCouponById`·`incrementIssuedCountConditional(couponId): Promise<number>`·`createUserCoupon`·`findUserCouponWithCoupon(userCouponId)`·`listUserCoupons`·`listCouponsByIssuer`·`markUserCouponUsed(userCouponId, orderId): Promise<number>`·`restoreUserCouponsByOrder(orderId): Promise<number>` |
| `CouponEvents` | `emitCouponUsed({userCouponId, couponId, orderId, userId, discountAmount})` → `'coupon.used'` |
| `ReviewService` | `createReview(userId, {orderItemId, rating, content})`·`updateReview(userId, reviewId, {rating?, content?})`·`deleteReview(userId, reviewId): Promise<void>`·`listProductReviews(productId, cursor?, limit?): Promise<{items, nextCursor}>`·`listMyReviews(userId, cursor?, limit?)` |
| `ReviewRepository` | `createReview`·`findReviewById`·`updateReview`·`deleteReview`·`listByProduct`·`listByUser` |
| `ReviewEvents` | `emitReviewCreated({reviewId, orderItemId, orderId, productId, userId, rating})` → `'review.created'` |
| `OrderService`(004 신규) | `getOrderItemForReview(orderItemId): Promise<{orderId, orderUserId, orderStatus, productId, sellerId} | null>` + `createOrder(userId, {items, shippingAddress, userCouponId?})`(additive)·`cancel(userId, orderId)`(내부 restoreForOrder) |
| `PaymentService` | `pay(userId, orderId, idempotencyKey)` — amount = `order.totalAmount.minus(order.discountAmount)`(SC-022) |
| `SellerService` | `getApprovedSeller(userId): Promise<{id, userId}>` — 미승인 `ForbiddenException`(coupon 컨트롤러가 DI 호출) |
| `PrismaService`(mock) | `runInTransaction((fn)=>fn())`·`onAfterCommit((cb)=>cb())`·`get tx(){return this}` passthrough — service 로직 검증용 |
| 예외 리터럴 | `ForbiddenException`(403)·`UnprocessableEntityException`(422, 만료/status/minOrder/non-completed)·`ConflictException`(409, 이중사용/발급한도/중복리뷰)·`BadRequestException`(400, rating via ValidationPipe)·`NotFoundException`(404) |
| enum/status 리터럴 | `CouponIssuerType.ADMIN/SELLER`·`CouponType.FIXED/PERCENTAGE`·`UserCouponStatus.unused/used/expired`·`OrderStatus.completed`(리뷰 허용) |

### (PATCH-03) coupon 적용/미적용 양 분기 + review 권한 mock 재현 규약

> mock 이 production 실제 경로를 재현하여, 5b 에서 가정 불일치로 인한 [B] 정정을 차단.

- **order.service.spec 양 분기 필수**:
  - **쿠폰 적용 경로(SC-012·019)**: `mockCouponService.validateAndCalculateDiscount.mockResolvedValue({discountAmount: new Prisma.Decimal(5000), couponId})` + `mockCouponService.markUsed.mockResolvedValue(undefined)`. createOrder 호출 후 `orderRepository.createOrder` 의 discountAmount 인자=5000 단언 + `markUsed` 호출 단언.
  - **쿠폰 미적용 경로(SC-021)**: userCouponId 미전달 → `mockCouponService.validateAndCalculateDiscount`·`markUsed` **호출 0 단언**(`not.toHaveBeenCalled()`) + discountAmount=0 단언.
  - **§F 생성자 마이그레이션**: OrderService TestingModule `providers` 에 `{provide: CouponService, useValue: mockCouponService}` **반드시 추가**(누락 시 003 order 테스트 전부 컴파일 FAIL). `mockCouponService = {validateAndCalculateDiscount: jest.fn(), markUsed: jest.fn(), restoreForOrder: jest.fn()}`.
  - **이중사용(SC-020 의 order 측)**: `mockCouponService.markUsed.mockRejectedValue(new ConflictException())` → createOrder 가 409 전파 + 전체 롤백(runInTransaction reject) 단언.
- **review 권한 mock 이 production validation 순서 재현(SC-031·032)**:
  - `mockOrderService.getOrderItemForReview.mockResolvedValue({orderId, orderUserId, orderStatus, productId, sellerId})` 형태로 — 타인 주문(`orderUserId !== userId`) → 403, 비-completed(`orderStatus !== 'completed'`) → 422, null → 404 각각 별도 케이스로 production 분기 순서(404→403→422→409) 재현.
  - 중복 리뷰(SC-033): `mockReviewRepository.createReview.mockRejectedValue(P2002)` → 409 변환 단언.
- **coupon.service.spec 동시성(SC-020·007)**:
  - 이중사용: `mockCouponRepository.markUserCouponUsed.mockResolvedValue(0)`(2회차 count=0) → markUsed 가 ConflictException(409) throw 단언.
  - 발급 한도(SC-007): `mockCouponRepository.incrementIssuedCountConditional.mockResolvedValue(0)` → issueByAdmin 409 단언.
- **Decimal 계산(SC-013·014)**: `validateAndCalculateDiscount` 직접 호출, 반환 discountAmount 를 `Prisma.Decimal` 로 단언(`.toString()` 비교) — FIXED 5000/total 3000→3000, PERCENTAGE 20%/max10000 total 60000→10000·total 30000→6000.

### SC → 테스트 매핑

| SC-ID | 수용 기준 | Happy | Edge | Error | 테스트 파일 | 비고 |
|---|---|---|---|---|---|---|
| SC-001, SC-002 | admin FIXED/PERCENTAGE 생성 | test_when_admin_create_fixed/percentage_then_201 | — | — | `src/modules/coupon/coupon.service.spec.ts` | [env:unit] createCoupon |
| SC-003 | 비-admin admin 생성 403 | — | — | test_when_non_admin_create_then_403 | `test/static/auth-required-guards.spec.ts`(확장) 또는 controller spec | [env:unit/static] AdminGuard |
| SC-004, SC-005 | 판매자 생성/미승인403 | test_when_approved_seller_create_then_201_issuerSELLER | — | test_when_unapproved_seller_then_403 | coupon.service.spec.ts | getApprovedSeller mock |
| SC-006, SC-007 | admin 발급/한도409 | test_when_admin_issue_then_201_unused | test_when_quantity_limit_exceeded_then_409 | — | coupon.service.spec.ts | incrementIssuedCountConditional→0 |
| SC-008, SC-009 | 판매자 자기/타발급자 발급 | test_when_own_coupon_issue_then_201 | — | test_when_other_issuer_then_403 | coupon.service.spec.ts | issuerId 검증 |
| SC-010 | 내 쿠폰 조회(격리) | test_when_list_my_then_own_only | — | — | coupon.service.spec.ts | userId 필터 |
| SC-011 | 판매자 쿠폰 조회(격리) | test_when_list_seller_then_issuer_only | — | — | coupon.service.spec.ts | cursor |
| SC-012 | discountAmount 서버 설정·클라무시 | test_when_fixed_coupon_then_order_discount_5000_server | — | — | `src/modules/order/order.service.spec.ts`(확장) | mockCoupon validate=5000 |
| SC-013 | FIXED 초과 방지 | — | test_when_fixed_exceeds_total_then_clamped_3000 | — | coupon.service.spec.ts | Decimal |
| SC-014 | PERCENTAGE 상한/미적용 | — | test_when_percentage_then_cap_10000_and_6000 | — | coupon.service.spec.ts | floor·min |
| SC-015 | 만료 쿠폰 422 | — | — | test_when_expired_then_422 | coupon.service.spec.ts | expiresAt<=now |
| SC-016 | used 쿠폰 422 | — | — | test_when_status_used_then_422 | coupon.service.spec.ts | |
| SC-017 | 타인 쿠폰 403 | — | — | test_when_other_user_coupon_then_403 | coupon.service.spec.ts | IDOR |
| SC-018 | minOrderAmount 미달 422 | — | — | test_when_below_min_order_then_422 | coupon.service.spec.ts | |
| SC-019 | tx 원자 used 전이/실패 unused | test_when_order_then_markUsed_called_in_tx | test_when_order_fails_then_coupon_unused | — | order.service.spec.ts | markUsed spy / reject 롤백 |
| SC-020 | 이중사용 409 | — | test_when_concurrent_markUsed_then_second_409 | — | coupon.service.spec.ts | markUserCouponUsed→0 |
| SC-021 | userCouponId 무 → discount 0 | test_when_no_coupon_then_discount_0_and_coupon_not_called | — | — | order.service.spec.ts | not.toHaveBeenCalled |
| SC-022 | 쿠폰 결제 청구액 | test_when_pay_with_discount_then_amount_50000 | — | — | `src/modules/payment/payment.service.spec.ts`(확장) | totalAmount.minus(discount) |
| SC-023 | 취소→쿠폰 복원 | test_when_cancel_then_restoreForOrder_called | — | — | order.service.spec.ts + coupon.service.spec(restore unit) | restoreForOrder spy / count no-op |
| SC-024 | coupon.used 이벤트 | test_when_markUsed_then_coupon_used_emitted_5fields | — | — | coupon.service.spec.ts | onAfterCommit passthrough |
| SC-030 | completed 주문 리뷰 | test_when_completed_order_then_review_201 | — | — | `src/modules/review/review.service.spec.ts` | getOrderItemForReview mock |
| SC-031 | 비-completed 422 | — | — | test_when_not_completed_then_422 | review.service.spec.ts | orderStatus≠completed |
| SC-032 | 타인 주문 403 | — | — | test_when_other_user_order_then_403 | review.service.spec.ts | orderUserId≠me |
| SC-033 | 중복 리뷰 409 | — | test_when_duplicate_orderItem_then_409 | — | review.service.spec.ts | P2002 catch |
| SC-034 | rating 0/6 → 400 | — | — | test_when_rating_out_of_range_then_400 | review dto / ValidationPipe | @Min/@Max |
| SC-035, SC-036 | 본인 수정/타인403 | test_when_own_update_then_updated | — | test_when_other_update_then_403 | review.service.spec.ts | |
| SC-037, SC-038 | 본인 삭제204/타인403 | test_when_own_delete_then_204 | — | test_when_other_delete_then_403 | review.service.spec.ts | |
| SC-039 | 상품 리뷰 공개조회 | test_when_get_product_reviews_no_jwt_then_200_cursor | — | — | review.service.spec.ts + controller(공개 가드 무) | 최신순 cursor |
| SC-040 | 내 리뷰 조회(격리) | test_when_list_my_reviews_then_own_only | — | — | review.service.spec.ts | userId 필터 |
| SC-041 | review.created 이벤트 | test_when_review_created_then_event_6fields | — | — | review.service.spec.ts | emitReviewCreated spy |
| SC-050 | 금전 Decimal 정적 | test_when_inspect_schema_then_coupon_money_fields_decimal | — | — | `test/static/schema-decimal.spec.ts`(확장) | discountValue·maxDiscountAmount·minOrderAmount |
| SC-051 | 조건부 UPDATE WHERE unused | test_when_inspect_repo_then_conditional_update_unused | — | — | coupon.service.spec.ts(markUsed count) + grep 정적 | NFR-002 |
| SC-052 | 비인증 401 | — | — | test_when_no_jwt_then_401 | `test/static/auth-required-guards.spec.ts`(확장) | coupon/review 인증 엔드포인트 |
| SC-053 | IDOR 403 종합 | — | — | test_idor_coupon_review_then_403 | order/coupon/review.service.spec(SC-017·032·036·038 재사용) | [env:unit] |
| SC-054 | coupon/review repo cross-schema 0 | test_coupon_review_repo_no_cross_schema | — | — | `test/static/cross-schema.spec.ts`(확장) | `this.prisma[.tx].{model}` 양 패턴 + commerce 모델 추가 |
| SC-055 | AWS SDK 미추가 | test_no_aws_sdk_added | — | — | `test/static/package-no-aws.spec.ts`(기존, 자동 충족) | [env:static] |

> 본 contract 는 외부 agent/사용자/CI 가 충족 가능. main session 이 `ExternalAuthoring: YES` 시 외부 산출물(test-cases.md + 테스트 파일) 존재를 확인 후 5b 진입.
> **SC-054 정적 사각지대 차단(research §공유 상태)**: 신규 coupon/review repo 는 `this.prisma.tx.{model}` 사용 → cross-schema.spec 의 `buildCrossSchemaPattern`(이미 `.tx.` 변형 포함) 재사용. **`COMMERCE_SCHEMA_MODELS` 에 `coupon`·`userCoupon`·`review` 추가** 필수(coupon/review repo 의 자기 스키마 모델은 forbidden 목록에서 제외, 타 모듈 repo 의 forbidden 목록에는 commerce 전체 포함). coupon/review repo rule = forbidden `[products + users + orders + payments]`.

---

## 태스크 입도 가이드

- 1 태스크 ≈ 구현 파일 1~3개 + 대응 테스트 1개. coupon.service(T002)는 책임이 크나 단일 클래스 응집(생성·발급·조회·검증·사용·복원) → 분할 시 상태 공유 비용. review.service(T031)도 단일 클래스.
- 호출측 5개 이상 영향 태스크: T021(OrderService 생성자 의존 추가) — order.service.spec 1개 파일만 영향(§F), 별도 분리 불요.
- 003 cross-cutting 보정(T021·T022·T023·T024)은 additive — 003 회귀 경계는 T046 smoke 가 감지.

## 구현 완료 기준

- [ ] 모든 A·B·C 태스크 체크박스 완료(4단계), D 태스크 완료(5a)
- [ ] `pnpm --filter backend test` 전체 PASSED — 003 회귀 0(101+177) + 004 신규 SC `[TypeScript/NestJS]`
- [ ] `pnpm --filter backend build`(`nest build`/tsc) 0 error — NestJS DI 순환(order↔coupon·review↔order 단방향) 미발생
- [ ] cross-schema(SC-054)·schema-decimal(SC-050)·package-no-aws(SC-055) 정적 PASS
- [ ] `package.json` 신규 의존 0(SC-055). `@aws-sdk/*` 0
- [ ] git status 의도치 않은 파일 없음
</content>
