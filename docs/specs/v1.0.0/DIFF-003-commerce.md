---
작성: Docs Agent
버전: v1.1
최종 수정: 2026-06-29 02:50
상태: 확정
---

# Diff: 003-commerce

## 커밋 메시지용 한 줄 요약

(이 섹션은 커밋 메시지 작성 시 참고할 수 있도록 제공한다. 실제 커밋 메시지는 프로젝트 컨벤션에 맞춰 자유롭게 조정한다.)
- **KO**: 003-commerce 거래 플로우 구현 + Security 수정 (SEC-FIND-001~005, pg-boss CommonJS import, PaymentModule DI)
- **EN**: Implement commerce transaction flow with security fixes (SEC-FIND-001~005, pg-boss CommonJS import, PaymentModule DI)

## 변경 요약

- **Prisma 스키마 확장**: commerce·orders·payments 스키마 7개 테이블(Cart, Order, OrderItem, OrderEvent, Payment, PaymentOutbox, Refund) 신규 정의. OrderStatus·ActorType·PaymentStatus enum 추가. InventoryLogType에 RESTORE 추가 (FR-023). 모든 금전 필드 Decimal(12,2) 선언 (NFR-005).
- **PrismaService tx-aware 확장**: ALS(AsyncLocalStorage) 기반 `runInTransaction`/`tx`/`onAfterCommit` 메서드 추가. cross-schema 단일 트랜잭션 및 outbox 패턴 지원 (P-005).
- **pg-boss 인프라 모듈 신규**: `PgBossModule`·`PgBossService`·`OutboxRelay`(payment_outbox 폴링→order confirmed)·`AutoConfirmJob`(delivered 7일→completed 스케줄) 구현 (FR-027, FR-034). CommonJS `import PgBoss = require('pg-boss')` 방식으로 런타임 초기화 오류 해소.
- **cart 모듈 실구현**: addItem(수량 합산)·updateItem·removeItem·getCart·removeItems. JSONB items 배열. 사용자당 1건 격리 (FR-001~005).
- **order 모듈 실구현**: createOrder(재고 확인→차감→주문 생성→장바구니 비움 단일 tx)·listOrders(cursor 페이지네이션)·getOrderDetail·cancelOrder(환불+재고복구+outbox 동일 tx)·sellerConfirmOrder·completeOrder·autoConfirmDeliveredOrders (FR-010~028).
- **payment 모듈 실구현**: processPayment(Idempotency-Key 멱등성·PG stub·outbox 동일 tx)·refundPayment(이중환불 409·동일 tx) (FR-030~038).
- **SEC-002 IDOR 수정**: inventory stock-in·stock 조회에 variantId→Variant.productId→Product.sellerId 소유권 검증 추가. 비소유 판매자 403 반환 (FR-050~051).
- **SEC-FIND-001 (HIGH) 수정**: `cancelOrder()` 내 환불 처리를 `order.payments[]` include 의존에서 `PaymentService.findPaymentByOrderId(orderId)` 직접 조회로 변경. completed 결제만 환불하는 조건 정확화 (A04/A08, P-005).
- **SEC-FIND-002 (HIGH) 수정**: `autoConfirmDelivered()` 상태 역전 오류 수정. `delivered → completed` 직접 전이 + `SYSTEM` 액터 `appendEvent`. 기존 `markConfirmed(pending→confirmed)` 오호출 제거 (A04/A08).
- **SEC-FIND-003/004 (MEDIUM) 수정**: `CreatePaymentDto.amount` 필드 제거(금액은 서버 측 `order.totalAmount` 사용). `CreateOrderDto.discountAmount` 필드 제거(쿠폰 미구현으로 `Decimal(0)` 고정). 클라이언트 금액 조작 차단 (A04).
- **SEC-FIND-005 (MEDIUM) 수정**: `PaymentController`에 `isUUID(key, '4')` 검증 추가. 비-UUID v4 Idempotency-Key → 400 BadRequest (A04, FR-031).
- **PaymentModule DI 수정**: `exports`에 `PaymentRepository` 추가. `OutboxRelay` 생성자 DI 해소 (AppModule 기동 실패 13건 수정).
- **InventoryService.restoreStock 신규**: 주문 취소 시 재고 복구 인터페이스 (FR-023).
- **product 모듈 확장**: `getVariantWithProduct`·`getVariantSnapshots` 메서드 추가 (inventory 소유권 검증·주문 스냅샷 지원).
- **정적/통합 테스트 확장**: auth-required-guards·cross-schema·schema-decimal 정적 검증에 003 신규 모듈 추가. orders/payments e2e 테스트 추가 (SC-007·045~047·049~050). SC-024 SEC-FIND-001 반영 mock 정정. SC-006 arrayContaining 견고한 단언으로 교체.
- **패키지**: pg-boss@^10.4.2 신규 의존 추가.

## 변경 파일 및 라인 수

