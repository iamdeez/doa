---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 검토중
---

# Plan: 002-catalog

> Branch: 002-catalog | Date: 2026-06-28 | Spec: [../spec/spec.md](../spec/spec.md)

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

> `constitution.md` (P-001~P-007) 존재 → 해당 조항을 Gates 로 사용한다 (constitution 우선).
> spec.md NFR 이 constitution 보다 강화된 경우 spec 기준, 완화된 경우 constitution 으로 상향.
> 본 spec 의 NFR(NFR-001~005)은 constitution 조항(P-001·P-002·P-005·P-006) 과 충돌 없이 하위 구체화한다.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: 각 모듈 Repository 가 자기 스키마(users 또는 products) 외 타 스키마 테이블을 직접 참조·쿼리·JOIN 하지 않음 — SC-049 정적 검증]
  → PASS. user·seller → `users` 스키마, product·inventory → `products` 스키마. **cross-schema 참조는 전부 plain String 필드 + 도메인 이벤트 + 공개 서비스 DI 호출로 회피**(ADR-001·002·004·006).
  Prisma cross-schema FK 관계를 선언하지 않으므로 생성 쿼리에 cross-schema JOIN 이 없다. 4계층 구조(controller·service·repository·events) 준수.
- [x] **P-002 AWS 의존 금지 원칙**: [Pass 기준: `@aws-sdk/*` 등 AWS 전용 패키지 신규 추가 0건 — SC-051 정적 검증]
  → PASS. 본 spec 은 순수 비즈니스 로직으로 신규 npm 의존을 추가하지 않는다(기존 `@nestjs/event-emitter`·Prisma·JWT 가드 재사용). `package.json` 무변경(NFR-005).
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 외부 저장소 0건]
  → PASS. 신규 테이블 10개를 기존 `users`·`products` 스키마에 추가할 뿐 외부 Redis/브로커/별도 DB 도입 없음. 이벤트는 인-프로세스 `@nestjs/event-emitter`.
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: Fly.io 전용 API 에 비즈니스 로직 결합 0건]
  → PASS. 표준 Prisma + PostgreSQL 만 사용. Fly 전용 SDK·API 미사용.
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: 금전 수치 필드 Decimal/정수, 부동소수점 0건 — SC-050 정적 검증]
  → PASS (부분 적용). 결제·정산 흐름은 003 범위 외. 단 P-005 의 "금전 수치는 Decimal/정수, float 금지" 조항이 본 spec 의 `products.price`·`variants.price` 에 적용 → **Prisma `Decimal` 타입 사용**(NFR-004, ADR-013). outbox·멱등성 키는 결제 흐름 부재로 N/A.
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건]
  → PASS. FR-001~035 전부 SC 매핑 존재(spec.md 매트릭스 역방향 검증 완료). NFR-001~005 도 SC-047~051 매핑. 매핑 누락 0건.
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건]
  → PASS. user·seller·product·inventory 4개 스텁 모듈 실구현 + 관련 스키마 확장만. cart·order·payment(003)·부가 도메인(Stage 3) 미변경. auth·shared 는 User 모델에 name/phone 컬럼 추가(ADR-013) 외 무변경.

예외 사항: 없음.

> **Gates 판정**: P-001~P-007 전부 통과(예외 0). Design Agent(3단계) 진입 가능.

---

## 기술 컨텍스트

> 001-skeleton-bootstrap 의 확정 스택을 **그대로 재확정**한다(신규 결정 없음 — 자명한 답습). 버전 핀은 기존 `package.json` 실재 값.

- **언어 / 런타임**: TypeScript 5.4 / Node.js 20.x. pnpm + Turborepo 모노레포.
- **백엔드 프레임워크**: NestJS 11.x (`@nestjs/common`·`@nestjs/core`·`@nestjs/platform-express`).
- **ORM / DB**: Prisma `^6.19.0` (`@prisma/client`) `multiSchema`(GA, flag 불필요) + PostgreSQL 16. 로컬은 Docker Compose.
- **인증**: 기존 `shared/auth` 재사용 — `JwtAuthGuard`(`AuthGuard('jwt')`)·`JwtStrategy`(`ignoreExpiration:false`)·`@CurrentUser()` 데코레이터. 신규 가드는 `OptionalJwtAuthGuard` 1개만 추가(ADR-012).
- **도메인 이벤트**: `@nestjs/event-emitter` `^3.0.0` (이미 의존성 존재) — 인-프로세스 `EventEmitter2`. `@OnEvent` 구독, `eventEmitter.emit` 발행. `app.module.ts` 에 `EventEmitterModule.forRoot()` 등록 필요(현재 미등록이면 추가 — 범위 내 부트스트랩 결선).
- **입력 검증**: `class-validator` + `class-transformer`, 전역 `ValidationPipe` (기존). 모듈별 DTO 추가.
- **금전 타입**: Prisma `Decimal`(`@db.Decimal(12,2)` 등) — `products.price`·`variants.price`(NFR-004, P-005).
- **테스트 프레임워크**: Jest(`*.spec.ts`, `src` rootDir) + `supertest`(HTTP). 단위(`[env:unit]`) 위주, 정적(`[env:static]`), 통합(`[env:integration]` — SC-047 P95).
- **환경변수**: 기존 `DATABASE_URL`·`JWT_*` 재사용. 신규 환경변수 없음.
- **신규 의존성**: **없음**(NFR-005·P-002). PATCH-A15 자가 점검 → selection-phases.md 참조.

---

## 외부 라이브러리 동작 검증

> 본 프로젝트는 코드베이스 실재(001 완료, 32/32 테스트 PASS). 핵심 가정은 Prisma/NestJS 공식 동작 + 기존 001 검증 결과 기준으로 정리한다. 핀 버전(Prisma 6.19, NestJS 11)은 기존 `package.json` 실값.

