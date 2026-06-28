---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# Research: 002-catalog

> plan.md 의 기술 방향을 실제 코드(001 완료 산출물)와 대조하여 영향 범위·호출 관계·라이브러리 동작을 정적 분석한다.
> context.md §2(핵심 모듈)·§4(데이터 모델)를 기준선으로 삼고, 중복 기술은 "context.md §X 참조" 로 대신한다.

## 목차

- [분석 우선순위 게이트 결과](#분석-우선순위-게이트-결과)
- [기존 코드베이스 분석](#기존-코드베이스-분석)
  - [클래스·모듈 계층 구조](#클래스모듈-계층-구조)
  - [영향 범위 분석 (호출 측 전수)](#영향-범위-분석-호출-측-전수)
  - [공유 상태·동시성 분석](#공유-상태동시성-분석)
- [영향 파일 목록](#영향-파일-목록)
- [외부 라이브러리 API 실제 동작 확인](#외부-라이브러리-api-실제-동작-확인)
- [인정되는 한계 및 안전망 (PATCH-A07)](#인정되는-한계-및-안전망-patch-a07)
- [배포 환경 영향 추정 (PATCH-A10)](#배포-환경-영향-추정-patch-a10)
- [context.md 부정합 사전 점검 (PATCH-A11)](#contextmd-부정합-사전-점검-patch-a11)
- [기술 선택 조사](#기술-선택-조사)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 분석 우선순위 게이트 결과

| 게이트 | 판정 |
|---|---|
| 1. 변경 대상 모듈 추출 (plan 핵심 설계) | user·seller·product·inventory 4개 모듈 + shared/auth(OptionalJwtAuthGuard 1개) + prisma/schema.prisma + 마이그레이션. **나머지 13 스텁·auth·health 무변경.** |
| 2. 분석 범위 제한 (§A·B·C) | 위 4 모듈 + shared/auth + schema 에만 적용. |
| 3. §D 다단계 병렬 파이프라인 | **건너뜀** — plan 이 다단계 병렬 인코딩/업로드 패턴을 요구하지 않음(인-프로세스 동기 이벤트). |
| 4. 외부 라이브러리 검증 한정 | **신규 라이브러리 0건.** 기존 Prisma/`@nestjs/event-emitter`/JWT 가드의 **기존 사용 패턴 재활용**이나, cursor 페이지네이션·`updateMany` affected-count·`@OnEvent` 토폴로지는 본 spec 최초 사용 분기이므로 §외부 라이브러리 동작 확인에서 한정 검증. |
| 5. §F production 시그니처 변경 | **건너뜀** — 기존 production 메서드 시그니처를 변경하지 않는다. 신규 공개 메서드(checkAvailability·decreaseStock·initStock·getApprovedSeller) 추가만. 회귀 대상 호출 측 테스트 부재(신규 추가). |

---

## 기존 코드베이스 분석

### 클래스·모듈 계층 구조

`[TypeScript][NestJS]` 001 산출물의 4계층 패턴을 실측 확인했다(전부 concrete class, 상속 트리 단순).

- **Service**: `@Injectable()` concrete. `AuthService` 가 `AuthRepository`·`JwtService`·`ConfigService` 를 생성자 DI 하고 **평문 객체(interface)** 를 반환(`UserProfile`·`LoginResult` 등). 4 신규 모듈 Service 동형 적용 — repository + (필요 시) 타 모듈 공개 Service + `EventEmitter2` DI.
- **Repository**: `@Injectable()` concrete. `AuthRepository` 가 `PrismaService` DI, **자기 스키마 Prisma 모델만**(`prisma.user`·`prisma.refreshToken`) 호출(P-001 준수 실증). 신규 repository 도 자기 스키마 모델만 호출.
- **Controller**: `@Controller('auth')` concrete. `@UseGuards(JwtAuthGuard)` + `@CurrentUser()` + DTO(`class-validator`). `@HttpCode(HttpStatus.OK/NO_CONTENT)` 로 상태코드 명시.
- **Guard**: `JwtAuthGuard extends AuthGuard('jwt')` (빈 확장). `OptionalJwtAuthGuard`(ADR-012)는 `handleRequest` override 로 토큰 부재/무효 시 throw 하지 않고 `user=undefined` 통과 — 동일 `AuthGuard('jwt')` 상속 + `AuthSharedModule` providers/exports 에 추가하는 비파괴적 확장.
- **이벤트 핸들러**: `*.events.ts` 는 현재 주석/빈 scaffold(예: `product.events.ts` 1줄 주석). 본 spec 에서 `@Injectable()` + `@OnEvent('...')` 핸들러 클래스로 채우고 각 모듈 providers 에 등록.

> **신규 클래스 인스턴스화 가능 여부**: 전부 NestJS DI 컨테이너가 생성하는 concrete `@Injectable()`/`@Controller()`. abstract/protected 생성자·pure virtual 부재(TS) → 인스턴스화 제약 없음.

### 모듈 간 통신 토폴로지 (순환 DI 검증)

plan §0 토폴로지를 DI/이벤트 방향으로 정적 검증했다.

| 방향 | 수단 | 순환 위험 |
|---|---|---|
| product → InventoryService | NestJS DI (`InventoryModule` exports `InventoryService`, `ProductModule` imports `InventoryModule`) | inventory 는 product 를 **DI 하지 않음**(이벤트로만 통신) → 순환 없음 |
| product → SellerService | NestJS DI (`SellerModule` exports `SellerService`, `ProductModule` imports `SellerModule`) | seller 는 product 를 DI 하지 않음 → 순환 없음 |
| inventory → product (재고 변경 통지) | `@OnEvent('inventory.stock-changed')` (product.events 구독, **단방향 이벤트**) | DI 아님 → 순환 없음 |
| product → user (조회 기록) | `@OnEvent('product.viewed')` (user.events 구독, **단방향 이벤트**) | DI 아님, cross-schema 회피 |

> **핵심 결론**: 이벤트 핸들러는 **각 구독 모듈의 자기 Service 만** 주입한다(user.events→UserService, product.events→ProductService). 발행 측은 `EventEmitter2.emit()` 만 호출하므로 모듈 간 컴파일 의존이 생기지 않는다. → `forwardRef` 불필요, 순환 모듈 import 0건. cross-schema(users↔products) 는 전부 이벤트로만 횡단(P-001/NFR-003/SC-049 구조적 보장).

### 영향 범위 분석 (호출 측 전수)

- **`User` 모델 확장(name·phone nullable 추가, ADR-013)**: 기존 `User` 참조 코드 = `auth.repository.ts`(`prisma.user.*`), `auth.service.ts`(`UserProfile{id,email,createdAt}` 반환). nullable additive 컬럼이므로 **기존 select·반환 형태 무변경 → auth 32 테스트 회귀 없음**. `auth.service.getProfile` 은 name/phone 을 반환하지 않으나 spec 범위 외(auth me 응답 불변 — P-007). user 모듈의 `GET /users/me`(FR-001)가 name/phone 포함 응답을 신규 제공.
- **신규 공개 메서드(checkAvailability·decreaseStock·initStock·getApprovedSeller)**: 호출 측은 **본 spec 내부**(product→inventory/seller) + **003(미래)**. 기존 코드에 호출 측 없음 → 시그니처 회귀 0. 003 소비 계약은 plan 인터페이스 계약 절에 고정.
- **`app.module.ts`**: `EventEmitterModule.forRoot()` **이미 등록됨**(실측 — app.module.ts L38). plan 의 "미등록 시 추가" 는 **검증만 필요, 신규 결선 불필요**. 4 모듈 module 파일에 controller/provider/이벤트 핸들러/타 모듈 import 추가만.
- **`package.json`**: `@nestjs/event-emitter`·`class-validator`·`class-transformer` **전부 기존 dependency**(실측). 신규 의존 0 → SC-051/NFR-005 PASS 유지. 단 카테고리 seed 메커니즘이 `prisma.seed` 키를 요구할 수 있음 → **GAP-001**(비블로킹, DB Design Agent 위임).

### 공유 상태·동시성 분석

plan §기타 고려사항·§6 검토를 코드 관점에서 재확인.

| 공유 자원 | Check-Then-Act 위험 | 안전 근거 |
|---|---|---|
| `products.inventory.quantity` (재고) | 동시 차감 시 음수 재고 | **조건부 감소** `updateMany({where:{variantId, quantity:{gte:qty}}, data:{decrement:qty}})` 단일 statement = row-level 원자. SELECT-then-UPDATE 미사용 → race window 없음(ADR-005). |
| `addresses.isDefault` (단일성) | 지정/삭제 재지정 중 복수 true | **단일 트랜잭션** `prisma.$transaction` 내 `updateMany(isDefault=false)` → `update(isDefault=true)`(ADR-008/009). |
| `wishlists`·`product_views` upsert | 중복 row | `@@unique([userId,productId])` + `upsert`/`create` catch P2002 → 멱등(409 또는 viewedAt 갱신). |
| 상품 자동 상태 전이 | 이벤트 순서 역전 | 최종 재고 기준 재수렴(self-healing). 일시 불일치 허용(plan §기타). Lock 불필요 — 핸들러는 `totalStock` 재계산 후 현재 status 와 비교하는 멱등 전이. |

> **Lock 없이 안전한 이유 명시**: (1) 재고 = DB row-level 원자 연산. (2) 기본배송지 = 트랜잭션 격리. (3) upsert = unique 제약. (4) 상태 전이 = 멱등 재수렴. 별도 애플리케이션 Lock·`SELECT FOR UPDATE` 불필요. 멀티 variant 주문 전체 원자성만 호출자(003) `$transaction` 책임(본 spec 범위 외).

---

## 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 |
|---|---|---|
| `apps/backend/prisma/schema.prisma` | 수정 | User 확장(name·phone) + users 4테이블(sellers·addresses·wishlists·product_views) + products 6테이블(categories·products·product_images·variants·inventory·inventory_logs) + enum(SellerStatus·ProductStatus·InventoryLogType). **상세는 DB Design Agent `data-model.md`.** |
| `apps/backend/prisma/migrations/<ts>_catalog/migration.sql` | 신규 | 10 테이블 + User ALTER + enum CREATE TYPE + 인덱스. `prisma migrate dev` 생성. |
| `apps/backend/prisma/seed.ts` 또는 마이그레이션 INSERT | 신규 | 카테고리 seed(ADR-010). 메커니즘은 GAP-001/DB Design 확정. |
| `apps/backend/src/modules/user/{user.repository,user.service,user.controller,user.events,user.module}.ts` + `dto/`, `user.constants.ts` | 수정(스텁→실구현) | FR-001~010. MAX_PRODUCT_VIEWS 상수. product.viewed 구독. |
| `apps/backend/src/modules/seller/{seller.repository,seller.service,seller.controller,seller.module}.ts` + `dto/` | 수정 | FR-011~017. 공개 메서드 getApprovedSeller. |
| `apps/backend/src/modules/product/{product.repository,product.service,product.controller,product.events,product.module}.ts` + `dto/`, `product.constants.ts` | 수정 | FR-018~029. MAX_PRODUCT_IMAGES·DEFAULT/MAX_PAGE_LIMIT 상수. InventoryService·SellerService DI. inventory.stock-changed 구독. product.viewed 발행. |
| `apps/backend/src/modules/inventory/{inventory.repository,inventory.service,inventory.controller,inventory.events,inventory.module}.ts` + `dto/`, `inventory.exception.ts` | 수정 | FR-030~035. checkAvailability·decreaseStock·initStock·stockIn·getStock. InsufficientStockException. stock-changed 발행. |
| `apps/backend/src/shared/auth/optional-jwt-auth.guard.ts` + `auth-shared.module.ts` | 신규/수정 | OptionalJwtAuthGuard(ADR-012). AuthSharedModule providers/exports 추가. |
| `apps/backend/src/app.module.ts` | 검증(무변경 예상) | EventEmitterModule 이미 등록. 4 모듈은 자체 module 파일에서 결선 → app.module 무변경. |

**무변경(배제) 근거**: cart·coupon·order·payment·shipping·settlement·review·search·notification·file·banner·stats·admin(13 스텁) + auth + health = 본 spec 호출/참조 대상 아님(P-007). 컴파일 대상이나 변경 심볼 미참조 → 빌드 회귀 없음.

---

## 외부 라이브러리 API 실제 동작 확인

> 신규 라이브러리 0. 기존 의존의 **본 spec 최초 사용 분기**만 검증한다. plan §외부 라이브러리 동작 검증과 cross-check.

| 가정 | 정리 (코드/공식 동작) | 일치 |
|---|---|---|
| Prisma cursor 페이지네이션 `findMany({take, skip: cursor?1:0, cursor: cursor?{id}:undefined, orderBy})` | Prisma 공식 cursor 동작. `orderBy:[{createdAt:'desc'},{id:'desc'}]` 복합 + cursor=id 로 동률 누락 방지(ADR-007). | 일치 |
| `updateMany` 반환 `{count}` 로 재고 부족 판정 | Prisma `updateMany` 는 `Promise<{count:number}>` 반환. `count===0` → WHERE(`quantity>=qty`) 미충족 → 재고 부족. row-level 원자. | 일치 |
| `@OnEvent` 핸들러 기본 동기 실행 | `@nestjs/event-emitter` `emit()` 은 등록 핸들러를 **동기 호출**(같은 스택). 핸들러 예외는 발행 측에 전파 가능 → 핸들러 내부 try/catch 로 주 응답 보호(best-effort 부수효과). | 일치 |
| Prisma multiSchema cross-schema = plain `String`(@relation 미선언) 시 JOIN 미발생 | `@relation` 으로 선언된 관계만 ORM JOIN/include. cross-schema id 를 String 컬럼으로 두면 cross-schema 쿼리 미생성(SC-049 구조적 보장). | 일치 (001 에서 8 스키마 선언·검증 완료) |
| `prisma.$transaction(async (tx)=>{...})` interactive transaction | Prisma 공식. 기본배송지 지정/삭제 재지정을 단일 트랜잭션으로 묶음(ADR-008/009). | 일치 |

가정-실제 불일치 **미발견** → BLOCKED 사유 없음.

> **private API 사용 0건**: 본 spec 은 Prisma/NestJS public API 만 사용한다. PATCH-A14(public 우선)·PROC-013(private lifecycle 검증) 해당 없음.

---

## 인정되는 한계 및 안전망 (PATCH-A07)

| 한계 | 안전망 |
|---|---|
| cross-schema FK 무결성 포기 — 삭제된 상품을 찜/조회 기록한 고아 productId 가능 | 본 spec 은 wishlist/view 추가 시 productId 존재 검증을 강제하지 않음(SC-008/011 요구 아님). 003/후속에서 정합성 필요 시 ProductService DI 검증 추가(비파괴적). |
| 이벤트 핸들러 best-effort — `inventory.stock-changed` 누락 시 상품 status 일시 불일치 | 다음 재고 변경 이벤트가 최종 재고 기준 재수렴(self-healing, 멱등 전이). 강한 일관성 필요 시 동일 products 스키마라 직접 트랜잭션 갱신으로 전환 비용 낮음. |
| `decreaseStock` 비멱등 — 동일 orderId 2회 호출 시 2회 차감 | 003 이 주문 단위 멱등성 키(P-005)로 중복 호출 방지. 다중 variant 전체 원자성은 003 `$transaction` 책임. 본 spec 단일 호출은 row-level 원자로 SC-046 충분. |
| ASM-005 — seller approve/reject 가 JWT 인증만(admin RBAC 미적용) | approve/reject 엔드포인트에 `@UseGuards(JwtAuthGuard)` + **후속 RBAC Guard 비파괴 부착 가능 구조**(컨트롤러 데코레이터 자리 확보). Security Agent 검토 대상(selection-phases Y). |

---

## 배포 환경 영향 추정 (PATCH-A10)

- 본 spec 은 **순수 비즈니스 로직**(REST 핸들러·Prisma 쿼리·인-프로세스 동기 이벤트). 컨테이너 NAT·docker-proxy·L4 LB·firewall conntrack·TCP keepalive 등 네트워크 레이어 특이성의 영향을 받는 동작(소켓 health check·재연결 등)이 **없다**. → infra.md cross-reference 시 신규 운영 환경 항목 부재.
- 운영 영향 1건: **Prisma 마이그레이션의 Fly release 단계 실행**(`prisma migrate deploy`). 10 신규 테이블이 Fly Postgres 에 정상 적용되는지는 운영 검증 대상이며 spec.md "사후 운영 검증 피드백 사이클(PROC-014)" 에 이미 명시. 본 단계는 로컬 `prisma migrate dev` 로 갈음. infra.md §3 에 마이그레이션 배포 절차 기재됨 → **gaps 등록 불필요**.
- `[Docker][PROC-003]` 컨테이너 빌드 산출물 경로: 본 spec 은 Dockerfile/docker-compose 무변경(Deploy Agent N). Prisma client 는 신규 모델 추가로 `prisma generate` 재생성 필요하나 Dockerfile 의 기존 builder 스테이지 `prisma generate` 가 이를 커버(경로 변경 없음). docker build 검증 태스크는 본 spec 미포함(001 에서 확립, 경로 불변) — tasks.md 는 `prisma migrate dev` + `prisma generate` 1회 실행 검증을 Layer A 완료 기준에 포함.

---

## context.md 부정합 사전 점검 (PATCH-A11)

본 spec 변경 대상(신규 테이블·모듈 역할)과 context.md §2/§4 정의를 grep 대조했다.

| 항목 | 현재 정의(context.md) | 본 spec 변경 후 | 부정합 여부 |
|---|---|---|---|
| §4 products 스키마 테이블 목록 | `categories, products, product_images, **options**, variants, inventory, inventory_logs` (7개, `options` 별도 테이블 포함) | 본 spec 은 `options` **별도 테이블을 만들지 않음** — variant 가 `optionName`·`optionValue` 인라인 보유(plan ADR-003·데이터 모델). 신규 6테이블에 `options` 없음. | **부정합** — context.md §4 의 `options` 는 목표(target) 구조였으나 실구현은 variant 인라인. 6단계 Docs Agent 가 §4 를 실구현 6테이블로 현행화 필요. |
| §4 users 스키마 테이블 목록 | `users, refresh_tokens, sellers, addresses, wishlists, product_views` | 본 spec 이 sellers·addresses·wishlists·product_views 실체화 → 목록 일치(목표→실재 전환). | 일치(현행화 시 "실재" 표기) |
| §2 user 모듈 역할 | "프로필/배송지/찜/최근 본 상품/**등급**" | 본 spec 은 프로필·배송지·찜·최근 본 상품 구현. **등급(grade)은 미구현**(spec 범위 외). | 부분 — §2 의 "등급" 은 미구현 잔여(부정합 아님, 미래 범위). Docs Agent 가 "v1.0.0 미구현" 표기 검토. |
| §2 product/inventory 역할 | product="상품/카테고리/옵션/이미지", inventory="재고/입출고 로그/SKU" | 일치(옵션=variant 인라인, SKU=variant.sku). | 일치 |
| §6 알려진 제약 "17개 스텁" | auth 외 17 스텁 | 본 spec 후 user·seller·product·inventory 4개 실구현 → **잔여 13 스텁**. | Docs Agent 가 §6 을 "13개 스텁" 으로 갱신 필요. |

> 위 항목은 6단계 Docs Agent 가 PATCH-A10 컨텍스트 검토로 처리하도록 가시화한다. 본 단계 BLOCKED 사유 아님(전부 사후 문서 현행화 범주).

---

## 기술 선택 조사

plan §결정 기록(ADR-001~014)을 코드 패턴으로 재확인. 본 spec 고유 선택만 요약(스택은 001 답습).

- **이벤트 vs DI 선택 기준**: cross-schema(users↔products) = **이벤트**(컴파일 의존·cross-schema 쿼리 제거). 동일 스키마 타 모듈 테이블 = **공개 Service DI**(직접 repository 교차 금지). 근거: P-001/NFR-003. 대안(직접 cross-schema 쿼리)은 SC-049 위반으로 기각.
- **재고 소유 = inventory 모듈**: variants 에 stock 컬럼 비정규화 대신 `products.inventory` 단일 소유(ADR-003). variant 생성 시 `InventoryService.initStock` DI. 대안(variant.stock denormalize)은 양 모듈 공동 쓰기·정합성 부담으로 기각.
- **OptionalJwtAuthGuard**: `AuthGuard('jwt')` 의 `handleRequest(err,user)` override 로 user 부재 시 throw 대신 통과(ADR-012). 신규 패키지 0. GET /products/:id 에만 적용(NFR-002 인증 불필요 endpoint 정합).
- **상수화**: `MAX_PRODUCT_IMAGES=10`·`MAX_PRODUCT_VIEWS=50`·`DEFAULT_PAGE_LIMIT=20`·`MAX_PAGE_LIMIT=100` 을 모듈 `*.constants.ts` 로 관리(매직넘버 금지). 테스트(SC-012/036/038)도 동일 상수 import.

---

## 엣지 케이스 및 한계

- **기본배송지 삭제 + 잔여 0**: 재지정 없이 삭제만(FR-005 ASM-003). 잔여 ≥1 이면 `orderBy createdAt desc` 첫 행 isDefault=true(SC-006).
- **이미지 정확히 10개 경계**: `count >= 10` → 400(`>=`, SC-036). 10개 미만이면 추가 허용.
- **최근 본 상품 > 50**: `take: MAX_PRODUCT_VIEWS(50)`, `orderBy viewedAt desc`(SC-012).
- **상태 전이 비대상**: DRAFT/INACTIVE 는 `inventory.stock-changed` 자동 전이 대상 아님(판매자 명시 게시 전/종료 후). totalStock 임계값 0 기준 ACTIVE↔OUT_OF_STOCK 만(FR-023/024, SC-030/031).
- **categoryId 미존재**: `POST /products` 시 동일 스키마 categories 조회 후 부재면 400(ADR-010, spec-input Q21).
- **cursor=비유일 키 동률 누락**: 복합 정렬 + cursor=id 로 차단(ADR-007).
- **decreaseStock 단독 호출(002)**: row-level 원자로 SC-046 충분. tx 파라미터 시그니처에 두지 않음(003 컨텍스트 전파 전제).
- **빈 컬렉션 guard**: 본 spec 은 `ThreadPoolExecutor` 류 병렬화 없음(단일 스레드 Node 이벤트 루프) → 빈 컬렉션 병렬 guard 무관.
