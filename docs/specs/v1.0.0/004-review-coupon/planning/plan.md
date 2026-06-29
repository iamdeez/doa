---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-29
상태: 검토중
---

# Plan: 004-review-coupon

> Branch: 004-review-coupon | Date: 2026-06-29 | Spec: [../spec/spec.md](../spec/spec.md)

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [외부 라이브러리 동작 검증](#외부-라이브러리-동작-검증)
- [배포 환경 영향 (PROC-009)](#배포-환경-영향-proc-009)
- [위험 완화 설계 (PATCH-A06)](#위험-완화-설계-patch-a06)
- [핵심 설계](#핵심-설계)
- [결정 기록 (ADRs)](#결정-기록-adrs)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> `constitution.md`(P-001~P-007) 존재 → 해당 조항을 Gates 로 사용한다(constitution 우선). spec.md NFR(NFR-001~006)은 P-001·P-002·P-005·P-006·P-007 을 하위 구체화하며 충돌 없음(완화 없음). spec NFR 이 더 엄격한 항목은 spec 기준 적용.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: `coupon`·`review` 모듈 Repository 가 자기 스키마(`commerce`) 외 타 도메인(`orders`·`users`·`products`) 테이블을 직접 참조·쿼리·JOIN 하지 않음 — SC-054 정적 검증]
  → PASS. coupon repo = `commerce.coupons`·`commerce.user_coupons` 만, review repo = `commerce.reviews` 만 쿼리. cross-domain 데이터는 전부 공개 서비스 DI: (a) 쿠폰 검증 시 주문 `totalAmount` 는 `OrderService.createOrder` 가 **인자로 전달**(coupon 이 orders 미조회), (b) 리뷰 권한 검증 시 `OrderService.getOrderItemForReview(orderItemId)`(신규 공개 DI)로 orderItem→order 컨텍스트 획득(review 가 orders 미조회), (c) 판매자 식별은 `SellerService.getApprovedSeller`(DI). 4계층(controller·service·repository·events) 준수. **단일 `$transaction`(003 ALS)이 commerce·orders·products 를 가로지르지만 각 repository 는 자기 스키마 모델에만 쿼리 발행**(003 ADR-002 판정 승계 — tx 클라이언트만 공유).
- [x] **P-002 AWS 의존 금지 원칙**: [Pass 기준: `@aws-sdk/*` 등 AWS 전용 패키지 신규 추가 0건 — SC-055 정적 검증]
  → PASS(NFR-006). 신규 npm 의존 0건. 쿠폰·리뷰 모듈은 기존 Prisma·NestJS·class-validator·EventEmitter2 만 사용. `@aws-sdk/*` 0건.
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 외부 저장소 0건]
  → PASS. 신규 3테이블(`coupons`·`user_coupons`·`reviews`)을 기존 `commerce` 스키마에 추가. 외부 저장소·캐시·브로커 도입 0. 이벤트(`coupon.used`·`review.created`)는 인-프로세스 EventEmitter2(무의존).
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: Fly.io 전용 API 결합 0건]
  → PASS. 표준 Prisma + PostgreSQL 만. Fly 전용 SDK·API 미사용.
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: 금전 수치 Decimal/정수·부동소수점 0건(NFR-001), 쿠폰 사용 원자성(NFR-002) — SC-050·051 검증]
  → PASS(핵심 요구). (1) **Decimal**: `coupons.discountValue`·`maxDiscountAmount`·`minOrderAmount`·`orders.discountAmount`(003 기존) 전부 `@db.Decimal(12,2)`. PERCENTAGE 할인 계산 중간 과정도 `Prisma.Decimal` 연산(`.mul/.div/.floor/.min`)만, float 0(SC-050, 외부 라이브러리 검증 절 참조). (2) **원자성**: 쿠폰 사용은 주문 생성과 **동일 `$transaction`** 내 조건부 UPDATE(`WHERE id=? AND status='unused'`) — `count===0` 이면 409 + 롤백(NFR-002, FR-013, SC-019·020·051). 쿠폰 발급 한도도 조건부 increment(SC-007). 결제 청구액 = `totalAmount - discountAmount`(FR-015, SC-022). **본 spec 은 결제 상태 변경을 신규로 만들지 않음**(003 outbox·멱등성 키 흐름 불변) — coupon/review 자체는 P-005 의 outbox/멱등키 대상(결제·정산 상태 변경)이 아니라 상태 전이 원자성 대상.
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건]
  → PASS. FR-001~027·NFR-001~006 전부 SC 매핑 존재(spec.md 매트릭스 역방향 검증 완료, 누락 0).
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건]
  → PASS. 변경 범위 = coupon·review 2개 스텁 실구현 + 003 cross-cutting 보정 3건(아래 "스코프 추적"). 전부 특정 FR 추적 가능. spec.md 범위 외 리팩토링·기능추가 0.

**스코프 추적 (P-007 — 003 산출물 cross-cutting 변경의 FR 근거)**:

| 변경 대상 | 변경 성격 | 근거 FR | 비파괴성 |
|---|---|---|---|
| `modules/order/dto/create-order.dto.ts` | optional `userCouponId?: string` 필드 추가 | FR-010 | additive — 미전달 시 003 동작(discountAmount=0) 불변(FR-014) |
| `modules/order/order.service.ts` `createOrder` | 쿠폰 검증·할인 계산·`markUsed`(tx 내) 호출 + `discountAmount` 동적 설정 | FR-010~014·017 | additive 분기 — `userCouponId` 없으면 기존 경로 그대로(FR-014, SC-021) |
| `modules/order/order.service.ts` `cancel` | tx 내 `CouponService.restoreForOrder(orderId)` 호출 추가 | FR-016 | additive — 쿠폰 없는 주문은 no-op(SC-023) |
| `modules/order/order.service.ts` 신규 공개 메서드 `getOrderItemForReview` | review 모듈 DI 소비용 orderItem→order 컨텍스트 조회 | FR-021 | additive 공개 메서드 |
| `modules/payment/payment.service.ts` `pay` | 청구액 `amount` 를 `totalAmount - discountAmount` 로 변경 | FR-015 | 동작 변경(의도된 보정) — discountAmount=0 주문은 결과 동일(003 회귀 없음) |

예외 사항: 없음.

> **Gates 판정**: P-001~P-007 전부 통과(예외 0). Design Agent(3단계) 진입 가능.

---

## 기술 컨텍스트

> 003 의 확정 스택을 그대로 재확정(자명한 답습). 004 고유 신규 결정만 명시.