| 가정 | 정리 | 인정되는 한계 (PATCH-A07) | 안전망 |
|---|---|---|---|
| Prisma multiSchema 에서 **동일 스키마 내** FK 관계는 정상, **cross-schema 참조는 plain scalar 필드로 두면 JOIN 미발생** | Prisma 는 `@relation` 으로 선언된 관계만 JOIN/include 한다. cross-schema id 를 `String` 컬럼으로만 두면 ORM 차원의 cross-schema 쿼리가 생성되지 않는다. | DB 레벨 참조 무결성(FK 제약)은 포기 — 고아 productId(삭제된 상품을 찜) 가능. | 003/후속에서 정합성 필요 시 ProductService DI 존재 검증. 본 spec 은 productId 존재 검증을 wishlist/view 추가 시 강제하지 않음(SC-008/011 요구 아님). |
| Prisma **cursor 페이지네이션**(`cursor`+`take`+`skip:1`) 동작 | `findMany({ take, skip: cursor?1:0, cursor: cursor?{id}:undefined, orderBy })` 로 안정적 페이지네이션. | orderBy 가 비유일 키만이면 동률 행 누락 위험. | `orderBy: [{createdAt:'desc'},{id:'desc'}]` 복합 정렬 + cursor=id 로 유일성 보장(ADR-007). |
| 조건부 감소 `updateMany({where:{quantity:{gte:qty}}, data:{quantity:{decrement:qty}}})` 의 **affected count** 로 재고 부족 판정 | Prisma `updateMany` 는 `{count}` 반환. count===0 → 조건 미충족(재고 부족). row-level 원자 연산. | 멀티 variant 주문 전체의 원자성은 **호출자(003) 트랜잭션 책임** — 단일 호출만으로는 보장 못함. | `decreaseStock` 을 003 의 `prisma.$transaction` 컨텍스트 내 호출하도록 인터페이스 계약 명시(FR-034). 본 spec 단일 호출은 row-level 원자성으로 충분(SC-046). |
| `@nestjs/event-emitter` `@OnEvent` 핸들러는 **기본 동기 실행** | `emit()` 은 등록 핸들러를 동기 호출(같은 호출 스택). 예외는 발행 측에 전파(설정에 따라). | 핸들러 예외 처리·트랜잭션 경계가 발행/구독 간 분리됨(이벤트는 best-effort). | product.viewed(조회 기록)·inventory.stock-changed(상태 전이)는 부수효과로, 실패해도 주 응답을 막지 않도록 핸들러 내부 try/catch + 로깅(설계 §기타). 상태 전이 누락 시 다음 재고 변경 이벤트로 복구. |

가정과 실제 동작 불일치 현재 미발견. 핀 버전 확정 후 불일치 발견 시 Design 단계(research.md)에서 main 에 BLOCKED 보고.

---

## 배포 환경 영향 (PROC-009)

- 본 spec 의 검증 대상은 **로컬/dev (Docker Compose PostgreSQL)** 환경에 한정된다. 순수 비즈니스 로직(REST 핸들러·Prisma 쿼리·인-프로세스 이벤트)으로 컨테이너 NAT·docker-proxy·L4 LB·firewall 등 네트워크 미들웨어 특이성의 영향을 받지 않는다(spec-input.md 배포 cross-reference: "네트워크 레이어 특이성 영향 없음").
- 운영 시점 영향 1건: **Prisma 마이그레이션의 Fly release 단계 실행**(infra.md §3 — `prisma migrate deploy`). 본 spec 이 추가하는 10개 테이블 마이그레이션이 Fly Postgres 에 정상 적용되는지는 운영 검증 대상이며 spec.md "사후 운영 검증 피드백 사이클(PROC-014)" 절에 이미 명시됨. 본 단계 검증은 로컬 `prisma migrate dev` 로 갈음.
- infra.md 에 누락 항목 없음(§3 마이그레이션 배포 절차 기재됨) → gaps 등록 불필요.

---

## 위험 완화 설계 (가정 안전망) (PATCH-A06)

assumptions.md 의 ASM 중 "확인 필요 여부 중간/높음 + defer/운영 검증" 항목 식별 및 안전망:

| ASM | 확인 필요 | 부정 검증 시 영향 | 안전망 설계 |
|---|---|---|---|
| ASM-005 (seller approve/reject = JWT 인증만, admin RBAC 후속) | 후속 spec 구현 확인(중간) | 임의 인증 사용자가 판매자를 승인/거부 가능 — 운영 시 권한 상승 위험 | (1) approve/reject 엔드포인트에 `@UseGuards(JwtAuthGuard)` 적용 + **후속 RBAC Guard 를 비파괴적으로 추가 가능한 구조**로 설계(컨트롤러 메서드 데코레이터 자리 확보). (2) 본 한계를 plan/CHANGES 에 명시하고 **Security Agent 검토 대상**으로 위임. (3) admin 모듈 spec 진입 시 동일 엔드포인트에 RBAC Guard 부착(SC 회귀 없이 확장). |
| ASM-004 (OUT_OF_STOCK 공개 노출) | 불필요(확정) | — | SC-038/039 로 정적 검증. status 필드 응답 포함으로 클라이언트 판단(품절 표시). |
| ASM-001/002/003/006/007 (이미지 10·최근본 50·기본배송지 재지정·필드 명세) | 불필요 | — | 각 SC(SC-036/012/006 등)로 단위 검증. 상수화(`MAX_PRODUCT_IMAGES=10`, `MAX_PRODUCT_VIEWS=50`)로 매직넘버 방지. |

ASM-005 안전망은 spec FR-015/016 + SC-017/018 에 매핑되며 Security Agent 활성화로 후속 검토. SC/FR 매핑 누락 없음 → BLOCKED 불필요.

---

## 핵심 설계

> 작성 깊이: Design Agent 가 추가 설계 판단 없이 tasks.md 를 분해할 수 있는 수준. 변경 대상 모듈·인터페이스 시그니처·핵심 분기 로직 포함.

### 0. 모듈 간 통신 토폴로지 (P-001 / NFR-003 핵심)

```
[user 모듈]  users 스키마 (users, addresses, wishlists, product_views)
   ▲ @OnEvent('product.viewed')                 │
   │                                            │ SellerService.getApprovedSeller(userId)  (DI, users→users 동일스키마)
[seller 모듈] users 스키마 (sellers)  ◀──────────┤
                                                │
[product 모듈] products 스키마 (categories, products, product_images, variants)
   │  emit 'product.viewed' {userId, productId}  (→ user)
   │  InventoryService.initStock(...) / checkAvailability(...)  (DI, 동일스키마)
   ▲ @OnEvent('inventory.stock-changed') {productId, totalStock}
   │
[inventory 모듈] products 스키마 (inventory, inventory_logs)
      emit 'inventory.stock-changed'  (→ product)
      checkAvailability / decreaseStock / stockIn (공개 DI 메서드, 003 + product 소비)
```

