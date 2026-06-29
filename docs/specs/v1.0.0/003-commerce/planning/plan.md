---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 검토중
---

# Plan: 003-commerce

> Branch: 003-commerce | Date: 2026-06-28 | Spec: [../spec/spec.md](../spec/spec.md)

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [외부 라이브러리 동작 검증](#외부-라이브러리-동작-검증)
- [배포 환경 영향 (PROC-009)](#배포-환경-영향-proc-009)
- [위험 완화 설계 (가정 안전망) (PATCH-A06)](#위험-완화-설계-가정-안전망-patch-a06)
- [핵심 설계](#핵심-설계)
- [결정 기록 (ADRs)](#결정-기록-adrs)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> `constitution.md`(P-001~P-007) 존재 → 해당 조항을 Gates 로 사용한다(constitution 우선). spec.md NFR 이 constitution 보다 강화면 spec, 완화면 constitution 으로 상향. 본 spec NFR(NFR-001~008)은 P-001·P-002·P-003·P-005·P-006·P-007 을 하위 구체화하며 충돌 없음.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: cart(commerce)·order(orders)·payment(payments) Repository 가 자기 스키마 외 타 도메인 스키마 테이블을 직접 참조·쿼리·JOIN 하지 않음 — SC-050 정적 검증]
  → PASS. cross-schema 접근은 전부 공개 서비스 DI(`CartService`·`ProductService.getVariantSnapshot`·`InventoryService.checkAvailability/decreaseStock/restoreStock`·`PaymentService.refund`·`OrderService.markConfirmed`) 또는 outbox+pg-boss relay 로만. **단일 `$transaction` 이 여러 스키마(commerce·orders·payments·products)를 가로지르지만, 각 모듈 Repository 는 자기 스키마 모델에만 쿼리를 발행**하므로(공유되는 것은 tx 클라이언트일 뿐) P-001 위반 아님(ADR-001·002 참조). 4계층(controller·service·repository·events) 준수.
- [x] **P-002 AWS 의존 금지 원칙**: [Pass 기준: `@aws-sdk/*` 등 AWS 전용 패키지 신규 추가 0건 — SC-051 정적 검증]
  → PASS. 신규 의존은 `pg-boss`(PostgreSQL 기반 큐, P-003 권장) 1건뿐이며 AWS 전용 패키지 아님. 트랜잭션 전파는 Node 내장 `AsyncLocalStorage`(무의존). `@aws-sdk/*` 0건(NFR-007).
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 외부 저장소 0건]
  → PASS. 신규 7테이블을 기존 commerce·orders·payments 스키마에 추가. 비동기 잡·큐는 **pg-boss(동일 PostgreSQL 내 `pgboss` 스키마 자동 생성)** — constitution P-003 이 명시적으로 권장한 큐. 별도 Redis·브로커·DB 도입 0.
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: Fly.io 전용 API 에 비즈니스 로직 결합 0건]
  → PASS. 표준 Prisma + PostgreSQL + pg-boss 만. Fly 전용 SDK·API 미사용. PaymentGatewayPort 는 추상 인터페이스(플랫폼 중립).
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: outbox + 멱등성 키 + Decimal/정수, 부동소수점 0건 — SC-049/052 검증]
  → PASS (핵심 요구). (1) **outbox**: `payments.payment_outbox` 에 `payment.completed`·`payment.refunded` 를 결제/환불 상태 변경과 **동일 트랜잭션**으로 기록(FR-033/037, SC-036/040/052). (2) **멱등성 키**: 결제 `Idempotency-Key`(클라이언트 UUID v4, `payments.idempotencyKey @unique`, FR-031/035), 환불 server-generated orderId 기반 키(`refunds.idempotencyKey @unique`, FR-021/038). (3) **Decimal**: `totalAmount·discountAmount·amount·unitPrice` 전부 Prisma `Decimal`(NFR-005, SC-049). float 0건.
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건]
  → PASS. FR-001~051·NFR-001~008 전부 SC 매핑 존재(spec.md 매트릭스 역방향 검증 완료). 매핑 누락 0건.
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건]
  → PASS. 변경 범위 = cart·order·payment 3개 스텁 실구현 + inventory 모듈(SEC-002 FR-050/051·restoreStock FR-023·tx-aware retrofit) + product 모듈(`getVariantSnapshot` 공개 메서드 1건 additive) + shared `PrismaService`(트랜잭션 전파 인프라) + pg-boss 부트스트랩. **각 cross-cutting 변경은 특정 FR 로 추적 가능**(아래 "스코프 추적" 표). spec.md 범위 외 리팩토링·기능추가 0.

**스코프 추적 (P-007 — cross-cutting 변경의 FR 근거)**:

| 변경 대상 | 변경 성격 | 근거 FR/NFR | 비파괴성 |
|---|---|---|---|
| `shared/prisma/prisma.service.ts` | ALS tx-aware 확장(`runInTransaction`·`tx`·`onAfterCommit`) | FR-013·022·033·037, NFR-008 | additive — 기존 직접 `prisma.x` 호출 동작 불변(ALS 미활성 시 root client 반환) |
| `modules/inventory/inventory.repository.ts` | 쿼리 클라이언트를 `this.prisma.tx` 로 교체 | FR-013·023 | behavior-preserving(tx 미활성 시 root) |
| `modules/inventory/inventory.service.ts` | `restoreStock` 추가, emit 을 after-commit hook 으로 | FR-023 | 기존 `decreaseStock` 시그니처 불변 |
| schema enum `InventoryLogType` | `RESTORE` 값 추가 | FR-023 | additive enum |
| `modules/inventory/inventory.controller.ts` | stockIn/getStock 소유권 검증 추가(SEC-002) | FR-050·051 | 동작 변경(403 추가) — spec 의도된 보정 |
| `modules/product/product.service.ts` | `getVariantSnapshot(s)`·`assertSellerOwnsVariant` 공개 메서드 | FR-010·016·017·024·050·051 | additive |

예외 사항: 없음.

> **Gates 판정**: P-001~P-007 전부 통과(예외 0). Design Agent(3단계) 진입 가능.

---

## 기술 컨텍스트

> 001/002 의 확정 스택을 그대로 재확정한다(자명한 답습). 003 고유의 신규 결정만 명시.

- **언어 / 런타임**: TypeScript 5.4 / Node.js 20.x. pnpm + Turborepo.
- **백엔드 프레임워크**: NestJS 11.x.
- **ORM / DB**: Prisma `^6.19.0` multiSchema + PostgreSQL 16. 로컬 Docker Compose.
- **인증**: 기존 `shared/auth` 재사용 — `JwtAuthGuard`·`@CurrentUser()`·`AuthenticatedUser`. 003 신규 가드 없음(소유권 검증은 service 레이어).
- **트랜잭션 전파(003 신규 인프라)**: `PrismaService` 를 Node 내장 `AsyncLocalStorage<Prisma.TransactionClient>` 기반으로 확장(ADR-001). `runInTransaction(fn)` 으로 cross-schema 단일 `$transaction` 을 열고, 모든 repository 가 ALS-aware getter `this.prisma.tx`(활성 tx 없으면 root client) 로 쿼리를 발행하여 동일 트랜잭션에 참여한다. **신규 npm 의존 없음**(Node 표준 라이브러리). 002 plan.md 인터페이스 계약이 003 으로 위임한 "CLS/AsyncLocalStorage 기반 트랜잭션 공유"의 확정안.
- **비동기 잡·큐(003 신규 의존)**: `pg-boss`(PostgreSQL 기반, constitution P-003 권장). outbox relay 폴링 + 7일 자동 구매확정 스케줄. 백엔드 프로세스 내 in-process 부트스트랩(`PgBossModule`). 전용 worker 프로세스 분리는 후속 인프라 단계(modular monolith 단일 배포 원칙 유지).
- **결제 게이트웨이**: `PaymentGatewayPort` 추상 인터페이스 + `StubPaymentGateway` 구현(FR-032). 실 PG 는 후속 spec.
- **입력 검증**: `class-validator` + 전역 `ValidationPipe`. `Idempotency-Key` 헤더 UUID v4 형식 검증(FR-031).
- **금전 타입**: Prisma `Decimal`(`@db.Decimal(12,2)`) — totalAmount·discountAmount·amount·unitPrice(NFR-005, P-005).
- **테스트 프레임워크**: Jest(`*.spec.ts`, src rootDir) + supertest. 단위([env:unit]) 위주, 정적([env:static]), 통합([env:integration] — SC-045/046 P95).
- **환경변수**: 기존 `DATABASE_URL`·`JWT_*` 재사용. pg-boss 는 동일 `DATABASE_URL` 사용(신규 env 없음). 결제는 stub 이므로 PG 키 불필요.
- **신규 의존성**: `pg-boss` 1건(비-AWS, P-003 권장). PATCH-A15 자가 점검 → selection-phases.md 참조.