- **언어 / 런타임**: TypeScript 5.4 / Node.js 20.x. pnpm + Turborepo.
- **백엔드 프레임워크**: NestJS 11.x. 4계층(controller·service·repository·events).
- **ORM / DB**: Prisma `^6.19.0` multiSchema + PostgreSQL 16. 로컬 Docker Compose.
- **인증/인가**: 기존 `shared/auth` 재사용 — `JwtAuthGuard`·`AdminGuard`(`ADMIN_USER_IDS` env, fail-closed)·`@CurrentUser()`·`AuthenticatedUser`. 신규 가드 없음. 판매자 권한은 `SellerService.getApprovedSeller(userId)`(DI, APPROVED 아니면 403) 로 해석. 공개 조회(FR-025)는 가드 미적용.
- **트랜잭션 전파**: 003 신규 인프라 `PrismaService` ALS(`runInTransaction`/`tx`/`onAfterCommit`) **재사용**. coupon repo·order repo 모두 `this.prisma.tx` 로 쿼리 → 쿠폰 사용·복원이 주문 생성/취소 트랜잭션에 동일 참여. 신규 인프라 0.
- **도메인 이벤트**: 인-프로세스 `EventEmitter2`(`@nestjs/event-emitter`, 기존). `coupon.used`(FR-017)·`review.created`(FR-027)는 트랜잭션 커밋 후 `onAfterCommit` 으로 발행(tx 오염 방지, 003 ADR-005 패턴 승계).
- **금전 타입**: `Prisma.Decimal`(`@db.Decimal(12,2)`) — discountValue·maxDiscountAmount·minOrderAmount·discountAmount(NFR-001, P-005). 할인 계산은 `.mul/.div/.floor()`·`Decimal.min(...)` 만.
- **입력 검증**: `class-validator` + 전역 `ValidationPipe`. `rating` 1~5 정수(`@IsInt @Min(1) @Max(5)` → 위반 시 400, FR-022/SC-034). 쿠폰 생성 DTO 의 `type`·`discountValue`(양수, PERCENTAGE 는 1~100) 검증.
- **테스트 프레임워크**: Jest(`*.spec.ts`, src rootDir) + supertest. 단위([env:unit]) 위주 + 정적([env:static] — SC-050·054·055).
- **환경변수**: 기존 `DATABASE_URL`·`JWT_*`·`ADMIN_USER_IDS` 재사용. 신규 env 0.
- **신규 의존성**: 0건(PATCH-A15 자가 점검 → selection-phases.md). 신규 PyPI/npm 패키지 없음 → `[env:e2e-docker]` 태그 SC 부재 → Deploy Agent 비활성.

---

## 외부 라이브러리 동작 검증

> spec 가정이 외부 라이브러리 API 동작에 의존하는 핵심 = "PERCENTAGE 할인의 FLOOR·MIN·상한 계산을 부동소수점 없이 `Prisma.Decimal` 로 수행 가능한가"(NFR-001, FR-012). 설치된 타입 정의로 1차 검증.

| 가정 | 검증 결과(근거) | 인정되는 한계 (PATCH-A07) | 안전망 |
|---|---|---|---|
| `Prisma.Decimal`(decimal.js)이 인스턴스 `.floor()` 와 정적 `Decimal.min(...)` 을 제공하여 PERCENTAGE 할인의 내림·상한·주문금액 초과 방지를 float 없이 계산 | **확인됨**. `apps/backend/node_modules/@prisma/client/runtime/index-browser.d.ts` — 인스턴스 `floor(): Decimal`(L80), `mul`(L172)·`div`(L72)·`minus`(L139)·`lte/gte`(L130~135), 정적 `static min(...n): Decimal`(L248). → FIXED: `Decimal.min(discountValue, totalAmount)`. PERCENTAGE: `base = totalAmount.mul(discountValue).div(100).floor()`; max 有 → `Decimal.min(base, maxDiscountAmount, totalAmount)`, max 無 → `Decimal.min(base, totalAmount)`. 전 과정 Decimal, float 0. | `.div(100)` 자체는 비정수 중간값을 가질 수 있으나 즉시 `.floor()` 로 정수(원) 절삭하므로 정밀도 손실 없음. decimal.js 기본 precision(20)은 12자리 금액에 충분. | `discountAmount ≤ totalAmount` 보장(`Decimal.min(…, totalAmount)`)으로 음수 잔액 차단(FR-012 최종 조건). 단위 테스트 SC-013·014 가 경계(상한 적용/미적용·초과 방지) 직접 검증. |
| Prisma `$transaction`(ALS `runInTransaction`)이 commerce(user_coupon)·orders(order)·products(inventory) cross-schema 쓰기를 단일 commit/rollback | 003 검증 승계(003 plan §외부 라이브러리 동작 검증). 동일 DB 단일 BEGIN/COMMIT. | 중첩 interactive tx 미지원 — `createOrder`/`cancel` 호출 그래프에서 coupon 메서드가 별도 `$transaction` 을 열지 않음(`this.prisma.tx` 만 사용). | `runInTransaction` 재진입 reuse(중첩 BEGIN 방지, 003 ADR-001). coupon `markUsed`/`restoreForOrder` 는 `updateMany` 만 발행. |
| 조건부 `updateMany({where:{id, status:'unused'}, data:{status:'used',…}})` 의 `count` 으로 이중사용 판정 | Prisma `updateMany` 가 `{count}` 반환(공식 동작). 003 `decreaseStock` 의 `count===0` 패턴과 동형. | row 부재(잘못된 id)와 조건 불일치(이미 used)가 모두 `count===0` → 구분 위해 사전 read 로 404/422/403 선판정 후 tx 내 update 는 동시성 race guard 전용. | 사전 검증 read(FR-011 a~d)로 명시적 4xx, tx 내 `count===0` 은 409(동시성). 이중 방어(SC-016 vs SC-020 구분). |

가정-실제 불일치 현재 미발견. 신규 외부 라이브러리 도입 없음 → import 형태 명시 대상 없음(research.md 에 "신규 라이브러리 없음 — 해당 없음" 기재 위임).

---

## 배포 환경 영향 (PROC-009)

- 본 spec 검증 대상은 **로컬/dev(Docker Compose PostgreSQL)** 한정. 순수 비즈니스 로직 + 인-프로세스 이벤트로 컨테이너 NAT·docker-proxy·L4 LB·firewall 네트워크 미들웨어 특이성 영향 없음(spec-input Q17-19: 003 동일, cross-reference 불필요).
- 운영 영향 1건: **Prisma 마이그레이션의 Fly release 단계 실행**(3 신규 테이블 + 인덱스/unique 제약) — 로컬 `prisma migrate dev` 로 갈음, spec.md "사후 운영 검증 피드백 사이클"에 명시.
- infra.md GAP 신규 등록 불필요(pg-boss·worker 등 003 에서 이미 식별, 본 spec 은 신규 인프라 항목 0).

---

## 위험 완화 설계 (PATCH-A06)

> assumptions.md 부재. 본 plan 의 동시성·정합성 위험에 대한 안전망(전부 FR/SC 매핑).