**규약**:
- **cross-schema(users↔products) 호출은 절대 직접 Prisma 쿼리 금지**. 반드시 도메인 이벤트(`product.viewed`) 또는 공개 서비스 DI 로만.
- **동일 스키마 내(user↔seller, product↔inventory)** 는 NFR-003/SC-049 위반이 아니나(둘 다 같은 스키마), 모듈 책임 분리를 위해 타 모듈 소유 테이블은 **공개 서비스 DI**로 접근한다(직접 repository 교차 호출 금지).
- **순환 DI 회피**: product → InventoryService(DI), inventory → product(이벤트 단방향). product → SellerService(DI). seller·user·inventory 는 product 를 DI 하지 않는다.

### 1. user 모듈 (users 스키마) — FR-001~010

변경 대상: `modules/user/{user.controller,user.service,user.repository,user.events}.ts` + `user.module.ts` + dto.

| 엔드포인트 | 인증 | 동작 | FR/SC |
|---|---|---|---|
| `GET /users/me` | JwtAuthGuard | User 조회 → `{id,email,name,phone}` (password 제외) | FR-001 / SC-001·002 |
| `PATCH /users/me` | JwtAuthGuard | `{name?,phone?}` 업데이트 | FR-002 / SC-003 |
| `POST /users/me/addresses` | JwtAuthGuard | address 생성, 201 | FR-003 / SC-004 |
| `PATCH /users/me/addresses/:id` | JwtAuthGuard | 본인 소유 검증 후 수정, 타인 → 403 | FR-004 / SC-005 |
| `DELETE /users/me/addresses/:id` | JwtAuthGuard | 본인 삭제, 204. 기본배송지 삭제 시 자동 재지정 | FR-005 / SC-006 |
| `PATCH /users/me/addresses/:id/default` | JwtAuthGuard | 기본배송지 지정(기존 default 해제) | FR-006 / SC-007 |
| `POST /users/me/wishlist/:productId` | JwtAuthGuard | 찜 추가, 중복 → 409 | FR-007 / SC-008 |
| `DELETE /users/me/wishlist/:productId` | JwtAuthGuard | 찜 제거, 204 | FR-007 / SC-009 |
| `GET /users/me/wishlist` | JwtAuthGuard | 찜 목록 | FR-008 / SC-010 |
| `GET /users/me/product-views` | JwtAuthGuard | 최근 본 상품 최신순 최대 `MAX_PRODUCT_VIEWS`(50) | FR-010 / SC-012 |

**핵심 분기 로직**:
- 주소 본인 소유 검증: `address.userId !== currentUser.userId` → `ForbiddenException`(403) (SC-005).
- 기본배송지 삭제 자동 재지정(FR-005/ASM-003, ADR-008): 단일 트랜잭션 — 삭제 대상이 `isDefault=true` 이고 잔여 배송지 ≥1 이면, 잔여 중 `orderBy:{createdAt:'desc'}` 첫 행을 `isDefault=true` 로 갱신. 잔여 0 이면 재지정 없음.
- 기본배송지 지정 단일성(FR-006, ADR-009): 트랜잭션 내 `updateMany({where:{userId, isDefault:true}, data:{isDefault:false}})` → 대상 `update({isDefault:true})`.
- 찜 중복(SC-008): `@@unique([userId, productId])` 위반 시 `ConflictException`(409). productId 는 plain String(ADR-001) — 상품 존재 검증 안 함(spec 요구 아님).
- 최근 본 상품 기록(FR-009): `@OnEvent('product.viewed')` 핸들러 → `product_views` upsert(`@@unique([userId,productId])`, `viewedAt=now()`) (SC-011). **product 모듈이 발행, user 모듈이 기록**(cross-schema 회피).

### 2. seller 모듈 (users 스키마) — FR-011~017

변경 대상: `modules/seller/{seller.controller,seller.service,seller.repository}.ts` + dto. 공개 메서드 `getApprovedSeller`.

| 엔드포인트 | 인증 | 동작 | FR/SC |
|---|---|---|---|
| `POST /sellers/register` | JwtAuthGuard | seller 생성 status=PENDING, 중복(이미 신청) → 409 | FR-011 / SC-013 |
| `GET /sellers/me` | JwtAuthGuard | 판매자 프로필 | FR-012 / SC-014 |
| `PATCH /sellers/me` | JwtAuthGuard | 프로필 수정 | FR-013 / SC-015 |
| `GET /sellers/me/status` | JwtAuthGuard | `{status, rejectReason}` | FR-014 / SC-016 |
| `PATCH /sellers/:id/approve` | JwtAuthGuard (ASM-005) | status→APPROVED | FR-015 / SC-017 |
| `PATCH /sellers/:id/reject` | JwtAuthGuard (ASM-005) | status→REJECTED, rejectReason 저장 | FR-016 / SC-018 |

**핵심 분기 로직**:
- 중복 신청(SC-013): `sellers.userId` `@@unique` → `ConflictException`(409).
- **공개 DI 메서드** `getApprovedSeller(userId: string): Promise<Seller>` — status≠APPROVED 면 `ForbiddenException`. product 모듈이 상품 등록/수정 권한 검증(FR-017/019)에 사용. PENDING/REJECTED → 403(SC-019/020/023).
- approve/reject 는 `:id`(sellerId) 로 대상 조회 후 status 갱신. RBAC 미적용(ASM-005, 위험 완화 설계 참조).

### 3. product 모듈 (products 스키마) — FR-018~029

변경 대상: `modules/product/{product.controller,product.service,product.repository,product.events}.ts` + dto. category 는 별도 컨트롤러 또는 동일 모듈 라우트.

| 엔드포인트 | 인증 | 동작 | FR/SC |
|---|---|---|---|
| `GET /categories` | 없음 | 카테고리 목록(seed) | FR-018 / SC-021 |
| `POST /products` | JwtAuthGuard + approved 검증 | DRAFT 상품 생성, 비승인 → 403 | FR-019 / SC-022·023 |
| `PATCH /products/:id` | JwtAuthGuard + 소유 검증 | 본인 상품 수정, 타인 → 403 | FR-020 / SC-024·025 |
| `PATCH /products/:id/publish` | JwtAuthGuard + 소유 | DRAFT/INACTIVE → ACTIVE | FR-021 / SC-026·027 |
| `PATCH /products/:id/deactivate` | JwtAuthGuard + 소유 | ACTIVE/OUT_OF_STOCK → INACTIVE | FR-022 / SC-028·029 |
| `POST /products/:id/variants` | JwtAuthGuard + 소유 | variant 생성 + 초기 재고(InventoryService.initStock) | FR-025 / SC-032 |
| `PATCH /products/:id/variants/:variantId` | JwtAuthGuard + 소유 | variant 수정 | FR-025 / SC-033 |
| `DELETE /products/:id/variants/:variantId` | JwtAuthGuard + 소유 | variant 삭제 | FR-025 / SC-034 |
| `POST /products/:id/images` | JwtAuthGuard + 소유 | 이미지 추가, 10개 초과 → 400 | FR-026 / SC-035·036 |
| `DELETE /products/:id/images/:imageId` | JwtAuthGuard + 소유 | 이미지 삭제 | FR-026 / SC-037 |
| `GET /products` | 없음 | cursor 페이지네이션, ACTIVE+OUT_OF_STOCK 만 | FR-027 / SC-038·047 |
| `GET /products/:id` | OptionalJwtAuthGuard | ACTIVE/OUT_OF_STOCK 상세, DRAFT/INACTIVE → 404. 인증 시 product.viewed emit | FR-028·009 / SC-039·011 |
| `GET /sellers/me/products` | JwtAuthGuard + approved | 본인 전체 상태 상품 목록 | FR-029 / SC-040 |

