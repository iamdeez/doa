---
작성: Security Agent
버전: v2.0
최종 수정: 2026-06-29 03:09
상태: 확정
---

# 보안 감사 결과 — 003-commerce (재감사)

## 목차

- [검토 범위](#검토-범위)
- [요약](#요약)
- [Constitution 보안 조항 이행 현황](#constitution-보안-조항-이행-현황)
- [취약점 목록](#취약점-목록)
- [NFR 보안 요구사항 이행 현황](#nfr-보안-요구사항-이행-현황)
- [OWASP Top 10 점검 결과](#owasp-top-10-점검-결과)
- [권고사항](#권고사항)

---

## 검토 범위

### 검토 대상 파일

| 파일 | 검토 사유 |
|---|---|
| `apps/backend/src/modules/order/order.service.ts` | SEC-FIND-001/002 수정 — cancel()/autoConfirmDelivered() |
| `apps/backend/src/modules/payment/payment.service.ts` | SEC-FIND-001 — findPaymentByOrderId 신규 메서드 |
| `apps/backend/src/modules/payment/payment.controller.ts` | SEC-FIND-005 — idempotency-key UUID v4 검증 |
| `apps/backend/src/modules/payment/dto/create-payment.dto.ts` | SEC-FIND-003 — amount 필드 제거 |
| `apps/backend/src/modules/order/dto/create-order.dto.ts` | SEC-FIND-004 — discountAmount 필드 제거 |
| `docs/specs/v1.0.0/DIFF-003-commerce.md` | 전체 변경 범위 확인 |

### 제외 파일 및 사유

이전 감사(run-009-security-agent.md)에서 PASS 판정을 받은 파일 — 변경 없음.

- `inventory.controller.ts` — SEC-002 IDOR 검증 PASS (이전 감사 확인, DIFF 추가 변경 없음)
- `order.repository.ts`, `seller-order.controller.ts`, `cart.service.ts` 등 — 이전 PASS 유지
- `schema.prisma` — Decimal 타입 검증 PASS (이전 감사 확인)
- `outbox-relay.ts`, `auto-confirm-job.ts` — PASS (이전 감사 확인)

---

## 요약

| 항목 | 값 |
|---|---|
| 검토 대상 파일 수 | 6 (재감사 대상) |
| Critical 건수 | 0 |
| High 건수 | 0 (이전 2건 → 모두 RESOLVED) |
| Medium 건수 | 0 (이전 3건 → 모두 RESOLVED) |
| 전체 취약점 건수 | 5건 발견, 5건 RESOLVED |
| **최종 상태** | **COMPLETE** |

---

## Constitution 보안 조항 이행 현황

| 조항 | 이행 여부 | 비고 |
|---|---|---|
| P-001 모듈 경계 | PASS | `OrderService.cancel()`이 `PaymentService.findPaymentByOrderId()`를 DI 호출로 사용 — cross-schema 직접 쿼리 없음 |
| P-002 AWS 금지 | PASS | `@aws-sdk/*` 의존 없음 |
| P-003 단일 DB | PASS | pg-boss 동일 PostgreSQL 인스턴스 사용 |
| P-004 클라우드 중립 | PASS | Fly.io 배포, 클라우드 종속 SDK 없음 |
| P-005 결제 정합성 | **PASS** (이전 FAIL → 수정) | `cancel()` 내 `findPaymentByOrderId` 직접 조회 후 `completed` 시 환불 처리. 결제·취소 정합성 복원됨 |
| P-006 테스트 원칙 | PASS | SC-024에 findPaymentByOrderId mock 정정 반영됨 (DIFF 확인) |
| P-007 스펙 범위 | PASS | 수정 사항이 spec.md FR-021/022/027/031 범위 내 |

---

## 취약점 목록

| SEC-ID | 심각도 | OWASP | 위치 | 설명 | 수정 방향 | 상태 |
|---|---|---|---|---|---|---|
| SEC-FIND-001 | HIGH | A04/A08 | `order.service.ts` `cancel()` | `findById` 반환값의 `payments:[]` 의존으로 결제 완료 주문 취소 시 환불 미처리 | `paymentService.findPaymentByOrderId(orderId)` 직접 조회 후 `completed` 조건 확인 | **RESOLVED** |
| SEC-FIND-002 | HIGH | A04/A08 | `order.service.ts` `autoConfirmDelivered()` | `markConfirmed(pending→confirmed)` 오호출로 `delivered→confirmed` 상태역전 발생 | `updateStatus(id, completed)` 직접 전이 + `SYSTEM` actorType 이벤트 기록 | **RESOLVED** |
| SEC-FIND-003 | MEDIUM | A04 | `payment/dto/create-payment.dto.ts` | DTO에 `amount` 필드 포함 시 클라이언트 금액 조작 가능 | `amount` 필드 제거 — 서버 측 `order.totalAmount` 사용 | **RESOLVED** |
| SEC-FIND-004 | MEDIUM | A04 | `order/dto/create-order.dto.ts` | `discountAmount` 클라이언트 입력 허용으로 할인액 조작 가능 | `discountAmount` 필드 제거 — 서비스 계층에서 `Decimal(0)` 고정 | **RESOLVED** |
| SEC-FIND-005 | MEDIUM | A04 | `payment.controller.ts` L39 | `Idempotency-Key` 헤더 값이 UUID v4인지 미검증 — 임의 문자열로 멱등성 우회 가능 | `isUUID(key, '4')` 검증 추가 — 비-UUID v4 → 400 BadRequest | **RESOLVED** |

### SEC-FIND-001 해소 검증 상세

`order.service.ts` L164-171:

```
const payment = await this.paymentService.findPaymentByOrderId(orderId);
...
if (payment && payment.status === PaymentStatus.completed) {
  await this.paymentService.refund(payment.id, `refund:${orderId}`);
}
```

`PaymentService.findPaymentByOrderId()` (L152-154): `paymentRepository.findByOrderId(orderId)` 호출로 payments 스키마에서 직접 조회. P-001 준수 (DI 경유).

### SEC-FIND-002 해소 검증 상세

`order.service.ts` L267-275:

```
await this.orderRepository.updateStatus(order.id, OrderStatus.completed);
await this.orderRepository.appendEvent({
  orderId: order.id,
  fromStatus: OrderStatus.delivered,
  toStatus: OrderStatus.completed,
  actorType: ActorType.SYSTEM,
});
```

`markConfirmed()` 호출 제거됨. `delivered → completed` 직접 전이 확인.

---

## NFR 보안 요구사항 이행 현황

| ID | 요구사항 | 이행 여부 | 비고 |
|---|---|---|---|
| NFR-003 | 인증 필수 엔드포인트 — JWT 없음 시 401 | PASS | `@UseGuards(JwtAuthGuard)` 전 컨트롤러 적용 확인 (이전 감사 PASS 유지) |
| NFR-004 | IDOR 차단 — 자원 소유권 검증 | PASS | orderId→userId 검증 전 메서드 확인, SEC-002 소유권 3축 확인 (이전 감사 PASS 유지) |
| NFR-005 | 금전 필드 Decimal 타입 | PASS | schema.prisma Decimal(12,2) 선언 (이전 감사 PASS 유지) |
| NFR-006 | 스키마 경계 — 타 도메인 직접 쿼리 금지 | PASS | P-001 cross-schema 경계 준수 (SEC-FIND-001 수정에서도 DI 경유 확인) |
| NFR-007 | AWS SDK 금지 | PASS | package.json `@aws-sdk/*` 없음 |
| NFR-008 | 결제·outbox 동일 트랜잭션 | PASS | `prisma.runInTransaction` 내 처리 확인 |

---

## OWASP Top 10 점검 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| A01 Broken Access Control | PASS | IDOR 3축(order/payment/seller-order) 확인, SEC-002 소유권 검증 완료 |
| A02 Cryptographic Failures | PASS | 금전 Decimal, JWT 002 범위 적용 |
| A03 Injection | PASS | Prisma ORM 파라미터화 쿼리 전용 |
| A04 Insecure Design | **PASS** (이전 FAIL → 수정) | SEC-FIND-001~005 모두 RESOLVED |
| A05 Security Misconfiguration | PASS | JwtAuthGuard 전 컨트롤러 적용 |
| A06 Vulnerable/Outdated Components | PASS | pg-boss@^10.4.2 (최신 LTS), P-003 승인 |
| A07 Identification and Authentication Failures | PASS | JWT 전략 정상, 미인증 401 반환 |
| A08 Software and Data Integrity Failures | **PASS** (이전 FAIL → 수정) | SEC-FIND-001(환불 무결성), SEC-FIND-002(상태 역전) 해소 |
| A09 Security Logging and Monitoring | PASS | `order_events` append-only 이벤트 로그 |
| A10 SSRF | N/A | 외부 URL 페치 없음 (PG stub 내부 처리) |

---

## 권고사항

이번 재감사에서 Critical/High 취약점 0건 확인. 이전 BLOCKED 사유 해소됨.

향후 개선 권고 (차기 spec 참고):

1. **환불 트랜잭션 경계**: `PaymentService.refund()`가 `prisma.runInTransaction` 외부에서 호출되고 이후 `runInTransaction` 내에서 재고복구·상태변경이 진행됨. 현재 구현에서 PG 환불 성공 후 트랜잭션 실패 시 환불은 완료되었으나 주문 취소는 미처리되는 부분 원자성 누락 가능성 존재. 결제 환불의 비가역성(PG 호출) 특성상 현실적 제약이나, 보상 트랜잭션(compensation transaction) 패턴 도입 검토 권장.

2. **Idempotency-Key 스코프**: 현재 key가 전역 unique로 관리됨. 사용자별 스코프 격리(userId + key) 고려 시 타 사용자의 key 충돌 가능성 사전 제거 가능.

3. **PG Stub 교체 시 보안 재검토**: `stub-payment-gateway.ts`가 운영 PG로 교체될 때 SSRF(A10), TLS 검증, API key 관리에 대한 별도 보안 검토 필요.
