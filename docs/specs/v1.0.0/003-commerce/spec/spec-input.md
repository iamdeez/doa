---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# Spec Input: 003-commerce

> 수집 일시: 2026-06-28 | 사용자 최종 확인: 완료

## 수집 진행 상태

| 카테고리 | 상태 | 마지막 질문 번호 | 답변 완료 항목 |
|---|---|---|---|
| 1. 배경 및 목적 | 완료 | Q3 | [Q1, Q2, Q3] |
| 2. 사용자 & 이해관계자 | 완료 | Q6 | [Q4, Q5, Q6] |
| 3. 핵심 기능 | 완료 | Q9 | [Q7, Q8, Q9] |
| 4. 데이터 & 입출력 | 완료 | Q12 | [Q10, Q11, Q12] |
| 5. 제약조건 | 완료 | Q16 | [Q13, Q14, Q15, Q16] |
| 6. 운영 환경 | 완료 | Q19 | [Q17, Q18, Q19] |
| 7. 예외 & 실패 시나리오 | 완료 | Q22 | [Q20, Q21, Q22] |

---

## 질문 분석 근거 (Question Analysis Basis)

> (PROC-015) 옵션형 질문을 본 Agent 의 분석에 근거해 구성한 경우 기록.

| 질문 ID | 요지 | 옵션별 근거·trade-off | 추천안(이유) | 채택 결과 |
|---|---|---|---|---|
| Q-PG | 결제 PG 연동 방식 | A: 특정 PG(예: 토스페이먼츠) 실 연동 — 외부 test API key 필요, 실제 결제 흐름 즉시 구현 가능 / B: PG 어댑터 인터페이스 + stub — 외부 의존 없이 E2E 테스트 가능, 추후 실 PG 교체 용이 | B — Stage 2에서 결제 흐름 설계가 목적. 어댑터 패턴으로 추후 교체 가능 | **B 채택**: `PaymentGatewayPort` 인터페이스 + stub. 실 PG 교체는 후속 spec. |
| Q-REFUND | 환불 범위 | A: 전액 환불만 — 단순, 표준 / B: 부분 환불 — 유연하지만 복잡 | A | **A 채택**: 전액 환불만. 부분 환불은 후속 spec. |
| Q-IDEM | 멱등성 키 생성 주체 | A: 클라이언트 UUID — PG 표준 관례 / B: 서버 생성 — 클라이언트 단순화 | A | **A 채택**: 클라이언트가 `Idempotency-Key` 헤더로 전달. 동일 키 재요청 시 최초 결과 반환. |
| Q-AUTOCONFIRM | 자동 구매 확정 | A: N일 자동 확정 / B: 수동만 / C: 수동+자동 | C(N=7일) | **C 채택**: 수동 구매 확정 + 배송완료 후 7일 자동 확정(pg-boss 스케줄 잡). |
| Q-CANCEL | 취소 가능 상태 | A: pending/confirmed 만 — 표준 / B: preparing 이전 / C: 모든 상태 | A | **A 채택**: pending·confirmed 상태만 고객 직접 취소. preparing 이후는 차단(400). |
| Q-COUPON | 쿠폰 포함 여부 | A: 포함 — coupon 모듈 실구현 필요 / B: 제외 — 별도 spec | B | **B 채택**: 003 제외. 단 totalAmount/discountAmount 필드 여지 유지. |
| Q-GUESTCART | 게스트 장바구니 | A: 인증 사용자만 / B: 게스트 지원 — 복잡 | A | **A 채택**: 인증 사용자만. user_id 기반 JSONB. |
| Q-ORDERITEMS | 주문 범위 | 전체 vs 일부 선택 | — | **일부 선택 주문 가능**: 장바구니에서 선택한 항목만 주문 생성. |

---

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

**Q1. 왜 만드는가?**

AWS 기반 MSA(DynamoDB Carts + 분산 트랜잭션 결제/주문)를 모듈러 모놀리스로 재구축.
cart·order·payment의 주문~결제 E2E 흐름을 단일 PostgreSQL 트랜잭션 + outbox 패턴으로 구현하여 분산 트랜잭션 복잡도를 제거한다. 또한 002-catalog Security Agent가 식별한 SEC-002(inventory stock-in IDOR)를 본 spec에서 수정한다.