**핵심 분기 로직**:
- 승인 판매자 검증(FR-019): `SellerService.getApprovedSeller(currentUser.userId)` → 실패 시 403(SC-023). 반환된 sellerId 를 `products.sellerId`(plain String, ADR-001) 에 저장.
- 소유 검증(FR-020): 대상 product 의 `sellerId` 와 현재 사용자 sellerId 비교 → 불일치 403(SC-025).
- 상태 머신(FR-021~024):
  - publish: status∈{DRAFT,INACTIVE} → ACTIVE.
  - deactivate: status∈{ACTIVE,OUT_OF_STOCK} → INACTIVE.
  - **자동 OUT_OF_STOCK/ACTIVE**(FR-023/024, ADR-004): `@OnEvent('inventory.stock-changed')` 핸들러 — payload `{productId, totalStock}`. `totalStock===0` 이고 status===ACTIVE → OUT_OF_STOCK. `totalStock>0` 이고 status===OUT_OF_STOCK → ACTIVE. DRAFT/INACTIVE 는 자동 전이 대상 아님(판매자 명시 게시 전/종료 후).
- 공개 목록(FR-027): `where:{status:{in:['ACTIVE','OUT_OF_STOCK']}}`, cursor=id, `orderBy:[{createdAt:'desc'},{id:'desc'}]`, `take=limit`(ADR-007). 응답 `{items, nextCursor}`.
- 단건 조회(FR-028): status∉{ACTIVE,OUT_OF_STOCK} → `NotFoundException`(404, SC-039). 인증 사용자면 `emit('product.viewed',{userId,productId})`(FR-009).
- variant 생성(SC-032): product.variant row 생성(카탈로그 속성 optionName/optionValue/sku/price) 후 `InventoryService.initStock(variantId, productId, stock)`(DI) 로 초기 재고 등록(ADR-003). stock 은 variants 테이블이 아닌 inventory 테이블에 저장.
- 이미지 10개 제한(FR-026/ASM-001, ADR-011): insert 전 `count({where:{productId}})>=MAX_PRODUCT_IMAGES(10)` → `BadRequestException`(400, SC-036).
- 카테고리(ADR-010): seed 데이터(마이그레이션 seed). 생성 API 범위 외. `POST /products` 시 `categoryId` 미존재 → `BadRequestException`(400, spec-input Q21).

### 4. inventory 모듈 (products 스키마) — FR-030~035

변경 대상: `modules/inventory/{inventory.controller,inventory.service,inventory.repository,inventory.events}.ts` + dto + `InsufficientStockException`.

| 엔드포인트/메서드 | 인증/노출 | 동작 | FR/SC |
|---|---|---|---|
| `POST /inventory/:variantId/stock-in` | JwtAuthGuard + approved | 재고 증가 + inventory_logs(IN) + stock-changed emit | FR-030 / SC-041 |
| `GET /inventory/:variantId/stock` | JwtAuthGuard + approved | 현재 재고 수량 | FR-031 / SC-042 |
| `checkAvailability(variantId, quantity)` | 공개 DI 메서드 | `inventory.quantity >= quantity` → boolean | FR-033 / SC-044 |
| `decreaseStock(variantId, quantity, orderId)` | 공개 DI 메서드 | 조건부 감소 + 부족 시 예외 + log(OUT) + stock-changed emit | FR-034·035 / SC-045·046 |
| `initStock(variantId, productId, quantity)` | 공개 DI 메서드 | variant 생성 시 초기 재고 row 생성 + log(INIT) | FR-025/030 보조 |

**핵심 분기 로직**:
- 재고 저장: `products.inventory` 1행 = 1 variant(`@@unique([variantId])`), `{variantId, productId, quantity}`. productId 보유 이유 = 상품 총재고 합산(FR-023/024 이벤트 payload)을 inventory 모듈 내에서 계산하기 위함.
- stock-in(FR-030): `quantity` `increment` → `inventory_logs` append(type=STOCK_IN, delta, orderId=null) → `computeProductTotal(productId)` → `emit('inventory.stock-changed',{productId,totalStock})`(SC-041).
- decreaseStock(FR-034/035, ADR-005): `updateMany({where:{variantId, quantity:{gte:quantity}}, data:{quantity:{decrement:quantity}}})`. `count===0` → `throw new InsufficientStockException(variantId)`(SC-046). 성공 시 `inventory_logs` append(type=DECREASE, delta=-quantity, orderId) → stock-changed emit. **호출자(003) 트랜잭션 컨텍스트 내 실행 전제**(인터페이스 계약 참조).
- inventory_logs append-only(FR-032/SC-043): repository 에 update/delete 메서드 미존재(정적 검증). 컨트롤러에 수정/삭제 라우트 미노출.

---

## 결정 기록 (ADRs)

> spec.md 매트릭스의 FR/NFR 행을 plan 결정에 매핑. 자명한 답습(NestJS·Prisma·JWT 스택)은 001 plan.md 의 ADR 을 승계하므로 생략. 본 spec 고유 결정만 기록. Design Agent research.md "기술 선택 조사" 절과 cross-reference.