| 파일 | 추가 | 삭제 |
|---|---|---|
| `apps/backend/package.json` | +1 | -0 |
| `apps/backend/prisma/schema.prisma` | +204 | -0 |
| `apps/backend/src/app.module.ts` | +2 | -0 |
| `apps/backend/src/modules/cart/cart.controller.ts` | +58 | -2 |
| `apps/backend/src/modules/cart/cart.module.ts` | +4 | -0 |
| `apps/backend/src/modules/cart/cart.repository.ts` | +25 | -1 |
| `apps/backend/src/modules/cart/cart.service.ts` | +102 | -2 |
| `apps/backend/src/modules/inventory/inventory.controller.ts` | +13 | -3 |
| `apps/backend/src/modules/inventory/inventory.module.ts` | +9 | -2 |
| `apps/backend/src/modules/inventory/inventory.repository.ts` | +7 | -6 |
| `apps/backend/src/modules/inventory/inventory.service.spec.ts` | +113 | -2 |
| `apps/backend/src/modules/inventory/inventory.service.ts` | +29 | -3 |
| `apps/backend/src/modules/order/order.controller.ts` | +77 | -3 |
| `apps/backend/src/modules/order/order.events.ts` | +7 | -1 |
| `apps/backend/src/modules/order/order.module.ts` | +19 | -2 |
| `apps/backend/src/modules/order/order.repository.ts` | +127 | -1 |
| `apps/backend/src/modules/order/order.service.ts` | +296 | -2 |
| `apps/backend/src/modules/payment/payment.controller.ts` | +46 | -3 |
| `apps/backend/src/modules/payment/payment.module.ts` | +16 | -2 |
| `apps/backend/src/modules/payment/payment.repository.ts` | +84 | -1 |
| `apps/backend/src/modules/payment/payment.service.ts` | +153 | -2 |
| `apps/backend/src/modules/product/product.module.ts` | +3 | -2 |
| `apps/backend/src/modules/product/product.repository.ts` | +18 | -0 |
| `apps/backend/src/modules/product/product.service.ts` | +70 | -0 |
| `apps/backend/src/shared/prisma/prisma.service.ts` | +54 | -1 |
| `apps/backend/test/auth.e2e-spec.ts` | +4 | -4 |
| `apps/backend/test/static/auth-required-guards.spec.ts` | +27 | -7 |
| `apps/backend/test/static/cross-schema.spec.ts` | +107 | -13 |
| `apps/backend/test/static/schema-decimal.spec.ts` | +129 | -7 |
| `pnpm-lock.yaml` | +144 | -0 |
| `apps/backend/prisma/migrations/20260628141551_003_commerce/migration.sql` (신규) | +152 | -0 |
| `apps/backend/src/infrastructure/pgboss/auto-confirm-job.ts` (신규) | +38 | -0 |
| `apps/backend/src/infrastructure/pgboss/outbox-relay.ts` (신규) | +58 | -0 |
| `apps/backend/src/infrastructure/pgboss/pgboss.constants.ts` (신규) | +9 | -0 |
| `apps/backend/src/infrastructure/pgboss/pgboss.module.ts` (신규) | +14 | -0 |
| `apps/backend/src/infrastructure/pgboss/pgboss.service.ts` (신규) | +38 | -0 |
| `apps/backend/src/modules/cart/cart.service.spec.ts` (신규) | +318 | -0 |
| `apps/backend/src/modules/cart/cart.types.ts` (신규) | +19 | -0 |
| `apps/backend/src/modules/cart/dto/add-cart-item.dto.ts` (신규) | +10 | -0 |
| `apps/backend/src/modules/cart/dto/update-cart-item.dto.ts` (신규) | +7 | -0 |
| `apps/backend/src/modules/inventory/inventory.controller.spec.ts` (신규) | +193 | -0 |
| `apps/backend/src/modules/order/order.constants.ts` (신규) | +8 | -0 |
| `apps/backend/src/modules/order/order.service.spec.ts` (신규) | +802 | -0 |
| `apps/backend/src/modules/order/seller-order.controller.ts` (신규) | +35 | -0 |
| `apps/backend/src/modules/order/dto/create-order.dto.ts` (신규) | +28 | -0 |
| `apps/backend/src/modules/payment/payment-gateway.port.ts` (신규) | +30 | -0 |
| `apps/backend/src/modules/payment/payment.service.spec.ts` (신규) | +367 | -0 |
| `apps/backend/src/modules/payment/stub-payment-gateway.ts` (신규) | +40 | -0 |
| `apps/backend/src/modules/payment/dto/create-payment.dto.ts` (신규) | +10 | -0 |
| `apps/backend/test/orders.e2e-spec.ts` (신규) | +203 | -0 |
| `apps/backend/test/payments.e2e-spec.ts` (신규) | +242 | -0 |


## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 이며 전체 캡처는 중복·비효율이다.
> 변경 내용은 위 "변경 요약" · "변경 파일 및 라인 수" 절로 추적하고, 라인 단위 diff 가 필요하면 아래로 재생성한다:
>
> ```bash
> git diff bf92cd4 (002 완료) -- apps   # base commit: bf92cd4 (002 완료)
> ```