| 위험 항목 | 부정 검증 시 영향 | 안전망 설계 | FR/SC 매핑 |
|---|---|---|---|
| 동일 user_coupon 동시 주문 2건(이중사용 race) | 한 쿠폰으로 2회 할인 | tx 내 조건부 UPDATE `WHERE status='unused'` → 두 번째 `count===0` → 409 + 롤백(원자적 1건만 성공) | FR-013 / SC-020 |
| 쿠폰 적용 주문 생성 실패(재고 race 등)로 롤백 | user_coupon 이 used 로 남아 쿠폰 소실 | 쿠폰 사용 UPDATE 가 **동일 트랜잭션** 내 → 주문 실패 시 함께 롤백 → status=unused 유지 | FR-013 / SC-019 |
| 주문 취소 후 쿠폰 미복원 | 고객이 쿠폰 영구 손실 | 취소 트랜잭션 내 `restoreForOrder(orderId)`(`WHERE usedOrderId=orderId`) → status=unused·usedOrderId=null. 취소 실패 시 전체 롤백(취소 미반영) | FR-016 / SC-023 |
| 쿠폰 발급 한도 초과 동시 발급 | totalQuantity 초과 발급 | `coupons.issuedCount` 조건부 increment `WHERE totalQuantity IS NULL OR issuedCount < totalQuantity` + user_coupon insert 동일 tx → `count===0` 시 409(ADR-004) | FR-003 / SC-007 |
| 동일 orderItem 중복 리뷰 동시 작성 | 중복 리뷰 | `reviews.orderItemId @unique` DB 제약 → 두 번째 insert P2002 → 409(catch 변환) | FR-021c / SC-033 |
| 클라이언트가 discountAmount 임의 전달(SEC-FIND-004 재발) | 무단 할인 | DTO 에 discountAmount 필드 부재(additive 는 userCouponId 만). 서버가 쿠폰 검증 후에만 discountAmount 계산·설정 | FR-010 / SC-012 |

모든 안전망이 FR/SC 에 매핑 → 누락 없음 → BLOCKED 불필요.

---

## 핵심 설계

> 작성 깊이: Design Agent 가 추가 설계 판단 없이 tasks.md 를 분해할 수 있는 수준. 변경 대상 모듈·인터페이스 시그니처·핵심 분기 로직 포함.

### 0. 모듈 간 통신 토폴로지 (P-001 / NFR-005 핵심)

```
[coupon 모듈] commerce 스키마 (coupons, user_coupons)
   ▲   validateAndCalculateDiscount(userCouponId, userId, orderTotal): {discountAmount, couponId}  (DI, orderTotal 은 인자로 수신 — coupon 이 orders 미조회)
   │   markUsed({userCouponId, orderId, userId, discountAmount})  (DI, tx 내 조건부 UPDATE + onAfterCommit emit)
   │   restoreForOrder(orderId)  (DI, 취소 tx 내 복원)
[order 모듈] orders 스키마 (orders, order_items, order_events)  ── 신규 공개: getOrderItemForReview(orderItemId)
   │   SellerService.getApprovedSeller(userId)  (DI, 판매자 식별 — coupon/order 공통)
   ▼
[review 모듈] commerce 스키마 (reviews)
   ▲   OrderService.getOrderItemForReview(orderItemId): {orderId, orderUserId, orderStatus, productId, sellerId} | null  (DI, review 가 orders 미조회)
[payment 모듈] payments 스키마 ── pay() 청구액 = totalAmount - discountAmount (FR-015)
[seller 모듈] users 스키마 ── getApprovedSeller (003 실재)
```

**규약**:
- coupon·review 의 cross-domain 데이터 획득은 **직접 Prisma 쿼리 절대 금지**, 공개 서비스 DI 만(P-001, NFR-005).
- **순환 DI 회피**: order → coupon(DI 단방향, 주문 생성·취소가 coupon 호출). review → order(DI 단방향, 권한 조회). coupon·review 는 order 를 DI 하지 않음(coupon 은 orderTotal 을 인자로만 수신). order → seller(003 실재). 순환 없음.

### 1. coupon 모듈 (commerce 스키마) — FR-001~006, 010~017

변경 대상: `modules/coupon/{coupon.controller,coupon.service,coupon.repository,coupon.events}.ts` + `coupon.module.ts` + dto. (현재 빈 스텁)

**컨트롤러 라우팅**(NestJS 다중 컨트롤러, 전체 경로 상이):

| 엔드포인트 | 가드 | 인가 | 동작 | FR/SC |
|---|---|---|---|---|
| `POST /admin/coupons` | JwtAuthGuard + AdminGuard | admin | `{type,discountValue,expiresAt,description?,minOrderAmount?,maxDiscountAmount?,totalQuantity?}` → coupon(issuerType=ADMIN, issuerId=user.userId) 생성, 201 | FR-001 / SC-001·002·003 |
| `POST /sellers/me/coupons` | JwtAuthGuard | getApprovedSeller(없거나 미승인 403) | issuerType=SELLER, issuerId=seller.id 서버 설정, 201 | FR-002 / SC-004·005 |
| `POST /admin/coupons/:couponId/issue` | JwtAuthGuard + AdminGuard | admin | `{userId}` → user_coupon(status=unused) 발급. 한도 초과 409 | FR-003 / SC-006·007 |
| `POST /sellers/me/coupons/:couponId/issue` | JwtAuthGuard | seller + `coupon.issuerId===seller.id`(불일치 403) | `{userId}` 발급 | FR-004 / SC-008·009 |
| `GET /users/me/coupons` | JwtAuthGuard | userId 자동 | `?status=unused|used|expired|all`(기본 unused) 필터, 본인 user_coupon | FR-005 / SC-010 |
| `GET /sellers/me/coupons` | JwtAuthGuard | seller | 본인 생성 쿠폰, cursor(`after`,`limit`) | FR-006 / SC-011 |

**핵심 분기 로직**:
- **생성(FR-001/002)**: PERCENTAGE 면 `discountValue` 1~100 검증(DTO + service). FIXED 면 양수. `maxDiscountAmount` 는 PERCENTAGE 전용(FIXED 에 전달 시 무시 또는 400 — Design 확정). `expiresAt` 필수. `totalQuantity` null=무제한.
- **발급(FR-003/004, SC-007)**: 한도 원자 보장 — `coupons.issuedCount` 조건부 increment + user_coupon insert 를 `runInTransaction` 으로 묶음(ADR-004). `updateMany({where:{id:couponId, OR:[{totalQuantity:null},{issuedCount:{lt: totalQuantity}}]}, data:{issuedCount:{increment:1}}})` → `count===0` → 409. (Prisma 에서 `issuedCount < totalQuantity` 동적 컬럼 비교가 제한되면 `$queryRaw` 또는 사전 read+조건 update — Design research 에서 확정, ADR-004 대안 명시).
- **판매자 발급 소유권(FR-004)**: `coupon.issuerType==='SELLER' && coupon.issuerId===seller.id` 아니면 403(SC-009).
- **조회(FR-005)**: `where:{userId, status?}` — status='expired' 는 `coupon.expiresAt < now` 동적 판정 포함 여부를 Design 확정(저장 status 'expired' vs 만료일 계산). 기본 저장 status 기준 + 'all' 은 무필터.