| ADR-ID | 결정 항목 | 채택안 | 대안 (검토했으나 채택 안 함) | 근거 (spec FR/NFR 참조) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | cross-schema 참조 방식 | `product_views.productId`·`wishlists.productId`·`products.sellerId`·`inventory.productId(동일스키마는 FK)` 중 **users↔products 경계 id 는 plain `String`**(Prisma `@relation` 미선언) | cross-schema Prisma FK 관계 / DB 뷰 | P-001, NFR-003, SC-049 (cross-schema JOIN 0) | user·product·seller repository, schema.prisma |
| ADR-002 | product 조회 기록(cross-schema) | product 모듈이 `product.viewed`{userId,productId} **이벤트 발행** → user 모듈 `@OnEvent` 으로 `users.product_views` upsert | product 가 직접 users.product_views 쓰기 / user→product DI | FR-009, NFR-003, SC-011 | product.events, user.events |
| ADR-003 | 재고 소유·초기화 | 재고 수량은 inventory 모듈 `products.inventory`(variantId unique, productId, quantity)에 저장. variants 테이블엔 stock 컬럼 없음. variant 생성 시 `InventoryService.initStock()` DI 호출 | variants.stock 컬럼 denormalize / 양 모듈 공동 쓰기 | FR-025·030·031·033·034, P-001 | product.service, inventory.service/repository, schema |
| ADR-004 | 상품 자동 상태 전이 | inventory 가 재고 변경 후 `inventory.stock-changed`{productId,totalStock} **이벤트 발행** → product 모듈 `@OnEvent` 구독, totalStock 임계값(0) 기준 OUT_OF_STOCK/ACTIVE 전환 (단방향 이벤트, inventory→product DI 금지) | inventory 가 products.products 직접 갱신 / 양방향 DI | FR-023·024, P-001(순환 회피) | inventory.events, product.events |
| ADR-005 | decreaseStock 원자성·트랜잭션 | 조건부 감소 `updateMany(where quantity>=qty, decrement)` + `count===0` → `InsufficientStockException`. 시그니처 고정(tx 파라미터 없음), 003 의 `prisma.$transaction` 컨텍스트 전파 전제 | SELECT-then-UPDATE(race) / 비관적 락 `SELECT FOR UPDATE` | FR-034·035, SC-046 | inventory.service, 003 인터페이스 계약 |
| ADR-006 | 승인 판매자 검증(cross-schema) | product 모듈이 `SellerService.getApprovedSeller(userId)` **DI 호출** (users.sellers 직접 쿼리 금지). 비승인 → 403 | product 가 users.sellers 직접 조회 / JWT 클레임에 seller status 포함 | FR-017·019, NFR-003, SC-019·020·023 | product.service, seller.service(공개 메서드) |
| ADR-007 | 상품 목록 페이지네이션 | Prisma cursor(`cursor:{id}`, `skip: cursor?1:0`, `take=limit`) + `orderBy:[{createdAt:desc},{id:desc}]` + `where status in (ACTIVE,OUT_OF_STOCK)` | offset/limit / keyset 수동 SQL | FR-027, NFR-001, SC-038·047 | product.repository |
| ADR-008 | 기본배송지 삭제 자동 재지정 | 삭제 트랜잭션 내 잔여 배송지 `orderBy createdAt desc` 첫 행 isDefault=true. 잔여 0 이면 재지정 없음 | 재지정 안 함 / 가장 오래된 것 지정 | FR-005, ASM-003, SC-006 | user.service |
| ADR-009 | 기본배송지 지정 단일성 | 트랜잭션 내 기존 default `updateMany isDefault=false` → 대상 `update isDefault=true` | partial unique index 의존 | FR-006, SC-007 | user.service, schema(addresses) |
| ADR-010 | 카테고리 데이터 | seed 데이터(마이그레이션 seed script). 생성 API 범위 외. 미존재 categoryId → 400 | 카테고리 CRUD API(범위 외) / 하드코딩 enum | FR-018·019, SC-021 | prisma seed, product.service |
| ADR-011 | 상품 이미지 최대 수 | insert 전 `count >= MAX_PRODUCT_IMAGES(10)` → 400. 상수화 | DB 트리거 / 무제한 | FR-026, ASM-001, SC-036 | product.service |
| ADR-012 | GET /products/:id 옵셔널 인증 | `OptionalJwtAuthGuard`(토큰 있으면 user 추출, 없으면 통과) → 인증 시 product.viewed emit | 별도 인증 endpoint / 항상 인증 필수 | FR-009·028, NFR-002, SC-011·039 | shared/auth(신규 가드), product.controller |
| ADR-013 | 금전 타입 / User 확장 | `products.price`·`variants.price` = Prisma `Decimal`. `users.users` 에 `name`·`phone` nullable 컬럼 추가 | float / 정수(원) | NFR-004, P-005, FR-001·002·019, SC-050 | schema.prisma(User·Product·Variant) |
| ADR-014 | 모듈 간 이벤트 버스 | `@nestjs/event-emitter` `EventEmitterModule.forRoot()` (이미 의존성 존재) 동기 핸들러 | pg-boss(유실불가 작업용 — 본 spec 부적합) / 직접 DI | FR-009·023·024, P-001 | app.module, *.events |

> **PATCH-003 (NFR 성능 직결 파라미터)**: NFR-001(목록 P95 500ms)에 직접 영향하는 파라미터는 cursor 페이지네이션 + 인덱스다. **권장 기본값**: `products(status, createdAt, id)` 복합 인덱스 + `limit` 기본 20·상한 100. 상한 100·상품 <1,000개 조건에서도 인덱스 스캔으로 P95 500ms 위반 없음(데이터 규모상 풀스캔도 임계 미만이나 인덱스로 마진 확보). bcrypt cost 류 "범위 제시" 파라미터는 본 spec 에 없음.

---

## 인터페이스 계약

### 003(거래) 모듈이 소비할 공개 인터페이스 (QualityGate: 트랜잭션 계약 명시 — 003 전제조건)

```ts
// modules/inventory/inventory.service.ts (NestJS DI, P-001 허용 — 모듈 간 공개 서비스 호출)
class InventoryService {
  // FR-033 / SC-044 — 재고 가용 여부. 부수효과 없음(순수 조회).
  checkAvailability(variantId: string, quantity: number): Promise<boolean>;

  // FR-034·035 / SC-045·046 — 재고 차감.
  //  - 원자성: 조건부 감소(WHERE quantity >= quantity) 단일 statement.
  //  - 부족 시 InsufficientStockException throw (FR-035).
  //  - 트랜잭션 계약: **호출자(003 order)의 Prisma interactive transaction 컨텍스트 내에서 호출되어야 한다.**
  //    003 은 `prisma.$transaction(async () => { ... await inventoryService.decreaseStock(...) ... })` 형태로
  //    주문 생성·결제 상태 변경과 재고 차감을 단일 트랜잭션으로 묶는다. 시그니처에 tx 파라미터를 두지 않으며,
  //    트랜잭션 전파 메커니즘(CLS/AsyncLocalStorage 기반 PrismaService 트랜잭션 공유)은 003 spec 에서 확정한다.
  //    본 spec(002)의 단독 호출은 row-level 원자 연산으로 일관성을 보장하므로 SC-046 검증에 충분하다.
  decreaseStock(variantId: string, quantity: number, orderId: string): Promise<void>;
}

// 002 내부 보조 (product → inventory, 동일 products 스키마)
//  initStock(variantId, productId, quantity): variant 생성 시 초기 재고 등록. 음수 금지(400).
```

