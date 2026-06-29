---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-28 22:35
상태: 확정
---

# Tasks: 003-commerce

> Branch: 003-commerce | Date: 2026-06-28 | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [Test Authoring Contract](#test-authoring-contract)
- [태스크 입도 가이드](#태스크-입도-가이드)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목 해소(미결 사항: 없음)
- [x] plan.md Constitution Gates(P-001~007) 전부 통과(예외 0)
- [ ] CHANGES.md 의 이전 작업 "후속 작업 시 주의사항" 확인(002 — inventory tx-aware/SEC-002 영향)
- [ ] **Database Design Agent** 가 `data-model.md` + 마이그레이션(commerce·orders·payments 7테이블 + `InventoryLogType.RESTORE` enum) 확정 후 Prisma client 생성 완료(PPG-1 진입 전제 — selection-phases: DB Design Y)

> A·B·C 레이어 = **4단계 Development Agent**. D 레이어 = **5a Test Agent(AUTHORING)**. 양 Agent 동일 turn PPG-1 병렬. 레이어 A→B→C 의존 순, [P] 는 병렬 가능.

---

## 태스크 목록

> 레이어: A 데이터(repository·schema 연동) / B 도메인(service·gateway·pgboss) / C 인터페이스(controller·dto·module wiring) / D 테스트(5a).
> 스키마·마이그레이션 자체는 Database Design Agent 소유 — A 레이어 repository 는 그 산출 client 를 소비.

### Step 1. 트랜잭션·큐 인프라 기반

- [x] **T001** — PrismaService ALS tx-aware 확장
  - 레이어: A/B (shared infra)
  - 구현 파일: `apps/backend/src/shared/prisma/prisma.service.ts`
  - 관련 요구사항: FR-013·022·033·037, NFR-008
  - 상세: `AsyncLocalStorage<TxContext{client, afterCommit:[]}>` 필드. `get tx(): Prisma.TransactionClient`(store 있으면 client, 없으면 `this`). `onAfterCommit(cb)`(store 있으면 push, 없으면 즉시 await). `runInTransaction<T>(fn)`(store 있으면 reuse, 없으면 `$transaction(client => als.run({client,hooks}, fn))` 후 hooks 순차 best-effort 실행). plan §1 코드 정합.
  - 완료 기준: 기존 `onModuleInit/Destroy` 불변. ALS 미활성 시 `tx===root client`(002 inventory.repository 회귀 0). `uv` 무관(TS) — `pnpm --filter backend test` 의 002 inventory 단위 PASS 유지.

- [x] **T002** `[P]` — 상수 모듈
  - 레이어: B
  - 구현 파일: `apps/backend/src/shared/pgboss/pgboss.constants.ts`, `apps/backend/src/modules/order/order.constants.ts`
  - 관련 요구사항: FR-018·024·027
  - 상세: `AUTO_CONFIRM_DAYS=7`, `OUTBOX_QUEUE='payment-outbox-relay'`, `AUTO_CONFIRM_QUEUE='order-auto-confirm'`, `AUTO_CONFIRM_CRON`(일1회), `OUTBOX_POLL_INTERVAL`, `DEFAULT_PAGE_LIMIT`/`MAX_PAGE_LIMIT`(002 승계). 매직넘버 금지(테스트도 동일 상수 참조).
  - 완료 기준: 매직 리터럴(7·cron·limit) 코드 직접 등장 0건.

- [x] **T003** — PgBossModule 부트스트랩(createQueue 필수)
  - 레이어: B
  - 구현 파일: `apps/backend/src/shared/pgboss/pgboss.module.ts`, `apps/backend/src/shared/pgboss/pgboss.service.ts`
  - 관련 요구사항: FR-027·034
  - 상세: `new PgBoss(DATABASE_URL)`→`onModuleInit`: `start()` → **`createQueue(OUTBOX_QUEUE)`·`createQueue(AUTO_CONFIRM_QUEUE)` 선행**(v10 필수, research §pg-boss) → relay `work`/`schedule` 등록. `onModuleDestroy`: `stop()`. PgBoss 인스턴스 DI 토큰 `PG_BOSS` provider. (OutboxRelay·AutoConfirmJob 핸들러 등록은 T050/T051.)
  - 완료 기준: `pg-boss@^10.4.2` import(ESM/Node22 비호환 v11/v12 금지). createQueue 가 work/schedule 보다 먼저 호출.

### Step 2. product 공개 인터페이스 + inventory(tx-aware + restoreStock + SEC-002)

- [x] **T010** — product.repository variant+product join 조회
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/product/product.repository.ts`
  - 관련 요구사항: FR-010·016·017·024·050·051
  - 상세: `findVariantWithProduct(variantId)`·`findVariantsWithProduct(variantIds: string[])` — `variant.findUnique/findMany({include:{product:true}})`(products 동일 스키마, P-001 무위반). 반환에 variant.price·product.sellerId·product.title 포함.
  - 완료 기준: products 스키마 모델만 접근(cross-schema 정적 무위반).

- [x] **T011** — ProductService 공개 메서드 + module exports
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/product/product.service.ts`, `apps/backend/src/modules/product/product.module.ts`
  - 관련 요구사항: FR-010·016·017·024·050·051
  - 상세: `getVariantSnapshot(variantId): Promise<VariantSnapshot>`(미존재 404), `getVariantSnapshots(variantIds): Promise<Map<string,VariantSnapshot>>`(배치 N→1, 누락 variantId 검출), `assertSellerOwnsVariant(variantId, sellerId): Promise<void>`(variant→product.sellerId≠sellerId → ForbiddenException). `VariantSnapshot` 타입 export. `ProductModule.exports` 에 `ProductService` 추가.
  - 완료 기준: cart/order/inventory 가 DI 소비 가능. unitPrice 는 `Prisma.Decimal`.

- [x] **T012** `[P]` — inventory.repository tx-aware retrofit
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/inventory/inventory.repository.ts`
  - 관련 요구사항: FR-013·023
  - 상세: `findByVariant·createInventory·increment·conditionalDecrement·sumQuantityByProduct·appendLog` 의 `this.prisma.X` → `this.prisma.tx.X`. behavior-preserving(ALS 미활성 시 root).
  - 완료 기준: `inventory-log-append-only`·`inventory-service-signature`·`cross-schema`(002) 정적 PASS 유지. 002 inventory.service 단위 PASS 유지.

- [x] **T013** — InventoryService.restoreStock + emit onAfterCommit 이동
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/inventory/inventory.service.ts`
  - 관련 요구사항: FR-023, SC-025
  - 상세: `restoreStock(variantId, quantity, orderId): Promise<void>` — findByVariant(미존재 예외) → `increment(variantId,quantity)` → `appendLog(type=RESTORE, delta=+quantity, orderId)` → `onAfterCommit(()=>emitStockChanged(productId))`. `stockIn`·`decreaseStock` 의 emit 도 `onAfterCommit` 으로 이동(ADR-005). `decreaseStock` **시그니처 불변**.
  - 완료 기준: `InventoryLogType.RESTORE` 사용. decreaseStock 외부 시그니처·호출측 무변경.

- [x] **T014** `[P]` — InventoryLogType.RESTORE enum 추가 (DB Design 협조)
  - 레이어: A
  - 구현 파일: `apps/backend/prisma/schema.prisma`(Database Design Agent 가 마이그레이션 확정 — 본 task 는 client 소비 정합 확인)
  - 관련 요구사항: FR-023
  - 상세: `enum InventoryLogType { STOCK_IN DECREASE INIT RESTORE }`(additive). 마이그레이션 순서·`@@schema("products")` 는 DB Design 소유.
  - 완료 기준: 기존 enum 값 영향 0. `@prisma/client` 에 `InventoryLogType.RESTORE` 노출.

- [x] **T015** — InventoryController SEC-002 소유권 검증
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/inventory/inventory.controller.ts`, `apps/backend/src/modules/inventory/inventory.module.ts`
  - 관련 요구사항: FR-050·051, SC-042·043·044
  - 상세: stockIn·getStock 에서 `seller=getApprovedSeller(user.userId)` → **`assertSellerOwnsVariant(variantId, seller.id)`**(ProductService DI) 후 기존 동작. getStock 은 소유권(403/404)을 getStock(0 반환)보다 **먼저**. `InventoryModule.imports` 에 ProductModule(또는 순환 회피 provider) 추가.
  - 완료 기준: **순환 DI 회피** — `Product→Inventory→Product` 순환 시 `forwardRef(()=>ProductModule)` 적용, NestJS 순환 경고 시 별도 `VariantOwnershipService`(products variant+product 조회) provider 로 분리(research §영향 범위 주의). 빌드 0 error.

### Step 3. cart 모듈 (commerce)

- [x] **T020** — cart.repository
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/cart/cart.repository.ts`
  - 관련 요구사항: FR-001~005
  - 상세: `this.prisma.tx.cart` 로 `findByUser(userId)`·`upsertItems(userId, items)`(JSONB) 등. commerce 스키마(`carts`)만 접근.
  - 완료 기준: cross-schema 정적(SC-050) 무위반(`this.prisma.tx.cart` 외 타 스키마 모델 접근 0).

- [x] **T021** — cart.service (+removeItems tx-aware)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/cart/cart.service.ts`, `apps/backend/src/modules/cart/cart.module.ts`
  - 관련 요구사항: FR-001~005·014
  - 상세: `addItem`(getVariantSnapshot 으로 snapshot 채움, 동일 variantId 수량 합산), `updateQuantity`(0→제거), `removeItem`, `getCart`(빈 배열 가능), `removeItems(userId, variantIds): Promise<void>`(order DI, tx 참여). ProductService DI. `CartModule.imports=[ProductModule]`, `exports=[CartService]`.
  - 완료 기준: 동일 variantId 합산(SC-002)·quantity=0 제거(SC-004) 분기. userId 키 격리(SC-008).

- [x] **T022** — cart.controller + dto
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/cart/cart.controller.ts`, `apps/backend/src/modules/cart/dto/{add-cart-item,update-cart-item}.dto.ts`
  - 관련 요구사항: FR-001~005, SC-001~008·047
  - 상세: `@Controller('cart')`+`@UseGuards(JwtAuthGuard)`. `POST /cart/items`(201)·`PATCH /cart/items/:variantId`·`DELETE /cart/items/:variantId`(204)·`GET /cart`. `@CurrentUser()` userId. dto `class-validator`(variantId string, quantity @Min(0)/@Min(1)).
  - 완료 기준: 비인증 401(JwtAuthGuard). HttpCode(201/204) 정확.

### Step 4. order 모듈 (orders)

- [x] **T030** — order.repository
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/order/order.repository.ts`
  - 관련 요구사항: FR-010~028
  - 상세: `this.prisma.tx.order/orderItem/orderEvent` 로 createOrder·createItems·appendEvent·findById·listByUser(cursor)·listBySeller·updateStatus·findDeliveredBefore(date). orders 스키마만 접근(order_items·order_events 동일 스키마 FK).
  - 완료 기준: cross-schema 정적(SC-050) 무위반. cursor `orderBy:[{createdAt:desc},{id:desc}]`.

- [x] **T031** — order.service 주문 생성(runInTransaction)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/order/order.service.ts`
  - 관련 요구사항: FR-010~017, SC-009·010·011·012·013·014·015·016·032
  - 상세: `createOrder(userId, {items, shippingAddress})`: (1) `getVariantSnapshots(variantIds)` 배치. (2) 각 `checkAvailability` — 부족 1+ → 409 + 부족 variantId 목록(tx 진입 전). (3) `runInTransaction`: order insert(status=pending, totalAmount=Σ unitPrice×q Decimal, discountAmount=0, shippingAddressSnapshot JSONB) → id 확보 → 각 `decreaseStock(variantId,q,orderId)`(race→InsufficientStock→롤백→409) → order_items N행 → order_events(null→pending, CUSTOMER) → `cartService.removeItems(userId, variantIds)`. ADR-009: order 먼저 insert 후 id 사용(무의존, research §기술선택).
  - 완료 기준: 전 단계 단일 tx. decreaseStock 실패 시 order 미생성(SC-012). 빈 items 400 guard.

- [x] **T032** — order.service 조회/상세/취소(+환불+재고복구)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/order/order.service.ts`
  - 관련 요구사항: FR-018·019·020·021·022·023, SC-017~025
  - 상세: `listMyOrders(userId, cursor, limit)`(cursor 응답 `{items, nextCursor}`), `getDetail(userId, id)`(userId≠me→403), `cancel(userId, id)`: status∉{pending,confirmed}→400, userId≠me→403, `runInTransaction`: 결제 completed 존재 시 `paymentService.refund(paymentId, 'refund:'+orderId)`(실패→전체 롤백) → 각 item `restoreStock(variantId,q,orderId)` → order.status=cancelled + order_events(CUSTOMER). PaymentService·InventoryService DI.
  - 완료 기준: 취소+환불+복구 동일 tx(SC-024). preparing+ 400(SC-022).

- [x] **T033** — order.service 판매자/구매확정/자동확정/markConfirmed
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/order/order.service.ts`
  - 관련 요구사항: FR-024·025·026·027·034, SC-026~031·037
  - 상세: `listSellerOrders(userId)`(getApprovedSeller→order_items.sellerId∋me), `confirmBySeller(userId, id)`(sellerId 미포함→403, confirmed→preparing, SELLER event), `complete(userId, id)`(userId≠me→403, delivered→completed, CUSTOMER event), `autoConfirmDelivered(now: Date): Promise<number>`(deliveredAt≤now-AUTO_CONFIRM_DAYS && delivered → completed, SYSTEM event — pg-boss 무관 순수 로직, SC-031 now mock), `markConfirmed(orderId)`(pending→confirmed, SYSTEM event — OutboxRelay 호출, SC-037, 멱등: 이미 confirmed→no-op).
  - 완료 기준: autoConfirmDelivered 가 pg-boss 의존 없이 단위 테스트 가능. markConfirmed 멱등.

- [x] **T034** `[P]` — order.events (order_events append-only)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/order/order.events.ts`
  - 관련 요구사항: FR-028, SC-032
  - 상세: 상태 전이 시 `order_events` append 헬퍼(또는 repository.appendEvent 직접). UPDATE/DELETE 미사용(append-only). `actorType` enum CUSTOMER/SELLER/ADMIN/SYSTEM.
  - 완료 기준: 모든 전이(생성·취소·확인·확정·자동확정·markConfirmed)에서 1행 append.

- [x] **T035** — order.controller + sellers.controller + dto + module
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/order/order.controller.ts`, `apps/backend/src/modules/order/seller-order.controller.ts`, `apps/backend/src/modules/order/dto/{create-order,list-orders}.dto.ts`, `apps/backend/src/modules/order/order.module.ts`
  - 관련 요구사항: FR-010·018·019·020·024·025·026, SC-009~030·047·048
  - 상세: `@Controller('orders')`: POST(201)·GET(목록)·GET/:id·DELETE/:id·POST/:id/complete·PATCH/:id/confirm. `@Controller('sellers')`: GET /sellers/me/orders. 전부 `@UseGuards(JwtAuthGuard)`. dto: items[{variantId,quantity@Min(1)}], shippingAddress{recipientName,phone,zipCode,address1,address2?}, list(after?,limit?). `OrderModule.imports=[ProductModule, CartModule, InventoryModule, PaymentModule, SellerModule, AuthSharedModule]`, `exports=[OrderService]`(pgboss relay 소비).
  - 완료 기준: 경로 `orders`/`sellers` 정확. 비인증 401. IDOR 403(SC-019/023/030).

### Step 5. payment 모듈 (payments)

- [x] **T040** `[P]` — PaymentGatewayPort + StubPaymentGateway
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/payment/payment.gateway.port.ts`, `apps/backend/src/modules/payment/stub.payment.gateway.ts`
  - 관련 요구사항: FR-032·036, SC-039
  - 상세: `interface PaymentGatewayPort{ charge(req:{orderId,amount:Decimal,idempotencyKey}):Promise<{success,pgTransactionId?,failureReason?}>; refund(req:{paymentId,amount:Decimal,idempotencyKey}):Promise<{success,pgRefundId?}> }`. DI 토큰 `PAYMENT_GATEWAY`. `StubPaymentGateway` 기본 성공 반환(테스트 시 실패 주입 가능).
  - 완료 기준: 토큰 기반 DI. 실 PG 결합 0(P-004).

- [x] **T041** `[P]` — payment.repository
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/payment/payment.repository.ts`
  - 관련 요구사항: FR-030~038
  - 상세: `this.prisma.tx.payment/refund/paymentOutbox` 로 createPayment·findByIdempotencyKey·findByOrderId·updateStatus·createRefund·findRefundByKey·createOutbox·findPendingOutbox·markOutboxProcessed. payments 스키마만(refunds·payment_outbox 동일 스키마 FK).
  - 완료 기준: cross-schema 정적(SC-050) 무위반.

- [x] **T042** — payment.service 결제(runInTransaction+outbox+idempotency)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/payment/payment.service.ts`
  - 관련 요구사항: FR-030·032·033·034·035·036, SC-033·034·036·038·039·052
  - 상세: `pay(userId, orderId, idempotencyKey)`: order 소유 조회(OrderService DI 또는 order 소유 확인)→userId≠me 403, status≠pending 거부. `findByIdempotencyKey` 존재→최초 결과 반환(멱등, SC-038). `runInTransaction`: `gateway.charge` 성공→payment(completed)+`createOutbox('payment.completed',{orderId})`(동일 tx, SC-036/052) / 실패→payment(failed), outbox 미기록, order pending 유지(SC-039). P2002(idempotencyKey race)→기존 조회 반환.
  - 완료 기준: outbox 기록 실패 주입 시 payment 롤백(SC-052). 멱등 재요청 변경 없음(SC-038).

- [x] **T043** — payment.service refund (tx-aware, 409 guard)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/payment/payment.service.ts`
  - 관련 요구사항: FR-021·037·038, SC-024·040·041
  - 상세: `refund(paymentId, idempotencyKey): Promise<RefundResult>`: `findRefundByKey` 동일 key 존재→최초 결과(멱등). `payment.status==='refunded' && key≠기존`→409. `runInTransaction`(order 취소 tx 참여): `gateway.refund`→`createRefund`+payment.status=refunded+`createOutbox('payment.refunded',{orderId})`(동일 tx).
  - 완료 기준: 환불+outbox 동일 tx(SC-040). 이중환불 다른키 409(SC-041).

- [x] **T044** — payment.controller + dto + module (Idempotency-Key 검증)
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/payment/payment.controller.ts`, `apps/backend/src/modules/payment/dto/create-payment.dto.ts`, `apps/backend/src/modules/payment/payment.module.ts`
  - 관련 요구사항: FR-030·031, SC-033·034·035·047
  - 상세: `@Controller('payments')`+`@UseGuards(JwtAuthGuard)`. `POST /payments`(201): body{orderId}, header `Idempotency-Key`(`@Headers`) — 없음/비-UUIDv4→400(FR-031, SC-035). UUID v4 검증(`class-validator isUUID('4')` 또는 수동). `PaymentModule.providers`: PaymentService·PaymentRepository·{provide:PAYMENT_GATEWAY, useClass:StubPaymentGateway}, `imports=[OrderModule(forwardRef 주의)/SellerModule/AuthSharedModule]`, `exports=[PaymentService]`(order refund 소비).
  - 완료 기준: 멱등키 누락 400. 타인 주문 403. **order↔payment 순환**: payment→OrderService(소유조회) DI 시 order→payment(refund) 와 순환 → research §토폴로지대로 payment 는 OrderService 직접 DI 대신 order 소유 확인을 자기 경로(orderId→소유)로 처리하거나 forwardRef. (relay 경유 markConfirmed 는 순환 아님.)

### Step 6. pg-boss relay/job 연결

- [x] **T050** — OutboxRelay (payment.completed → markConfirmed)
  - 레이어: B
  - 구현 파일: `apps/backend/src/shared/pgboss/outbox-relay.ts`
  - 관련 요구사항: FR-033·034, SC-037
  - 상세: `payment_outbox` pending 폴링(또는 pg-boss work 큐) → `payment.completed` → `OrderService.markConfirmed(orderId)` → outbox `processed`. **work 핸들러는 job 배열 수신**(`async (jobs)=>{ for (const job of jobs)… }`, research §pg-boss). at-least-once 멱등(markConfirmed no-op). OrderService DI(payment→order 순환 회피: relay 가 인프라 레이어에서 order 의존, ADR-007).
  - 완료 기준: createQueue(OUTBOX_QUEUE) 선행. 배열 핸들러. 멱등.

- [x] **T051** `[P]` — AutoConfirmJob (schedule → autoConfirmDelivered)
  - 레이어: B
  - 구현 파일: `apps/backend/src/shared/pgboss/auto-confirm.job.ts`
  - 관련 요구사항: FR-027, SC-031
  - 상세: `boss.schedule(AUTO_CONFIRM_QUEUE, AUTO_CONFIRM_CRON)` + `boss.work(AUTO_CONFIRM_QUEUE, async ()=>orderService.autoConfirmDelivered(new Date()))`. 로직은 OrderService(SC-031 now mock 단위 검증). createQueue 선행.
  - 완료 기준: pg-boss 는 thin trigger. 로직 OrderService 분리.

### Step 7. app wiring

- [x] **T060** — app.module 등록 + package.json 의존
  - 레이어: C
  - 구현 파일: `apps/backend/src/app.module.ts`, `apps/backend/package.json`
  - 관련 요구사항: FR-027·034, NFR-007, SC-051
  - 상세: `PgBossModule` 을 app.module imports 에 추가. `package.json dependencies` 에 `"pg-boss": "^10.4.2"`(비-AWS). `@aws-sdk/*` 추가 0(SC-051).
  - 완료 기준: 앱 부트 시 pg-boss start + createQueue. pnpm install 후 빌드 0 error.

### Step 8. 테스트 (D 레이어 — 5a Test Agent AUTHORING)

> 본 Step 은 **5a Test Agent(AUTHORING)** 가 PPG-1 시작 시 작성(TDD Red). Development(4단계)는 Step 1~7(A·B·C)만 진행. 아래 [Test Authoring Contract](#test-authoring-contract) 가 입력.

- [ ] **T070** — cart 단위 테스트 (`cart.service.spec.ts`) — SC-001~006·008
- [ ] **T071** — order 단위 테스트 (`order.service.spec.ts`) — SC-009~016·017~023·025~032
- [ ] **T072** — payment 단위 테스트 (`payment.service.spec.ts`) — SC-033~041·052
- [ ] **T073** — SEC-002 단위 테스트 (`inventory.controller.spec.ts` 또는 product.service.spec 확장) — SC-042·043·044
- [ ] **T074** — restoreStock/markConfirmed/autoConfirm 단위 (`inventory.service.spec.ts` 확장 + order.service.spec) — SC-025·031·037
- [ ] **T075** — 정적 테스트: cross-schema(`this.prisma.{model}`+`this.prisma.tx.{model}` 양 패턴) SC-050, schema-decimal SC-049, package-no-aws SC-051 — `test/static/`
- [ ] **T076** — 인증/IDOR 종합 (`auth-required-guards` 확장) — SC-047·048
- [ ] **T077** `[P]` — 002 회귀 smoke 확인 — `inventory.service.spec`·`product.service.spec`·기존 static green 유지(plan §smoke_tests)
- [ ] **T078** — integration(옵션 A — main session 주도): POST /orders P95 SC-045, POST /payments P95 SC-046 — `test/*.e2e-spec.ts`(실 PostgreSQL)

---

## Test Authoring Contract

> **PPG-1 5a Test Agent(AUTHORING) 입력 contract**. (PROC-004) production canonical 심볼 명시 — AUTHORING 은 production 미열람 상태로 가정하므로 아래 시그니처·토큰을 권위값으로 사용.

### Production canonical 심볼 (추측 단언 금지)

| 심볼 | canonical 형태 |
|---|---|
| `CartService` | `addItem(userId, {variantId, quantity})`·`updateQuantity(userId, variantId, quantity)`·`removeItem(userId, variantId)`·`getCart(userId)`·`removeItems(userId, variantIds: string[])` |
| `OrderService` | `createOrder(userId, {items:[{variantId,quantity}], shippingAddress})`·`listMyOrders(userId, cursor?, limit?)`·`getDetail(userId, id)`·`cancel(userId, id)`·`listSellerOrders(userId)`·`confirmBySeller(userId, id)`·`complete(userId, id)`·`autoConfirmDelivered(now: Date): Promise<number>`·`markConfirmed(orderId): Promise<void>` |
| `PaymentService` | `pay(userId, orderId, idempotencyKey)`·`refund(paymentId, idempotencyKey): Promise<RefundResult>` |
| `PaymentGatewayPort` (토큰 `PAYMENT_GATEWAY`) | `charge(req):Promise<{success,pgTransactionId?,failureReason?}>`·`refund(req):Promise<{success,pgRefundId?}>` — **mock 주입으로 실패 시뮬**(SC-039) |
| `ProductService` | `getVariantSnapshot(variantId)`·`getVariantSnapshots(variantIds): Promise<Map>`·`assertSellerOwnsVariant(variantId, sellerId): Promise<void>`(ForbiddenException) |
| `InventoryService` | `restoreStock(variantId, quantity, orderId): Promise<void>`·`decreaseStock(...)` 시그니처 불변·`checkAvailability(...)` |
| `PrismaService` | `runInTransaction(fn)`·`get tx`·`onAfterCommit(cb)` — 단위 테스트는 mock PrismaService(`runInTransaction = (fn)=>fn()`, `onAfterCommit=(cb)=>cb()`) |
| 예외/상태 리터럴 | `ForbiddenException`(403)·`ConflictException`(409, 재고부족/이중환불)·`BadRequestException`(400)·status `'pending'/'confirmed'/'preparing'/'delivered'/'completed'/'cancelled'`·actorType `'CUSTOMER'/'SELLER'/'SYSTEM'` |

> **이벤트 핸들러 분리 명기**: OutboxRelay·AutoConfirmJob 은 OrderService 와 **별도 클래스**(`shared/pgboss/`). pg-boss `work` 핸들러는 **job 배열** 수신. SC-031/037 단위는 OrderService 메서드(`autoConfirmDelivered`/`markConfirmed`)를 직접 호출(pg-boss 런타임 불요).
> **mock 주의(PATCH-PY 무관·TS)**: PrismaService mock 의 `runInTransaction`/`onAfterCommit` 을 passthrough 로 두어 service 로직 검증. repository 는 jest mock(production 메서드명 그대로).

### SC → 테스트 매핑

| SC-ID | 수용 기준 | Happy | Edge | Error | 테스트 파일 | 비고 |
|---|---|---|---|---|---|---|
| SC-001, SC-002 | 장바구니 추가/합산 | test_when_add_item_then_added | test_when_same_variant_then_quantity_summed | — | `src/modules/cart/cart.service.spec.ts` | [env:unit] getVariantSnapshot mock |
| SC-003, SC-004 | 수량 변경/0제거 | test_when_patch_qty_then_updated | test_when_qty_zero_then_removed | — | cart.service.spec.ts | [env:unit] |
| SC-005, SC-006 | 제거/조회(빈배열) | test_when_delete_then_removed / test_when_get_then_list | test_when_empty_then_empty_array | — | cart.service.spec.ts | [env:unit] |
| SC-007, SC-047 | 비인증 401 | — | — | test_when_no_jwt_then_401 | `test/static/auth-required-guards.spec.ts`(확장) | [env:static] guard 정적 |
| SC-008 | 사용자 격리 | — | test_when_two_users_then_isolated | — | cart.service.spec.ts | [env:unit] |
| SC-009, SC-010 | 주문 생성/일부선택 | test_when_order_then_created | test_when_partial_select_then_ok | — | `src/modules/order/order.service.spec.ts` | [env:unit] |
| SC-011 | 재고부족 409 | — | — | test_when_insufficient_then_409_with_variantIds | order.service.spec.ts | checkAvailability mock false |
| SC-012 | tx 원자성 | — | — | test_when_decreaseStock_fails_then_order_rolled_back | order.service.spec.ts | decreaseStock throw → runInTransaction reject |
| SC-013 | 주문후 장바구니제거 | test_when_order_then_cart_removeItems_called | — | — | order.service.spec.ts | removeItems spy |
| SC-014, SC-015, SC-016 | pending/스냅샷/금액 | test_when_order_then_pending / snapshot / total=Σ,discount=0 | — | — | order.service.spec.ts | Decimal 검증 |
| SC-017, SC-018 | 목록 cursor/상세 | test_when_list_then_nextCursor / test_when_own_detail_then_200 | — | — | order.service.spec.ts | |
| SC-019, SC-023, SC-030 | IDOR 403 | — | — | test_when_other_user_then_403 (detail/cancel/complete) | order.service.spec.ts | |
| SC-020, SC-021, SC-022 | pending/confirmed 취소·preparing 차단 | test_when_cancel_pending/confirmed_then_cancelled | — | test_when_cancel_preparing_then_400 | order.service.spec.ts | |
| SC-024 | 취소+환불 tx | test_when_cancel_paid_then_refund_restore_cancel_same_tx | — | — | order.service.spec.ts | refund/restoreStock spy |
| SC-025 | 재고복구 | test_when_cancel_then_restoreStock_called | — | — | order.service.spec.ts / inventory.service.spec | restoreStock spy |
| SC-026, SC-027, SC-028 | 수주/확인/미포함403 | test_when_seller_orders / confirm_then_preparing | — | test_when_not_my_seller_then_403 | order.service.spec.ts | |
| SC-029, SC-030 | 구매확정/타인403 | test_when_complete_delivered_then_completed | — | test_when_other_complete_then_403 | order.service.spec.ts | |
| SC-031 | 자동확정 7일 | — | test_when_autoConfirm_now_mock_then_completed | — | order.service.spec.ts | now mock, AUTO_CONFIRM_DAYS |
| SC-032 | 상태전이 이벤트 | test_when_transition_then_order_event_appended | — | — | order.service.spec.ts | appendEvent spy |
| SC-033, SC-034, SC-035 | 결제/타인403/멱등키누락400 | test_when_pay_then_201 | — | test_when_other_order_then_403 / test_when_no_idem_key_then_400 | `src/modules/payment/payment.service.spec.ts` + payment.controller 검증 | UUID v4 |
| SC-036, SC-052 | 결제+outbox tx | test_when_pay_then_payment_and_outbox_same_tx | — | test_when_outbox_fails_then_payment_rolled_back | payment.service.spec.ts | createOutbox throw |
| SC-037 | confirmed 전이 | test_when_markConfirmed_then_pending_to_confirmed | test_when_already_confirmed_then_noop | — | order.service.spec.ts | |
| SC-038 | 멱등 재요청 | — | test_when_same_idem_key_then_first_result | — | payment.service.spec.ts | findByIdempotencyKey 존재 |
| SC-039 | 결제 실패 | — | — | test_when_gateway_fails_then_status_failed_order_pending | payment.service.spec.ts | gateway mock 실패 |
| SC-040, SC-041 | 환불+outbox/이중환불409 | test_when_refund_then_refunded_outbox_same_tx | — | test_when_refunded_other_key_then_409 | payment.service.spec.ts | |
| SC-042, SC-044 | 타 variant stock-in/조회 403 | — | — | test_when_other_seller_variant_then_403 | `src/modules/inventory/inventory.controller.spec.ts` | assertSellerOwnsVariant throw |
| SC-043 | 자기 variant stock-in | test_when_own_variant_then_stock_increased | — | — | inventory.controller.spec.ts | 기존 동작 유지 |
| SC-045, SC-046 | P95 주문/결제 | test_orders_p95_under_1000ms / payments_p95_under_2000ms | — | — | `test/orders.e2e-spec.ts`·`test/payments.e2e-spec.ts` | [env:integration] 옵션 A(main 주도) |
| SC-048 | IDOR 종합 | — | — | test_idor_scenarios_then_403 | order/payment.service.spec(SC-019/023/034/030 재사용) | [env:unit] |
| SC-049 | 금전 Decimal | test_money_fields_decimal | — | — | `test/static/schema-decimal.spec.ts`(확장) | [env:static] totalAmount/discountAmount/amount/unitPrice |
| SC-050 | cross-schema 미참조 | test_cart_order_payment_repo_no_cross_schema | — | — | `test/static/cross-schema.spec.ts`(확장) | **`this.prisma.{model}`+`this.prisma.tx.{model}` 양 패턴** |
| SC-051 | AWS SDK 미추가 | test_no_aws_sdk_added | — | — | `test/static/package-no-aws.spec.ts` | [env:static] |

> 본 contract 는 외부 agent/사용자/CI 가 충족 가능. main session 이 `ExternalAuthoring: YES` 시 외부 산출물(test-cases.md + 테스트 파일) 존재를 확인 후 5b 진입.
> **SC-050 정적 사각지대 차단(research §F)**: 003 repository 는 `this.prisma.tx.{model}` 사용 → 신규 cross-schema 테스트는 002 의 `this.prisma.{model}` 정규식에 **`.tx.` 변형을 추가**해야 cart/order/payment 의 위반을 검출 가능.

---

## 태스크 입도 가이드

- 1 태스크 ≈ 구현 파일 1~3개 + 대응 테스트 1개. order.service 는 책임이 커 T031/T032/T033 으로 3분할(생성/취소·조회/판매자·확정).
- 호출측 5개 이상 영향 태스크 없음(스텁 실구현 + additive 위주).

## 구현 완료 기준

- [ ] 모든 A·B·C 태스크 체크박스 완료(4단계), D 태스크 완료(5a)
- [ ] `pnpm --filter backend test` 전체 PASSED(002 회귀 0 + 003 신규 SC) `[TypeScript/NestJS]`
- [ ] `pnpm --filter backend build`(`nest build`/tsc) 0 error — NestJS DI 순환(Product↔Inventory, Order↔Payment) 미발생 또는 forwardRef 해소
- [ ] cross-schema(SC-050)·decimal(SC-049)·no-aws(SC-051) 정적 PASS
- [ ] `pg-boss@^10.4.2` 핀(v11/v12 금지), createQueue 선행, work 배열핸들러
- [ ] git status 의도치 않은 파일 없음
