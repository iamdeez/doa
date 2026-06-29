---
작성: Performance Agent
버전: v1.0
최종 수정: 2026-06-29 03:16
상태: 확정
---

# 성능 측정 및 최적화 결과

## 목차

- [검토 범위](#검토-범위)
- [Constitution 성능 원칙 조항 이행 현황](#constitution-성능-원칙-조항-이행-현황)
- [성능 목표](#성능-목표)
- [Baseline 측정 결과](#baseline-측정-결과)
- [병목 지점 분석](#병목-지점-분석)
- [최적화 적용 내역](#최적화-적용-내역)
- [최종 측정 결과](#최종-측정-결과)
- [미달성 항목 및 사유](#미달성-항목-및-사유)
- [회귀 테스트 결과](#회귀-테스트-결과)

---

## 검토 범위

### 검토 대상 파일

DIFF-003-commerce.md 기반 변경 파일 + research.md §영향 범위 분석으로 확정한 hot path 파일.

| 파일 | 검토 사유 |
|---|---|
| `src/modules/order/order.service.ts` | createOrder 트랜잭션 hot path — NFR-001 직결 |
| `src/modules/order/order.repository.ts` | createOrder·createItems·appendEvent·findById 쿼리 |
| `src/modules/product/product.service.ts` | getVariantSnapshots 배치 패턴 |
| `src/modules/product/product.repository.ts` | findVariantsWithProduct 배치 쿼리 구현 |
| `src/modules/inventory/inventory.service.ts` | checkAvailability·decreaseStock 쿼리 패턴 |
| `src/modules/inventory/inventory.repository.ts` | findByVariant·conditionalDecrement·appendLog |
| `src/modules/cart/cart.service.ts` | removeItems (트랜잭션 내 장바구니 제거) |
| `prisma/schema.prisma` | 인덱스 선언 현황 |

### 제외 파일

| 파일 | 제외 사유 |
|---|---|
| `src/modules/payment/payment.service.ts` | NFR-002 결제 경로 — stub 구현으로 외부 PG 레이턴시 없음. 단일 tx INSERT 위주로 분석 불필요 |
| `src/infrastructure/pgboss/` | OutboxRelay·AutoConfirmJob — 비동기 백그라운드 잡, NFR-001/002 hot path 외 |
| Controller/DTO 계층 | 쿼리·트랜잭션 없음, JSON 직렬화 오버헤드 무시 수준 |

---

## Constitution 성능 원칙 조항 이행 현황

constitution.md 에는 성능 전용 조항(P-001 성능 최우선 등)이 없다. 간접 영향 조항:

| 조항 | 내용 | 이행 여부 |
|---|---|---|
| P-001. 모듈 경계 원칙 | 타 도메인 스키마 직접 쿼리 금지 — cross-schema plain String | **준수** — OrderRepository 는 orders 스키마만 접근; payments 조회는 PaymentService DI 경유 |
| P-003. 단일 DB 원칙 | 단일 PostgreSQL; 인-앱 LRU 캐시 허용 | **준수** — 외부 캐시·별도 DB 없음. Prisma → PostgreSQL 단일 경로 |
| P-005. 결제·정산 정합성 원칙 | 상태 변경 = 단일 tx + outbox | **준수** — `runInTransaction` + `appendEvent` + outbox createMany 동일 tx |
| P-007. 스펙 범위 원칙 | spec 외 성능 개선 금지 (별도 spec) | **준수** — 발견된 최적화 기회(checkAvailability 배치화)는 spec.md 범위 외이므로 권고 수준 기재, 미적용 |

---

## 성능 목표

| PERF-ID | NFR-ID | SC-ID | 목표값 | 측정 방법 | 조건 |
|---|---|---|---|---|---|
| PERF-001 | NFR-001 | SC-045 | POST /orders P95 ≤ 1,000ms | e2e 100회 반복 | 로컬 docker-compose, 아이템 ≤ 10개 |
| PERF-002 | NFR-002 | SC-046 | POST /payments P95 ≤ 2,000ms | e2e 100회 반복 | stub PG 기준 |

---

## Baseline 측정 결과

### 측정 환경

- PostgreSQL 16: docker-compose (Up 16 hours, `doa-next-postgres-1`)
- DATABASE_URL: `postgresql://doa:doa_local@localhost:5432/doa_next`
- TEST_JWT_TOKEN: **미설정** — 테스트 사용자 미생성, DB 시드 없음 (users 테이블 0건)
- 측정 방식: 코드 정적 분석 + 쿼리 수 추산 (실측 불가)

### PERF-001 — POST /orders 쿼리 수 추산 (N=아이템 수)

`createOrder` hot path 전체 DB 쿼리 수 분석:

**Phase 1. 사전 가용성 확인 (트랜잭션 외부, 비원자적 fast-path)**

| 단계 | 쿼리 | 쿼리 수 | 인덱스 |
|---|---|---|---|
| `checkAvailability` 루프 | `SELECT * FROM inventory WHERE variantId = ?` | **N** (직렬) | `variantId @unique` (O(1) 인덱스 탐색) |

**Phase 2. 스냅샷 일괄 조회 (트랜잭션 외부)**

| 단계 | 쿼리 | 쿼리 수 | 인덱스 |
|---|---|---|---|
| `getVariantSnapshots` | `SELECT v.*, p.* FROM variants v JOIN products p WHERE v.id IN (ids)` | **1** (배치) | PK `id` |

**Phase 3. 단일 트랜잭션 내부 (`runInTransaction`)**

| 단계 | 쿼리 | 쿼리 수 | 인덱스 |
|---|---|---|---|
| `decreaseStock` 루프 — findByVariant | `SELECT * FROM inventory WHERE variantId = ?` | N (직렬) | `variantId @unique` |
| `decreaseStock` 루프 — conditionalDecrement | `UPDATE inventory SET quantity = quantity - ? WHERE variantId = ? AND quantity >= ?` | N (직렬) | `variantId @unique` |
| `decreaseStock` 루프 — appendLog | `INSERT INTO inventory_logs ...` | N (직렬) | — |
| `createOrder` | `INSERT INTO orders ...` | 1 | — |
| `createItems` | `INSERT INTO order_items VALUES (...),(...),(...)` (createMany) | **1** (배치) | — |
| `appendEvent` | `INSERT INTO order_events ...` | 1 | — |
| `cartService.removeItems` — getCartItems | `SELECT * FROM carts WHERE userId = ?` | 1 | `userId @unique` |
| `cartService.removeItems` — upsertItems | `UPDATE carts SET items = ? WHERE userId = ?` | 1 | `userId @unique` |

**Phase 4. 주문 조회 (트랜잭션 외부)**

| 단계 | 쿼리 | 쿼리 수 | 인덱스 |
|---|---|---|---|
| `findById` (include items + events) | `SELECT * FROM orders WHERE id = ?` + 2 SELECT (items, events) | 3 | PK `id`, `orderId @index` |

**총계 (N 아이템):**

| 구분 | 쿼리 수 |
|---|---|
| Pre-tx fast-path check | N |
| 스냅샷 배치 | 1 |
| Tx 내부 (decreaseStock × N) | 3N |
| Tx 내부 (order + items + event + cart) | 5 |
| Post-tx findById | 3 |
| **합계** | **4N + 9** |

N=1: 13쿼리 / N=5: 29쿼리 / **N=10: 49쿼리**

**쿼리 레이턴시 추산 (로컬 docker-compose, 루프백 소켓):**

| 단위 | 추산값 |
|---|---|
| 단순 인덱스 SELECT 1건 | ~1-3ms |
| UPDATE with WHERE (indexed) | ~2-5ms |
| INSERT / createMany | ~2-5ms |
| NestJS 미들웨어·JSON 직렬화 | ~5-10ms |
| 트랜잭션 BEGIN/COMMIT 오버헤드 | ~3-8ms |

N=10 총 추산: 49쿼리 × 평균 2.5ms + tx 오버헤드 10ms + 앱 오버헤드 10ms ≈ **~142ms** (avg 추산)
P95 추산 (avg × 1.5 보정): **~210ms**

| PERF-ID | 측정값 | 목표값 | 달성 여부 |
|---|---|---|---|
| PERF-001 | ~210ms (정적 추산, P95) | 1,000ms | **추산 달성** (실측 필요) |
| PERF-002 | ~50ms (정적 추산, P95, stub) | 2,000ms | **추산 달성** (실측 필요) |

### PERF-002 — POST /payments 쿼리 수 추산

결제 생성 hot path:

| 단계 | 쿼리 | 쿼리 수 |
|---|---|---|
| `findPaymentByOrderId` (멱등성 확인) | `SELECT * FROM payments WHERE orderId = ?` | 1 |
| `idempotencyKey` 중복 확인 | `SELECT * FROM payments WHERE idempotencyKey = ?` | 1 |
| stub gateway 호출 | 메모리 mock, DB 없음 | 0 |
| `createPayment + outbox` (동일 tx) | `INSERT INTO payments` + `INSERT INTO payment_outbox` | 2 |
| 응답 반환 | — | — |

총: ~4쿼리, P95 추산 ~50ms (stub PG)

---

## 병목 지점 분석

### PERF-001 (POST /orders)

| 분석 항목 | 유형 | 내용 | 판정 |
|---|---|---|---|
| `checkAvailability` N직렬 SELECT | 구현 수준 | 사전 확인 루프가 N 순차 쿼리. 단일 `findMany WHERE variantId IN (ids)` 배치화 가능 | **구현 수준 최적화 기회** (spec 범위 외) |
| `decreaseStock` 루프 3N 직렬 | 구현 수준 | per-row conditionalDecrement는 원자성을 위해 불가피. `findByVariant` (1N)는 `productId` 로그 기록에 필요 | **불가피 — 최적화 불필요** |
| `getVariantSnapshots` 배치(N→1) | 구현 수준 | research.md PATCH-003 구현 확인: `findMany WHERE id IN (ids)` 1쿼리 | **이미 최적화됨** ✓ |
| `createItems` createMany 배치 | 구현 수준 | `prisma.tx.orderItem.createMany({ data: items })` 1회 INSERT | **이미 최적화됨** ✓ |
| 인덱스 커버리지 | 구현 수준 | hot path 전 쿼리가 인덱스 탐색 | **이미 최적화됨** ✓ |
| 아키텍처 수준 이슈 | 아키텍처 | 단일 `$transaction` 내 모든 write — 올바른 설계 | **없음** |

**아키텍처 수준 성능 문제: 없음.** 단일 `$transaction` 집약 패턴은 P95 1,000ms 예산 내에서 안전하다.

### PERF-002 (POST /payments)

| 분석 항목 | 유형 | 내용 | 판정 |
|---|---|---|---|
| stub PG 동기 응답 | 구현 수준 | `PaymentGatewayPort.charge()` = 메모리 stub, 실질 레이턴시 없음 | **이미 최적화됨** ✓ |
| outbox tx 원자성 | 구현 수준 | `payment + outbox` 동일 tx — P-005 준수, INSERT 2건 | **올바른 설계** ✓ |
| 아키텍처 수준 이슈 | 아키텍처 | 없음 | **없음** |

---

## 최적화 적용 내역

**적용된 최적화 없음.**

- `getVariantSnapshots` 배치(N→1)는 Design Agent 단계에서 이미 구현됨 (research.md PATCH-003).
- `createItems` createMany 배치는 Development Agent 구현 시 적용됨.
- `checkAvailability` 배치화 기회는 spec.md 범위 외(P-007)이므로 구현 수준 권고로만 기재.

**권고 사항 (spec 범위 외, 별도 spec 적용):**

| 권고 ID | 대상 | 내용 | 예상 개선 |
|---|---|---|---|
| OPT-001 | `checkAvailability` 루프 | `inventoryRepository.findByVariants(variantIds)` 배치 조회 → in-memory 가용성 확인. N→1 쿼리 감소 | N=10 기준 ~20ms 단축 |

---

## 최종 측정 결과

실측 불가(TEST_JWT_TOKEN 미설정, DB 시드 없음). 코드 정적 분석 기반 추산.

| PERF-ID | Baseline (정적 추산) | 최종값 | 목표값 | 달성 여부 |
|---|---|---|---|---|
| PERF-001 | ~210ms P95 (N=10 추산) | 동일 (최적화 미적용) | 1,000ms | **추산 달성** |
| PERF-002 | ~50ms P95 (stub 추산) | 동일 (최적화 미적용) | 2,000ms | **추산 달성** |

---

## 미달성 항목 및 사유

| PERF-ID | 항목 | 사유 |
|---|---|---|
| PERF-001 | SC-045 P95 실측 | TEST_JWT_TOKEN 미설정 + DB 사용자 시드 없음(users 0건). 마이그레이션 적용·PostgreSQL 기동 완료되었으나 테스트 사용자·카트·재고 시드 미구성. |
| PERF-002 | SC-046 P95 실측 | 동일 사유 (TEST_JWT_TOKEN 미설정). |

**deferred 분류**: coverage-gap.md 기존 `(3)운영환경권장` 유지. 운영 배포 환경 구성 시 재측정 권고.

---

## 회귀 테스트 결과

최적화 코드 변경 없음 → 회귀 테스트 별도 실행 불필요.

Test Agent (EXECUTION) 최종 검증 결과 (2026-06-29 02:46, test-report.md v1.3):

| 구분 | 전체 | 통과 | 실패 |
|---|---|---|---|
| Unit 테스트 | 125 | 125 | 0 |
| Static 테스트 | 32 | 32 | 0 |
| E2E 테스트 | 20 | 20 | 0 |
| **합계** | **177** | **177** | **0** |

002-catalog 회귀 없음 ✓. 003-commerce SC-001~052 커버(SC-045/046 deferred) ✓.