> **003 작성자 주의(CHANGES 승계 예정)**: `decreaseStock` 은 멱등하지 않다(같은 orderId 로 2회 호출 시 2회 차감). 003 은 주문 단위 멱등성 키(P-005)로 중복 호출을 방지해야 한다. 다중 variant 주문의 전체 원자성은 003 의 단일 `$transaction` 으로 보장한다.

### seller → product 공개 인터페이스

```ts
// modules/seller/seller.service.ts
class SellerService {
  // FR-017·019 — 승인 판매자 조회. status≠APPROVED 면 ForbiddenException(403).
  getApprovedSeller(userId: string): Promise<{ id: string; userId: string }>;
}
```

### 도메인 이벤트 계약 (인-프로세스 EventEmitter2)

| 이벤트 | 발행 | 구독 | payload | 처리 |
|---|---|---|---|---|
| `product.viewed` | product | user | `{userId: string, productId: string}` | product_views upsert(viewedAt 갱신) — FR-009 |
| `inventory.stock-changed` | inventory | product | `{productId: string, totalStock: number}` | 상품 자동 상태 전이 — FR-023/024 |

> 이벤트 핸들러는 부수효과(best-effort). 핸들러 내부 try/catch + 로깅으로 주 트랜잭션·응답을 차단하지 않는다(외부 라이브러리 동작 검증 §4 한계 참조).

### 하위 호환성

- `User` 모델에 `name`·`phone` **nullable 컬럼 추가** — 기존 auth(register/login/me) 응답·로직에 영향 없음(addtive). 기존 32개 테스트 회귀 없음.
- 17개 스텁 중 13개(cart·coupon·order·payment·shipping·settlement·review·search·notification·file·banner·stats·admin)는 본 spec 무변경.
- `app.module.ts` 에 `EventEmitterModule.forRoot()` 미등록 시 추가(부트스트랩 결선). 기존 모듈 동작 불변.

---

## 데이터 모델

> 복잡도가 높아 상세 컬럼·인덱스·제약은 **Database Design Agent**(selection-phases.md: Y)가 `data-model.md` / 마이그레이션 설계로 확정한다. 본 절은 plan 수준의 목표 구조·핵심 제약을 정의한다.

### users 스키마 (신규 4테이블 + User 확장)

| 테이블 | 핵심 필드 | 제약·인덱스 | 모듈 |
|---|---|---|---|
| `users.users` (확장) | 기존 + `name String?`, `phone String?` | — | user/auth |
| `users.sellers` | `id`, `userId`, `businessName`, `businessNumber`, `representativeName`, `contactPhone?`, `businessAddress?`, `status`(enum PENDING/APPROVED/REJECTED), `rejectReason?`, `createdAt` | `@@unique([userId])`, userId FK→users.users(동일스키마) | seller |
| `users.addresses` | `id`, `userId`, `recipientName`, `phone`, `zipCode`, `address1`, `address2?`, `isDefault`(default false), `createdAt` | userId FK(동일스키마), index(userId) | user |
| `users.wishlists` | `id`, `userId`, `productId`(plain String, FK 없음), `createdAt` | `@@unique([userId, productId])` | user |
| `users.product_views` | `id`, `userId`, `productId`(plain String, FK 없음), `viewedAt` | `@@unique([userId, productId])`, index(userId, viewedAt desc) | user |

### products 스키마 (신규 6테이블)

| 테이블 | 핵심 필드 | 제약·인덱스 | 모듈 |
|---|---|---|---|
| `products.categories` | `id`, `name`, `slug`, `displayOrder` | seed 데이터(ADR-010) | product |
| `products.products` | `id`, `sellerId`(plain String, FK 없음 — ADR-001), `categoryId`(동일스키마 FK), `title`, `description?`, `price Decimal`, `status`(enum DRAFT/ACTIVE/OUT_OF_STOCK/INACTIVE, default DRAFT), `createdAt` | index(status, createdAt, id) — NFR-001 | product |
| `products.product_images` | `id`, `productId`(동일스키마 FK), `url`, `displayOrder` | 상품당 ≤10(앱 레벨, ADR-011), index(productId) | product |
| `products.variants` | `id`, `productId`(동일스키마 FK), `optionName`, `optionValue`, `sku`, `price Decimal` (**stock 컬럼 없음** — ADR-003) | `@@unique([sku])`, index(productId) | product |
| `products.inventory` | `id`, `variantId`(동일스키마 FK), `productId`(동일스키마, 합산용), `quantity Int`(default 0) | `@@unique([variantId])`, index(productId) | inventory |
| `products.inventory_logs` | `id`, `variantId`, `productId`, `type`(enum STOCK_IN/DECREASE/INIT), `delta Int`, `orderId String?`, `createdAt` | append-only(FR-032), index(variantId, createdAt) | inventory |

> **P-001/NFR-003 핵심**: `wishlists.productId`·`product_views.productId`·`products.sellerId` 는 cross-schema 경계이므로 **Prisma `@relation` 미선언 plain String**. 동일 스키마 내 FK(sellers↔users, products↔categories↔variants↔inventory)는 정상 선언.

---

## 테스트 전략

> 환경 태그: `[env:static]` 코드·설정 정적 검증 / `[env:unit]` 단위(NestJS Testing + mock repository, 기동 불필요) / `[env:integration]` 앱 기동 + PostgreSQL.
> 대부분 SC 가 `[env:unit]` — service 단위 테스트(repository·SellerService·InventoryService·EventEmitter mock) + controller 가드/HTTP 상태 검증.

