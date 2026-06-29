---
작성: Design Agent → Docs Agent (갱신) → Security Agent (GAP-004/005 추가) → Docs Agent [재작업] (GAP-004/005 RESOLVED)
버전: v1.4
최종 수정: 2026-06-29 03:03
상태: 확정
---

# Gaps: 003-commerce

> 형식: pipeline-conventions.md §6. 3단계 이후 모든 Agent 가 누적 기록한다.
> 해결 시 상태를 `RESOLVED by [Agent 공식명]` 으로 갱신한다.

## 목차

- [GAP-001 (infra.md 갱신 필요 — pg-boss 부트·pgboss 스키마 권한·Node 핀·AUTO_CONFIRM_DAYS)](#gap-001)
- [GAP-004 (RESOLVED — SEC-FIND-001: cancel() 환불 미실행 → findPaymentByOrderId 교체)](#gap-004)
- [GAP-005 (RESOLVED — SEC-FIND-002: autoConfirmDelivered 상태역전 → completed 전이 수정)](#gap-005)
- [GAP-002 (context.md 갱신 필요 — cart/order/payment 모듈 정의·도메인 흐름·SEC-002 해소)](#gap-002)
- [GAP-003 (RESOLVED — D-layer 스펙 파일 TypeScript 오류)](#gap-003)

---

## GAP-001

- **ID**: GAP-001
- **유형**: 문서-갱신-필요 (infra.md)
- **출처**: Design Agent → Docs Agent (PATCH-A09 추가)
- **컨텍스트**: pg-boss 부트스트랩 / shared/pgboss / AUTO_CONFIRM_DAYS 임계값
- **상태**: OPEN (Retrospective Agent 가 infra.md 갱신 위임)
- **내용**:
  - `infra.md` 에 pg-boss 운영 항목 부재. 본 spec 이 pg-boss(in-process `PgBossModule`)를 도입하므로 다음을 infra.md §배포 절차·§연결실패 재시도·§알려진 인프라 제약에 반영 필요:
    1. pg-boss 가 동일 `DATABASE_URL` PostgreSQL 에 `pgboss` 스키마를 **앱 기동 시 1회 자동 생성** → DB 사용자에게 **스키마 생성 권한(CREATE)** 필요. Fly Postgres 운영 사용자 권한 확인 대상.
    2. **버전 제약**: `pg-boss@^10.4.2` 핀(CommonJS·Node>=20). 최신 v11(Node>=22)·v12(ESM·Node>=22.12) 은 본 프로젝트 Node 20.x + CommonJS 와 비호환 → 업그레이드 시 런타임 전제 변경. infra/CHANGES 주의사항으로 박제.
    3. outbox `pending` 적체 수 · 자동확정 잡 마지막 성공 시각을 운영 모니터링/알람 항목으로 추가(plan 기타 고려사항).
  - **(PATCH-A09 Docs Agent 추가)**: `AUTO_CONFIRM_DAYS = 7` 신규 운영 임계값 도입 (코드 검증: `src/modules/order/order.constants.ts` L1-2 — `export const AUTO_CONFIRM_DAYS = 7 as const`). 운영자가 인지해야 할 값이므로 infra.md §알려진 인프라 제약 또는 §운영 임계값 표에 반영 필요. "배송 완료 후 7일 경과 시 자동 구매 확정(AutoConfirmJob — pg-boss 스케줄)"
  - **갱신 위임**: Retrospective Agent. [MUST NOT] [agent:docs] infra.md 직접 수정.

---

## GAP-002

- **ID**: GAP-002
- **유형**: 문서-갱신-필요 (context.md)
- **출처**: Design Agent → Docs Agent (PROC-002 코드 검증 추가)
- **컨텍스트**: cart/order/payment 모듈 실구현 + shared/prisma·shared/pgboss + SEC-002 해소
- **상태**: OPEN (Retrospective Agent 가 context.md 갱신 위임)
- **내용**:
  - 현재 `context.md` 에서 다음 갱신 필요:
    1. **§2 핵심 모듈 목록**: cart(`carts` commerce), order(`orders`·`order_items`·`order_events` orders), payment(`payments`·`refunds`·`payment_outbox` payments) 모듈을 스텁→실구현으로 갱신. `shared/prisma/PrismaService` 설명에 "ALS tx-aware(`runInTransaction`/`tx`/`onAfterCommit`) 확장" 추가. `shared/pgboss` 신규 모듈(PgBossModule·OutboxRelay·AutoConfirmJob) 행 추가.
    2. **§3 이벤트 및 데이터 흐름**: 장바구니→주문(cross-schema 단일 tx)→결제(outbox 기록)→OutboxRelay pg-boss relay→order confirmed, 7일 AutoConfirmJob 자동확정 흐름 추가.
    3. **§5 도메인 용어 사전**: `idempotencyKey`·`VariantSnapshot`·`PaymentGatewayPort` 정의 추가. `order_events`는 §5 `append-only` 항목에 "order_events 포함" 보완.
    4. **§5 부정합 사전 점검(PATCH-A11 → 코드 검증)**: `InventoryLogType.RESTORE` 추가 — context.md §5에 InventoryLogType 정의가 현재 없음(grep 확인). 따라서 기존 표현 불일치 없음. 단, §5 도메인 용어에 enum 값 목록이 없으면 신규 추가 불필요. 부정합 없음으로 확인.
    5. **§6 알려진 제약 갱신**:
       - `"13개 도메인 모듈 빈 스텁"` 항목 → cart·order·payment 3개 실구현됨. "10개 모듈 빈 스텁(coupon~admin, shipping, settlement 등)"으로 갱신.
       - `"inventory 재고입고 소유권 미검증 (SEC-002/IDOR)"` 항목 → FR-050/FR-051 구현 완료. 해당 행 제거 또는 "RESOLVED by 003-commerce" 표기.
    6. **§1 현재 버전**: v1.0.0 — 003-commerce 완료로 구현 범위 확대됨 (버전 자체는 동일).
  - **PROC-002 코드 검증 (Docs Agent 수행)**:
    - `shared/prisma/PrismaService.runInTransaction`: `apps/backend/src/shared/prisma/prisma.service.ts` L49 — `async runInTransaction<T>(fn: () => Promise<T>): Promise<T>` 확인 ✓
    - `PrismaService.onAfterCommit`: `prisma.service.ts` L35-36 — ALS getStore 기반 확인 ✓
    - `shared/pgboss/PgBossModule`: `apps/backend/src/infrastructure/pgboss/pgboss.module.ts` L9-14 — OutboxRelay·AutoConfirmJob providers 확인 ✓
    - `AutoConfirmJob(AUTO_CONFIRM_DAYS=7)`: `apps/backend/src/modules/order/order.constants.ts` L1-2 → `AUTO_CONFIRM_DAYS = 7 as const` 확인. AutoConfirmJob: `auto-confirm-job.ts` L25-34 — schedule 적용 확인 ✓
    - `CartService/CartRepository`: `apps/backend/src/modules/cart/cart.service.ts`·`cart.repository.ts` — commerce.carts 전용 실구현 확인 ✓
  - **갱신 위임**: Retrospective Agent. [MUST NOT] [agent:docs] context.md 직접 수정.

---

## GAP-003

- **ID**: GAP-003
- **유형**: D-layer 스펙 파일 TypeScript 오류
- **출처**: Development Agent
- **컨텍스트**: T033 구현 완료 후 `npx jest order.service.spec.ts` 실행 시 발견
- **상태**: RESOLVED by Test Agent (EXECUTION) — 5b 자체 정정 [B]로 수정 완료
- **내용 (참고 이력)**:
  - `src/modules/order/order.service.spec.ts` 437행 `it.each` 콜백이 TypeScript 타입 오류로 테스트 스위트 실행 불가.
  - 오류 메시지: `TS2345: Argument of type '(cancelStatus: "pending" | "confirmed") => Promise<void>' is not assignable to parameter of type '(...args: ["pending", "when_cancel_pending_then_cancelled"] | ...)' `
  - **해결**: Test Agent (EXECUTION) 가 5b 자체 정정 [B]로 `async (cancelStatus, _label) =>` 2파라미터 확장 + `Prisma.Decimal('15000')` 교체. test-report.md 자체 정정 내역 참조.
  - Development Agent 는 D-layer 파일 수정 금지 → 5b에서 처리 완료.

---

## GAP-004

- **ID**: GAP-004
- **유형**: 보안-취약점 (HIGH) — 금전 정합성 위반
- **출처**: Security Agent
- **컨텍스트**: [SEC-FIND-001: order.repository.findById 항상 payments:[] 반환 → cancel() 환불 미실행, P-005/FR-021/FR-022 위반]
- **상태**: RESOLVED by Development Agent + Test Agent (EXECUTION) — 2026-06-29
- **해결 내용**:
  - `order.service.ts` `cancel()`: `order.payments` 배열 의존 대신 `this.paymentService.findPaymentByOrderId(orderId)` 직접 호출로 교체. P-001(cross-schema 경계) 준수 + 실제 환불 로직 실행 보장.
  - `payment.service.ts`: `findPaymentByOrderId(orderId: string)` 신규 메서드 추가.
  - `payment.module.ts`: `exports: [PaymentService, PaymentRepository]` — OrderModule 에서 PaymentService DI 가능하도록 exports 추가.
  - Test Agent (EXECUTION) 177 PASS 확인 (SC-024 mock 정상화 포함).
- **원본 내용 (이력)**:
  - `order.repository.ts` L74-75: `findById` 반환 값에 `payments: []` 하드코딩. P-001(cross-schema 경계 — orders스키마가 payments스키마 직접 조회 금지) 준수를 위한 설계이나, 결과적으로 `payments` 배열이 항상 비어 있음.
  - `order.service.ts` L165-169: `cancel()` 내부 `if (order.payments && order.payments.length > 0)` 조건이 항상 false → confirmed 상태 주문을 취소해도 환불 로직이 실행되지 않음.
  - **영향**: 결제 완료 후 `confirmed` 상태 주문을 취소할 경우 PG 환불 없이 주문 상태만 `cancelled`로 변경 → 소비자 결제 금액 환불 불가 → P-005(결제·정산 정합성) 위반.
  - **관련 요구사항**: FR-021(주문 취소), FR-022(재고 복원), P-005(결제·정산 정합성)

---

## GAP-005

- **ID**: GAP-005
- **유형**: 보안-취약점 (HIGH) — 상태 기계 역전
- **출처**: Security Agent
- **컨텍스트**: [SEC-FIND-002: autoConfirmDelivered → markConfirmed(confirmed) 호출 → delivered→confirmed 상태역전, FR-027 미구현]
- **상태**: RESOLVED by Development Agent + Test Agent (EXECUTION) — 2026-06-29
- **해결 내용**:
  - `order.service.ts` `autoConfirmDelivered()`: `markConfirmed()` 대신 `updateStatus(orderId, OrderStatus.completed)` 직접 호출 + `appendEvent(orderId, OrderEventType.SYSTEM, 'delivered→completed')` 이벤트 기록으로 교체. FR-027(delivered → completed 자동 구매확정) 정상 구현.
  - Test Agent (EXECUTION) 177 PASS 확인.
- **원본 내용 (이력)**:
  - `order.service.ts` L259-267: `autoConfirmDelivered()`가 `delivered` 상태 주문에 대해 `this.markConfirmed(order.id)` 호출.
  - `order.service.ts` L275-287: `markConfirmed()`는 ADR-007용 메서드로 `pending → confirmed` 전이 목적. `updateStatus(orderId, OrderStatus.confirmed)` 를 고정 실행.
  - **결과**: 자동확정 대상인 `delivered` 주문이 `completed`가 아닌 `confirmed`로 상태 변경 → 주문 상태 기계 역전 (delivered > confirmed은 후퇴 전이).
  - **FR-027 미구현**: "배송 완료 후 N일 경과 시 자동 구매확정(delivered → completed)" 이 실제로 실행되지 않음.
  - **관련 요구사항**: FR-027(자동 구매확정), plan.md §주문 상태 기계