**Q2. 기존 한계?**

- DynamoDB Carts → PostgreSQL JSONB 대체 (P-003 단일 DB 원칙)
- MSA 분산 트랜잭션(Saga) → 단일 Prisma 트랜잭션으로 단순화
- SEC-002: inventory stock-in 소유권 미검증 IDOR (002-catalog에서 미수정, GAP-005)

**Q3. 성공 기준?**

- 고객이 장바구니 → 주문 → 결제 → 재고 차감 E2E 흐름이 동작
- SEC-002(inventory IDOR) 해소
- constitution P-005 준수: outbox + 멱등성 키 + Decimal

---

### [카테고리 2] 사용자 & 이해관계자

**Q4. 누가 사용하는가?**

- 고객(buyer): 장바구니·주문·결제·취소·환불 요청·구매확정
- 판매자(seller, APPROVED): 주문 확인(confirmed→preparing), 자신의 재고 조작만 가능(SEC-002 수정)
- 시스템(SYSTEM): pg-boss 스케줄 잡으로 자동 구매 확정(delivered→completed after 7일)
- 관리자(admin): 향후 확장 가능(본 spec에서 별도 admin 전용 엔드포인트 최소화)

**Q5. 기술 수준?**

- 고객: Flutter 앱 (일반 사용자)
- 판매자: 콘솔 웹(Next.js)
- 관리자: 콘솔 웹(Next.js)

**Q6. 이해관계자?**

- 결제 PG사 (stub으로 대체, 후속 실 연동)
- settlement 모듈 (003 범위 외, order.completed 이벤트 구독자)
- notification 모듈 (003 범위 외, 이벤트 구독자)
- shipping 모듈 (003 범위 외, preparing→shipped 전이 담당)

---

### [카테고리 3] 핵심 기능

**Q7. 반드시 있어야 하는 기능 (우선순위 순):**

1. **장바구니(cart)**: 담기·수량변경·제거·조회 (JSONB items, user_id 기반, 인증 사용자만)
2. **주문 생성(order)**: 장바구니에서 일부 또는 전체 선택 → 재고 확인 → 주문 생성 + 재고 차감 (동일 트랜잭션)
3. **결제(payment)**: `PaymentGatewayPort` stub 통해 결제 → outbox → order confirmed
4. **주문 상태 전이**: pending→confirmed→preparing→shipped→delivered→completed / cancelled
5. **취소/환불**: pending·confirmed 상태 취소 → 전액 환불 + 재고 복구 → payment.refunded outbox
6. **구매 확정**: 수동(고객) + 자동 7일(pg-boss)
7. **주문 목록/상세 조회**: 고객의 내 주문, 판매자의 수주 목록
8. **SEC-002 수정**: stock-in·getStock 소유권 검증 (variantId→product→seller)

**Q8. 있으면 좋지만 필수 아닌 것:**

해당 없음 — 위 8가지가 모두 필수 범위로 확정.

**Q9. 명시적 제외 (Out of Scope):**

- shipping 모듈 (배송·송장·추적) — 별도 spec
- settlement 모듈 (정산) — 별도 spec
- coupon 적용 — 별도 spec (coupon 모듈 스텁 유지)
- review 모듈 — 별도 spec
- 부분 환불 — 전액 환불만 지원, 부분 환불 별도 spec
- 게스트(비로그인) 장바구니 — 인증 사용자 전용
- 실 PG 연동 — stub만, 후속 spec

---

### [카테고리 4] 데이터 & 입출력

**Q10. 주요 데이터:**