| SC | 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | unit | Happy | 내 프로필 조회 | 인증 GET /users/me | 200 `{id,email,name,phone}` (password 제외) |
| SC-002 | unit | Error | 비인증 프로필 | 토큰 없음 | 401 |
| SC-003 | unit | Happy | 프로필 수정 | `{name,phone}` | 업데이트된 프로필 반환 |
| SC-004 | unit | Happy | 배송지 등록 | `{recipientName,phone,zipCode,address1}` | 201 + 신규 배송지 |
| SC-005 | unit | Happy/Error | 배송지 수정·타인 차단 | 본인/타인 :id | 본인 반영 / 타인 403 |
| SC-006 | unit | Edge | 기본배송지 삭제 자동 재지정 | DELETE 기본배송지 | 204 + 잔여 최신 배송지 isDefault=true |
| SC-007 | unit | Happy | 기본배송지 지정 | PATCH :id/default | 대상 true, 이전 default false |
| SC-008 | unit | Happy/Error | 찜 추가·중복 | POST wishlist/:productId ×2 | 1차 추가 / 2차 409 |
| SC-009 | unit | Happy | 찜 제거 | DELETE wishlist/:productId | 204 |
| SC-010 | unit | Happy | 찜 목록 | GET wishlist | 찜 목록 |
| SC-011 | unit | Happy | 조회 기록 생성 | 인증 GET /products/:id | product.viewed 핸들러 → product_views upsert(viewedAt 갱신) |
| SC-012 | unit | Edge | 최근 본 상품 상한 | GET product-views (>50 기록) | 최신순 최대 50개 |
| SC-013 | unit | Happy/Error | 판매자 등록·중복 | POST register ×2 | PENDING 생성 / 2차 409 |
| SC-014 | unit | Happy | 판매자 프로필 | GET /sellers/me | 프로필 |
| SC-015 | unit | Happy | 판매자 프로필 수정 | PATCH /sellers/me | 반영 |
| SC-016 | unit | Happy | 심사 상태 조회 | GET /sellers/me/status | `{status, rejectReason}` |
| SC-017 | unit | Happy | 승인 | PATCH /sellers/:id/approve | status=APPROVED |
| SC-018 | unit | Happy | 거부 | PATCH :id/reject `{rejectReason}` | REJECTED + rejectReason |
| SC-019 | unit | Error | PENDING 상품 등록 차단 | PENDING + POST /products | 403 |
| SC-020 | unit | Error | REJECTED 상품 등록 차단 | REJECTED + POST /products | 403 |
| SC-021 | unit | Happy | 카테고리 목록 | GET /categories (비인증) | 카테고리 목록 |
| SC-022 | unit | Happy | 상품 등록 | APPROVED + POST /products | DRAFT 상품 |
| SC-023 | unit | Error | 비승인 상품 등록 | PENDING/REJECTED | 403 |
| SC-024 | unit | Happy | 본인 상품 수정 | APPROVED PATCH 본인 | 반영 |
| SC-025 | unit | Error | 타인 상품 수정 | PATCH 타인 :id | 403 |
| SC-026 | unit | Happy | 게시(DRAFT→ACTIVE) | PATCH publish | ACTIVE |
| SC-027 | unit | Happy | 재게시(INACTIVE→ACTIVE) | PATCH publish | ACTIVE |
| SC-028 | unit | Happy | 종료(ACTIVE→INACTIVE) | PATCH deactivate | INACTIVE |
| SC-029 | unit | Happy | 종료(OUT_OF_STOCK→INACTIVE) | PATCH deactivate | INACTIVE |
| SC-030 | unit | Edge | 재고 0 자동 OUT_OF_STOCK | stock-changed totalStock=0 (ACTIVE) | status OUT_OF_STOCK |
| SC-031 | unit | Edge | 재고 복구 자동 ACTIVE | stock-changed totalStock>0 (OUT_OF_STOCK) | status ACTIVE |
| SC-032 | unit | Happy | variant 생성 + 초기재고 | POST /products/:id/variants | variant 생성 + initStock 호출 |
| SC-033 | unit | Happy | variant 수정 | PATCH variants/:variantId | 반영 |
| SC-034 | unit | Happy | variant 삭제 | DELETE variants/:variantId | 삭제 |
| SC-035 | unit | Happy | 이미지 추가 | POST images `{url,displayOrder}` | product_images 생성 |
| SC-036 | unit | Edge | 이미지 10개 초과 | 10개 상태 + 추가 | 400 |
| SC-037 | unit | Happy | 이미지 삭제 | DELETE images/:imageId | 삭제 |
| SC-038 | unit | Happy/Edge | 목록 cursor·노출 필터 | GET /products?limit=20&after | ACTIVE+OUT_OF_STOCK 만, cursor 페이지 |
| SC-039 | unit | Happy/Error | 단건·비노출 404 | GET /:id (ACTIVE / DRAFT) | 상세 / 404 |
| SC-040 | unit | Happy | 본인 전체상태 목록 | GET /sellers/me/products | DRAFT·ACTIVE·OUT_OF_STOCK·INACTIVE |
| SC-041 | unit | Happy | 재고 입고 | POST stock-in `{quantity}` | quantity 증가 + inventory_logs(IN) |
| SC-042 | unit | Happy | 재고 조회 | GET :variantId/stock | 현재 수량 |
| SC-043 | static | Happy | 로그 append-only | 코드 검사 | inventory_logs update/delete API·repository 메서드 부재 |
| SC-044 | static | Happy | checkAvailability 시그니처 | 코드 검사 | `checkAvailability(variantId,quantity):Promise<boolean>` 존재 |
| SC-045 | static | Happy | decreaseStock 시그니처 | 코드 검사 | `decreaseStock(variantId,quantity,orderId):Promise<void>` 존재 |
| SC-046 | unit | Error | 재고 부족 차감 | decreaseStock(재고<수량) | InsufficientStockException throw |
| SC-047 | integration | Edge(성능) | 목록 P95 | 상품 <1000, GET /products?limit=20 연속 | P95 ≤ 500ms (NFR-001) |
| SC-048 | unit | Error | 비인증 401 | 인증필수 endpoint 토큰 없음 | 401 |
| SC-049 | static | Happy | cross-schema 미참조 | repository 코드 정적 검사 | 타 스키마 Prisma 모델 직접 참조 0 |
| SC-050 | static | Happy | price Decimal | schema.prisma | price `Decimal` 선언 |
| SC-051 | static | Happy | AWS SDK 미추가 | package.json | `@aws-sdk/*` 신규 0 |

**Happy/Edge/Error 3유형 충족 점검** (모듈 단위):
- user: Happy(SC-001/003/004/007/009/010/011) · Edge(SC-006 자동재지정·SC-012 상한) · Error(SC-002/005타인/008중복).
- seller: Happy(SC-013/014/015/016/017/018) · Edge(상태 전이 경계 = approve/reject 가 겸함) · Error(SC-019/020 차단·SC-013 중복).
- product: Happy(SC-021/022/024/026~029/032~035/037/040) · Edge(SC-030/031 자동전이·SC-036 이미지상한·SC-038 cursor) · Error(SC-023/025/039 404).
- inventory: Happy(SC-041/042) · Edge(SC-030/031 stock-changed 경계 — product 측 검증) · Error(SC-046 부족).
- 정적(SC-043/044/045/049/050/051)·성능(SC-047)·인증(SC-048)은 횡단 검증.