### 2. coupon↔order 연동 (order 모듈 createOrder 수정) — FR-010~014·017 (★ 핵심)

`modules/order/order.service.ts` `createOrder` 수정(additive 분기) + `create-order.dto.ts` 에 `userCouponId?` 추가.

**수정 후 흐름**(기존 003 단계에 ★표시 신규 삽입):

```
1. 입력: { items, shippingAddress, userCouponId? }
2. checkAvailability × N (tx 외부 사전 확인, 003 기존)
3. getVariantSnapshots → totalAmount = Σ(unitPrice × quantity) (003 기존)
4. orderId = randomUUID() (003 기존, ADR-009)
★5. discountAmount = Decimal(0)
★   if (userCouponId):
★     { discountAmount, couponId } = await couponService.validateAndCalculateDiscount(userCouponId, userId, totalAmount)
★       └ FR-011 검증(전부 read, 위반 시 즉시 throw, tx 진입 전 fast-fail):
★          (a) user_coupon.status !== 'unused' → 422 (SC-016)
★          (b) user_coupon.userId !== userId → 403 (SC-017)
★          (c) coupon.expiresAt <= now → 422 (SC-015)
★          (d) coupon.minOrderAmount && totalAmount < minOrderAmount → 422 (SC-018)
★       └ FR-012 계산(Decimal): FIXED=min(discountValue, totalAmount) / PERCENTAGE=min(floor(totalAmount×dv/100), maxDiscountAmount?, totalAmount)
6. runInTransaction:
     - decreaseStock × N (003 기존)
★    - if (userCouponId): await couponService.markUsed({userCouponId, orderId, userId, discountAmount})
★        └ 조건부 UPDATE WHERE id=? AND status='unused' SET status='used', usedOrderId=orderId → count===0 → ConflictException(409) (FR-013, SC-019·020)
★        └ onAfterCommit(emit 'coupon.used' {userCouponId, couponId, orderId, userId, discountAmount}) (FR-017, SC-024)
     - createOrder({ id:orderId, userId, totalAmount, discountAmount, shippingAddressSnapshot }) ← discountAmount 동적 (003 은 0 고정)
     - createItems / appendEvent / cart.removeItems (003 기존)
7. userCouponId 없으면 ★단계 전부 skip → discountAmount=0 (FR-014, SC-021 — 003 동작 불변)
```

- **SEC-FIND-004 재발 방지**: `CreateOrderDto` 에 `discountAmount` 필드 **추가하지 않음**. 신규 필드는 `userCouponId?: string` 단 하나. 서버 계산값만 반영(SC-012 — 클라이언트가 다른 값 전달해도 무시).
- **검증 read 위치**: FR-011(a~d)는 tx 진입 전 read 로 명시적 4xx 반환(빠른 실패·정확한 코드). tx 내 `markUsed` 의 `count===0` 은 동시성 race(이미 사용됨) 전용 409 — 단일 요청 정상 경로에서는 read 통과 후 update 성공.

### 3. coupon↔order 취소 복원 (order 모듈 cancel 수정) — FR-016

`order.service.ts` `cancel` 의 `runInTransaction` 내부에 추가:
```
★ await couponService.restoreForOrder(orderId)
    └ updateMany({where:{usedOrderId:orderId, status:'used'}, data:{status:'unused', usedOrderId:null}})  // 쿠폰 미적용 주문이면 count=0 no-op
```
- 환불·재고복원·상태전이와 동일 트랜잭션(원자성). 실패 시 전체 롤백(취소 미반영). SC-023.
- 위치: 기존 `restoreStock` 루프와 같은 tx 블록. 순서 무관(독립 자원).

### 4. payment 청구액 보정 (payment 모듈 pay 수정) — FR-015

`payment.service.ts` `pay`:
```
- const amount = new Prisma.Decimal(order.totalAmount.toString());                       // 003 기존
+ const amount = new Prisma.Decimal(order.totalAmount.toString()).minus(order.discountAmount); // FR-015
```
- `order.discountAmount` 는 003 schema 에 이미 존재(기본 0). discountAmount=0 주문은 결과 동일(003 회귀 없음). `PaymentGatewayPort.charge` 전달 금액·`payment.amount` 모두 이 값. SC-022(60000-10000=50000).
- `totalAmount - discountAmount ≥ 0` 은 FR-012 가 보장(`discountAmount ≤ totalAmount`).

### 5. review 모듈 (commerce 스키마) — FR-020~027

변경 대상: `modules/review/{review.controller,review.service,review.repository,review.events}.ts` + `review.module.ts` + dto. (현재 빈 스텁)

| 엔드포인트 | 가드 | 인가 | 동작 | FR/SC |
|---|---|---|---|---|
| `POST /reviews` | JwtAuthGuard | order.userId===me + order.status=completed | `{orderItemId, rating(1~5), content}` → 리뷰 생성, 201 | FR-020~022 / SC-030~034 |
| `PATCH /reviews/:id` | JwtAuthGuard | review.userId===me(403) | `{rating?, content?}` 수정 | FR-023 / SC-035·036 |
| `DELETE /reviews/:id` | JwtAuthGuard | review.userId===me(403) | 삭제, 204 | FR-024 / SC-037·038 |
| `GET /products/:productId/reviews` | 없음(공개) | — | cursor(`after`,`limit`) 최신순 | FR-025 / SC-039 |
| `GET /reviews/me` | JwtAuthGuard | userId 자동 | 본인 리뷰 cursor | FR-026 / SC-040 |

**핵심 분기 로직**:
- **작성(FR-021, SC-030~033)**:
  1. `ctx = await orderService.getOrderItemForReview(orderItemId)`(DI). null → 404.
  2. `ctx.orderUserId !== userId` → 403 (FR-021a, SC-032).
  3. `ctx.orderStatus !== 'completed'` → 422 (FR-021b, SC-031).
  4. `rating` 1~5 검증은 DTO(`@Min(1)@Max(5)@IsInt`) → 위반 400 (FR-022, SC-034).
  5. `reviews` insert `{orderItemId(unique), orderId:ctx.orderId, userId, productId:ctx.productId, sellerId:ctx.sellerId, rating, content}`. P2002(orderItemId unique 위반) catch → 409 (FR-021c, SC-033).
  6. `onAfterCommit` 불필요(단일 insert, tx 미사용) → insert 성공 후 `emit 'review.created' {reviewId, orderItemId, orderId, productId, userId, rating}` (FR-027, SC-041).