- `commerce.carts`: user_id (plain String), items (JSONB: [{variantId, productId, quantity, unitPrice, optionName, optionValue, productTitle, sku, imageUrl?}]), 사용자당 1건
- `orders.orders`: userId (plain), status, totalAmount (Decimal), discountAmount (Decimal, default 0), shippingAddressSnapshot (JSONB), deliveredAt?
- `orders.order_items`: orderId, variantId (plain), productId (plain), sellerId (plain), quantity, unitPrice (Decimal), optionName, optionValue, productTitle, sku
- `orders.order_events`: orderId, fromStatus?, toStatus, actorType (CUSTOMER/SELLER/ADMIN/SYSTEM), actorId?, createdAt — append-only
- `payments.payments`: orderId (plain, unique per order), userId (plain), amount (Decimal), status, idempotencyKey (unique), pgTransactionId?
- `payments.refunds`: paymentId, amount (Decimal), idempotencyKey (unique), status, pgRefundId?

**Q11. 외부 연동:**

- `InventoryService.checkAvailability(variantId, quantity)`: Promise<boolean> — DI 호출 (002 FR-033)
- `InventoryService.decreaseStock(variantId, quantity, orderId)`: Promise<void> — 호출자 트랜잭션 내 실행 (002 FR-034)
- `InventoryService.restoreStock(variantId, quantity, orderId)`: Promise<void> — 신규 공개 메서드 (주문 취소 시 재고 복구)
- `PaymentGatewayPort` stub — DI 어댑터 인터페이스
- pg-boss 스케줄 잡 — 자동 구매 확정(7일)

**Q12. 데이터 민감도:**

- 주문 금액·결제 정보: JWT 인증 + 소유권 검증으로 접근 제어
- 배송지 스냅샷(recipientName, phone, zipCode, address1, address2): 개인 주문 데이터, 인증 사용자 자신의 주문만 접근 가능

**Q12-1. 주문 목록 미리보기 필드:**

주문 목록(`GET /orders`)에 주문 ID·상태·총 금액·대표 상품명·아이템 수·주문 일시 포함.

---

### [카테고리 5] 제약조건

**Q13. 기술 스택 제약:**

NestJS + Prisma + PostgreSQL multiSchema 기존 스택 계승. AWS 전용 SDK 추가 금지(P-002). 외부 캐시·브로커 추가 없음(P-003).

**Q14. 일정 제약:**

Stage 2 순서대로 — 001 골격 + 002 카탈로그 완료 후속.

**Q15. 성능 요구사항:**

- `POST /orders` P95 응답 1,000ms 이하 (측정: 로컬 docker-compose, 아이템 10개 미만)
- `POST /payments` P95 응답 2,000ms 이하 (stub 기준)

**Q16. 보안/법규 요구사항:**

- 주문·결제·환불 엔드포인트 IDOR 차단: 소유권 검증 필수 (PATCH-001 평가 결과)
- Idempotency-Key 필수: 결제·환불 API (P-005)
- Decimal 타입 필수: 모든 금전 필드 (P-005)
- outbox 패턴 필수: 결제·환불 상태 변경 (P-005)
- SEC-002 수정: inventory stock-in·getStock 소유권 검증 필수

---

### [카테고리 6] 운영 환경

**Q17. 실행 환경:**

Fly.io App (Docker 컨테이너) + Fly Postgres (단일 PostgreSQL 16, multiSchema)

**Q18. 예상 규모:**

오픈마켓 재구축 단계 — 초기 소규모 트래픽

**Q19. 배포 담당:**

GitHub Actions → flyctl deploy. PG 실 연동 시 API key는 Fly secrets로 관리(본 spec은 stub이므로 별도 환경변수 불필요).

---

### [카테고리 7] 예외 & 실패 시나리오

**Q20. 시스템 실패 시:**

- PaymentGatewayPort stub 실패 → payment.status=failed, 주문은 pending 유지. 동일 Idempotency-Key로 재시도 가능.
- InventoryService.decreaseStock 실패(InsufficientStockException) → 트랜잭션 rollback, 주문 생성 실패.
- pg-boss 스케줄 잡 실패 → pg-boss 재시도 정책 적용(idempotent 잡 설계).

**Q21. 예상 오류/엣지 케이스:**

