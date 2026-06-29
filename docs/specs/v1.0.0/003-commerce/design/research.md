---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-28 22:35
상태: 확정
---

# Research: 003-commerce

## 목차

- [기존 코드베이스 분석](#기존-코드베이스-분석)
- [영향 범위 분석](#영향-범위-분석)
- [외부 라이브러리 API 실제 동작 확인 (pg-boss)](#외부-라이브러리-api-실제-동작-확인-pg-boss)
- [트랜잭션 전파(AsyncLocalStorage) 동작 확인](#트랜잭션-전파asynclocalstorage-동작-확인)
- [Idempotency 동시성 분석](#idempotency-동시성-분석)
- [인정되는 한계 및 안전망 (PATCH-A07)](#인정되는-한계-및-안전망-patch-a07)
- [배포 환경 영향 추정 (PATCH-A10)](#배포-환경-영향-추정-patch-a10)
- [context.md 부정합 사전 점검 (PATCH-A11)](#contextmd-부정합-사전-점검-patch-a11)
- [§F production 시그니처 변경 / SEC-002 호출측 영향 (PROC-R03)](#f-production-시그니처-변경--sec-002-호출측-영향-proc-r03)
- [기술 선택 조사](#기술-선택-조사)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

> context.md 에 기술된 전체 구조는 중복 기술하지 않고 참조한다. 본 문서는 plan.md 의 기술 설계를 코드베이스 수준에서 검증·구체화한다.

---

## 기존 코드베이스 분석

### 클래스·모듈 계층 구조 (변경 대상 한정 — 분석 우선순위 게이트)

| 모듈/클래스 | 현재 상태 (실코드) | 003 변경 |
|---|---|---|
| `shared/prisma/PrismaService` | `PrismaClient` 확장, `onModuleInit($connect)`·`onModuleDestroy($disconnect)` 만. `@Global() PrismaModule` 로 전역 export. | ALS tx-aware 확장(`runInTransaction`/`get tx`/`onAfterCommit`). additive — 기존 멤버 불변 |
| `modules/cart/{controller,service,repository}` | **빈 스텁**(`@Controller('cart')` / `class CartService {}` / `class CartRepository {}`) | 실구현(FR-001~005, removeItems) |
| `modules/order/{controller,service,repository}` + `order.events` | **빈 스텁**(`@Controller('order')`) | 실구현(FR-010~028). 경로 `@Controller('orders')` 로 변경 + `@Controller('sellers')` 분리 필요 |
| `modules/payment/{controller,service,repository}` | **빈 스텁** | 실구현(FR-030~038) + PaymentGatewayPort/StubPaymentGateway |
| `modules/inventory/InventoryService` | `initStock`·`stockIn`·`getStock`·`checkAvailability`·`decreaseStock`(orderId 인자 보유)·`emitStockChanged`(private). EventEmitter2 DI. | `restoreStock` 추가, emit 을 `onAfterCommit` 지연 |
| `modules/inventory/InventoryRepository` | products 스키마(`inventory`·`inventoryLog`)만 접근. `findByVariant`·`createInventory`·`increment`·`conditionalDecrement`·`sumQuantityByProduct`·`appendLog`. | `this.prisma` → `this.prisma.tx` retrofit(behavior-preserving) |
| `modules/inventory/InventoryController` | `@UseGuards(JwtAuthGuard)`. stockIn/getStock — `sellerService.getApprovedSeller(user.userId)` 만(소유권 미검증). | SEC-002 소유권 검증 추가(FR-050/051) |
| `modules/product/ProductService` | `assertOwner(private)`·variant CRUD. SellerService·InventoryService·ProductRepository·EventEmitter2 DI. | `getVariantSnapshot(s)`·`assertSellerOwnsVariant` 공개 메서드(additive) |
| `modules/seller/SellerService` | `getApprovedSeller(userId): Promise<ApprovedSeller{id,userId}>` 실재. `SellerModule.exports=[SellerService]`. | 변경 없음(DI 소비만) |

**상속/인스턴스화**: 신규 추상은 `PaymentGatewayPort`(interface) 1건 — DI 토큰 `PAYMENT_GATEWAY`, `StubPaymentGateway` 가 `implements`. 추상 클래스 상속 트리 변경 없음.

### schema.prisma 현황 (실코드)

- `datasource db`: `provider=postgresql`, `schemas=["users","products","commerce","orders","payments","settlements","admin","files"]`. multiSchema GA(Prisma 6.7+, previewFeatures 불요).
- `commerce`·`orders`·`payments` 스키마는 **선언만 존재, 테이블 0** → 본 spec 이 신규 7테이블 + `InventoryLogType.RESTORE` enum 추가(Database Design Agent 가 `data-model.md`/마이그레이션 확정).
- `Variant{id,productId,optionName,optionValue,sku@unique,price Decimal(12,2),product@relation,inventory?}` — **title 없음**. `Product{id,sellerId(plain),categoryId,title,description?,price Decimal,status,...}`. `Inventory{variantId@unique,productId,quantity}`.
  - → `VariantSnapshot.productTitle` 은 **Product.title**, `sellerId` 는 **Product.sellerId**, `unitPrice` 는 **Variant.price**. `getVariantSnapshot` 은 variant+product join(동일 products 스키마, P-001 무위반).

### 테스트 레이아웃 (실측)

- 단위 테스트: `src/**/*.spec.ts` (jest `rootDir=src`, `testRegex=.*\.spec\.ts$`). 모듈 디렉토리 내 colocate.
- 정적 테스트: `test/static/*.spec.ts` (별도 위치 — e2e 설정 `test/jest-e2e.json`, `rootDir=.`, `testRegex=.*\.(spec|e2e-spec)\.ts$` 가 포함).
- e2e: `test/*.e2e-spec.ts`.
- 002 정적 테스트: `cross-schema.spec.ts`(SC-050 류, `this.prisma.{model}` 정규식)·`schema-decimal.spec.ts`·`inventory-log-append-only.spec.ts`·`inventory-service-signature.spec.ts`·`auth-required-guards.spec.ts`·`package-no-aws.spec.ts`.

---

## 영향 범위 분석

| 파일 | 변경 유형 | 영향 내용 | 비파괴성 |
|---|---|---|---|
| `shared/prisma/prisma.service.ts` | 수정 | ALS `runInTransaction`/`tx`/`onAfterCommit` 추가 | additive — ALS 미활성 시 root client(기존 동작 보존) |
| `shared/pgboss/*` (신규 디렉토리) | 신규 | `PgBossModule`·`OutboxRelay`·`AutoConfirmJob`·상수 | 신규 |
| `modules/cart/*` | 수정(스텁→실구현) | controller/service/repository/module/dto | 스텁이라 회귀 없음 |
| `modules/order/*` | 수정(스텁→실구현) | controller/service/repository/events/module/dto | 스텁이라 회귀 없음 |
| `modules/payment/*` | 수정(스텁→실구현) | + payment.gateway.port.ts·stub.payment.gateway.ts | 스텁이라 회귀 없음 |
| `modules/inventory/inventory.repository.ts` | 수정 | `this.prisma`→`this.prisma.tx` (6 메서드) | behavior-preserving |
| `modules/inventory/inventory.service.ts` | 수정 | `restoreStock` 추가, emit→`onAfterCommit` | decreaseStock 시그니처 불변 |
| `modules/inventory/inventory.controller.ts` | 수정 | SEC-002 소유권 검증(stockIn/getStock) | 동작 변경(403 추가) — 의도된 보정 |
| `modules/product/product.service.ts` | 수정 | `getVariantSnapshot(s)`·`assertSellerOwnsVariant` 공개 | additive |
| `modules/product/product.repository.ts` | 수정 | variant+product join 조회 메서드 추가 | additive |
| `modules/product/product.module.ts` | 수정 | `exports:[ProductService]` 추가(cart/order DI 소비) | additive |
| `modules/inventory/inventory.module.ts` | 수정 | `imports:[ProductModule]`(assertSellerOwnsVariant DI) — 순환 주의(아래) | additive |
| `apps/backend/src/app.module.ts` | 수정 | `PgBossModule` 등록 | additive |
| `apps/backend/package.json` | 수정 | `pg-boss@^10.4.2` 1건 추가 | 비-AWS(SC-051 무위반) |
| `prisma/schema.prisma` | 수정 | 7테이블 + RESTORE enum (DB Design 확정) | additive |

> **순환 DI 주의 (실측 필요)**: `ProductModule` 이 이미 `InventoryModule` 을 import(`product.module.ts` 확인). SEC-002 로 `InventoryController` 가 `ProductService.assertSellerOwnsVariant` 를 DI 하려면 `InventoryModule` 이 `ProductModule` 을 import → **모듈 순환**(`Product→Inventory→Product`) 발생. 회피: (a) `ProductService` 를 import 하지 않고, `ProductModule` 이 export 하는 좁은 provider 로 분리하거나, (b) `forwardRef`, (c) **권장**: SEC-002 소유권 검증을 `ProductService` 가 아닌 별도 경량 provider(예: `VariantOwnershipService` — products 스키마 variant+product 조회)로 두고 InventoryModule 만 그 provider 를 소비. tasks.md 는 (b) forwardRef 회피를 우선하되, NestJS 순환 경고 발생 시 (c) 로 전환하도록 태스크 완료 기준에 명시. (NestJS DI 순환은 빌드 시 즉시 표면화되므로 4단계에서 검출 가능.)

---

## 외부 라이브러리 API 실제 동작 확인 (pg-boss)

> **검증 방법**: npm registry(`registry.npmjs.org/pg-boss`) 전 버전 메타 + v10.4.2 tarball 의 `types.d.ts`·`README.md` 인용(2026-06-28 확인).

### 핀 버전 확정 (QualityGate 1차 검증 — 불일치 시 BLOCKED 판정)

| pg-boss major | `type` | `engines.node` | 본 프로젝트(Node>=20.0.0, CommonJS ts-jest) 호환 |
|---|---|---|---|
| v9.0.3 | commonjs | >=16 | 호환(구버전) |
| **v10.4.2** | **commonjs** | **>=20** | **✅ 호환 — 채택** |
| v11.1.2 | commonjs | >=22 | ✗ Node 22 요구 |
| v12.23.0 (latest) | **module(ESM)** | >=22.12.0 | ✗ ESM + Node 22.12 요구 |

- plan.md 가 Design 으로 위임한 "정확한 핀 버전" → **`pg-boss@^10.4.2`** 로 확정. 최신(v12)을 무비판 채택하면 ESM/Node22 비호환으로 빌드·런타임 실패.
- **BLOCKED 판정 불요**: plan 가정("`boss.schedule`·`boss.send`·`boss.work` API 제공, `pgboss` 스키마 자동 생성")이 v10 에서 **모두 CONFIRMED**. 호환 버전이 존재하므로 가정-실제 불일치(차단 사유) 아님. 핀만 v10 으로 구체화.

### v10.4.2 API 시그니처 (types.d.ts 인용)

```ts
declare class PgBoss extends EventEmitter {
  constructor(connectionString: string);            // line 261
  start(): Promise<PgBoss>;                          // line 293
  stop(options?): Promise<void>;                     // line 294
  createQueue(name: string, options?: Queue): Promise<void>;        // line 354
  send(name: string, data: object, options?: SendOptions): Promise<string|null>; // 296-298
  schedule(name: string, cron: string, data?: object, options?: ScheduleOptions): Promise<void>; // 370
  unschedule(name: string): Promise<void>;           // line 371
  // work: WorkHandler<ReqData> = (job: JobWithMetadata<ReqData>[]) => Promise<any>  // line 143 — 배열 수신
}
```

- **v10 신규 제약 (v9→v10 변경)**: `work`/`schedule`/`send` **이전에 반드시 `createQueue(name)` 호출**(README quick start line 18: `await boss.createQueue(queue)` → line 24: `await boss.work(queue, ...)`). → `PgBossModule.onModuleInit` 에서 큐 사전 생성 필수.
- **work 핸들러는 job 배열 수신**: `boss.work(name, async (jobs) => …)` 의 `jobs` 는 단건이 아닌 **배열**(`[job]`). OutboxRelay 핸들러는 `for (const job of jobs)` 또는 `const [job] = jobs` 로 처리.
- **AutoConfirmJob 은 pg-boss 무관 로직 분리**: `OrderService.autoConfirmDelivered(now: Date)` 로 비즈니스 로직을 분리 → SC-031 단위 테스트는 `now` mock 으로 pg-boss 런타임 없이 검증. pg-boss `schedule` 은 cron 트리거만 담당(thin wrapper).

### 가정 vs 실제 동작 비교

| plan 가정 | v10 실제 | 정합 |
|---|---|---|
| `new PgBoss(DATABASE_URL)` → `boss.start()` | `constructor(connectionString)`·`start()` | ✅ |
| `boss.schedule(cron)` 일1회 자동확정 | `schedule(name, cron, data?, options?)` | ✅ (단 createQueue 선행) |
| `boss.send`/`boss.work` outbox relay | `send`/`work` 존재 | ✅ (단 createQueue 선행, work 배열핸들러) |
| `pgboss` 스키마 자동 생성 | start() 시 자동 마이그레이션 | ✅ (DB CREATE 권한 필요 — GAP-001) |

가정-실제 불일치 **미발견**(핀 버전 구체화로 해소). 단 createQueue 선행·work 배열핸들러는 plan 에 미명시된 v10 구현 디테일 → tasks.md 에 반영.

---

## 트랜잭션 전파(AsyncLocalStorage) 동작 확인

- Node 내장 `AsyncLocalStorage`(stable, Node 16+) — `als.run(store, fn)` 내부 await 체인 전반에서 `als.getStore()` 동일 store 반환. NestJS DI 서비스 호출도 동일 비동기 컨텍스트라 전파됨(plan ADR-001 정합).
- **Prisma interactive `$transaction(async (tx)=>…)`**: 동일 DB 커넥션 단일 BEGIN/COMMIT. multiSchema = 동일 PostgreSQL 인스턴스 → cross-schema 쓰기도 1 트랜잭션 원자 commit/rollback. tx 클라이언트(`Prisma.TransactionClient`)로 발행한 모든 쿼리 원자적.
- **중첩 금지**: tx 내부에서 또 `$transaction`(중첩 interactive) 미지원 → `runInTransaction` 이 `als.getStore()` 존재 시 `fn()` 재사용(중첩 BEGIN 방지, plan 코드 정합). decreaseStock/restoreStock 은 내부에서 `$transaction` 을 열지 않음(updateMany+create 만) → 재진입 안전.
- **EventEmitter2 `@OnEvent` 동기 핸들러 ALS 오염 위험**: emit 을 tx 내부에서 호출하면 동기 핸들러 쿼리가 tx 에 편입될 수 있음 → `onAfterCommit` 지연으로 커밋 후 root client 실행(plan ADR-005 정합, 검증 완료).

---

## Idempotency 동시성 분석 (§C 공유 상태)

| 공유 자원 | Check-Then-Act 위험 | 방어 |
|---|---|---|
| `payments.idempotencyKey @unique` | `findUnique(key)` → 없음 → INSERT 사이 동시 2요청(race) | DB `@unique` 제약이 최종 guard. 2번째 INSERT P2002 → catch 후 기존 결제 조회·최초 결과 반환(FR-035). Lock 불요(DB 제약이 원자) |
| `refunds.idempotencyKey @unique` | 동일 | `@unique` + `payment.status==='refunded' && key 불일치 → 409`(FR-038) |
| `inventory.quantity` 동시 차감 | checkAvailability 통과 후 차감 시점 부족 | `conditionalDecrement`(updateMany WHERE quantity>=qty, count===0 판정) 원자 — 002 실코드(inventory.repository.ts:36-41). 음수 재고 불가 |
| `payment_outbox` relay | at-least-once 중복 처리 | relay 핸들러 멱등(order 이미 confirmed → markConfirmed no-op) |

- **Lock 불요 근거 문서화**: 모든 동시성 지점이 DB 단일 statement 원자 연산(`@unique` INSERT, 조건부 updateMany)으로 방어됨 → application-level Lock 미도입. `runInTransaction` 은 격리이지 상호배제용 Lock 아님. P2002 catch→재조회 패턴은 idempotent.

---

## 인정되는 한계 및 안전망 (PATCH-A07)

| 한계 | 안전망 | FR/SC |
|---|---|---|
| `onAfterCommit` in-process best-effort — 커밋 후 크래시 시 `inventory.stock-changed` 유실 | 002 self-healing(다음 재고 변경 시 status 재수렴). 주문·재고는 이미 commit 되어 정합 | FR-013 / SC-012 |
| pg-boss in-process 부트 — 앱 이벤트루프 공유, 무거운 잡은 API 지연 | 잡 경량 한정(일1회 auto-confirm·짧은 outbox 폴링). 운영 모니터링(GAP-001) | FR-027·034 |
| outbox relay 일시 실패 | outbox 행 DB 영속 → 다음 폴링 복구(at-least-once) | FR-033·034 / SC-036·037 |
| StubPaymentGateway tx 내 호출 | stub 즉시 반환. 실 PG 전환 시 외부 호출을 tx 밖으로(후속 spec 주의) | FR-032 |

## 배포 환경 영향 추정 (PATCH-A10)

- 본 spec 검증 대상은 **로컬/dev(Docker Compose PostgreSQL)** 한정. 순수 비즈니스 로직 + in-process pg-boss → 컨테이너 NAT·docker-proxy·L4 LB·firewall conntrack·TCP keepalive 등 네트워크 미들웨어 특이성의 영향 **없음**(socket-level health check 류 미사용).
- 운영 영향 2건(plan PROC-009 승계): (1) Fly release `prisma migrate deploy`(7테이블+RESTORE enum), (2) pg-boss `pgboss` 스키마 자동 생성 — DB CREATE 권한 필요. → **infra.md 미반영 → GAP-001 등록**.

## context.md 부정합 사전 점검 (PATCH-A11)

- 변경 대상 식별: cart/order/payment 모듈(스텁→실구현), `PrismaService`(확장), `InventoryLogType`(RESTORE 추가), 신규 도메인 용어(outbox·idempotencyKey·VariantSnapshot·PaymentGatewayPort·order_events).
- `InventoryLogType` 가 context.md §5 에 STOCK_IN/DECREASE/INIT 로만 정의되어 있으면 RESTORE 추가로 **부정합** → 6단계 Docs Agent 갱신(GAP-002 에 포함).
- cart/order/payment 가 §2 에서 "스텁"으로 기술되어 있으면 실구현으로 갱신 필요 → GAP-002.

---

## §F production 시그니처 변경 / SEC-002 호출측 영향 (PROC-R03)

> plan "핵심 설계" 에 production 시그니처 변경(inventory tx-aware retrofit) + 동작 변경(SEC-002 403) 명시 → 본 절 의무 수행.

### 시그니처 변경 production 메서드

| 메서드 | 전 | 후 | 호출측 마이그레이션 |
|---|---|---|---|
| `InventoryService.decreaseStock(variantId,quantity,orderId)` | 동일 | **시그니처 불변**(내부 repository 만 `this.prisma.tx` 로) | 불요 |
| `InventoryRepository.{findByVariant,increment,conditionalDecrement,sumQuantityByProduct,appendLog}` | `this.prisma.x` | `this.prisma.tx.x` | 시그니처 불변(내부 클라이언트만 교체) |
| `InventoryService.restoreStock` | (부재) | 신규 추가 | additive — 신규 호출만 |

→ **production 외부 시그니처 변경 0건**. tx-aware retrofit 은 내부 클라이언트 교체(behavior-preserving). 호출측 await 패턴·인자 변경 불요.

### SEC-002 동작 변경(403) 호출측 테스트 전수 식별

`grep -rn "stockIn\|getStock\|stock-in\|/inventory" --include="*.spec.ts" --include="*.e2e-spec.ts"` 결과:

| 테스트 파일 | 레벨 | stock-in/getStock 호출 형태 | SEC-002 영향 |
|---|---|---|---|
| `src/modules/inventory/inventory.service.spec.ts` | service(unit) | `service.stockIn(variantId,5)`·`service.getStock(variantId)` 직접 호출. **소유권 시나리오 없음**(단일 variant). | **무영향** — 소유권은 controller 레이어 추가, service 시그니처 불변. green 유지 |
| `test/static/auth-required-guards.spec.ts` | static | InventoryController 소스에 `JwtAuthGuard` 문자열 존재 검증 | 무영향(가드 유지) |
| `test/static/inventory-service-signature.spec.ts` | static | `checkAvailability`/`decreaseStock` 시그니처·async 검증 | 무영향(시그니처 불변, restoreStock additive) |
| `test/static/inventory-log-append-only.spec.ts` | static | `inventory.repository.ts`/`inventory.service.ts` 에 `inventoryLog.update/delete` 부재 검증 | 무영향(`this.prisma.tx.inventoryLog.create` 는 create-only) |
| `test/static/cross-schema.spec.ts` | static | inventory.repository → users 스키마 모델 `this.prisma.{model}` 부재 | 무영향(`this.prisma.tx.inventory` 는 products 모델, 정규식 매칭 안 됨) |
| `test/*.e2e-spec.ts` | e2e | grep 결과 **stock-in/inventory 호출 0건**(`products.e2e-spec.ts` 등) | 무영향 |

### 마이그레이션 판정 (결론)

- **비소유 판매자가 stock-in/getStock 에 200/201 을 단언하는 기존 002 테스트는 0건**. 002 의 inventory 테스트는 전부 service-level(ownership-agnostic, 단일 variant) 또는 정적 검증이며, controller-level 소유권 시나리오 테스트(seller A→B variant)가 애초에 부재.
- spec.md PROC-R03 이 우려한 "002 SC-041/042 의 200/201 → 403 역전"은 **실제 002 테스트 코드 기준 비해당**(해당 SC 들은 happy-path service 테스트로, 비소유 시나리오를 단언하지 않음).
- **본 spec 범위 처리**: (1) 002 inventory/product 단위 테스트 회귀 없음 확인(smoke_tests Y — plan §smoke_tests). (2) SEC-002 검증은 **신규 SC-042(타 variant 403)·SC-043(자기 variant 정상)·SC-044(타 variant 조회 403)** 로 신규 작성. → **픽스처 재작성 태스크 불요**, 신규 테스트 추가 + 회귀 smoke 로 처리. tasks.md T-D 레이어에 SC-042/043/044 신규 테스트 + 002 smoke 명시.

### (PROC-001/SC-050) "PASS 유지" 예측 정밀 점검

- 003 신규 cross-schema 정적 테스트(SC-050)는 cart/order/payment repository 가 자기 스키마 모델만 접근하는지 검사. 003 repository 는 **`this.prisma.tx.{model}`** 패턴 사용 → 002 의 `cross-schema.spec.ts` 정규식(`this\.prisma\.{model}\b`)은 `.tx.` 가 끼어 매칭 안 됨. **신규 SC-050 정적 테스트는 `this.prisma.{model}` 과 `this.prisma.tx.{model}` 두 패턴 모두 검사**해야 함(Test Authoring Contract 명시). 이를 누락하면 cross-schema 위반을 정적으로 못 잡는 사각지대 발생.

---

## 기술 선택 조사

| 결정 | 채택 | 근거(코드/문서) |
|---|---|---|
| 트랜잭션 전파 | Node 내장 AsyncLocalStorage(무의존) | `nestjs-cls` 등 신규 의존 회피(P-002 정신·최소 의존). plan ADR-001 |
| 비동기 큐 | `pg-boss@^10.4.2` | constitution P-003 명시 권장. v10 = CommonJS+Node>=20 호환 최신(v11/v12 비호환) |
| 결제 게이트웨이 | `PaymentGatewayPort` interface + StubPaymentGateway, DI 토큰 `PAYMENT_GATEWAY` | P-004 중립. 실 PG 후속 spec. plan ADR-010 |
| order id | `cuid()` 선생성 | decreaseStock 인자 orderId 가 order insert 전 필요. plan ADR-009. `@prisma/client` `Prisma` 의존 또는 cuid 유틸 |
| 주문 hot path | `getVariantSnapshots(variantIds)` 배치(N→1) + checkAvailability | NFR-001 P95 1,000ms. plan PATCH-003 |

> cuid 생성: schema 가 `@default(cuid())` 를 쓰므로 DB-side 생성도 가능하나 ADR-009 는 선생성 요구. NestJS 측 cuid 생성은 별도 패키지 없이 `@paralleldrive/cuid2` 도입은 신규 의존 → 회피. 대안: order insert 시 Prisma `@default(cuid())` 로 생성된 id 를 **먼저 order 만 insert 해 id 확보 후** 동일 tx 내 decreaseStock·items·events 에 사용(왕복 1회, tx 내부라 원자). tasks.md 는 이 무의존 방식(order 먼저 insert → id → 나머지)을 채택(ADR-009 의 "선생성" 목적=FK 일관성 달성, 신규 의존 없이 충족).

## 엣지 케이스 및 한계

- **빈 컬렉션 guard**: 주문 items 빈 배열·getVariantSnapshots 빈 입력 → 400 또는 빈 결과 즉시 반환(불필요한 tx 진입 회피). plan §D 정합.
- **order 경로명**: 스텁 `@Controller('order')` → spec 은 `POST /orders`. controller 경로를 `'orders'` 로 변경 + 판매자 수주(`GET /sellers/me/orders`)는 별도 `@Controller('sellers')` 컨트롤러로 분리(경로 prefix 상이).
- **getStock + SEC-002 순서**: `assertSellerOwnsVariant`(variant 미존재 시 404/예외) 를 getStock(미존재 시 0 반환) 보다 먼저 → 비소유 variant 는 403, 존재하지 않는 variant 는 404.
- **payment ↔ order 순환**: payment 는 order 를 DI 안 함(outbox relay 경유). order → payment.refund 는 단방향 DI. relay(인프라)가 OrderService 의존(ADR-007).