- **수정/삭제(FR-023/024)**: `review.userId !== me` → 403(SC-036·038). PATCH 는 rating·content 만.
- **공개 조회(FR-025)**: 가드 없음. `where:{productId}`, `orderBy:[{createdAt:desc},{id:desc}]`, cursor=id, `take=limit`. JWT 없이 200(SC-039).
- **내 리뷰(FR-026)**: `where:{userId}` cursor(SC-040).

### 6. order 모듈 신규 공개 메서드 — FR-021 (review DI contract)

```ts
// OrderService (additive 공개 메서드)
async getOrderItemForReview(orderItemId: string):
  Promise<{ orderId: string; orderUserId: string; orderStatus: OrderStatus;
            productId: string; sellerId: string } | null>;
//  order_items(자기 스키마) + orders(자기 스키마) join 으로 컨텍스트 구성.
//  미존재 orderItem → null. review 가 orders 스키마를 직접 쿼리하지 않도록 하는 P-001 경계 메서드.
```

---

## 결정 기록 (ADRs)

> spec.md 매트릭스 FR/NFR 를 plan 결정에 매핑. 자명한 답습(NestJS·Prisma·JWT·ALS tx — 001/002/003 ADR 승계)은 생략. Design Agent research.md "기술 선택 조사" 절과 cross-reference. 미작성 결정이 design 단계에 발견되면 BLOCKED → Planning 복귀.

| ADR-ID | 결정 항목 | 채택안 | 대안(검토했으나 채택 안 함) | 근거(spec FR/NFR) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | 쿠폰 사용의 주문 트랜잭션 통합 | `OrderService.createOrder` 가 003 ALS `runInTransaction` 내에서 `CouponService.markUsed` 호출 — 쿠폰 사용·할인 설정·주문 생성 단일 원자 | 쿠폰 사용을 별도 API/별도 tx(주문과 비원자 — 사용 후 주문 실패 시 쿠폰 소실) / coupon 모듈이 order 직접 생성(P-001 위반) | FR-010·013, NFR-002, P-005 | order.service, coupon.service, prisma(ALS 재사용) |
| ADR-002 | 쿠폰 이중사용 방지 | tx 내 조건부 `updateMany WHERE id=? AND status='unused'` → `count===0` → 409(003 decreaseStock 패턴 승계) | 비관 락(SELECT FOR UPDATE — 추가 복잡도) / 사전 read 만(check-then-act race) | FR-013, NFR-002, SC-020 | coupon.repository |
| ADR-003 | 클라이언트 할인금액 차단(SEC-FIND-004) | `CreateOrderDto` 신규 필드는 `userCouponId?` 만. discountAmount 는 서버가 쿠폰 검증 후 계산·설정 | dto 에 discountAmount 허용(클라이언트 임의 할인) | FR-010, SC-012, 선행 SEC-FIND-004 | create-order.dto, order.service |
| ADR-004 | 쿠폰 발급 한도 원자 보장 | `coupons.issuedCount` 조건부 increment(`WHERE totalQuantity IS NULL OR issuedCount < totalQuantity`) + user_coupon insert 동일 tx, `count===0`→409 | 발급 시 `user_coupons` count 후 insert(check-then-act race, 한도 초과 가능) | FR-003, SC-007 | coupon schema(issuedCount), coupon.repository. **Prisma 동적 컬럼 비교 한계 시 `$queryRaw` 또는 read+조건update 로 Design 확정** |
| ADR-005 | PERCENTAGE 할인 Decimal 계산 | `totalAmount.mul(dv).div(100).floor()` 후 `Decimal.min(…, maxDiscountAmount?, totalAmount)` — 전 과정 `Prisma.Decimal`, 내림 적용 | Number 변환 후 Math.floor(부동소수점 — P-005/NFR-001 위반) | FR-012, NFR-001, SC-013·014 | coupon.service. (외부 라이브러리 검증 절: `.floor()`/`Decimal.min` 확인됨) |
| ADR-006 | 결제 청구액 산출 | `payment.pay` 가 `order.totalAmount - order.discountAmount`(Decimal `.minus`) 를 charge·payment.amount 에 사용 | totalAmount 그대로 청구(할인 미반영) | FR-015, SC-022 | payment.service |
| ADR-007 | 쿠폰 복원 트랜잭션 통합 | `OrderService.cancel` tx 내 `CouponService.restoreForOrder(orderId)`(`WHERE usedOrderId=orderId`) | 취소 후 별도 비동기 복원(취소 실패 시 불일치) | FR-016, SC-023 | order.service, coupon.repository |
| ADR-008 | review↔order P-001 경계 | review 권한 검증을 `OrderService.getOrderItemForReview`(신규 공개 DI)로 처리 — review repo 는 orders 미조회 | review.repository 가 orders.order_items/orders 직접 join(P-001·NFR-005 위반) | FR-021, NFR-005, SC-032·054 | order.service(공개 메서드), review.service |
| ADR-009 | orderItem당 1리뷰 보장 | `reviews.orderItemId @unique` + insert P2002 catch → 409 | 사전 count read 후 insert(check-then-act race) | FR-021c, SC-033 | review schema, review.service |
| ADR-010 | 쿠폰 발급자 구분 | `coupons.issuerType(ADMIN|SELLER)` + `issuerId`(plain String — admin userId 또는 sellerId). 판매자 발급/조회 시 `issuerId===seller.id` 검증 | 별도 admin_coupons/seller_coupons 테이블 분리(중복 구조) | FR-002·004·006, SC-009·011 | coupon schema, coupon.service |

> **PATCH-003 (NFR 성능 직결 파라미터)**: 본 spec 은 P95 수치 NFR 없음(spec-input Q15). 범위 제시형 파라미터(bcrypt cost 류) 없음 → 단일 권장값 명시 대상 없음. 쿠폰 할인 계산은 O(1) 산술, 주문 트랜잭션 라운드트립은 003 의 배치 스냅샷 패턴 유지(쿠폰 read 1회 추가만).

---

## 인터페이스 계약

### 권한 부여·상태 전이 엔드포인트 인가 3축 (PATCH-001 / PROC-003)

> 권한 부여·발급·사용·상태 전이 엔드포인트마다 (a) 호출자 신원 (b) 대상 자원 소유권 (c) 역할 검증 여부 명시. 본 spec Security=Y(금전·권한·이중사용).