---

## 외부 라이브러리 동작 검증

> 코드베이스 실재(001·002 완료, 002 검증 101 PASS). 핵심 가정은 Prisma/NestJS/Node 공식 동작 + 실 코드 인용 기준으로 정리. pg-boss 정확한 핀 버전·API 시그니처는 Design Agent research.md 에서 venv/공식 문서로 최종 확정(불일치 시 BLOCKED 보고).

| 가정 | 정리(근거) | 인정되는 한계 (PATCH-A07) | 안전망 |
|---|---|---|---|
| Prisma interactive `$transaction(async (tx) => …)` 가 **여러 스키마에 걸친 쓰기를 단일 트랜잭션으로 commit/rollback** | 동일 DB 커넥션·단일 BEGIN/COMMIT. multiSchema 는 같은 PostgreSQL 인스턴스이므로 cross-schema 쓰기도 1 트랜잭션. tx 클라이언트로 발행한 모든 쿼리가 원자적. | tx 내부에서 또 다른 `$transaction`(중첩 interactive)은 미지원 → 호출 그래프에서 중첩 진입 금지. | `runInTransaction` 이 ALS store 존재 시 재진입을 reuse 로 처리(중첩 BEGIN 방지, ADR-001). decreaseStock/restoreStock 은 내부에서 `$transaction` 을 열지 않음(updateMany+create 만). |
| **AsyncLocalStorage** 가 async/await 체인 전반에 store 를 전파 | Node 내장(stable, Node 16+). `als.run(store, fn)` 내부의 await 체인에서 `als.getStore()` 동일 store 반환. DI 서비스 호출도 동일 비동기 컨텍스트. | EventEmitter2 `@OnEvent` 동기 핸들러는 같은 호출스택이라 ALS 전파됨 → 의도치 않게 핸들러 쿼리가 tx 에 편입될 수 있음. | stock-changed 이벤트 emit 을 **트랜잭션 내부에서 호출하지 않고 after-commit hook 으로 지연**(ADR-005). 핸들러는 commit 후 root client 로 실행되어 tx 오염·롤백 위험 제거. |
| 002 `decreaseStock` 의 조건부 감소 `updateMany({where:{variantId,quantity:{gte}}, data:{decrement}})` 의 `count===0` 으로 재고부족 판정 | inventory.service.ts:73-90·inventory.repository.ts:36-41 실코드 확인. row-level 원자 연산. | 단일 호출만으로 멀티-variant 주문 전체 원자성은 미보장. `decreaseStock` 은 멱등하지 않음(같은 orderId 2회 → 2회 차감). | 003 이 `runInTransaction` 으로 전체 주문을 1 트랜잭션에 묶음(FR-013). 주문 단위 멱등성은 cart→order 1회 생성 흐름 + 결제 Idempotency-Key 로 방어(ADR-001·008). |
| `pg-boss` 가 동일 PostgreSQL 에 `pgboss` 스키마 자동 생성, `boss.schedule(cron)`·`boss.send`·`boss.work` API 제공 | pg-boss 공식 동작(PostgreSQL 큐). REBUILD-PLAN §8·context.md outbox 정의와 정합. | in-process 부트 시 앱 이벤트루프 공유 — 무거운 잡은 API 지연 유발 가능. pg-boss 정확한 메서드명·옵션은 버전별 차이 가능. | 잡은 경량(일 1회 auto-confirm·outbox 짧은 폴링)으로 한정. **정확한 핀 버전·API 는 Design research.md 에서 확정**(불일치 시 BLOCKED). outbox 행은 DB 에 영속 → relay 누락 시 다음 폴링에서 복구(at-least-once). |

가정-실제 불일치 현재 미발견. pg-boss API 는 Design 단계 1차 검증 필수(미검증 항목으로 명시).

---

## 배포 환경 영향 (PROC-009)

- 본 spec 검증 대상은 **로컬/dev(Docker Compose PostgreSQL)** 한정. 순수 비즈니스 로직 + 인-프로세스 큐(pg-boss)로 컨테이너 NAT·docker-proxy·L4 LB·firewall 네트워크 미들웨어 특이성의 영향을 받지 않는다.
- 운영 영향 2건: (1) **Prisma 마이그레이션의 Fly release 단계 실행**(7 신규 테이블 + enum 확장) — spec.md "사후 운영 검증 피드백 사이클" 에 명시, 로컬 `prisma migrate dev` 로 갈음. (2) **pg-boss 의 `pgboss` 스키마 자동 생성** — Fly Postgres 에서 앱 기동 시 1회 발생. DB 사용자에 스키마 생성 권한 필요(infra 확인 대상).
- infra.md 에 pg-boss/worker 운영 항목이 아직 없을 수 있음 → Design/Docs/Retrospective Agent 가 infra.md §연결실패 재시도·§배포 절차에 pg-boss 부트·`pgboss` 스키마 권한을 반영하도록 **gaps.md 후보**로 위임(3단계 이후 GAP 등록).

---

## 위험 완화 설계 (가정 안전망) (PATCH-A06)

> assumptions.md(존재 시) 의 "중간/높음 + defer/운영 검증" 가정 + 본 plan 의 미검증 항목에 대한 안전망.

| 위험 항목 | 부정 검증 시 영향 | 안전망 설계 | FR/SC 매핑 |
|---|---|---|---|
| pg-boss API/버전 가정 오류 | 자동 구매확정·outbox relay 미동작 | Design research.md 1차 venv 검증 의무. outbox 행 DB 영속(at-least-once) — relay 일시 실패해도 다음 폴링 복구. auto-confirm 로직은 SC-031 단위 테스트(날짜 mock)로 pg-boss 무관하게 검증. | FR-027·034 / SC-031·037 |
| after-commit hook 유실(커밋 후 프로세스 크래시 직전) | `inventory.stock-changed` 미발행 → 상품 status 자동 전이(OUT_OF_STOCK) 누락 | 002 self-healing 승계: 다음 재고 변경 이벤트가 최종 재고 기준 status 재수렴. 주문·재고 차감 자체는 이미 commit 되어 정합. | FR-013 / SC-012 |
| 결제 멱등성 race(동일 Idempotency-Key 동시 2요청) | 이중 결제·이중 outbox | `payments.idempotencyKey @unique` DB 제약이 최종 방어선. 두 번째 INSERT 가 unique 위반 → 기존 결제 조회 후 최초 결과 반환(FR-035). | FR-031·035 / SC-038 |
| 동시 주문 재고 경쟁(checkAvailability 통과 후 차감 시점 부족) | 음수 재고 | `decreaseStock` 조건부 원자 감소 `count===0` → InsufficientStockException → 트랜잭션 롤백 → 409(FR-012). checkAvailability 는 사전 UX 필터, 최종 guard 는 차감. | FR-011·012·013 / SC-011·012 |
| 환불 재시도(이미 refunded) | 이중 환불 | `refunds.idempotencyKey @unique`(orderId 기반) + PaymentService.refund 가 `payment.status===refunded` 이고 다른 key → 409(FR-038). 동일 key 재요청 → 최초 결과(멱등). | FR-021·038 / SC-024·041 |

모든 안전망이 FR/SC 에 매핑됨 → 누락 없음 → BLOCKED 불필요.

---

## 핵심 설계

