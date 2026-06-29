---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-28 22:56
상태: 작성중
---

# Test Cases: 003-commerce

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류 — 4-카테고리)](#미커버-항목-사전-분류--4-카테고리)

---

## SC × 시나리오 매트릭스

### 장바구니 SC (SC-001~008)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-001 | 장바구니 아이템 추가 → 201 + GET /cart 조회 | `when_add_item_then_item_added` | — | — | `src/modules/cart/cart.service.spec.ts` | [env:unit] |
| SC-002 | 동일 variantId 재추가 → 수량 합산 (2+3=5) | — | `when_same_variant_then_quantity_summed` | — | cart.service.spec.ts | [env:unit] |
| SC-003 | PATCH 수량 변경 → 5 갱신 | `when_update_qty_then_updated` | — | — | cart.service.spec.ts | [env:unit] |
| SC-004 | PATCH 수량 0 → 아이템 제거 | — | `when_qty_zero_then_item_removed` | — | cart.service.spec.ts | [env:unit] |
| SC-005 | DELETE → 204 + 아이템 제거 | `when_delete_then_removed` | — | — | cart.service.spec.ts | [env:unit] |
| SC-006 | GET /cart → 목록 / 빈 배열 | `when_get_then_items_list` | `when_empty_cart_then_empty_array` | — | cart.service.spec.ts | [env:unit] |
| SC-007 | 비인증 → 401 | — | — | `when_no_jwt_then_401` | `test/static/auth-required-guards.spec.ts` | [env:static] |
| SC-008 | 두 사용자 각자 독립 장바구니 | — | `when_two_users_then_isolated` | — | cart.service.spec.ts | [env:unit] |

### 주문 SC (SC-009~032)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-009 | POST /orders → 201 주문 생성 | `when_create_order_then_201` | — | — | `src/modules/order/order.service.spec.ts` | [env:unit] |
| SC-010 | 장바구니 3개 중 2개 선택 주문 가능 | — | `when_partial_items_then_order_created` | — | order.service.spec.ts | [env:unit] |
| SC-011 | 재고 부족 → 409 + 부족 variantId | — | — | `when_insufficient_stock_then_409_with_variant_ids` | order.service.spec.ts | [env:unit] |
| SC-012 | 주문+재고차감 동일 tx; decreaseStock 실패 → 롤백 | — | — | `when_decrease_stock_fails_then_order_rolled_back` | order.service.spec.ts | [env:unit] |
| SC-013 | 주문 생성 후 장바구니에서 주문 아이템 제거 | `when_order_then_cart_remove_items_called` | — | — | order.service.spec.ts | [env:unit] |
| SC-014 | 주문 직후 status = pending | `when_order_then_status_is_pending` | — | — | order.service.spec.ts | [env:unit] |
| SC-015 | shippingAddressSnapshot JSONB 저장 | `when_order_then_shipping_snapshot_saved` | — | — | order.service.spec.ts | [env:unit] |
| SC-016 | totalAmount=Σ(unitPrice×qty), discountAmount=0 | `when_order_then_total_and_discount_correct` | — | — | order.service.spec.ts | [env:unit] |
| SC-017 | GET /orders?limit=20 → 최신순 + nextCursor | `when_list_orders_then_next_cursor_returned` | — | — | order.service.spec.ts | [env:unit] |
| SC-018 | GET /orders/:id (본인) → 200 상세 | `when_own_detail_then_200` | — | — | order.service.spec.ts | [env:unit] |
| SC-019 | GET /orders/:id (타인) → 403 | — | — | `when_other_user_detail_then_403` | order.service.spec.ts | [env:unit] |
| SC-020 | DELETE pending 주문 → 200 + cancelled | `when_cancel_pending_then_cancelled` | — | — | order.service.spec.ts | [env:unit] |
| SC-021 | DELETE confirmed 주문 → 200 + cancelled | `when_cancel_confirmed_then_cancelled` | — | — | order.service.spec.ts | [env:unit] |
| SC-022 | DELETE preparing 주문 → 400 | — | — | `when_cancel_preparing_then_400` | order.service.spec.ts | [env:unit] |
| SC-023 | DELETE 타인 주문 → 403 | — | — | `when_cancel_other_user_then_403` | order.service.spec.ts | [env:unit] |
| SC-024 | 취소+환불 → 동일 tx (refunded+outbox+cancelled) | `when_cancel_paid_order_then_refund_cancel_same_tx` | — | — | order.service.spec.ts | [env:unit] |
| SC-025 | 취소 성공 → restoreStock 호출 확인 | `when_cancel_then_restore_stock_called` | — | — | order.service.spec.ts | [env:unit] |
| SC-026 | GET /sellers/me/orders → 내 sellerId 포함 주문만 | `when_seller_list_then_own_orders_only` | — | — | order.service.spec.ts | [env:unit] |
| SC-027 | PATCH confirm (confirmed) → preparing | `when_seller_confirm_then_preparing` | — | — | order.service.spec.ts | [env:unit] |
| SC-028 | PATCH confirm (내 상품 미포함) → 403 | — | — | `when_seller_not_in_items_then_403` | order.service.spec.ts | [env:unit] |
| SC-029 | POST complete (delivered, 본인) → completed | `when_complete_delivered_then_completed` | — | — | order.service.spec.ts | [env:unit] |
| SC-030 | POST complete (타인) → 403 | — | — | `when_complete_other_user_then_403` | order.service.spec.ts | [env:unit] |
| SC-031 | pg-boss 잡 → delivered 7일 경과 → completed (now mock) | — | `when_auto_confirm_7days_then_completed` | — | order.service.spec.ts | [env:unit] |
| SC-032 | 각 상태 전이 → order_events append | `when_status_transition_then_event_appended` | — | — | order.service.spec.ts | [env:unit] |

### 결제 SC (SC-033~041, SC-052)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-033 | POST /payments + Idempotency-Key → 201 결제 | `when_pay_then_201` | — | — | `src/modules/payment/payment.service.spec.ts` | [env:unit] |
| SC-034 | 타인 orderId → 403 | — | — | `when_pay_other_order_then_403` | payment.service.spec.ts | [env:unit] |
| SC-035 | Idempotency-Key 누락 → 400 | — | — | `when_pay_no_idem_key_then_400` | payment.service.spec.ts (+ controller 검증) | [env:unit] |
| SC-036 | 결제+outbox 동일 tx | `when_pay_then_payment_and_outbox_same_tx` | — | — | payment.service.spec.ts | [env:unit] |
| SC-037 | payment.completed relay → order pending→confirmed | `when_mark_confirmed_then_pending_to_confirmed` | `when_already_confirmed_then_noop` | — | order.service.spec.ts | [env:unit] |
| SC-038 | 동일 Idempotency-Key 재호출 → 최초 결과 반환 | — | `when_same_idem_key_then_first_result` | — | payment.service.spec.ts | [env:unit] |
| SC-039 | stub 실패 → payment.status=failed, order pending 유지 | — | — | `when_gateway_fails_then_status_failed_order_pending` | payment.service.spec.ts | [env:unit] |
| SC-040 | 환불+outbox 동일 tx (refunded + payment.refunded outbox) | `when_refund_then_refunded_outbox_same_tx` | — | — | payment.service.spec.ts | [env:unit] |
| SC-041 | refunded 상태 다른 key → 409 | — | — | `when_refunded_other_key_then_409` | payment.service.spec.ts | [env:unit] |
| SC-052 | outbox 실패 → payment 롤백 | — | — | `when_outbox_fails_then_payment_rolled_back` | payment.service.spec.ts | [env:unit] |

### SEC-002 수정 SC (SC-042~044)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-042 | 타 판매자 variant stock-in → 403 | — | — | `when_other_seller_variant_stockin_then_403` | `src/modules/inventory/inventory.controller.spec.ts` | [env:unit] |
| SC-043 | 자기 variant stock-in → 재고 증가(기존 동작 유지) | `when_own_variant_stockin_then_stock_increased` | — | — | inventory.controller.spec.ts | [env:unit] |
| SC-044 | 타 판매자 variant 재고 조회 → 403 | — | — | `when_other_seller_variant_getstock_then_403` | inventory.controller.spec.ts | [env:unit] |

### 비기능 SC (SC-045~052)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-045 | POST /orders P95 ≤ 1,000ms | — | `test_orders_p95_under_1000ms` | — | `test/orders.e2e-spec.ts` | [env:integration] |
| SC-046 | POST /payments P95 ≤ 2,000ms | — | `test_payments_p95_under_2000ms` | — | `test/payments.e2e-spec.ts` | [env:integration] |
| SC-047 | 비인증 → 401 (인증 필수 엔드포인트 전체) | — | — | `when_no_jwt_then_401_on_auth_endpoints` | `test/static/auth-required-guards.spec.ts` | [env:static] |
| SC-048 | IDOR 종합 → 403 (SC-019/023/034/030 재사용) | — | — | (SC-019/023/034/030 개별 테스트에서 검증) | order/payment.service.spec.ts | [env:unit] |
| SC-049 | schema.prisma 금전 필드 = Decimal, Float 0건 | `test_money_fields_are_decimal` | — | — | `test/static/schema-decimal.spec.ts` | [env:static] |
| SC-050 | cart/order/payment Repository 타 스키마 미참조 | `test_cart_order_payment_repo_no_cross_schema` | — | — | `test/static/cross-schema.spec.ts` | [env:static] |
| SC-051 | package.json @aws-sdk/* 없음 | `test_no_aws_sdk_added` | — | — | `test/static/package-no-aws.spec.ts` (기존 유지) | [env:static] |
| SC-052 | outbox 실패 → payment 롤백 | — | — | `when_outbox_fails_then_payment_rolled_back` | payment.service.spec.ts | [env:unit] |

---

## 외부 의존성 명시

### fixture / mock

| 항목 | 내용 |
|---|---|
| `CartRepository` mock | `findByUser`, `upsertItems` Jest mock fn |
| `OrderRepository` mock | `createOrder`, `createItems`, `appendEvent`, `findById`, `listByUser`, `listBySeller`, `updateStatus`, `findDeliveredBefore` |
| `PaymentRepository` mock | `createPayment`, `findByIdempotencyKey`, `findByOrderId`, `updateStatus`, `createRefund`, `findRefundByKey`, `createOutbox`, `findPendingOutbox`, `markOutboxProcessed` |
| `InventoryService` mock | `checkAvailability`, `decreaseStock`, `restoreStock` |
| `ProductService` mock | `getVariantSnapshot`, `getVariantSnapshots`, `assertSellerOwnsVariant` |
| `PaymentGatewayPort` mock (토큰 `PAYMENT_GATEWAY`) | `charge`, `refund` |
| `CartService` mock | `removeItems` |
| `PaymentService` mock | `refund` |
| `OrderService` mock | `markConfirmed`, `getDetail` (소유권 확인용) |
| `SellerService` mock | `getApprovedSeller` |
| `PrismaService` mock | `runInTransaction = (fn) => fn()`, `onAfterCommit = (cb) => cb()` |

### 환경 변수

- 단위/정적 테스트: 없음 (DB 연결 불필요)
- integration (SC-045/046): `DATABASE_URL`, PostgreSQL Docker Compose

### 외부 서비스

- SC-045/046: 실 PostgreSQL (Docker Compose)
- 나머지: mock만으로 검증 가능

---

## 미커버 항목 (사전 분류 — 4-카테고리)

| SC-ID | 미커버 시나리오 | 카테고리 | 검증 방법 | 환경/도구 | 담당 |
|---|---|---|---|---|---|
| SC-012 (DB 롤백) | decreaseStock 실패 시 order 레코드 실제 롤백 (DB 수준) | (2) 단위테스트 불가 | integration — 실 PostgreSQL tx + rollback 확인 | Docker Compose | QA/운영 |
| SC-024 (취소+환불 DB 롤백) | 환불 실패 시 취소·재고복구 미반영 DB 수준 확인 | (2) 단위테스트 불가 | integration | Docker Compose | QA/운영 |
| SC-036/052 (outbox tx 롤백) | outbox 기록 실패 시 payment 실제 DB 롤백 확인 | (2) 단위테스트 불가 | integration | Docker Compose | QA/운영 |
| SC-045 | POST /orders P95 성능 측정 | (3) 운영 환경 권장 | 실 PostgreSQL + 부하 측정 도구 | Docker Compose + ApacheBench/k6 | 운영 |
| SC-046 | POST /payments P95 성능 측정 | (3) 운영 환경 권장 | 동일 | Docker Compose + ApacheBench/k6 | 운영 |
| SC-031 (pg-boss 런타임) | AutoConfirmJob이 실제 pg-boss 런타임에서 스케줄 실행되는지 | (3) 운영 환경 권장 | 운영 환경 pg-boss 잡 모니터링 | 운영 대시보드 | 운영 |
| SC-037 (OutboxRelay 런타임) | OutboxRelay가 실제 pg-boss work 핸들러로 실행되는지 | (3) 운영 환경 권장 | 운영 환경 모니터링 | 운영 대시보드 | 운영 |
| SC-048 (IDOR 종합) | 단독 케이스보다 조합 시나리오(복합 IDOR 공격 경로) | (4) 차후 점검 | Security Agent 감사 | — | 보안 |

> 카테고리 (1) 항목: 0건 (Development Agent 복귀 불필요).
> 카테고리 (2)(3)(4) 만 있으므로 Docs Agent 진행 가능.