- 재고 부족(409): 주문 생성 시 checkAvailability 실패
- 이미 완료된 결제에 재결제 시도: idempotencyKey 중복 → 최초 결과 반환(멱등성)
- 이미 환불된 결제에 재환불 시도: 409
- preparing/shipped/delivered 상태에서 고객 직접 취소: 400
- 타인 주문·결제 접근: 403 (IDOR 차단)
- 동시 주문 + 재고 차감 경쟁 조건: `decreaseStock` 조건부 원자성(002 ADR-005) 으로 음수 재고 방지

**Q22. 백업/복구:**

PostgreSQL Fly Postgres PITR(기본 정책) — spec 범위 외.

---

## 보완 내용

### SEC-002 수정 범위 (확정)

002-catalog security-report.md REC-002 기반:
- `POST /inventory/:variantId/stock-in`: variantId→productId→sellerId 소유권 검증 추가. 소유자가 아닌 APPROVED 판매자 → 403.
- `GET /inventory/:variantId/stock`: 동일하게 소유권 검증 추가. (읽기 전용이지만 003에서 함께 수정)

### PATCH-001 권한 평가 (확정)

주요 상태 전이 엔드포인트 인가 3축 평가 결과:

| 엔드포인트 | 호출자 신원 | 자원 소유권 검증 | 역할 | 위험 수준 | 대응 |
|---|---|---|---|---|---|
| `POST /orders` | 인증 고객 | 자신의 cart (userId 자동 적용) | buyer | 저 | 별도 소유권 검증 불필요 |
| `DELETE /orders/:id` | 인증 고객 | orderId→userId 검증 | buyer | 중 | 소유권 검증 필수 |
| `POST /payments` | 인증 고객 | orderId→userId 검증 | buyer | 고 | 소유권 + 중복결제 방지 |
| `POST /payments/:id/refund` | 인증 고객 | paymentId→userId 검증 | buyer | 고 | 소유권 + 중복환불 방지(409) |
| `PATCH /orders/:id/confirm` | APPROVED 판매자 | orderId → 주문 내 sellerId 포함 여부 검증 | seller | 중 | 자신의 상품이 포함된 주문만 처리 |
| `POST /orders/:id/complete` | 인증 고객 | orderId→userId 검증 | buyer | 저 | 소유권 검증 필수 |
| `POST /inventory/:variantId/stock-in` | APPROVED 판매자 | **(SEC-002)** variantId→product→seller 검증 | seller | 중 | 003에서 수정 |
| `GET /inventory/:variantId/stock` | APPROVED 판매자 | **(SEC-002)** variantId→product→seller 검증 | seller | 저(읽기) | 003에서 함께 수정 |

> **자가 조작 위험 평가**: 결제(`POST /payments`)에서 타인 주문의 결제를 시도하는 IDOR 위험이 가장 높다. orderId→userId 검증으로 차단 가능. 자가 승인(자기 자신에게 권한 부여) 유형의 위험은 본 spec 엔드포인트에서 식별되지 않음.

### 선행 spec 영향 추적 (Predecessor Lineage)

| 선행 spec | 식별된 결함 항목 | 결함 인지 시점 | 식별 경로 |
|---|---|---|---|
| v1.0.0/002-catalog | SEC-002: inventory stock-in IDOR (variantId 소유권 미검증) | 2026-06-28 | 운영 검토 (Security Agent v1.1, security-report.md REC-002) |

### PROC-R03 사전 식별 — SEC-002 수정으로 인한 기존 테스트 영향

SEC-002 수정(inventory 소유권 검증 추가)으로 인해 002-catalog의 기존 테스트가 영향을 받을 수 있다:
- `SC-041` (FR-030): `POST /inventory/:variantId/stock-in` 테스트가 임의 APPROVED 판매자로 타인 variant에 요청하면 403으로 실패 전환 가능.
- `SC-042` (FR-031): `GET /inventory/:variantId/stock` 테스트도 동일.

본 spec FR-050·FR-051 구현 시 SC-041·SC-042 테스트 픽스처가 variant 소유자 판매자를 사용하도록 마이그레이션이 필요할 수 있다. Design Agent 가 research.md §F에서 전수 확인 후 plan.md에 반영할 것.