### [env:integration] 검증 방식 결정 (PATCH-A08 / PROC-010)

본 spec 의 integration SC 는 **SC-047(목록 P95 500ms)** 1건뿐이다(실 PostgreSQL + 상품 <1000 데이터 필요).

**확정: 옵션 A** (001 선례 승계 — 사용자 확정 대기) — main session 이 Docker Compose(PostgreSQL) 기동 + `prisma migrate dev` + seed(카테고리·상품 <1000) + 앱 기동 + `GET /products?limit=20` 부하 측정 절차를 제시 → 사용자 실행 → P95 결과 전달 → Test Agent(EXECUTION)가 SC-047 검증.
- 미채택: 옵션 B(사용자 직접 전 과정), 옵션 C(integration 스킵).
- `[env:unit]`/`[env:static]` SC(SC-047 외 50건)는 옵션 A 와 무관하게 Test Agent 가 직접 실행·정적 검증.
- Spec Agent 가 사용자 선택을 미수집한 경우 main session 이 AWAITING_USER 로 옵션 A 확정 처리(001 과 동일 인프라).

**PROC-010 옵션 C 자가 점검** (옵션 C 미채택이나 의사결정 근거 기록):
1. 운영 환경 의존성: 결함 발견이 운영 배포 환경(Fly.io NAT 등)에 의존하는가? → **N**. 표준 로컬 Docker Compose PostgreSQL 로 충분(순수 비즈니스 로직).
2. mock 불가 시나리오: 단위 mock 으로 시뮬레이션 불가능? → **Y(1건)**. 실 HTTP P95(SC-047)는 실 PostgreSQL·실 쿼리 필요.
3. 권장 재검토: #2 Y → 옵션 A/B 권장. **옵션 A 확정**으로 충족.

### 사후 운영 검증 피드백 사이클 (PROC-014)

spec.md "범위 외 > 사후 운영 검증 피드백 사이클" 절에 이미 명시됨:
- 점검 시나리오: (1) Fly release 단계 `prisma migrate deploy` 정상 실행 (2) users 신규 4테이블 Fly Postgres 생성 (3) products 신규 6테이블 생성.
- 결함 발견 시: spec.md 배경 절 또는 hotfix spec 입력 → main "spec 수정" 이벤트 → cycle 2 재진입, 직전 cycle 산출물 `_ai-workspace/cycle-N-archive/` 백업.
- 본 plan 은 위 절차를 승계하며 추가 수정 없음.

### smoke_tests (선택)

- 필요 여부: **Y**
- 대상 경로:
  - `apps/backend/src/modules/auth/**/*.spec.ts` (기존 auth 단위 테스트)
  - `apps/backend/test/**/*.e2e-spec.ts` 중 auth 흐름 (존재 시)
- 근거: 본 spec 이 `users.users` 모델에 `name`·`phone` 컬럼을 추가(ADR-013)하고 `app.module.ts` 에 `EventEmitterModule.forRoot()` 를 결선한다. User 모델 변경·부트스트랩 변경이 기존 auth(register/login/me) 경로에 회귀를 유발하지 않음을 SC 매핑 테스트와 함께 확인한다. (001 의 32개 테스트 green 유지 검증.)

---

## 기타 고려사항

- **EventEmitter 핸들러 트랜잭션 경계**: `product.viewed`·`inventory.stock-changed` 핸들러는 발행 측 응답/트랜잭션과 분리된 부수효과다. 핸들러 내부 try/catch + 로깅으로 주 흐름을 차단하지 않는다. inventory.stock-changed 누락 시 다음 재고 변경 이벤트가 상태를 재수렴(self-healing) → FR-023/024 의 최종 일관성 보장. 강한 일관성이 필요해지면(후속) 동일 트랜잭션 직접 갱신으로 전환 가능(현재는 동일 products 스키마라 전환 비용 낮음).
- **동시성/race(P-001 §6 검토)**: (1) `decreaseStock` 조건부 감소는 row-level 원자 연산으로 동시 차감 시 음수 재고 불가(ADR-005). (2) 기본배송지 지정/삭제 재지정은 단일 트랜잭션으로 묶어 isDefault 복수 true 방지(ADR-008/009). (3) 찜·조회 upsert 는 `@@unique` + upsert 로 멱등. (4) 자동 상태 전이는 이벤트 순서 역전 시 최종 재고 기준으로 재수렴하므로 일시 불일치 허용.
- **상수화 원칙**: `MAX_PRODUCT_IMAGES=10`, `MAX_PRODUCT_VIEWS=50`, `DEFAULT_PAGE_LIMIT=20`, `MAX_PAGE_LIMIT=100` 을 모듈 상수/config 로 관리(매직넘버 금지). 테스트(SC-012/036/038)도 동일 상수 참조.
- **개인정보 응답 최소화(Q12/Q16)**: User 응답에 `password` 절대 미포함(기존 auth 패턴 — Prisma select 명시 또는 DTO 매핑). seller `businessNumber`·user `phone`·address 는 본인 접근만(가드/소유 검증). Security Agent 검토 대상.
- **옵셔널 인증 가드(ADR-012)**: `OptionalJwtAuthGuard` 는 `AuthGuard('jwt')` 의 `handleRequest` 를 override 하여 토큰 부재·무효 시 user=undefined 로 통과(401 미발생). GET /products/:id 는 이 가드 사용. NFR-002 의 "인증 불필요 endpoint(GET /products/:id)" 와 정합.
- **카테고리 seed(ADR-010)**: 마이그레이션 seed script(`prisma/seed.ts` 또는 마이그레이션 SQL)로 기본 카테고리 N개 삽입. Design/DB Design Agent 가 seed 목록 확정. 생성 API 는 admin 모듈(범위 외).
- **gaps**: 현재 없음. 3단계 이후 설계 공백(특히 DB Design Agent 의 스키마 상세화 중 cross-schema 무결성·seed 범위) 발견 시 gaps.md 에 GAP-XXX 기록.
- **Database Design Agent 위임 사항**: 10개 신규 테이블의 상세 컬럼 타입·인덱스·제약·enum·마이그레이션 순서·seed 데이터를 `data-model.md` 로 확정한다(selection-phases.md: DB Design Y). 본 plan 의 데이터 모델 절이 입력 contract.