> 작성 깊이: Design Agent 가 추가 설계 판단 없이 tasks.md 를 분해할 수 있는 수준. 변경 대상 모듈·인터페이스 시그니처·핵심 분기 로직 포함.

### 0. 모듈 간 통신 토폴로지 (P-001 / NFR-006 핵심)

```
[cart 모듈] commerce 스키마 (carts)
   │  ProductService.getVariantSnapshot(variantId)  (DI, commerce→products 회피, snapshot 획득)
   ▼
[product 모듈] products 스키마 (products, variants, ...)   ── 신규 공개: getVariantSnapshot(s), assertSellerOwnsVariant
   ▲
   │  ProductService.getVariantSnapshot(s) (주문시점 단가·sellerId)
   │  ProductService.assertSellerOwnsVariant(variantId, sellerId) (SEC-002)
[order 모듈] orders 스키마 (orders, order_items, order_events)
   │  CartService.removeItems(userId, variantIds)        (DI, 주문 성공 시 장바구니 제거)
   │  InventoryService.checkAvailability/decreaseStock/restoreStock  (DI, 재고)
   │  PaymentService.refund(paymentId, key)              (DI, 취소 시 환불 — 동기)
   ▲
   │  OrderService.markConfirmed(orderId)  ◀── [OutboxRelay] ◀── payment.completed (pg-boss)
[payment 모듈] payments 스키마 (payments, refunds, payment_outbox)
      PaymentGatewayPort(stub) DI / outbox 기록

[inventory 모듈] products 스키마 (inventory, inventory_logs)  ── 신규 공개: restoreStock; SEC-002 소유권 검증
[shared/prisma] PrismaService — ALS tx-aware (runInTransaction / tx / onAfterCommit)
[shared/pgboss] PgBossModule — OutboxRelay(payment.completed→order) + AutoConfirmJob(delivered+7d→completed)
```

**규약**:
- cross-schema 호출은 **절대 직접 Prisma 쿼리 금지**, 공개 서비스 DI 또는 outbox+pg-boss relay 로만(P-001, NFR-006).
- **순환 DI 회피**: order → payment(refund, 동기 DI). payment → order 는 **직접 DI 하지 않음** — `payment.completed` outbox → `OutboxRelay`(인프라) → `OrderService.markConfirmed`(DI). relay 가 order 를 의존하므로 payment↔order 직접 순환 없음(ADR-007).
- order → cart·product·inventory(DI 단방향). cart → product(DI 단방향). product·inventory·payment 는 order 를 DI 하지 않는다.

### 1. 트랜잭션 전파 인프라 (shared/prisma) — FR-013·022·033·037, NFR-008 (ADR-001)

```ts
// shared/prisma/prisma.service.ts (확장)
type TxClient = Prisma.TransactionClient;
interface TxContext { client: TxClient; afterCommit: Array<() => void | Promise<void>>; }

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly als = new AsyncLocalStorage<TxContext>();

  /** ALS-aware client: 활성 트랜잭션이 있으면 tx client, 없으면 root client */
  get tx(): TxClient { return this.als.getStore()?.client ?? (this as unknown as TxClient); }

  /** 커밋 직후(트랜잭션 외부)에 실행할 부수효과 등록. 트랜잭션 밖에서 호출 시 즉시 실행. */
  async onAfterCommit(cb: () => void | Promise<void>): Promise<void> {
    const ctx = this.als.getStore();
    if (ctx) ctx.afterCommit.push(cb); else await cb();
  }

  /** cross-schema 단일 트랜잭션. 재진입 시(이미 tx 안) 중첩 없이 reuse. */
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.als.getStore()) return fn();                 // 중첩 진입 reuse (중첩 BEGIN 금지)
    const hooks: TxContext['afterCommit'] = [];
    const result = await this.$transaction(async (client) =>
      this.als.run({ client, afterCommit: hooks }, () => fn()),
    );
    for (const cb of hooks) { try { await cb(); } catch { /* best-effort, self-healing */ } }
    return result;
  }
}
```

- **모든 repository(cart·order·payment·inventory)는 `this.prisma.tx` 로 쿼리 발행** → ALS 활성 시 동일 트랜잭션 참여, 비활성 시 root client(기존 동작 보존).
- decreaseStock/restoreStock/stockIn 의 `inventory.stock-changed` emit 은 `onAfterCommit` 으로 지연(tx 오염 방지, ADR-005).

### 2. cart 모듈 (commerce 스키마) — FR-001~005

변경 대상: `modules/cart/{cart.controller,cart.service,cart.repository}.ts` + `cart.module.ts` + dto.

| 엔드포인트 | 인증 | 동작 | FR/SC |
|---|---|---|---|
| `POST /cart/items` | JwtAuthGuard | `{variantId, quantity}` → ProductService.getVariantSnapshot 로 snapshot, 동일 variantId 존재 시 수량 합산 | FR-001 / SC-001·002 |
| `PATCH /cart/items/:variantId` | JwtAuthGuard | `{quantity}` 갱신. quantity=0 → 제거 | FR-002 / SC-003·004 |
| `DELETE /cart/items/:variantId` | JwtAuthGuard | 아이템 제거, 204 | FR-003 / SC-005 |
| `GET /cart` | JwtAuthGuard | 현재 items(빈 배열 가능) | FR-004 / SC-006 |

**핵심 분기 로직**:
- 장바구니 = `commerce.carts` 사용자당 1행(`userId @unique` plain String), `items` JSONB 배열 `[{variantId, productId, sellerId, quantity, unitPrice, optionName, optionValue, productTitle, sku, imageUrl?}]`(FR-005). 게스트 미지원.
- 추가(FR-001): 행 없으면 upsert 생성. snapshot 은 `ProductService.getVariantSnapshot(variantId)`(DI)로 채움. 동일 variantId 존재 → `quantity += n`(SC-002).
- 수량 변경(FR-002): quantity>0 갱신, quantity===0 → 해당 항목 제거(SC-004).
- JSONB 갱신은 `cart.repository` 가 `this.prisma.tx.cart.update` 로 처리. 비인증 → 401(SC-007, JwtAuthGuard). 사용자 격리는 userId 키로 보장(SC-008).
- **`removeItems(userId, variantIds: string[])`**: order 가 주문 성공 시 DI 호출(FR-014). tx-aware(주문 트랜잭션 참여).

### 3. order 모듈 (orders 스키마) — FR-010~028

변경 대상: `modules/order/{order.controller,order.service,order.repository,order.events}.ts` + `order.module.ts` + dto.

| 엔드포인트 | 인증 | 인가(소유권) | 동작 | FR/SC |
|---|---|---|---|---|
| `POST /orders` | JwtAuthGuard | userId 자동(조작불가) | 일부/전체 선택 주문 생성 | FR-010~017 / SC-009·010·012~016 |
| `GET /orders` | JwtAuthGuard | userId 필터 | 내 주문 최신순 cursor 페이지 | FR-018 / SC-017 |
| `GET /orders/:id` | JwtAuthGuard | order.userId===me | 내 주문 상세, 타인 403 | FR-019 / SC-018·019 |
| `DELETE /orders/:id` | JwtAuthGuard | order.userId===me | pending/confirmed 취소(+환불+재고복구), preparing+ → 400, 타인 403 | FR-020~023 / SC-020~025 |
| `GET /sellers/me/orders` | JwtAuthGuard | order_items.sellerId∋me | 내 상품 포함 주문 | FR-024 / SC-026 |
| `PATCH /orders/:id/confirm` | JwtAuthGuard | order_items.sellerId∋me | confirmed→preparing, 미포함 403 | FR-025 / SC-027·028 |
| `POST /orders/:id/complete` | JwtAuthGuard | order.userId===me | delivered→completed, 타인 403 | FR-026 / SC-029·030 |