| 엔드포인트 | (a) 호출자 신원(인증) | (b) 대상 자원 소유권 | (c) 역할 | 미검증 축 위험·후속 |
|---|---|---|---|---|
| `POST /admin/coupons` | JWT | — (생성, 자원 무) | AdminGuard(`ADMIN_USER_IDS` fail-closed) | 없음 — (c) 가드가 1차 방어(SC-003) |
| `POST /sellers/me/coupons` | JWT | issuerId=seller.id 서버 자동 설정 | getApprovedSeller(APPROVED, 미승인 403) | 없음(SC-005) |
| `POST /admin/coupons/:couponId/issue` | JWT | — | AdminGuard | 없음(SC-003 류). 발급 대상 userId 는 임의 지정(설계상 허용) |
| `POST /sellers/me/coupons/:couponId/issue` | JWT | **coupon.issuerId===seller.id**(불일치 403) | getApprovedSeller | (b) 미검증 시 타 판매자 쿠폰 무단 발급 IDOR → 검증으로 차단(SC-009) |
| `POST /orders`(userCouponId 포함) | JWT | **user_coupon.userId===me**(불일치 403) + 클라이언트 discountAmount 지정 불가 | buyer(암묵) | **위험 최고(IDOR + 금전)** — (b) userId 검증으로 타인 쿠폰 사용 차단(SC-017), discountAmount 서버 계산(SEC-FIND-004, SC-012) |
| `POST /reviews` | JWT | **order.userId===me**(403) + order.status=completed(422) | — | (b) orderItem→order.userId 검증으로 타인 주문 리뷰 차단(SC-032), status 로 허위 리뷰 차단(SC-031) |
| `PATCH /reviews/:id` | JWT | **review.userId===me**(403) | — | (b) 미검증 시 타인 리뷰 변조 IDOR → 검증 차단(SC-036) |
| `DELETE /reviews/:id` | JWT | **review.userId===me**(403) | — | (b) 미검증 시 타인 리뷰 삭제 IDOR → 검증 차단(SC-038) |
| `GET /users/me/coupons` | JWT | where userId=me | — | 없음 — 자기 자원만 조회(SC-010) |
| `GET /sellers/me/coupons` | JWT | where issuerId=seller.id | getApprovedSeller | 없음(SC-011) |
| `GET /products/:productId/reviews` | 없음(공개) | — | — | 공개 조회(읽기 전용) — 쓰기 권한 무관(SC-039) |

> **자가 조작(self-approval) 위험**: spec.md PATCH-001 평가의 "잠재 위험 기록" 2건(판매자 자기 쿠폰 자가 사용 / 판매자 자기 상품 리뷰)은 **사업적 위험으로 허용·기록**(보안 위험 아님). 본 spec 엔드포인트에 "자기 자신에게 권한 부여"형 자가 승인 없음. 최고 위험은 `POST /orders` 의 타인 쿠폰 사용 IDOR → (b)축 user_coupon.userId 검증으로 차단.

### 004 가 소비하는 003 공개 인터페이스 (DI)

```ts
// modules/order/order.service.ts — 003 실재 + 004 신규
class OrderService {
  createOrder(userId, dto): Promise<OrderWithDetails>;  // 004: dto 에 userCouponId? 추가, 내부 쿠폰 분기(수정)
  cancel(userId, orderId): Promise<void>;               // 004: tx 내 restoreForOrder 추가(수정)
  getOrderItemForReview(orderItemId: string):           // 004 신규 공개(review DI, FR-021)
    Promise<{ orderId; orderUserId; orderStatus; productId; sellerId } | null>;
}
// modules/payment/payment.service.ts — 003 실재 + 004 수정
class PaymentService { pay(userId, orderId, idempotencyKey): /* amount = totalAmount - discountAmount (FR-015) */ }
// modules/seller/seller.service.ts — 003 실재
class SellerService { getApprovedSeller(userId): Promise<{ id; userId }>; }  // 미승인 403
```

### 004 신규 공개 인터페이스 (모듈 간 DI)

```ts
class CouponService {
  // order 가 주문 생성 시 호출(orderTotal 은 인자 — coupon 이 orders 미조회, P-001)
  validateAndCalculateDiscount(userCouponId: string, userId: string, orderTotal: Prisma.Decimal):
    Promise<{ discountAmount: Prisma.Decimal; couponId: string }>;  // FR-011 검증 throw(403/422), FR-012 계산
  markUsed(input: { userCouponId: string; orderId: string; userId: string; discountAmount: Prisma.Decimal }):
    Promise<void>;  // tx 내 조건부 UPDATE(count===0→409) + onAfterCommit emit coupon.used (tx-aware)
  restoreForOrder(orderId: string): Promise<void>;  // 취소 tx 내 복원(WHERE usedOrderId=orderId), 쿠폰 무 → no-op (tx-aware)
}
```

### 트랜잭션 경계 계약 (QualityGate 핵심 — 004 원자성)

- **쿠폰 적용 주문 생성**(FR-013): `runInTransaction` 안에서 `decreaseStock×N` → `couponService.markUsed`(조건부 UPDATE) → order/items/events insert → `cart.removeItems`. 어느 한 단계 실패 → 전체 롤백 → user_coupon.status=unused 유지(SC-019). markUsed `count===0`(이중사용) → 409 + 롤백(SC-020).
- **쿠폰 복원 취소**(FR-016): `cancel` 의 `runInTransaction` 안에서 (003 환불·restoreStock·상태전이) + `couponService.restoreForOrder`. 환불 실패 시 전체 롤백(쿠폰 복원 미반영)(SC-023).
- **전파 메커니즘**: coupon.repository 가 `this.prisma.tx` 사용 → ALS 활성 트랜잭션 자동 참여(003 인프라). `coupon.used` emit 은 `onAfterCommit` 지연(커밋 후 root client).

### 하위 호환성 / 방어 코드

- `CreateOrderDto` 에 `userCouponId?` optional 추가 → 003 호출(미전달) 동작 불변(FR-014, SC-021). 003 테스트(177 PASS) 회귀 없음.
- `payment.pay` 의 amount 변경은 discountAmount=0(003 모든 기존 주문)에서 결과 동일 → 003 결제 테스트 회귀 없음.
- coupon.repository·review.repository 는 `this.prisma.tx` 사용(ALS 미활성 시 root client — coupon 조회·발급 등 비-tx 경로 정상 동작).
- review 생성 시 P2002 catch → 409 변환(방어 코드, FR-021c).
- `getOrderItemForReview` 미존재 orderItem → null 반환(review.service 가 404 변환).

---

## 데이터 모델

> 상세 컬럼·타입·인덱스·제약·마이그레이션 순서는 **Database Design Agent**(selection-phases.md: Y)가 `data-model.md`/마이그레이션으로 확정한다. 본 절은 plan 수준 목표 구조·핵심 제약(DB Design 입력 contract).

### commerce 스키마 (신규 3테이블)

