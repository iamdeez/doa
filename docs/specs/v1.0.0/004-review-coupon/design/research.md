---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 13:54
상태: 확정
---

# Research: 004-review-coupon

## 목차

- [분석 우선순위 게이트 결과](#분석-우선순위-게이트-결과)
- [기존 코드베이스 분석](#기존-코드베이스-분석)
  - [클래스·모듈 계층 구조](#클래스모듈-계층-구조)
  - [영향 범위 분석 (호출 측 전수 목록)](#영향-범위-분석-호출-측-전수-목록)
  - [공유 상태·동시성 분석](#공유-상태동시성-분석)
- [영향 파일 목록](#영향-파일-목록)
- [§F production 시그니처 변경 — 호출 측 테스트 식별 (PROC-001)](#f-production-시그니처-변경--호출-측-테스트-식별-proc-001)
- [외부 라이브러리 API 실제 동작 확인](#외부-라이브러리-api-실제-동작-확인)
- [인정되는 한계 및 안전망 (PATCH-A07)](#인정되는-한계-및-안전망-patch-a07)
- [배포 환경 영향 추정 (PATCH-A10)](#배포-환경-영향-추정-patch-a10)
- [context.md 부정합 사전 점검 (PATCH-A11)](#contextmd-부정합-사전-점검-patch-a11)
- [기술 선택 조사](#기술-선택-조사)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 분석 우선순위 게이트 결과

- **변경 대상 모듈(plan §핵심 설계)**: `coupon`(빈 스텁 실구현), `review`(빈 스텁 실구현), `order`(createOrder·cancel 수정 + getOrderItemForReview 신규), `payment`(pay 수정), `prisma`(ALS 재사용, 변경 0), `schema.prisma`(commerce 3테이블 — Database Design Agent 소유).
- §A·B·C 분석은 위 모듈로 한정.
- §D(다단계 병렬 파이프라인): 미해당 — 건너뜀.
- §E(동일 가드 결정 통합): 할인 계산 분기(FIXED/PERCENTAGE)에 적용 — 본문 [엣지 케이스](#엣지-케이스-및-한계) 참조.
- 외부 라이브러리 검증(§4): **신규 라이브러리 0건**. 기존 `Prisma.Decimal` 메서드는 plan §외부 라이브러리 동작 검증에서 public API 확인 완료(승계). `$executeRaw` 만 신규 사용 패턴 — 아래 검증.
- §F(production 시그니처 변경): **해당** — `createOrder`·`cancel`·`pay` 수정 → 전용 절 수행.

---

## 기존 코드베이스 분석

> context.md §2 핵심 모듈 목록·§4 데이터 모델을 기준선으로 삼는다. 전체 구조는 context.md 참조, 본 절은 변경 대상 한정 정밀 분석.

### 클래스·모듈 계층 구조

- **OOP 상속/추상 클래스 없음**: 변경 대상은 전부 NestJS `@Injectable()` concrete 클래스. `protected` 생성자·pure virtual 부재. 신규 클래스(CouponService 등)는 상속 없이 직접 인스턴스화(NestJS DI).
- **모듈 DI 토폴로지(실측)**:
  - `OrderService` 생성자(실측 `order.service.ts:23-32`): `OrderRepository`, `PrismaService`, `ProductService`, `InventoryService`, `CartService`, `SellerService`, `@Inject(forwardRef(()=>PaymentService))`. → **004 가 `CouponService` 를 7번째 의존으로 추가**.
  - `OrderModule.imports`(실측 `order.module.ts`): `AuthSharedModule, SellerModule, ProductModule, InventoryModule, CartModule, forwardRef(()=>PaymentModule)`. → **004 가 `CouponModule` 추가**. exports 에 `OrderService, OrderRepository` 이미 존재(review DI 소비 가능).
  - `PaymentService` 생성자(실측): `PaymentRepository`, `PrismaService`, `@Inject(forwardRef(()=>OrderRepository))`, `@Inject(PAYMENT_GATEWAY)`. → **신규 의존 추가 없음**. `pay` 가 이미 주입된 `orderRepository.findById(orderId)` 로 `order.discountAmount` 획득.
  - `SellerService.getApprovedSeller(userId): Promise<{id; userId}>`(실측 `seller.service.ts:101`) — 미승인 시 `ForbiddenException`. coupon 모듈이 DI 소비(FR-002/004).
  - `AdminGuard`(실측 `admin.guard.ts`) — `ADMIN_USER_IDS` env fail-closed, `@UseGuards(AdminGuard)` 메서드/클래스 레벨 적용 가능(`seller.controller.ts:62` 패턴).

- **순환 DI 점검(신규 4개 의존 관계)**:
  | 관계 | 방향 | 순환? |
  |---|---|---|
  | order → coupon | OrderModule imports CouponModule, OrderService uses CouponService | coupon 은 order 미import → **순환 없음** |
  | coupon → seller | CouponModule imports SellerModule | seller 는 coupon 미import → 순환 없음 |
  | review → order | ReviewModule imports OrderModule, ReviewService uses OrderService.getOrderItemForReview | order 는 review 미import → **순환 없음** |
  | payment → order | (003 기존 forwardRef OrderRepository) | 변경 없음 |
  - 결론: **forwardRef 신규 도입 불필요**. order↔coupon·review↔order 는 단방향. (003 의 order↔payment forwardRef 만 유지.)

### 영향 범위 분석 (호출 측 전수 목록)

- **`OrderService.createOrder` 호출 측**: `order.controller.ts:30`(HTTP), `order.service.spec.ts`(단위). 시그니처는 dto 에 optional 필드 추가 → HTTP 호출 측 무변경(FR-014). 단위 테스트 측은 §F 참조.
- **`OrderService.cancel` 호출 측**: `order.controller.ts:66`(`POST /orders/:orderId/cancel`), `order.service.spec.ts`. 시그니처 불변. **라우트 불일치 주의**: spec/plan 은 `DELETE /orders/:id` 로 표기하나 **003 실구현은 `POST /orders/:orderId/cancel`**(실측 `order.controller.ts:60`). 004 는 `cancel()` 서비스 메서드 내부만 수정(restoreForOrder 추가)하고 라우트는 003 그대로 유지 → SC-023 은 [env:unit] 서비스 단위 검증이므로 라우트 표기 불일치는 무영향. (GAP-001 기록.)
- **`PaymentService.pay` 호출 측**: `payment.controller.ts`(HTTP), `order` 모듈은 pay 직접 호출 없음, `payment.service.spec.ts`. 시그니처 불변. §F 참조.
- **신규 `OrderService.getOrderItemForReview`**: review 모듈만 호출(신규). 기존 호출 측 0.
- **`CreateOrderDto`**: `order.controller.ts` 만 사용. optional `userCouponId?` 추가 → 비전달 시 003 동작 불변.

### 공유 상태·동시성 분석

- **공유 자원**: `commerce.user_coupons.status`(이중사용 대상), `commerce.coupons.issuedCount`(발급 한도 대상), `commerce.reviews.orderItemId`(중복 리뷰 대상).
- **Check-Then-Act 회피(전부 원자적 조건부 연산)**:
  | 자원 | 위험 | 안전망(원자 연산) | 근거 |
  |---|---|---|---|
  | user_coupon.status | 동일 쿠폰 2주문 동시 사용 | tx 내 `updateMany({where:{id, status:'unused'}, data:{status:'used', usedOrderId}})` → `count===0`→409 | FR-013, SC-020. 003 `decreaseStock` 의 `count===0` 패턴과 동형(검증된 패턴) |
  | coupons.issuedCount | 한도 초과 동시 발급 | tx 내 `$executeRaw UPDATE ... SET issued_count=issued_count+1 WHERE id=? AND (total_quantity IS NULL OR issued_count<total_quantity)` → 영향 행 0→409 | FR-003, SC-007, ADR-004 |
  | reviews.orderItemId | 동일 orderItem 중복 리뷰 | DB `@@unique([orderItemId])` → 2번째 insert P2002 catch→409 | FR-021c, SC-033, ADR-009 |
- **Lock 범위**: 별도 비관 락(SELECT FOR UPDATE) 미사용. PostgreSQL 조건부 UPDATE 의 행 수준 락이 원자성 보장. Lock 내 네트워크/파일 I/O 없음(쿠폰 사용은 순수 DB UPDATE).
- **검증 read vs tx 내 update 의 이중 방어(plan §기타 고려사항 승계)**: `validateAndCalculateDiscount`(FR-011 a~d)는 `runInTransaction` **진입 전** root client read 로 명시적 4xx(403/422). tx 내 `markUsed` 의 `count===0` 은 동시성 race(이미 used) 전용 409. SC-016(사전 read 422) ↔ SC-020(race 409) 의미 구분.
- **EventEmitter tx 전파 주의**: `coupon.used` 는 `markUsed` 내부에서 `prisma.onAfterCommit(()=>emit)` → 커밋 후 발행(주문 tx 미오염, 003 ADR-005 승계). `review.created` 는 tx 미사용 단일 insert 성공 후 직접 emit.
- **캐싱 컴포넌트 없음**: 본 spec 은 in-memory 캐시 도입 없음 → 캐시 생명주기 검토 비해당.

---

## 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 | 레이어 |
|---|---|---|---|
| `prisma/schema.prisma` | 수정(DB Design 소유) | commerce 3테이블(coupons·user_coupons·reviews) + 3 enum | A |
| `src/modules/coupon/coupon.repository.ts` | 신규 구현 | commerce.coupon/userCoupon 쿼리 + issuedCount $executeRaw + markUsed/restore 조건부 update | A |
| `src/modules/coupon/coupon.service.ts` | 신규 구현 | 생성·발급·조회·validateAndCalculateDiscount·markUsed·restoreForOrder | B |
| `src/modules/coupon/coupon.events.ts` | 신규 구현 | `coupon.used` emit 헬퍼 | B |
| `src/modules/coupon/coupon.controller.ts` → 다중 분리 | 신규 구현 | AdminCoupon·SellerCoupon·UserCoupon 컨트롤러 | C |
| `src/modules/coupon/dto/*.ts` | 신규 | create-coupon·issue-coupon·list-coupon dto | C |
| `src/modules/coupon/coupon.module.ts` | 수정 | imports(SellerModule·AuthSharedModule·EventEmitter)·exports(CouponService)·다중 controller | C |
| `src/modules/review/review.repository.ts` | 신규 구현 | commerce.review CRUD + cursor 조회 | A |
| `src/modules/review/review.service.ts` | 신규 구현 | 작성(권한 검증 DI)·수정·삭제·공개조회·내리뷰 | B |
| `src/modules/review/review.events.ts` | 신규 구현 | `review.created` emit 헬퍼 | B |
| `src/modules/review/review.controller.ts` → 다중 분리 | 신규 구현 | Review·ProductReview 컨트롤러 | C |
| `src/modules/review/dto/*.ts` | 신규 | create-review·update-review·list-review dto | C |
| `src/modules/review/review.module.ts` | 수정 | imports(OrderModule·AuthSharedModule·EventEmitter)·다중 controller | C |
| `src/modules/order/dto/create-order.dto.ts` | 수정(additive) | optional `userCouponId?: string` 필드 추가 | C |
| `src/modules/order/order.service.ts` | 수정(additive) | createOrder 쿠폰 분기·cancel restoreForOrder·getOrderItemForReview 신규 + CouponService 의존 추가 | B |
| `src/modules/order/order.repository.ts` | 수정(additive) | `findOrderItemWithOrder(orderItemId)` 신규(orders 스키마 join) | A |
| `src/modules/order/order.module.ts` | 수정(additive) | imports 에 CouponModule 추가 | C |
| `src/modules/payment/payment.service.ts` | 수정 | pay amount = totalAmount.minus(discountAmount) | B |
| `test/static/cross-schema.spec.ts` | 수정(확장) | coupon/review repo 규칙 + commerce 모델 목록에 coupon/userCoupon/review 추가 (SC-054) | D |
| `test/static/schema-decimal.spec.ts` | 수정(확장) | discountValue·maxDiscountAmount·minOrderAmount Decimal 검증 추가 (SC-050) | D |

> `package.json` 변경 0건(신규 npm 의존 없음 — SC-055 자동 충족). `@nestjs/event-emitter`·`@prisma/client`·`class-validator` 는 003 에서 이미 설치됨.

---

## §F production 시그니처 변경 — 호출 측 테스트 식별 (PROC-001)

> production 메서드 시그니처/생성자 변경 → 호출 측 테스트 동반 마이그레이션 누락이 003 baseline(101+177) 회귀로 이어질 위험을 사전 식별.

### 변경되는 production 메서드/생성자 목록

| 대상 | 변경 전 | 변경 후 | 변경 성격 |
|---|---|---|---|
| `OrderService` 생성자 | 6 의존(repo·prisma·product·inventory·cart·seller) + forwardRef payment | **+`CouponService`(7번째)** | 의존 추가 — TestingModule provider 추가 필수 |
| `OrderService.createOrder` | `(userId, {items, shippingAddress})` | `(userId, {items, shippingAddress, userCouponId?})` | additive(optional) |
| `OrderService.cancel` | `(userId, orderId)` | 시그니처 동일, 내부 restoreForOrder 호출 추가 | 내부 동작 추가 |
| `OrderService.getOrderItemForReview` | (없음) | `(orderItemId): Promise<{...}|null>` | 신규 공개 |
| `PaymentService.pay` | 시그니처 동일, amount 산출 변경 | `amount = totalAmount.minus(discountAmount)` | 내부 동작 변경 |

### 호출 측 테스트 전수 (grep 결과)

```
grep -rnE "createOrder\(|\.cancel\(|\.pay\(|OrderService|PaymentService" src/modules/**/*.spec.ts
```

- `src/modules/order/order.service.spec.ts` — `OrderService` TestingModule 구성(`mockOrderRepository`·`mockProductService`·`mockInventoryService`·`mockCartService`·`mockPaymentService`·`mockSellerService`·`mockPrismaService` 7개 provider). createOrder/cancel 직접 호출.
- `src/modules/payment/payment.service.spec.ts` — `PaymentService` TestingModule. `pay`·`refund` 호출. order mock = `FIXED_ORDER_PENDING`.

### 호출 측 마이그레이션 필요 여부 판정

1. **OrderService 생성자에 CouponService 추가** → `order.service.spec.ts` 의 `Test.createTestingModule({providers:[...]})` 에 **`{provide: CouponService, useValue: mockCouponService}` 추가 필수**. 누락 시 `Nest can't resolve dependencies of OrderService` 컴파일 에러로 003 order 테스트(SC-009~032) 전부 FAIL.
   - **처리**: 본 spec 의 order 쿠폰 테스트(SC-012~024)가 `order.service.spec.ts` 를 확장(D 레이어/5a)하면서 동일 TestingModule 에 mockCouponService 를 등록 → 003 기존 테스트도 동일 beforeEach 모듈에서 해소. **tasks D 레이어 + Test Authoring Contract 에 명시**.
2. **`PaymentService.pay` 의 `order.discountAmount` read** → `payment.service.spec.ts` 의 `FIXED_ORDER_PENDING` mock 은 **이미 `discountAmount: '0'` 포함**(실측 `payment.service.spec.ts:79`). `new Prisma.Decimal(totalAmount).minus('0') = totalAmount` → 기존 amount 단언(30000) 불변. **회귀 없음(검증 완료)**. PROC-001 representation 점검: 단언이 읽는 값(`payment.amount`)은 discountAmount=0 에서 동일.
3. **`createOrder` userCouponId 미전달 경로** → 003 order 테스트는 userCouponId 없이 호출 → `if(userCouponId)` 분기 skip → CouponService 미호출, discountAmount=0(SC-021). 단, (1)의 생성자 provider 등록이 전제. 등록 후 discountAmount 단언(=0) 불변.
4. **정적 AST 검사 테스트 없음** — `_find_funcdef` 류 sync↔async 매칭 테스트 부재(본 변경은 전부 async 유지). 해당 없음.

### 본 spec 범위 포함 여부

- 호출 측 마이그레이션(order.service.spec 에 mockCouponService 등록)은 **본 spec D 레이어 범위에 포함**(SC-012~024 테스트 작성과 동일 파일 확장). spec.md FR-010~017 이 createOrder 쿠폰 연동을 명시 → 범위 내. **BLOCKED 불필요**.
- payment.spec 은 마이그레이션 불요(이미 호환). → tasks 의 회귀 확인 항목에만 명시.

> **동적 호출 사각지대**: getattr/eval 류 동적 호출 없음(NestJS DI 정적). CI 의 `pnpm --filter backend test` 전체 suite 가 사후 안전망.

---

## 외부 라이브러리 API 실제 동작 확인

- **신규 외부 라이브러리: 없음 — 해당 없음**(PATCH-04 import 형태 명시 대상 부재). selection-phases.md PATCH-A15 자가 점검 결과 신규 npm 0건.
- **`Prisma.Decimal`(decimal.js)**: plan §외부 라이브러리 동작 검증에서 public API 확인 승계 — 인스턴스 `.floor()`(`index-browser.d.ts:80`)·`.mul/.div/.minus/.lte/.gte`·정적 `Decimal.min(...)`(:248). PERCENTAGE 할인 FLOOR·MIN·상한·주문초과 방지를 부동소수점 없이 구현(NFR-001). public API 만 사용(PATCH-A14 1순위), private API 미사용 → PROC-013 lifecycle 검증 비해당.
- **`updateMany` `{count}` 반환**: Prisma 공식 동작. 003 `decreaseStock` 의 `conditionalDecrement` 에서 검증된 패턴 재사용. `markUsed`/`restoreForOrder` 가 사용.
- **`$executeRaw` 반환값(신규 사용 패턴 — 검증)**: Prisma `$executeRaw`/`$executeRawUnsafe` 는 **영향받은 행 수(number)** 를 반환(공식 문서). issuedCount 조건부 increment 에 사용:
  - 근거: Prisma `where` 필터는 **컬럼-컬럼 비교(`issuedCount < totalQuantity`)를 지원하지 않음**(상수 비교만 가능). 따라서 `updateMany` 로는 한도 가드 불가 → `$executeRaw` parameterized SQL 로 원자적 조건부 UPDATE 수행. 반환 number===0 → 한도 초과 409.
  - 형태: ``this.prisma.tx.$executeRaw`UPDATE commerce.coupons SET issued_count = issued_count + 1 WHERE id = ${couponId} AND (total_quantity IS NULL OR issued_count < total_quantity)` `` — Prisma tagged-template 으로 SQL injection 방어. **commerce 스키마 자기 테이블만 참조**(P-001 무위반).
  - tx 참여: `this.prisma.tx.$executeRaw` 는 ALS 활성 시 tx 클라이언트로 발행 → user_coupon insert 와 동일 tx(ADR-004). count===0 시 throw → 롤백.

가정-실제 불일치 현재 미발견.

---

## 인정되는 한계 및 안전망 (PATCH-A07)

| 인정되는 한계 | 안전망 |
|---|---|
| 단위 테스트는 실제 동시 트랜잭션을 재현하지 못함(mock PrismaService passthrough). SC-020 이중사용·SC-007 한도의 진짜 race 는 통합 환경에서만 완전 재현 | 조건부 UPDATE/`$executeRaw` 의 원자성은 PostgreSQL 표준 보장. 단위는 2회차 `count===0`(또는 `$executeRaw`→0) 을 직접 단언하여 분기 로직 검증. spec.md "사후 운영 검증 피드백 사이클" 1·2번 시나리오가 운영 안전망(옵션 C, PROC-010 N/N 판정). |
| `validateAndCalculateDiscount` 의 만료 판정(`expiresAt <= now`)은 read 시점 기준 — read 후 markUsed 사이 만료는 미포착 | 사용 시점 만료 윈도우는 초 단위로 무시 가능(쿠폰 만료는 일 단위). 이중 방어 불필요(spec 요구 외). |
| `status='expired'` 저장 전이 배치 부재 → 조회 필터의 expired 의미가 동적/저장 중 택1 | SC-010 은 unused 기본 필터만 검증(expired 선택 무관). 사용 시점 만료(FR-011c)는 항상 `coupon.expiresAt` 동적 비교(저장 status 무관) → 정합. 아래 [기술 선택 조사](#기술-선택-조사) 확정. |

## 배포 환경 영향 추정 (PATCH-A10)

- 본 spec 변경은 순수 비즈니스 로직 + 인-프로세스 EventEmitter + PostgreSQL 트랜잭션/제약. 컨테이너 NAT·docker-proxy TCP·L4 LB·firewall conntrack·kernel keepalive 등 네트워크 미들웨어 특이성 **영향 없음**(외부 소켓 연결·heartbeat 부재).
- 운영 영향 1건: Prisma 마이그레이션(commerce 3테이블 + unique/복합 인덱스)의 Fly release 단계 실행 — 로컬 `prisma migrate dev` 로 갈음(plan §배포 환경 영향, spec.md 사후 운영 검증). infra.md GAP 신규 등록 불필요(003 에서 이미 식별, 본 spec 신규 인프라 0).
- (PROC-003 컨테이너 빌드 산출물 경로): 본 spec 은 `docker build` 성공 SC 미포함(`[env:e2e-docker]` 태그 SC 부재, Deploy Agent N). Dockerfile COPY 경로 변경 없음 → 점검 비해당.

## context.md 부정합 사전 점검 (PATCH-A11)

> 변경 대상 클래스·필드·Enum 과 관련된 context.md §2/§4/§5 항목을 grep 으로 추출, 변경 후 정의 유효성 평가.

| context.md 항목 | 현재 정의 | 변경 후 | GAP 등록 |
|---|---|---|---|
| §2 핵심 모듈 — `coupon`/`review` | "빈 스텁(골격만)" + §6 "10개 도메인 모듈 빈 스텁" | coupon·review **실구현** → §2 비고·§6 항목에서 2개 모듈 제거 필요 | GAP-002 (6단계 Docs Agent 갱신 위임) |
| §4 데이터 모델 — commerce 스키마 | "commerce 1(carts)" / "19개 테이블 실체화" | commerce **4테이블**(carts·coupons·user_coupons·reviews) / **22개 테이블** | GAP-002 |
| §3.2 이벤트 — `coupon.used` | "발행 모듈 coupon / 인-프로세스 EventEmitter"(이미 표기됨) | 실제 발행 구현됨 → 정의 유효(부정합 없음) | 없음 |
| §3.2 이벤트 — `review.created` | context.md 이벤트 표에 미등재 | 신규 발행 → 이벤트 표 행 추가 필요 | GAP-002 |
| §5 용어 — cursor 페이지네이션 | 정의 유효 | review FR-025/026 동일 패턴 적용 → 부정합 없음 | 없음 |

> 위 항목은 6단계 Docs Agent 가 PATCH-A10 컨텍스트 검토로 갱신(본 spec 구현·검증 완료 시점). 3단계에서 사전 가시화하여 누락 위험 최소화. gaps.md GAP-002 등록.

---

## 기술 선택 조사

| 결정 | 채택 | 근거 |
|---|---|---|
| coupon 다중 컨트롤러 분리 | `AdminCouponController`(`@Controller('admin/coupons')`)·`SellerCouponController`(`@Controller('sellers/me/coupons')`)·`UserCouponController`(`@Controller('users/me/coupons')`) | 전체 경로 상이(`sellers/me/coupons` vs 기존 `sellers/register`·`sellers/me` 충돌 없음). NestJS 다중 컨트롤러 표준. AdminGuard 는 admin 컨트롤러에만 `@UseGuards(JwtAuthGuard, AdminGuard)`. |
| review 다중 컨트롤러 분리 | `ReviewController`(`@Controller('reviews')` — POST·PATCH/:id·DELETE/:id·GET /me)·`ProductReviewController`(`@Controller('products/:productId/reviews')` — GET 공개) | `GET /reviews/me` 와 `GET /reviews/:id`(부재) 충돌 없음. 공개 조회는 가드 미적용 별도 컨트롤러로 명확화. |
| issuedCount 한도 가드 | `$executeRaw` parameterized 조건부 UPDATE(컬럼-컬럼 비교) | Prisma where 필터의 컬럼-컬럼 비교 미지원(외부 라이브러리 검증 절). updateMany 대안 불가 → raw 원자 UPDATE. ADR-004. |
| user_coupon 사용/복원 | `updateMany`(상수 조건 `status='unused'`/`usedOrderId=orderId`) | 상수 비교는 Prisma 정상 지원. 003 decreaseStock 동형. ADR-002·007. |
| orderItem↔order 컨텍스트 | `order.repository.findOrderItemWithOrder(orderItemId)` — `orderItem.findUnique({include:{order:true}})`(orders 동일 스키마) → review.service 에 `{orderId, orderUserId, orderStatus, productId, sellerId}` 전달 | review repo 가 orders 미조회(P-001/NFR-005). ADR-008. OrderItem→Order 동일 스키마 FK 관계 사용. |
| `status='expired'` 처리 | **사용 시점 만료는 항상 `coupon.expiresAt` 동적 비교**(저장 status 무관). 조회(FR-005) expired 필터는 저장 status 기준(만료 배치 범위 외) | spec 에 만료 배치 잡 요구 없음(범위 외 "쿠폰 비활성화" 인접). SC-010 은 unused 기본 필터만 검증 → 선택 무관. plan §기타 고려사항 승계. |
| 할인 계산 분기 | FIXED/PERCENTAGE 를 `validateAndCalculateDiscount` 단일 메서드 내 분기 + maxDiscountAmount 유무 통합 결정(§E) | 동일 입력(coupon·totalAmount)에서 discountAmount 단일 결정 → 가드 중복 회피. |

## 엣지 케이스 및 한계

- **§E 동일 가드 조건 통합(할인 계산)**: `coupon.type` 단일 가드로 discountAmount 를 한 블록에서 결정. PERCENTAGE 의 `maxDiscountAmount` 유무는 `Decimal.min(...)` 가변 인자로 흡수(`max 有 → min(base, max, total)`, `max 無 → min(base, total)`) → 중복 분기 없음.
- **discountAmount ≤ totalAmount 항상 보장**: 모든 경로가 `Decimal.min(…, totalAmount)` 로 마감 → `totalAmount - discountAmount ≥ 0`(FR-012 최종 조건) → payment amount 음수 차단(FR-015).
- **빈 컬렉션 guard**: 본 spec 은 ThreadPoolExecutor/병렬 executor 미사용(§D 비해당). createOrder 빈 items 는 003 기존 400 guard 유지.
- **SEC-FIND-004 재발 방지**: `CreateOrderDto` 신규 필드는 `userCouponId?` 단 하나. `discountAmount` 필드 **추가 금지**. 클라이언트가 임의 discountAmount body 전달 시 ValidationPipe whitelist(또는 무시) → 서버 계산값만 반영(SC-012).
- **rating 검증 위치**: `@IsInt() @Min(1) @Max(5)` DTO 레벨 → 위반 시 전역 ValidationPipe 400(SC-034). 서비스 레벨 중복 검증 불필요.
- **취소 라우트**: 003 실구현 `POST /orders/:orderId/cancel` 유지(spec 의 `DELETE /orders/:id` 표기와 불일치 — GAP-001). 004 는 서비스 메서드만 수정.
- **부분 환불 시 쿠폰**: 범위 외(전액 취소만 복원). `restoreForOrder` 는 `cancelled` 전이에만 작동.
- **issuedCount 와 user_coupon 수 정합**: 발급 후 user_coupon 삭제 경로 없음(범위 외) → issuedCount 와 실제 수 일치 유지.
</content>
</invoke>