**핵심 분기 로직**:
- **주문 생성(FR-010~017, SC-012 원자성)**:
  1. `items[{variantId,quantity}]` + `shippingAddress` 입력. `ProductService.getVariantSnapshot(variantIds)`(DI)로 주문시점 `{productId, sellerId, unitPrice, optionName, optionValue, productTitle, sku}` 획득(FR-016·017·024 의 sellerId·단가 출처 — cart 신뢰 대신 product 권위값).
  2. **사전 가용성**: 각 variant `InventoryService.checkAvailability(variantId, quantity)`(DI). 부족분 1건 이상 → **409 + 부족 variantId 목록**(FR-011·012, SC-011). 트랜잭션 진입 전.
  3. `prisma.runInTransaction(async () => { … })`(FR-013, SC-012):
     - 각 variant `InventoryService.decreaseStock(variantId, quantity, orderId)`(DI, tx 참여). race 로 `InsufficientStockException` → 트랜잭션 롤백 → 409.
     - `orders.orders` 생성: `status='pending'`(FR-015), `totalAmount=Σ(unitPrice×quantity)`(Decimal), `discountAmount=0`(FR-017), `shippingAddressSnapshot` JSONB(FR-016).
     - `orders.order_items` N행(variantId·productId·sellerId·quantity·unitPrice·optionName·optionValue·productTitle·sku).
     - `orders.order_events` append: `(orderId, fromStatus=null, toStatus='pending', actorType='CUSTOMER', actorId=userId)`(FR-028).
     - `CartService.removeItems(userId, 주문 variantIds)`(DI, tx 참여, FR-014, SC-013).
  4. orderId 가 decreaseStock 인자에 필요 → 주문 row 를 먼저 생성(id 확보) 후 차감, 또는 cuid 선생성. **권장: order id 를 `cuid()` 로 선생성 후 동일 id 로 decreaseStock·order·order_items 일관 사용**(ADR-009).
- **목록(FR-018)**: `where userId`, cursor=id, `orderBy:[{createdAt:desc},{id:desc}]`, `take=limit`. 응답 `{items:[{id,status,totalAmount,대표상품명,itemCount,createdAt}], nextCursor}`(spec-input Q12-1). ADR(002 ADR-007 승계).
- **상세(FR-019)**: `order.userId!==me` → 403(SC-019).
- **취소(FR-020~023, SC-020~025)**:
  - status∉{pending,confirmed} → 400(SC-022). `order.userId!==me` → 403(SC-023).
  - `runInTransaction`:
    - 결제 존재 & `payment.status==='completed'` → `PaymentService.refund(paymentId, idemKey=refund:${orderId})`(DI). 환불 성공해야 진행(FR-021). refund 내부에서 `payments.payment_outbox` `payment.refunded` + `payment.status='refunded'` 동일 tx 기록(FR-022·037).
    - 각 order_item `InventoryService.restoreStock(variantId, quantity, orderId)`(DI, FR-023, SC-025).
    - `order.status='cancelled'` + order_events append(actorType='CUSTOMER').
- **판매자 수주(FR-024)**: `order_items.sellerId` 에 내 sellerId(SellerService.getApprovedSeller 로 해석) 포함 주문만(SC-026).
- **판매자 확인(FR-025)**: 대상 주문 order_items 에 내 sellerId 없으면 403(SC-028). status `confirmed→preparing` + order_events(actorType='SELLER').
- **구매확정(FR-026)**: `order.userId!==me` → 403(SC-030). status `delivered→completed` + order_events(actorType='CUSTOMER').
- **자동 확정(FR-027)**: `AutoConfirmJob`(pg-boss schedule, 일 1회) → `deliveredAt <= now-7d && status='delivered'` 주문을 `completed` 전이 + order_events(actorType='SYSTEM'). 로직은 `OrderService.autoConfirmDelivered(now)` 로 분리하여 SC-031 단위 테스트(now mock).
- **markConfirmed(FR-034)**: `OutboxRelay` 가 `payment.completed` 처리 시 DI 호출 → `pending→confirmed` + order_events(actorType='SYSTEM' 또는 actorId=결제자). SC-037.

### 4. payment 모듈 (payments 스키마) — FR-030~038

변경 대상: `modules/payment/{payment.controller,payment.service,payment.repository}.ts` + `PaymentGatewayPort`·`StubPaymentGateway` + dto.

| 엔드포인트/메서드 | 인증/노출 | 인가 | 동작 | FR/SC |
|---|---|---|---|---|
| `POST /payments` | JwtAuthGuard | order.userId===me + pending | `{orderId}` + `Idempotency-Key`(UUID v4) 결제 | FR-030~036 / SC-033~039 |
| `refund(paymentId, idemKey)` | 공개 DI(order 가 호출) | — | 전액 환불 + outbox(payment.refunded) | FR-021·037·038 / SC-024·040·041 |

**핵심 분기 로직**:
- **결제(FR-030~036)**:
  - `Idempotency-Key` 헤더 없음/비-UUIDv4 → 400(FR-031, SC-035).
  - 소유권: `orderId → orders.userId`(OrderService DI 또는 order 소유 조회) ≠ me → 403(FR-030, SC-034). 주문 status≠pending → 거부.
  - **멱등성(FR-035, SC-038)**: `payments.findUnique(idempotencyKey)` 존재 → 최초 결과 그대로 반환(재처리 없음).
  - `runInTransaction`:
    - `PaymentGatewayPort.charge({orderId, amount, idempotencyKey})`(stub). 성공 → `payments` 생성 `status='completed'`, `pgTransactionId`. `payments.payment_outbox` `payment.completed` 기록(FR-033, SC-036). 동일 tx(NFR-008, SC-052).
    - 실패 → `payments` `status='failed'` 저장, 주문 pending 유지(FR-036, SC-039). outbox 미기록.
  - `payment.completed` → OutboxRelay → OrderService.markConfirmed(FR-034, SC-037).
- **환불(FR-021·037·038)**: `refund(paymentId, idemKey)`:
  - `refunds.findUnique(idempotencyKey)` 동일 key 존재 → 최초 결과 반환(멱등).
  - `payment.status==='refunded'` 이고 요청 key≠기존 refund key → **409**(FR-038, SC-041).
  - `runInTransaction`(order 취소 tx 에 참여): `PaymentGatewayPort.refund(...)` → `refunds` 생성 + `payment.status='refunded'` + `payment_outbox` `payment.refunded`(FR-037, SC-040).
- **`PaymentGatewayPort`**(FR-032, 어댑터): `charge(req): Promise<{success, pgTransactionId?, failureReason?}>` · `refund(req): Promise<{success, pgRefundId?}>`. `StubPaymentGateway` 가 기본 구현(성공 반환, 테스트 시 실패 주입 가능 — SC-039). DI 토큰 `PAYMENT_GATEWAY`.

### 5. inventory 모듈 (products 스키마) — FR-023·050·051 (SEC-002 + restoreStock)

변경 대상: `modules/inventory/{inventory.controller,inventory.service,inventory.repository}.ts` + enum.

- **SEC-002 소유권 검증(FR-050·051, SC-042~044)**: `InventoryController.stockIn`·`getStock` 에서 `await this.sellerService.getApprovedSeller(user.userId)` 로 sellerId 획득 후 **`await this.productService.assertSellerOwnsVariant(variantId, seller.id)`**(신규 ProductService 공개 메서드, DI) 호출. variantId→Variant.productId→Product.sellerId≠요청 sellerId → 403. inventory 가 products.products/variants 를 직접 쿼리하지 않고 ProductService DI 로 검증(P-001 — 단, inventory·product 동일 products 스키마이나 모듈 책임 분리상 DI 사용, 002 ADR-006 패턴 승계).
- **restoreStock(FR-023, SC-025)**: `restoreStock(variantId, quantity, orderId): Promise<void>` — `this.prisma.tx` 로 `inventory.increment(variantId, quantity)` + `appendLog(type=RESTORE, delta=+quantity, orderId)` + `onAfterCommit(()=>emitStockChanged(productId))`. tx-aware(order 취소 tx 참여).
- **enum 확장**: `InventoryLogType` 에 `RESTORE` 추가(additive).
- **tx-aware retrofit**: `inventory.repository` 의 `findByVariant·increment·conditionalDecrement·sumQuantityByProduct·appendLog` 이 `this.prisma.tx` 사용. `decreaseStock`/`stockIn` 의 emit 도 `onAfterCommit` 으로 이동(ADR-005).