| 테이블 | 핵심 필드 | 제약·인덱스 | 모듈 |
|---|---|---|---|
| `commerce.coupons` | `id`, `issuerType`(enum ADMIN/SELLER), `issuerId`(plain String — admin userId 또는 seller.id), `type`(enum FIXED/PERCENTAGE), `discountValue Decimal(12,2)`, `maxDiscountAmount Decimal(12,2)?`(PERCENTAGE 전용), `minOrderAmount Decimal(12,2)?`, `expiresAt DateTime`(필수), `totalQuantity Int?`(null=무제한), `issuedCount Int @default(0)`(ADR-004 한도 가드), `description String?`, `createdAt` | index(issuerType, issuerId) — FR-006 판매자 조회 | coupon |
| `commerce.user_coupons` | `id`, `couponId`(동일스키마 FK), `userId`(plain String — users.users.id, P-001 경계), `status`(enum unused/used/expired, default unused), `usedOrderId`(plain String? — orders.orders.id, P-001 경계), `createdAt` | index(userId, status) — FR-005, index(usedOrderId) — FR-016 복원 | coupon |
| `commerce.reviews` | `id`, `orderItemId`(plain String, **@unique** — orders.order_items.id, P-001 경계), `orderId`(plain String), `userId`(plain String), `productId`(plain String — FR-025 조회), `sellerId`(plain String), `rating Int`(1~5), `content String`, `createdAt`, `updatedAt @updatedAt` | `@@unique([orderItemId])`(FR-021c, ADR-009), index(productId, createdAt desc, id desc) — FR-025 cursor, index(userId, createdAt desc, id desc) — FR-026 | review |

### 스키마 enum 신규 (commerce)

| enum | 값 | 근거 |
|---|---|---|
| `CouponIssuerType` | ADMIN, SELLER | FR-001/002 |
| `CouponType` | FIXED, PERCENTAGE | FR-001, FR-012 |
| `UserCouponStatus` | unused, used, expired | FR-005/011/013/016 |

> **P-001/NFR-005 핵심**: `user_coupons.userId`·`user_coupons.usedOrderId`·`reviews.orderItemId/orderId/userId/productId/sellerId` 는 전부 cross-schema(users·orders·products) 경계 → **Prisma `@relation` 미선언 plain String**(003 패턴 승계). 동일 commerce 스키마 내 FK(`coupons`↔`user_coupons`)만 정상 선언. enum 의 DB 표현(Prisma enum vs String)은 DB Design 확정. `reviews.rating` 앱 레벨 1~5 검증(DTO).

---

## 테스트 전략

> 테스트 수준: 단위/정적. spec 의 모든 SC 가 [env:unit] 또는 [env:static]. 통합·E2E 대상 없음(외부 연동·다중 프로세스 협력 없음 — 쿠폰·리뷰는 단일 앱 내 DI/tx).

### 통합 테스트 / 운영 검증 defer (PATCH-A08) — 옵션 C

- 본 spec 은 통합/운영 검증을 파이프라인 범위에서 **옵션 C(단위 + 정적 검증만으로 마감)** 채택. spec.md "사후 운영 검증 피드백 사이클" 에 운영 점검 시나리오 명시됨(spec 작성자 = 사용자 확인 완료).
- **(PROC-010) 옵션 C 운영 환경 의존성 자가 점검**:
  1. **운영 환경 의존성 평가**: N — 결함 발견이 배포 토폴로지·외부 시스템·OS·네트워크 미들웨어에 의존하지 않음. 쿠폰 이중사용·복원·결제 청구액·리뷰 중복은 전부 PostgreSQL 트랜잭션/제약으로 결정되며 단일 앱 내에서 재현 가능.
  2. **mock 시뮬레이션 가능성**: 동시성(SC-020 이중사용, SC-007 한도)은 단위 테스트에서 동일 user_coupon/coupon 에 대한 조건부 UPDATE `count` 결과를 직접 단언(2회차 count=0)하여 검증 가능. 실제 DB 동시 트랜잭션은 통합 환경에서만 완전 재현되나, 조건부 UPDATE 의 원자성은 PostgreSQL 표준 보장이므로 단위 단언으로 갈음. mock 불가 운영 시나리오 없음.
  3. **권장 옵션 재검토**: 1·2 모두 N → 옵션 C 유지 정당. 운영 모니터링 보완은 spec.md 피드백 사이클(동시 주문·복원·결제 금액·리뷰 중복 4시나리오)로 충족.
- **(PROC-014) 사후 운영 검증 피드백 사이클**: spec.md "사후 운영 검증 피드백 사이클" 절에 명시됨(broker 무관, 쿠폰/리뷰 도메인 4시나리오). 결함 발견 시 처리 절차(spec 수정 이벤트 → 1단계 재진입 또는 patch spec, cycle-N-archive 백업) 동일 명시. 사용자 확인 완료.

### SC↔테스트 매핑 (요약)

