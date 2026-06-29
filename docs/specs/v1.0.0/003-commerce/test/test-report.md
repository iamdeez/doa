---
작성: Test Agent (EXECUTION)
버전: v1.3
최종 수정: 2026-06-29 02:46
상태: 확정
---

# 테스트 실행 결과

## 목차

- [실행 요약](#실행-요약)
- [자체 정정 [B] 내역](#자체-정정-b-내역)
- [실패 목록](#실패-목록)
- [SC 미커버 항목](#sc-미커버-항목)
- [plan.md 매핑표 검증](#planmd-매핑표-검증)
- [설계 문서 정합성](#설계-문서-정합성)
- [회귀 탐지](#회귀-탐지)

---

## 실행 요약

SEC-FIND-001~005 Security 수정 + SC-024 [B] mock 정정 + pg-boss import 수정 + SC-006 [B] arrayContaining 정정 후 최종 검증 (2026-06-29).

| 구분 | 전체 | 통과 | 실패 | 비고 |
|---|---|---|---|---|
| Unit 테스트 (`pnpm test`) | 125 | **125** | **0** | PASS |
| Static 테스트 (jest-e2e static/) | 32 | 32 | 0 | 8 suites PASS |
| E2E — auth.e2e | 8 | 8 | 0 | PASS |
| E2E — health.e2e | 3 | 3 | 0 | PASS |
| E2E — products.e2e | 2 | 2 | 0 | PASS |
| E2E — orders.e2e | 3 | 3 | 0 | SC-045 P95 deferred |
| E2E — payments.e2e | 4 | 4 | 0 | SC-046 P95 deferred |
| **합계** | **177** | **177** | **0** | |

**E2E integration deferred** (graceful skip):
- SC-045, SC-046: `TEST_JWT_TOKEN` 미설정으로 P95 integration 부분 skip. 구조 검증(401, 400)은 통과. `coverage-gap.md` (3)운영환경권장 분류.

---

## 자체 정정 [B] 내역

5a AUTHORING 산출물의 테스트 결함을 [B]로 자체 정정함 (production 불변).

| 파일 | 결함 | 수정 |
|---|---|---|
| `order.service.spec.ts` L437 | `it.each` 2-tuple에 1-param 콜백 (GAP-003 TypeScript 오류) | `async (cancelStatus, _label) =>` 로 2파라미터 확장 |
| `order.service.spec.ts` L93~113 | `FIXED_VARIANT_SNAPSHOTS.unitPrice: '15000'` (string) → production `.mul()` 호출 불가 | `new Prisma.Decimal('15000')` 로 교체 |
| `order.service.spec.ts` L338 | `singleItemSnapshot.unitPrice: '15000'` (string) | `new Prisma.Decimal('15000')` 로 교체 |
| `order.service.spec.ts` L365 | SC-014 검증: `capturedOrderData.status` 확인 → repository가 status를 자체 추가하므로 false negative | `mockOrderRepository.appendEvent(toStatus: pending)` 호출로 교체 |
| `test/static/schema-decimal.spec.ts` L149~152 | `unitPrice` 필드 라인 필터가 schema 주석 라인(L252)을 포함해 false positive | `!/^\s*\/\//.test(line)` 주석 제외 필터 추가 |
| `order.service.spec.ts` SC-024 | SEC-FIND-001 이후 `findById`의 `payments:[]` 의존 mock → `PaymentService.findPaymentByOrderId` 불호출 가림 | `mockPaymentService.findPaymentByOrderId.mockResolvedValue({id, status:'completed'})` 로 교체, `refund` 호출 단언 유지 |
| `order.service.spec.ts` SC-020/021/025/032 | `cancel()` 경로 테스트에서 `findPaymentByOrderId` 미정의 → TypeError | `mockPaymentService.findPaymentByOrderId: jest.fn()` 추가 + 각 테스트에 `.mockResolvedValue(null)` |

---

## 실패 목록

### [A] AppModule 초기화 실패 — PaymentModule.exports 누락 (13건)

**원인 분류: [A] 구현 오류** — `PaymentModule`이 `PaymentRepository`를 exports에 포함하지 않아 `OutboxRelay` DI 불가.

```
OutboxRelay 생성자: (PgBossService, PaymentRepository, OrderService)
PgBossModule imports: [OrderModule, PaymentModule]
PaymentModule.exports: [PaymentService]   ← PaymentRepository 누락
```

**영향 범위**: AppModule을 전체 초기화하는 e2e 테스트 3개 suite (13 tests).

| 파일 | 실패 SC | 원인 |
|---|---|---|
| `test/auth.e2e-spec.ts` | SC-006, SC-009, SC-011, SC-012, SC-015, SC-018, SC-019, SC-027 | AppModule DI 실패 → **해결됨** |
| `test/health.e2e-spec.ts` | SC-002, SC-007, SC-008 | AppModule DI 실패 → **해결됨** |
| `test/products.e2e-spec.ts` | SC-047(× 2) | AppModule DI 실패 → **해결됨** |

**해결 이력**:
- [A] pg-boss v10 default import 오류(`import PgBoss = require('pg-boss')`) → Development Agent 수정 완료
- [B] SC-006 `toHaveLength(2)` → 002-catalog 이후 users 스키마 6테이블로 확장 → `arrayContaining(['users','refresh_tokens'])` 로 교체 (견고한 단언, production 불변)

---

## SC 미커버 항목

003-commerce spec SC-001~052 중 단위 테스트 미커버 없음.
SC-045, SC-046 integration P95 부분은 deferred (coverage-gap.md 참조).

---

## plan.md 매핑표 검증

**SC 매핑 테이블**:

| SC-ID | 관련 테스트 | 통과 여부 | 미커버 근본원인 |
|---|---|---|---|
| SC-001 | `cart.service.spec.ts::when_add_item_then_item_added` | PASS | - |
| SC-002 | `cart.service.spec.ts::when_same_variant_then_quantity_summed` | PASS | - |
| SC-003 | `cart.service.spec.ts::when_update_qty_then_updated` | PASS | - |
| SC-004 | `cart.service.spec.ts::when_qty_zero_then_item_removed` | PASS | - |
| SC-005 | `cart.service.spec.ts::when_delete_then_removed` | PASS | - |
| SC-006 | `cart.service.spec.ts::when_get_then_items_list` | PASS | - |
| SC-007 | `auth-required-guards.spec.ts::when_inspect_auth_controllers_then_jwt_guard_applied` | PASS | - |
| SC-008 | `cart.service.spec.ts::when_two_users_then_isolated` | PASS | - |
| SC-009 | `order.service.spec.ts::SC-009/010::when_order_then_created` | PASS | - |
| SC-010 | `order.service.spec.ts::SC-009/010::when_partial_select_then_ok` | PASS | - |
| SC-011 | `order.service.spec.ts::SC-011::when_insufficient_then_409_with_variantIds` | PASS | - |
| SC-012 | `order.service.spec.ts::when_decreaseStock_fails_then_order_rolled_back` | PASS | - |
| SC-013 | `order.service.spec.ts::when_order_then_cart_removeItems_called` | PASS | - |
| SC-014 | `order.service.spec.ts::SC-014/015/016::when_order_then_pending_and_snapshot_and_total` | PASS | - |
| SC-015 | `order.service.spec.ts::SC-014/015/016::when_order_then_pending_and_snapshot_and_total` | PASS | - |
| SC-016 | `order.service.spec.ts::SC-014/015/016::when_order_then_pending_and_snapshot_and_total` | PASS | - |
| SC-017 | `order.service.spec.ts::SC-017::when_list_then_nextCursor` | PASS | - |
| SC-018 | `order.service.spec.ts::SC-018::when_own_detail_then_200` | PASS | - |
| SC-019 | `order.service.spec.ts::SC-019::when_other_user_then_403` | PASS | - |
| SC-020 | `order.service.spec.ts::SC-020/021::cancel pending→cancelled` | PASS | - |
| SC-021 | `order.service.spec.ts::SC-020/021::cancel confirmed→cancelled` | PASS | - |
| SC-022 | `order.service.spec.ts::SC-022::when_cancel_preparing_then_400` | PASS | - |
| SC-023 | `order.service.spec.ts::SC-023::when_other_user_cancel_then_403` | PASS | - |
| SC-024 | `order.service.spec.ts::SC-024::when_cancel_paid_then_refund_restore_cancel_same_tx` | PASS | - |
| SC-025 | `order.service.spec.ts::SC-025::when_cancel_then_restoreStock_called` | PASS | - |
| SC-026 | `order.service.spec.ts::SC-026::when_seller_orders_then_list` | PASS | - |
| SC-027 | `order.service.spec.ts::SC-027::when_seller_confirm_then_preparing` | PASS | - |
| SC-028 | `order.service.spec.ts::SC-028::when_not_my_seller_then_403` | PASS | - |
| SC-029 | `order.service.spec.ts::SC-029::when_complete_delivered_then_completed` | PASS | - |
| SC-030 | `order.service.spec.ts::SC-030::when_other_complete_then_403` | PASS | - |
| SC-031 | `order.service.spec.ts::SC-031::when_autoConfirm_now_mock_then_completed` | PASS | - |
| SC-032 | `order.service.spec.ts::SC-032::when_transition_then_order_event_appended` | PASS | - |
| SC-033 | `payment.service.spec.ts::SC-033::when_pay_then_201` | PASS | - |
| SC-034 | `payment.service.spec.ts::SC-034::when_other_order_then_403` | PASS | - |
| SC-035 | `payment.service.spec.ts::SC-035::when_no_idem_key_then_400_note` | PASS | - |
| SC-036 | `payment.service.spec.ts::SC-036::when_pay_then_payment_and_outbox_same_tx` | PASS | - |
| SC-037 | `order.service.spec.ts::SC-037::when_markConfirmed_then_pending_to_confirmed` | PASS | - |
| SC-038 | `payment.service.spec.ts::SC-038::when_same_idem_key_then_first_result` | PASS | - |
| SC-039 | `payment.service.spec.ts::SC-039::when_gateway_fails_then_status_failed_order_pending` | PASS | - |
| SC-040 | `payment.service.spec.ts::SC-040::when_refund_then_refunded_outbox_same_tx` | PASS | - |
| SC-041 | `payment.service.spec.ts::SC-041::when_refunded_other_key_then_409` | PASS | - |
| SC-042 | `inventory.controller.spec.ts::when_other_seller_variant_then_403` | PASS | - |
| SC-043 | `inventory.controller.spec.ts::when_own_variant_then_stock_increased` | PASS | - |
| SC-044 | `inventory.controller.spec.ts::when_other_seller_getstock_then_403` | PASS | - |
| SC-045 | `orders.e2e-spec.ts::when_post_orders_without_token_then_401` (structural) | PASS (structural) | integration deferred: TEST_JWT_TOKEN 미설정 |
| SC-046 | `payments.e2e-spec.ts::when_post_payments_without_token_then_401` (structural) | PASS (structural) | integration deferred: TEST_JWT_TOKEN 미설정 |
| SC-047 | `auth-required-guards.spec.ts::when_inspect_auth_controllers_then_jwt_guard_applied` | PASS | - |
| SC-048 | `order.service.spec.ts`(SC-019,023,030) + `payment.service.spec.ts`(SC-034) | PASS | - |
| SC-049 | `schema-decimal.spec.ts::when_inspect_schema_money_fields_then_all_Decimal` | PASS | - |
| SC-050 | `cross-schema.spec.ts` (크로스 스키마 참조 금지) | PASS | - |
| SC-051 | `package-no-aws.spec.ts::when_inspect_package_then_no_aws_sdk` | PASS | - |
| SC-052 | `payment.service.spec.ts::SC-052::when_outbox_fails_then_payment_rolled_back` | PASS | - |

---

## 설계 문서 정합성

- `order.service.ts`: `ConflictException`(409) 재고 부족 처리 확인 (SC-011 ✓)
- 다른 상태-전이 가드(SC-022 preparing 취소 불가 등): `BadRequestException`(400) 유지 — spec 명세대로 ✓
- `OrderRepository.createOrder`: `status: OrderStatus.pending` 자체 추가 (SC-014 ✓)
- `Prisma.Decimal` 금전 필드 일관 적용 (SC-049 ✓)
- 크로스 스키마 참조 0건 (SC-050 ✓)
- AWS SDK 의존 0건 (SC-051 ✓)
- SEC-FIND-001: `cancel()`이 `PaymentService.findPaymentByOrderId(orderId)` 직접 조회 (SC-024 ✓)
- SEC-FIND-002: `autoConfirmDelivered()`가 `updateStatus(completed)` + `appendEvent(SYSTEM, delivered→completed)` (FR-027 ✓)
- **[A] 불일치 발견**: `PaymentModule.exports`에 `PaymentRepository` 미포함 → `OutboxRelay` DI 실패 → auth/health/products e2e 13건 FAIL

---

## 회귀 탐지

- Unit 테스트: 125건 전부 PASS — 002 기존 101 + 003 신규 24 (0 FAIL)
- Static 테스트: 32건 전부 PASS
- E2E 테스트: 52건 전부 PASS (auth 8 + health 3 + products 2 + orders 3 + payments 4 = 20 non-static + 32 static)
- **002 회귀 없음** ✓ — auth/health/products e2e (002 spec 테스트 포함) 전부 PASS
- SC-024 SEC-FIND-001 반영 검증: `findPaymentByOrderId` mock + `refund` 단언 ✓
- SEC-FIND-002 FR-027: `autoConfirmDelivered` → delivered→completed (역전 없음) ✓