### 6. product 모듈 (products 스키마) — 신규 공개 메서드 (additive)

- **`getVariantSnapshot(variantId)`** / **`getVariantSnapshots(variantIds: string[])`**: variant + product join(동일 스키마) → `{variantId, productId, sellerId, unitPrice(Decimal), optionName, optionValue, productTitle, sku, imageUrl?}`. cart 추가·order 생성이 소비(FR-001·010·016·017·024). 미존재 variant → 404/예외.
- **`assertSellerOwnsVariant(variantId, sellerId)`**: variantId→productId→product.sellerId≠sellerId → ForbiddenException(403). inventory SEC-002 가 소비(FR-050·051).

### 7. pg-boss 부트스트랩 (shared/pgboss) — FR-027·034

- `PgBossModule`: 앱 부트 시 pg-boss 시작(`new PgBoss(DATABASE_URL)` → `boss.start()`).
- **OutboxRelay**: `payment_outbox` 의 `pending` 행을 폴링(또는 pg-boss work 큐) → `payment.completed` → `OrderService.markConfirmed(orderId)` → 행 `processed`. at-least-once(멱등: order 이미 confirmed 면 no-op).
- **AutoConfirmJob**: `boss.schedule('order-auto-confirm', cron 일1회)` → `OrderService.autoConfirmDelivered(now)`.

---

## 결정 기록 (ADRs)

> spec.md 매트릭스의 FR/NFR 를 plan 결정에 매핑. 자명한 답습(NestJS·Prisma·JWT — 001/002 ADR 승계)은 생략. Design Agent research.md "기술 선택 조사" 절과 cross-reference. 미작성 결정이 design 단계에 발견되면 BLOCKED → Planning 복귀.

| ADR-ID | 결정 항목 | 채택안 | 대안(검토했으나 채택 안 함) | 근거(spec FR/NFR) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | cross-schema 단일 트랜잭션 전파 | `PrismaService` 를 Node 내장 `AsyncLocalStorage` 기반 tx-aware 로 확장(`runInTransaction`/`tx`/`onAfterCommit`). 002 `decreaseStock` 고정 시그니처(tx 파라미터 없음) 불변 | (a) decreaseStock 에 tx 파라미터 추가(002 계약 파괴) (b) `nestjs-cls`/`@nestjs-cls/transactional` 라이브러리(신규 의존) (c) 각 모듈 자체 $transaction(원자성 불가) | FR-013·022·033·037, NFR-008, P-005 | shared/prisma, 전 모듈 repository |
| ADR-002 | cross-schema 단일 tx 의 P-001 적합성 | 각 repository 가 자기 스키마 모델에만 쿼리 발행(공유는 tx 클라이언트뿐) → P-001 위반 아님으로 판정 | 모듈별 분리 tx + saga(분산 복잡도, 단일 DB 이점 상실) | P-001, NFR-006, FR-013 | 설계 원칙 |
| ADR-003 | 주문 항목 sellerId·단가 출처 | `ProductService.getVariantSnapshot(s)` 공개 DI 로 **주문 시점 권위 snapshot** 획득. cart JSONB 는 표시용 | cart 저장 unitPrice/sellerId 신뢰(stale·sellerId 부재) / order 가 products 직접 쿼리(P-001 위반) | FR-016·017·024, P-001 | product.service(공개), order.service, cart.service |
| ADR-004 | restoreStock 신규 인터페이스 | `InventoryService.restoreStock(variantId,quantity,orderId)` 추가 + `InventoryLogType.RESTORE` enum | STOCK_IN 재사용(의미 모호) / 외부 보정 | FR-023, SC-025 | inventory.service/repository, schema enum |
| ADR-005 | tx 내 stock-changed 이벤트 처리 | emit 을 `onAfterCommit` 으로 지연 → 커밋 후 root client 실행(tx 오염·롤백 위험 제거) | tx 내부 동기 emit(핸들러 쿼리가 tx 편입·실패 시 주문 롤백) | FR-013, P-001(이벤트 best-effort) | inventory.service, prisma.service |
| ADR-006 | 결제 멱등성 | 클라이언트 `Idempotency-Key`(UUID v4 헤더) + `payments.idempotencyKey @unique`. 존재 시 최초 결과 반환, unique 위반=최종 race guard | 서버 생성 키 / 멱등성 미적용 | FR-031·035, P-005, SC-035·038 | payment.controller/service, schema |
| ADR-007 | payment→order 비순환 전이 | `payment.completed` outbox → `OutboxRelay`(인프라) → `OrderService.markConfirmed`. payment 가 order 를 직접 DI 안 함 | payment→OrderService 직접 DI(order↔payment 순환) | FR-033·034, P-001, SC-037 | shared/pgboss, payment, order |
| ADR-008 | 환불 멱등성·범위 | order 취소 흐름 내부 `PaymentService.refund(paymentId, key=refund:${orderId})`. 전액 환불만. 동일 key 멱등, 다른 key+refunded → 409 | 독립 `POST /payments/:id/refund` 공개 엔드포인트 / 부분 환불(범위 외) | FR-021·038, SC-024·041 | order.service, payment.service, schema(refunds) |
| ADR-009 | orderId 선생성 | order id 를 `cuid()` 로 선생성 후 decreaseStock·order·order_items·order_events 에 동일 id 사용(트랜잭션 내 FK 일관) | order insert 후 id 회수 → 재차 차감(왕복 증가) | FR-013, SC-012 | order.service |
| ADR-010 | PaymentGatewayPort 어댑터 | 추상 `PaymentGatewayPort`(charge/refund) + `StubPaymentGateway` 기본 구현, DI 토큰 `PAYMENT_GATEWAY` | 실 PG 직접 결합(후속 spec) / 인터페이스 없이 stub 하드코딩 | FR-032·036, P-004, SC-039 | payment.module/service |
| ADR-011 | pg-boss in-process 부트 | 백엔드 프로세스 내 `PgBossModule` 부트(단일 배포 단위). worker 분리는 후속 인프라 | 별도 worker 프로세스 즉시 분리(배포 복잡도 조기 증가) | FR-027·034, P-003, REBUILD §8 | shared/pgboss |

> **PATCH-003 (NFR 성능 직결 파라미터)**: NFR-001(POST /orders P95 1,000ms)에 직접 영향하는 파라미터 = 주문 트랜잭션 내 라운드트립 수(N variant × (snapshot + checkAvailability + decreaseStock) + order/items/events insert + cart update). **권장 기본값**: variant snapshot 과 checkAvailability 를 **배치 조회**(getVariantSnapshots(variantIds), 단일 쿼리)로 N→1 축소, decreaseStock 은 항목별 원자 감소 유지. 아이템 ≤10(NFR-001 측정 조건) + 로컬 docker-compose 에서 배치화 시 P95 1,000ms 상한 위반 없음(상한값이 NFR 위반 안 함). 범위 제시형(bcrypt cost 류) 파라미터는 본 spec 에 없음.

---

## 인터페이스 계약

### 권한 부여·상태 전이 엔드포인트 인가 3축 (PATCH-001 / PROC-003)

> 권한 부여·승인·상태 전이 엔드포인트마다 (a) 호출자 신원 (b) 대상 자원 소유권 (c) 역할 검증 여부 명시. Security 단계 비활성이어도 본 표가 최소 방어선(본 spec 은 Security=Y).