| SC 식별자 | 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | 단위 | Happy | admin FIXED 쿠폰 생성 | `{type:FIXED,discountValue:5000,expiresAt,description}` | 201 + coupon |
| SC-002 | 단위 | Happy | admin PERCENTAGE 쿠폰 생성 | `{type:PERCENTAGE,discountValue:20,maxDiscountAmount:10000,minOrderAmount:30000}` | 201 |
| SC-003 | 단위 | Error | 비-admin `POST /admin/coupons` | 일반 고객/판매자 JWT | 403 |
| SC-004 | 단위 | Happy | APPROVED 판매자 쿠폰 생성 | seller JWT | 201 (issuerType=SELLER, issuerId=seller.id) |
| SC-005 | 단위 | Error | PENDING/REJECTED/고객 판매자 쿠폰 생성 | 미승인 JWT | 403 |
| SC-006 | 단위 | Happy | admin 발급 | `{userId}` | 201 user_coupon(unused) |
| SC-007 | 단위 | Edge | totalQuantity=2, 3번째 발급 | 3rd issue | 409 (issuedCount 가드) |
| SC-008 | 단위 | Happy | 판매자 자기 쿠폰 발급 | seller A, coupon issuerId=A | 201 |
| SC-009 | 단위 | Error | 판매자 타 발급자 쿠폰 발급 | seller A, coupon issuerId≠A | 403 |
| SC-010 | 단위 | Happy | 내 쿠폰 조회(타인 제외) | `GET /users/me/coupons` | 본인 user_coupon만 |
| SC-011 | 단위 | Happy | 판매자 생성 쿠폰 조회(타인 제외) | `GET /sellers/me/coupons` | 본인 issuerId만 |
| SC-012 | 단위 | Happy | FIXED 5000, total 60000 + 클라 임의 discountAmount | userCouponId | order.discountAmount=5000(서버값) |
| SC-013 | 단위 | Edge | FIXED 5000, total 3000(초과 방지) | — | discountAmount=3000 |
| SC-014 | 단위 | Edge | PERCENTAGE 20%/max10000: total 60000→10000(상한), 30000→6000 | — | 상한 적용/미적용 |
| SC-015 | 단위 | Error | 만료 쿠폰 주문 | expiresAt 경과 | 422 |
| SC-016 | 단위 | Error | status=used 쿠폰 주문 | — | 422 |
| SC-017 | 단위 | Error | 타인 userCouponId 주문 | user_coupon.userId≠me | 403 |
| SC-018 | 단위 | Error | minOrderAmount=30000, total 20000 | — | 422 |
| SC-019 | 단위 | Happy | 정상 사용 → status=used·usedOrderId, 주문 실패 시 unused 유지 | — | tx 원자 전이 |
| SC-020 | 단위 | Edge | 동일 user_coupon 동시 2주문(이중사용) | 동시 markUsed | 1건 성공·1건 409 |
| SC-021 | 단위 | Happy | userCouponId 없는 주문 | — | discountAmount=0 (003 동작) |
| SC-022 | 단위 | Happy | 쿠폰 주문 결제 | total 60000·discount 10000 | payment.amount=50000 |
| SC-023 | 단위 | Happy | 쿠폰 적용 주문 취소 → 복원 | `DELETE /orders/:id` | status=unused·usedOrderId=null |
| SC-024 | 단위 | Happy | 쿠폰 사용 후 이벤트 | — | coupon.used(payload 5필드) |
| SC-030 | 단위 | Happy | completed 주문 orderItem 리뷰 | `{orderItemId,rating:5,content}` | 201 |
| SC-031 | 단위 | Error | 비-completed 주문 리뷰 | pending~delivered | 422 |
| SC-032 | 단위 | Error | 타인 주문 orderItem 리뷰 | order.userId≠me | 403 |
| SC-033 | 단위 | Edge | 동일 orderItem 2번째 리뷰 | — | 409 (unique) |
| SC-034 | 단위 | Error | rating=0/6 | — | 400 |
| SC-035 | 단위 | Happy | 본인 리뷰 수정 | `{rating:4,content}` | 수정 반영 |
| SC-036 | 단위 | Error | 타인 리뷰 수정 | review.userId≠me | 403 |
| SC-037 | 단위 | Happy | 본인 리뷰 삭제 | — | 204 |
| SC-038 | 단위 | Error | 타인 리뷰 삭제 | — | 403 |
| SC-039 | 단위 | Happy | 상품 리뷰 공개 조회 | `?limit=10`, JWT 무 | 최신순 cursor, 200 |
| SC-040 | 단위 | Happy | 내 리뷰 조회(타인 제외) | `GET /reviews/me` | 본인 리뷰만 |
| SC-041 | 단위 | Happy | 리뷰 생성 후 이벤트 | — | review.created(payload 6필드) |
| SC-050 | 정적 | — | Decimal 금전 필드(Float 부재) | grep schema.prisma | discountValue·maxDiscountAmount·minOrderAmount·discountAmount Decimal |
| SC-051 | 단위/정적 | — | 조건부 UPDATE WHERE status='unused' | grep/단위 | 구문 존재·count 가드 |
| SC-052 | 단위 | Error | JWT 무 인증 필요 엔드포인트 | — | 401 |
| SC-053 | 단위 | Error | IDOR 시나리오(SC-017·032·036·038 포함) | — | 403 |
| SC-054 | 정적 | — | coupon/review repo 타 도메인 모델 직접 참조 0 | grep repository | orders/users/products 모델 미참조 |
| SC-055 | 정적 | — | `@aws-sdk/*` 신규 0 | grep package.json | 미추가 |

> **시나리오 유형 충족**: Happy(생성·정상 사용·조회·이벤트)·Edge(초과 방지·상한·한도·동시성·중복)·Error(권한·만료·범위·rating)가 SC 전반에 분포. Test Agent 가 coverage.md 에 SC 단위 유형 충족 기록.

### smoke_tests

- 필요 여부: N
- 근거: 본 spec 변경은 coupon/review 신규 모듈 + order/payment 의 additive 분기(userCouponId 없으면 003 경로 불변). SC 매핑 테스트가 회귀 경계(003 동작 유지: SC-021 discountAmount=0, payment discountAmount=0 동일)를 직접 포함하므로 SC 범위 밖 별도 smoke 불필요. 003 의 177 테스트는 CI 에서 회귀 감지.

---

## 기타 고려사항

- **검증 read vs tx 내 update 의 코드 구분(이중 방어)**: FR-011(a~d) 검증은 tx 진입 전 read 로 정확한 4xx(403/422)를 반환하고, tx 내 `markUsed` 의 `count===0` 은 동시성 race(이미 used) 전용 409. SC-016(사전 read 로 422)과 SC-020(race 로 409)이 의미적으로 구분됨 — Design/Test 가 두 경로를 별도 케이스로 다룬다.
- **issuedCount 와 user_coupons count 의 정합**: 발급 한도는 `coupons.issuedCount` 카운터로 판정(ADR-004). 발급 후 user_coupon 삭제 기능은 본 spec 범위 외이므로 issuedCount 와 실제 user_coupon 수는 일치 유지(감소 경로 없음). Prisma 의 `WHERE issuedCount < totalQuantity`(컬럼-컬럼 비교) 가능 여부는 Design research 에서 확정 — 불가 시 `$queryRaw` 또는 tx 내 read-lock+조건 update 대안(ADR-004 명시).
- **status='expired' 처리**: FR-005 의 expired 필터는 (a) 만료 시 배치로 status 전이 vs (b) 조회 시 `expiresAt < now` 동적 계산 중 선택. 본 spec 에 만료 배치 잡 요구 없음(범위 외 "쿠폰 비활성화" 인접) → 조회 시 동적 판정 또는 저장 status 기준을 Design 이 확정(SC-010 은 unused 기본 필터만 검증하므로 expired 동적/저장 선택은 SC 불변). 쿠폰 사용 시점(FR-011c)의 만료는 항상 `coupon.expiresAt` 동적 비교로 판정(저장 status 무관).
- **판매자 자기 상품 리뷰·자기 쿠폰 자가 사용**: spec.md PATCH-001 "잠재 위험 기록" 으로 허용·기록(사업 위험). 향후 `order_items.sellerId ≠ review.userId` 등 제어는 별도 정책 spec(범위 외).
- **EventEmitter 동기 핸들러의 tx 전파 주의**: `coupon.used` 는 `onAfterCommit` 으로 커밋 후 발행하여 핸들러 쿼리가 주문 tx 에 편입되지 않도록 함(003 ADR-005 승계). `review.created` 는 tx 미사용 단일 insert 후 발행.
- **부분 환불 시 쿠폰**: 범위 외(전액 취소만 복원). FR-016 은 `cancelled` 전이에만 작동.
</content>