| 엔드포인트 | (a) 호출자 신원(인증) | (b) 대상 자원 소유권 | (c) 역할 | 미검증 축 위험·후속 |
|---|---|---|---|---|
| `POST /orders` | JWT(JwtAuthGuard) | userId 서버 자동 적용(조작 불가) | buyer(암묵) | 없음 — 자가 자원 |
| `GET /orders/:id` | JWT | order.userId===me, 불일치 403 | — | 없음(SC-019) |
| `DELETE /orders/:id` | JWT | order.userId===me, 불일치 403 | — | 없음(SC-023) |
| `POST /orders/:id/complete` | JWT | order.userId===me, 불일치 403 | — | 없음(SC-030) |
| `PATCH /orders/:id/confirm` | JWT | order_items.sellerId ∋ me(getApprovedSeller), 미포함 403 | seller(APPROVED) | 다수 판매자 주문 지원. 자가 자원 아닌 타 sellerId 항목은 전이 불가(SC-028) |
| `GET /sellers/me/orders` | JWT | order_items.sellerId ∋ me 필터 | seller(APPROVED) | 없음(SC-026) |
| `POST /payments` | JWT | order.userId===me + status=pending, 불일치 403 | buyer | **위험 최고(IDOR)** — orderId→userId 검증으로 타인 주문 결제 차단(SC-034) |
| `refund`(order 취소 내부) | order 소유권으로 간접 보증(DELETE /orders/:id) | paymentId→order→userId | buyer | 독립 refund 엔드포인트 미노출 → 외부 IDOR 표면 없음 |
| `POST /inventory/:variantId/stock-in` | JWT | **(SEC-002)** variantId→product→seller.id===me, 불일치 403 | seller(APPROVED) | FR-050 보정(SC-042). 미검증 시 IDOR 재고 조작 |
| `GET /inventory/:variantId/stock` | JWT | **(SEC-002)** 동일 소유권 검증, 불일치 403 | seller(APPROVED) | FR-051 보정(SC-044) |

> **자가 조작(self-approval) 위험**: 본 spec 엔드포인트에 "자기 자신에게 권한 부여" 유형 없음. 최고 위험은 `POST /payments` 의 타인 주문 결제 IDOR → (b)축 orderId→userId 검증으로 차단.

### 003 이 소비하는 002 공개 인터페이스 (DI)

```ts
// modules/inventory/inventory.service.ts (002 실재 + 003 추가)
class InventoryService {
  checkAvailability(variantId: string, quantity: number): Promise<boolean>;          // 002, 부수효과 없음
  decreaseStock(variantId: string, quantity: number, orderId: string): Promise<void>; // 002, tx-aware retrofit(시그니처 불변)
  restoreStock(variantId: string, quantity: number, orderId: string): Promise<void>;  // 003 신규(FR-023)
}
// modules/product/product.service.ts (003 추가 공개 메서드)
class ProductService {
  getVariantSnapshot(variantId: string): Promise<VariantSnapshot>;
  getVariantSnapshots(variantIds: string[]): Promise<Map<string, VariantSnapshot>>;
  assertSellerOwnsVariant(variantId: string, sellerId: string): Promise<void>;        // SEC-002
}
type VariantSnapshot = { variantId; productId; sellerId; unitPrice: Prisma.Decimal;
  optionName; optionValue; productTitle; sku; imageUrl?: string };
// modules/seller/seller.service.ts (002 실재)
class SellerService { getApprovedSeller(userId: string): Promise<{ id: string; userId: string }>; }
```

### 003 내부 공개 인터페이스 (모듈 간 DI)

```ts
class CartService   { removeItems(userId: string, variantIds: string[]): Promise<void>; } // tx-aware
class PaymentService{ refund(paymentId: string, idempotencyKey: string): Promise<RefundResult>; } // tx-aware, 409 가드
class OrderService  {
  markConfirmed(orderId: string): Promise<void>;          // OutboxRelay 호출(FR-034)
  autoConfirmDelivered(now: Date): Promise<number>;       // AutoConfirmJob 호출(FR-027), 반환=전이 건수
}
// 결제 게이트웨이 (DI 토큰 PAYMENT_GATEWAY)
interface PaymentGatewayPort {
  charge(req: { orderId; amount: Prisma.Decimal; idempotencyKey }): Promise<{ success; pgTransactionId?; failureReason? }>;
  refund(req: { paymentId; amount: Prisma.Decimal; idempotencyKey }): Promise<{ success; pgRefundId? }>;
}
```

### 트랜잭션 경계 계약 (QualityGate 핵심 — 003 원자성)

- **주문 생성**(FR-013): `prisma.runInTransaction` 안에서 `decreaseStock×N` → order/order_items/order_events insert → `cart.removeItems`. 어느 한 단계 실패 → 전체 롤백(SC-012). decreaseStock 의 InsufficientStockException → 409.
- **주문 취소+환불**(FR-021·022·023): `runInTransaction` 안에서 `PaymentService.refund`(→ refunds + payment.status=refunded + payment_outbox payment.refunded) → `restoreStock×N` → order.status=cancelled + order_events. 환불 실패 → 전체 롤백, 취소 미반영(SC-024).
- **결제**(FR-033, NFR-008): `runInTransaction` 안에서 payments insert(completed) + payment_outbox(payment.completed). outbox 기록 실패 → payment 롤백(SC-052).
- **전파 메커니즘**: 모든 repository 가 `this.prisma.tx` 사용 → ALS 활성 트랜잭션 자동 참여. decreaseStock/restoreStock 의 stock-changed emit 은 `onAfterCommit` 지연.

### 하위 호환성 / 방어 코드

- 002 `decreaseStock` **시그니처 불변** → 기존 002 테스트(101 PASS) 회귀 없음. repository 의 `this.prisma.tx` 는 ALS 미활성 시 root client 반환(기존 동작 보존).
- `InventoryLogType.RESTORE` 는 additive enum(기존 STOCK_IN/DECREASE/INIT 영향 없음).
- product 의 신규 공개 메서드는 additive(기존 product 엔드포인트·테스트 불변).
- SEC-002 검증 추가 → 002 의 SC-041/042(현 003 의 SC-043/044 회귀 대응)는 **소유자 판매자 픽스처로 마이그레이션** 필요(아래 "PROC-R03" 참조).

### PROC-R03 — SEC-002 로 인한 002 기존 테스트 영향

spec.md 선행 영향 추적·spec-input PROC-R03 식별: SEC-002 소유권 검증 추가로 002-catalog 의 stock-in/getStock 테스트가 임의 APPROVED 판매자로 타 variant 요청 시 200/201 → 403 으로 역전될 수 있다. **Design Agent 는 research.md §F 에서 002 의 inventory 관련 테스트 픽스처(stock-in·getStock 호출자=variant 소유자)를 전수 식별하고 마이그레이션을 본 spec tasks 에 포함**한다. 본 spec 의 SC-043(자기 variant stock-in 정상)·SC-042/044(타인 variant 403)가 회귀 기준.

---

## 데이터 모델

> 복잡도가 높아 상세 컬럼·타입·인덱스·제약·마이그레이션 순서는 **Database Design Agent**(selection-phases.md: Y)가 `data-model.md`/마이그레이션으로 확정한다. 본 절은 plan 수준 목표 구조·핵심 제약을 정의(DB Design 의 입력 contract).

### commerce 스키마 (신규 1테이블)

| 테이블 | 핵심 필드 | 제약·인덱스 | 모듈 |
|---|---|---|---|
| `commerce.carts` | `id`, `userId`(plain String), `items` JSONB `[{variantId,productId,sellerId,quantity,unitPrice,optionName,optionValue,productTitle,sku,imageUrl?}]`, `updatedAt` | `@@unique([userId])`(사용자당 1건, FR-005) | cart |

### orders 스키마 (신규 3테이블)

| 테이블 | 핵심 필드 | 제약·인덱스 | 모듈 |
|---|---|---|---|
| `orders.orders` | `id`(cuid 선생성), `userId`(plain), `status`(enum pending/confirmed/preparing/shipped/delivered/completed/cancelled, default pending), `totalAmount Decimal`, `discountAmount Decimal default 0`, `shippingAddressSnapshot` JSONB, `deliveredAt DateTime?`, `createdAt` | index(userId, createdAt desc, id desc) — FR-018/NFR-001 | order |
| `orders.order_items` | `id`, `orderId`(동일스키마 FK), `variantId`(plain), `productId`(plain), `sellerId`(plain), `quantity`, `unitPrice Decimal`, `optionName`, `optionValue`, `productTitle`, `sku` | index(orderId), index(sellerId) — FR-024 | order |
| `orders.order_events` | `id`, `orderId`(동일스키마 FK), `fromStatus String?`, `toStatus String`, `actorType`(enum CUSTOMER/SELLER/ADMIN/SYSTEM), `actorId String?`, `createdAt` | append-only(FR-028, UPDATE/DELETE 미사용), index(orderId, createdAt) | order |

### payments 스키마 (신규 3테이블)

| 테이블 | 핵심 필드 | 제약·인덱스 | 모듈 |
|---|---|---|---|
| `payments.payments` | `id`, `orderId`(plain, order당 1건), `userId`(plain), `amount Decimal`, `status`(enum pending/completed/failed/refunded), `idempotencyKey`(unique), `pgTransactionId String?`, `createdAt` | `@@unique([idempotencyKey])`(FR-035), `@@unique([orderId])`(order당 결제 1건), index(orderId) | payment |
| `payments.refunds` | `id`, `paymentId`(동일스키마 FK), `amount Decimal`, `idempotencyKey`(unique), `status`, `pgRefundId String?`, `createdAt` | `@@unique([idempotencyKey])`(FR-038) | payment |
| `payments.payment_outbox` | `id`, `eventType`(payment.completed/payment.refunded), `payload` JSONB(orderId 등), `status`(pending/processed), `createdAt`, `processedAt DateTime?` | index(status, createdAt) — relay 폴링 | payment |

### 스키마 enum 확장 (products)

| enum | 변경 | 근거 |
|---|---|---|
| `InventoryLogType` | `RESTORE` 값 추가(기존 STOCK_IN/DECREASE/INIT 유지) | FR-023 |

> **P-001/NFR-006 핵심**: `carts.userId`·`carts.items.*`·`orders.userId`·`order_items.variantId/productId/sellerId`·`payments.orderId/userId` 는 전부 cross-schema 경계 → **Prisma `@relation` 미선언 plain String**. 동일 스키마 내 FK(orders↔order_items↔order_events, payments↔refunds)만 정상 선언. enum status 값(원시 String 표현 vs Prisma enum)은 DB Design 이 확정.

---

## 테스트 전략

> 환경 태그: `[env:static]` 정적 / `[env:unit]` 단위(NestJS Testing + mock repository·서비스, 기동 불필요) / `[env:integration]` 앱 기동 + PostgreSQL. 대부분 SC 가 `[env:unit]`.

| SC | 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | unit | Happy | 장바구니 추가 | 인증 POST /cart/items {variantId,q:2} | 201 + GET /cart 에 항목 |
| SC-002 | unit | Edge | 동일 variant 수량 합산 | 재호출 {q:3} | 총 5 |
| SC-003 | unit | Happy | 수량 변경 | PATCH {q:5} | 수량 5 |
| SC-004 | unit | Edge | 수량 0 제거 | PATCH {q:0} | 항목 제거 |
| SC-005 | unit | Happy | 항목 제거 | DELETE /cart/items/:variantId | 204 |
| SC-006 | unit | Happy/Edge | 장바구니 조회(빈 배열 포함) | GET /cart | 목록 / [] |
| SC-007 | unit | Error | 비인증 접근 | 토큰 없음 | 401 |
| SC-008 | unit | Edge | 사용자 격리 | 두 사용자 각 추가 | 상호 불가시 |
| SC-009 | unit | Happy | 주문 생성 | POST /orders {items,shippingAddress} | 201 주문 |
| SC-010 | unit | Edge | 일부 선택 주문 | 장바구니 3 중 2 선택 | 2 항목 주문 |
| SC-011 | unit | Error | 재고 부족 409 | 부족 variant 포함 | 409 + 부족 variantId |
| SC-012 | unit | Error | 트랜잭션 원자성 | decreaseStock 실패 주입 | 주문 롤백(미생성) |
| SC-013 | unit | Happy | 주문 후 장바구니 제거 | 주문 성공 → GET /cart | 주문 항목 제거됨 |
| SC-014 | unit | Happy | 초기 상태 pending | 주문 직후 GET /orders/:id | status=pending |
| SC-015 | unit | Happy | 배송지 스냅샷 | 주문 레코드 | shippingAddressSnapshot JSONB 존재 |
| SC-016 | unit | Happy | 금액 계산 | 주문 레코드 | totalAmount=Σ(unitPrice×q), discountAmount=0 |
| SC-017 | unit | Happy | 주문 목록 cursor | GET /orders?limit=20 | 최신순 + nextCursor |
| SC-018 | unit | Happy | 내 주문 상세 | GET /orders/:id (본인) | 200 상세 |
| SC-019 | unit | Error | 타인 주문 상세 | GET /orders/:id (타인) | 403 |
| SC-020 | unit | Happy | pending 취소 | DELETE /orders/:id (pending) | 200 cancelled |
| SC-021 | unit | Happy | confirmed 취소 | DELETE (confirmed) | 200 cancelled |
| SC-022 | unit | Error | preparing 취소 차단 | DELETE (preparing) | 400 |
| SC-023 | unit | Error | 타인 주문 취소 | DELETE (타인) | 403 |
| SC-024 | unit | Happy | 취소+환불 트랜잭션 | completed 결제 주문 취소 | refunded + outbox + cancelled 동일 tx |
| SC-025 | unit | Happy | 재고 복구 | 취소 성공 | restoreStock 호출 확인 |
| SC-026 | unit | Happy | 판매자 수주 목록 | GET /sellers/me/orders | 내 sellerId 포함 주문만 |
| SC-027 | unit | Happy | 판매자 확인 전이 | PATCH confirm (confirmed) | preparing |
| SC-028 | unit | Error | 미포함 주문 확인 | PATCH confirm (타 판매자) | 403 |
| SC-029 | unit | Happy | 구매 확정 | POST complete (delivered, 본인) | completed |
| SC-030 | unit | Error | 타인 구매 확정 | POST complete (타인) | 403 |
| SC-031 | unit | Edge | 자동 확정 7일 | autoConfirmDelivered(now mock, delivered+7d) | completed 전이 |
| SC-032 | unit | Happy | 상태 전이 이벤트 | 각 전이 | order_events append 레코드 |
| SC-033 | unit | Happy | 결제 성공 | POST /payments {orderId}+Idempotency-Key | 201 결제 |
| SC-034 | unit | Error | 타인 주문 결제 | POST /payments (타인 orderId) | 403 |
| SC-035 | unit | Error | 멱등키 누락 | POST /payments(헤더 없음) | 400 |
| SC-036 | unit | Happy | 결제+outbox 원자성 | 결제 성공 | payments + payment.completed outbox 동일 tx |
| SC-037 | unit | Happy | confirmed 전이 | payment.completed relay 처리 | order pending→confirmed |
| SC-038 | unit | Edge | 멱등 재요청 | 동일 Idempotency-Key 재호출 | 최초 결과 반환(변경 없음) |
| SC-039 | unit | Error | 결제 실패 | stub 실패 주입 | payment.status=failed, order pending 유지 |
| SC-040 | unit | Happy | 환불+outbox 원자성 | 환불 성공 | payment.status=refunded + payment.refunded outbox 동일 tx |
| SC-041 | unit | Error | 이중 환불 다른 키 | refunded 결제에 다른 key | 409 |
| SC-042 | unit | Error | 타 variant stock-in | 판매자 A → B 소유 variant | 403 |
| SC-043 | unit | Happy | 자기 variant stock-in | 판매자 자기 variant | 재고 증가(기존 동작) |
| SC-044 | unit | Error | 타 variant 재고 조회 | 판매자 A → B 소유 variant | 403 |
| SC-045 | integration | Edge(성능) | POST /orders P95 | 아이템 ≤10 연속 호출 | P95 ≤ 1,000ms (NFR-001) |
| SC-046 | integration | Edge(성능) | POST /payments P95 | stub 연속 호출 | P95 ≤ 2,000ms (NFR-002) |
| SC-047 | unit | Error | 인증 필수 401 | 인증 endpoint 토큰 없음 | 401 |
| SC-048 | unit | Error | IDOR 종합 403 | 타인 order/payment 접근 | 403(SC-019/023/034/030 포함) |
| SC-049 | static | Happy | 금전 Decimal | schema.prisma | totalAmount/discountAmount/amount/unitPrice = Decimal, Float 0 |
| SC-050 | static | Happy | cross-schema 미참조 | cart/order/payment repository grep | 타 스키마 Prisma 모델 직접 참조 0 |
| SC-051 | static | Happy | AWS SDK 미추가 | package.json | `@aws-sdk/*` 신규 0 |
| SC-052 | unit | Error | outbox 실패 롤백 | outbox 기록 실패 주입 | payment 레코드 롤백 |

**Happy/Edge/Error 3유형 충족 점검**(모듈 단위):
- cart: Happy(SC-001/003/005/006) · Edge(SC-002 합산·SC-004 0제거·SC-006 빈배열·SC-008 격리) · Error(SC-007).
- order: Happy(SC-009/013/014/015/016/017/018/020/021/026/027/029/032) · Edge(SC-010 일부선택·SC-031 자동확정) · Error(SC-011/012/019/022/023/028/030).
- payment: Happy(SC-033/036/037/040) · Edge(SC-038 멱등) · Error(SC-034/035/039/041/052).
- SEC-002: Happy(SC-043) · Error(SC-042/044).
- 횡단: 정적(SC-049/050/051)·인증(SC-047)·IDOR(SC-048)·성능(SC-045/046).

### [env:integration] 검증 방식 결정 (PATCH-A08 / PROC-010)

본 spec 의 integration SC 는 **SC-045(POST /orders P95 1,000ms)·SC-046(POST /payments P95 2,000ms)** 2건(실 PostgreSQL + 시드 데이터 필요).

**확정: 옵션 A**(002 선례 승계 — main session 사용자 확정 대기) — main session 이 Docker Compose(PostgreSQL) 기동 + `prisma migrate dev` + seed(카테고리·상품·variant·재고·장바구니) + 앱 기동 + `POST /orders`·`POST /payments` 부하 측정 절차 제시 → 사용자 실행 → P95 결과 전달 → Test Agent(EXECUTION) 검증.
- 미채택: 옵션 B(사용자 전 과정 직접), 옵션 C(integration 스킵).
- `[env:unit]`/`[env:static]` SC(50건)는 옵션 A 무관하게 Test Agent 직접 실행·정적 검증.

**PROC-010 옵션 C 자가 점검**(옵션 C 미채택, 근거 기록):
1. 운영 환경 의존성: 결함 발견이 Fly.io 배포 토폴로지에 의존하는가? → **N**. 표준 로컬 Docker Compose PostgreSQL + in-process pg-boss 로 충분(순수 비즈니스 로직).
2. mock 불가 시나리오: 단위 mock 으로 시뮬레이션 불가능? → **Y(2건)**. 실 HTTP P95(SC-045/046)는 실 PostgreSQL·실 트랜잭션 필요. (단, outbox·자동확정·멱등 **로직**은 SC-031/036/037/038/052 단위 테스트로 pg-boss 런타임 없이 검증.)
3. 권장 재검토: #2 Y → 옵션 A/B 권장. **옵션 A 확정**.

### 사후 운영 검증 피드백 사이클 (PROC-014)

spec.md "범위 외 > 사후 운영 검증 피드백 사이클" 절에 명시됨(결제 중복·취소+환불·7일 자동확정). 본 plan 추가 점검 항목:
- (1) Fly release `prisma migrate deploy` 로 commerce·orders·payments 신규 7테이블 + RESTORE enum 생성 정상.
- (2) pg-boss 가 Fly Postgres 에 `pgboss` 스키마 자동 생성(DB 사용자 스키마 생성 권한).
- (3) OutboxRelay 가 실제 pg-boss 런타임에서 `payment.completed` → order confirmed 전이(단위 테스트 외 실런타임 1회).
- 결함 발견 시: spec.md 배경 절 또는 hotfix spec 입력 → main "spec 수정" → cycle N+1 재진입, 직전 cycle 산출물 `_ai-workspace/cycle-N-archive/` 백업.
- pg-boss 실런타임·자동확정 7일 경과 시나리오는 단위 테스트(now mock)로 로직 검증 + 운영 모니터링 보완(아래 기타 고려사항).

### smoke_tests (선택)

- 필요 여부: **Y**
- 대상 경로:
  - `apps/backend/src/modules/inventory/**/*.spec.ts` (002 재고 단위 테스트)
  - `apps/backend/src/modules/product/**/*.spec.ts` (002 상품 단위 테스트)
- 근거: 본 spec 이 (1) `inventory.repository` 를 tx-aware(`this.prisma.tx`)로 retrofit, (2) `InventoryService.restoreStock` + `InventoryLogType.RESTORE` 추가, (3) `InventoryController` 에 SEC-002 소유권 검증 추가, (4) `ProductService` 공개 메서드 추가, (5) `PrismaService` 확장한다. 002 의 inventory·product 단위 테스트(101 PASS 중 해당분)가 회귀 없이 green 유지됨을 SC 매핑 테스트와 함께 확인한다. SEC-002 로 인한 002 stock-in/getStock 테스트는 PROC-R03 마이그레이션 후 green(회귀 아님, 의도된 기대값 변경).

---

## 기타 고려사항

- **트랜잭션·동시성(P-001 §6 검토)**: (1) 주문 생성 `decreaseStock` 조건부 원자 감소로 동시 주문 음수 재고 불가(002 ADR-005). (2) cross-schema 단일 `$transaction`(ALS 전파)으로 주문/재고/장바구니/결제 outbox 원자성. tx 내 장시간 I/O(PaymentGatewayPort stub) — stub 은 즉시 반환, 실 PG 전환 시 외부 호출을 tx 밖으로 빼는 설계 재검토 필요(후속 spec 주의). (3) `payments.idempotencyKey @unique`·`refunds.idempotencyKey @unique` 가 멱등성 race 최종 guard. (4) `payment_outbox` at-least-once → relay/order 핸들러 멱등(이미 confirmed → no-op).
- **after-commit hook 한계(PATCH-A07)**: `onAfterCommit` 은 in-process best-effort. 커밋 후 프로세스 크래시로 hook 미실행 시 `inventory.stock-changed` 누락 → 상품 status 자동전이 지연. 안전망 = 002 self-healing(다음 재고 변경 시 재수렴) + 주문/재고 데이터는 이미 commit 되어 정합. 강한 일관성 필요해지면(후속) status 전이를 tx 내부로 이동 가능(동일 products 스키마라 비용 낮음).
- **pg-boss 운영 모니터링**: outbox `pending` 적체 수, 자동확정 잡 마지막 성공 시각을 운영 대시보드/알람으로 관측(Design/infra 반영). in-process 부트라 무거운 잡 추가 시 API 지연 모니터링.
- **상수화 원칙**: `AUTO_CONFIRM_DAYS=7`, `DEFAULT_PAGE_LIMIT`/`MAX_PAGE_LIMIT`(002 승계), outbox 폴링 주기 등을 모듈 상수/config 로(매직넘버 금지). 테스트(SC-031)도 동일 상수 참조.
- **개인정보 최소화(Q12/Q16)**: 주문/결제/배송지(recipientName·phone·zipCode·address)는 본인 접근만(소유권 검증). Security Agent 검토 대상.
- **gaps**: 현재 없음. 3단계 이후 설계 공백(DB Design 의 스키마 상세화 중 cross-schema 무결성·status enum 표현·pg-boss/`pgboss` 스키마 권한 infra 누락) 발견 시 gaps.md 에 GAP-XXX 기록. infra.md 에 pg-boss 부트·worker 운영 항목 부재 시 GAP 등록(Docs/Retrospective 가 infra 갱신 위임).
- **Database Design Agent 위임 사항**: commerce·orders·payments 신규 7테이블 + RESTORE enum + status enum 의 상세 컬럼 타입·인덱스·제약·plain String 경계·마이그레이션 순서를 `data-model.md` 로 확정(selection-phases.md: DB Design Y). 본 plan 의 데이터 모델 절이 입력 contract.
- **Security Agent 위임 사항**: 결제 멱등성·IDOR 3축(위 표)·SEC-002 소유권 검증·환불 중복 방지·개인정보 응답 범위 감사(selection-phases.md: Security Y).
