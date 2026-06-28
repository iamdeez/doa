# Project Context

> 이 문서는 프로젝트의 **현재 상태를 묘사**하는 살아있는 참조 문서다.
> 새로운 spec 설계 전 반드시 읽어 프로젝트 구조·흐름·용어를 숙지한다.
>
> - **갱신 시점**: spec 구현·검증 완료 후, `CHANGES.md` 작성과 같은 시점에 갱신한다.
> - **작성 원칙**: 현재 코드베이스의 사실만 기록한다. 미래 계획이나 설계 의도는 spec.md에 작성한다.
> - **constitution.md와의 구분**: constitution은 "어떻게 만들어야 하는가(원칙)"이고,
>   이 문서는 "현재 무엇이 존재하는가(사실)"다.

---

## 1. 프로젝트 개요

- **프로젝트명**: DOA Market (doa-next)
- **목적**: 기존 AWS 기반 MSA 18개 서비스 오픈마켓을 모듈러 모놀리스 + Fly.io로 재구축. AWS 의존 제거·비용 절감·운영 단순화.
- **현재 버전**: v1.0.0
- **주요 기술 스택**: Node.js + TypeScript, NestJS, Prisma, PostgreSQL 16, Turborepo

> 골격 구축(`001-skeleton-bootstrap`) + 카탈로그(`002-catalog`) 완료. `apps/backend`(NestJS 18모듈 — auth·user·seller·product·inventory **5개 실구현** + 13 스텁),
> Prisma 12테이블·JWT 인증·AdminGuard·멀티스테이지 Docker·CI 가 실재한다. (001 골격 검증 32/32 PASS, 002 카탈로그 검증 101 PASS.)

---

## 2. 프로젝트 구조

### 디렉토리 레이아웃

> 실재 기준. `apps/console`·`apps/worker` 는 현재 스캐폴드(package.json + README)만 존재하며 실제 앱 초기화는 후속 단계.
> `mobile/customer-app`·`apps/backend/fly.toml` 은 아직 미존재(Stage 2~4).

```
doa-next/                      Turborepo 모노레포 루트
├── apps/
│   ├── backend/               NestJS 모듈러 모놀리스 (실구현)
│   │   ├── src/health/        헬스체크 (GET /health)
│   │   ├── src/shared/        auth(JwtStrategy·JwtAuthGuard·@CurrentUser)·config(jwt)·prisma(PrismaService)
│   │   ├── src/modules/       18개 NestJS 도메인 모듈 (auth 실구현 + 17 스텁)
│   │   ├── prisma/            schema.prisma (multiSchema) + migrations
│   │   └── Dockerfile         멀티스테이지 + HEALTHCHECK (fly.toml 은 Stage 2+)
│   ├── console/               Next.js seller·admin 웹 (스캐폴드만 — Stage 4 init)
│   └── worker/                pg-boss 워커 (스캐폴드만 — Stage 2+ 설정)
├── packages/
│   ├── shared-types/          OpenAPI 기반 공유 타입
│   ├── api-client/            웹 공통 API 클라이언트
│   └── ui/                    공유 UI 컴포넌트
├── (mobile/customer-app/      Flutter 고객 앱 — 미존재, Stage 4)
├── .github/workflows/ci.yml   CI (lint→typecheck→test→docker build)
├── docker-compose.yml         로컬 PostgreSQL 16
├── turbo.json
└── docs/specs/                SDD 산출물
```

### 레이어 구조 (apps/backend)

```
HTTP 요청
    ↓
Controller (HTTP 라우팅·입력 검증)
    ↓
Service (도메인 로직)
    ↓
Repository (Prisma·DB 접근 — 자기 스키마만)
    ↑ ↓ (도메인 이벤트)
Events (발행/구독 — NestJS EventEmitter)
```

### 핵심 도메인 모듈 목록

| 모듈 | 담당 스키마 | 역할 |
|---|---|---|
| `auth` | `users` | 로그인/JWT/Refresh/비밀번호 재설정/세션 |
| `user` | `users` | 프로필/배송지/찜(wishlist)/최근 본 상품/등급 |
| `seller` | `users` | 판매자 등록·심사·판매자 정보 |
| `product` | `products` | 상품/카테고리/옵션/이미지 |
| `inventory` | `products` | 재고/입출고 로그/SKU |
| `cart` | `commerce` | 장바구니 (JSONB items) |
| `coupon` | `commerce` | 쿠폰 발급·사용 |
| `review` | `commerce` | 리뷰·평점 |
| `order` | `orders` | 주문 생성·상태 전이·주문항목 |
| `payment` | `payments` | 결제·환불 (PG 연동) |
| `shipping` | `orders` | 배송·송장·배송추적 |
| `settlement` | `settlements` | 판매자 정산 |
| `search` | `products` | 상품 검색 인덱싱·질의 (PostgreSQL tsvector/pg_trgm) |
| `notification` | `admin` | 알림 (이메일/푸시/인앱) |
| `file` | `files` | 파일 업로드·메타데이터 (Cloudflare R2) |
| `banner` | `admin` | 배너·프로모션 노출 |
| `stats` | `admin` | 집계·통계·대시보드 |
| `admin` | `admin` | 공지·시스템 설정·운영 |

> **구현 상태**: `auth`·`user`·`seller`·`product`·`inventory` **5개 실구현**(controller/service/repository/events/dto). 나머지 13개(cart~admin)는
> 4계층 빈 스텁(골격만, 비즈니스 로직 없음 — Stage 3 대상).

### 공통(shared)·인프라 모듈 (실구현)

| 모듈 | 위치 | 역할 |
|---|---|---|
| `health` | `src/health/` | 앱 alive 헬스체크 (GET /health, DB 미접근) |
| `shared/auth` | `src/shared/auth/` | JwtStrategy · JwtAuthGuard · OptionalJwtAuthGuard · AdminGuard(`ADMIN_USER_IDS` env 기반, fail-closed) · `@CurrentUser` 데코레이터 |
| `shared/config` | `src/shared/config/` | jwt.config (Access 15분 / Refresh 30일 상수) |
| `shared/prisma` | `src/shared/prisma/` | PrismaService · PrismaModule (DB 연결) |

---

## 3. 이벤트 및 데이터 흐름

### 3.1 주요 처리 흐름

```
[고객 Flutter 앱 / 판매자·관리자 콘솔 웹]
    ↓ HTTPS REST
[NestJS Controller]
    ↓
[Service (도메인 로직)]
    ↓
[Repository (Prisma → PostgreSQL)]
    ↓ (선택: 도메인 이벤트 발행)
[EventEmitter → 구독 모듈 Service 호출]
    ↓ (유실 불가 작업)
[outbox 기록 → pg-boss 워커 폴링]
```

### 3.2 이벤트 흐름

| 이벤트 | 발행 모듈 | 구독 모듈 | 처리 방식 |
|---|---|---|---|
| `product.created` / `product.updated` | `product` | `search`, `stats` | 인-프로세스 EventEmitter |
| `order.created` | `order` | `inventory`, `notification`, `stats` | 인-프로세스 EventEmitter |
| `order.completed` | `order` | `settlement`, `review`, `stats` | outbox + pg-boss (유실 불가) |
| `payment.completed` | `payment` | `order`, `settlement`, `notification` | outbox + pg-boss |
| `payment.refunded` | `payment` | `order`, `settlement`, `notification` | outbox + pg-boss |
| `coupon.used` | `coupon` | `stats` | 인-프로세스 EventEmitter |
| `file.uploaded` | `file` | — | 인-프로세스 (후처리 시 pg-boss) |
| `inventory.stock-changed` | `inventory` | `product` | 인-프로세스 (ProductEventsHandler — ACTIVE↔OUT_OF_STOCK 자동 전이, FR-023/024). **002 실구현** |
| `product.viewed` | `product` | `user` | 인-프로세스 (UserEventsHandler — 최근 본 상품 기록, FR-009). **002 실구현** |

### 3.3 상태 흐름 (state machine)

**주문(Order)**:
```
pending → confirmed → preparing → shipped → delivered → completed
                ↘ cancelled
```
- `pending → confirmed`: payment.completed 이벤트 수신
- `confirmed → preparing`: 판매자 주문 확인
- `preparing → shipped`: 판매자 송장 등록
- `shipped → delivered`: 배송 추적 상태 업데이트
- `delivered → completed`: 구매 확정 (자동 N일 후 또는 수동)
- `* → cancelled`: 취소 요청 + 환불 처리

**결제(Payment)**:
```
pending → completed
       ↘ failed
completed → refund_pending → refunded
```

### 3.4 외부 시스템 연동

| 시스템 | 연동 방식 | 담당 모듈 | 주의사항 |
|---|---|---|---|
| Cloudflare R2 | S3 호환 SDK (`@aws-sdk/client-s3` + R2 엔드포인트) | `file` | AWS SDK 사용하되 R2 엔드포인트만 사용 |
| PG사(결제) | REST API (PG사별 SDK) | `payment` | 멱등성 키 필수 |
| 이메일(알림) | SMTP 또는 외부 SaaS | `notification` | [TBD] — 골격 구축 후 결정 |
| 푸시(알림) | FCM | `notification` | Flutter 앱 대상 |

---

## 4. 데이터 모델

### 스키마 분리 구조

```
postgres (단일 인스턴스, Fly Postgres)
├── schema: users      (users, refresh_tokens, sellers, addresses, wishlists, product_views)
├── schema: products   (categories, products, product_images, variants, inventory, inventory_logs)
├── schema: commerce   (carts, coupons, user_coupons, reviews)
├── schema: orders     (orders, order_items, order_events, shipments, shipment_tracking)
├── schema: payments   (payments, refunds)
├── schema: settlements(settlements, settlement_items)
├── schema: admin      (notices, system_configs, audit_logs, notifications)
└── schema: files      (files)
```

> **실재 상태**: `users` 스키마 6테이블(users·refresh_tokens·sellers·addresses·wishlists·product_views) + `products` 스키마 6테이블(categories·products·product_images·variants·inventory·inventory_logs) = **12개 테이블 실체화**(Prisma migrate 적용).
> 나머지 6개 스키마(commerce·orders·payments·settlements·admin·files)는 네임스페이스만 선언(테이블 0). Variant 가 옵션을 인라인 필드(optionName·optionValue)로 흡수 — 별도 options 테이블 없음.
> 위 괄호 안 나머지 도메인 테이블(commerce~files)은 실구현(Stage 3) 시 추가될 **목표** 구조다.
> Refresh Token 은 원문이 아닌 SHA-256 해시(`tokenHash`)로 저장된다(ADR-003).

**주요 설계 결정 (비도출 지식)**:
- `cart`: `user_id + JSONB items` 구조로 DynamoDB Carts 테이블 대체.
- `orders.order_events`: 이벤트 소싱 유지 (append-only). 주문 상태 변경 이력 보존.
- `orders` 스키마: 트래픽 증가 시 월별 파티셔닝 적용 가능하도록 설계 계승.
- `users.product_views`: 인-앱 캐시 + 배치 flush 방식으로 DynamoDB ProductViews 대체 가능.
- 세션: JWT stateless (Refresh Token은 `users.refresh_tokens` 테이블로 관리).

---

## 5. 도메인 용어 사전 (Glossary)

| 용어 | 정의 | 사용 금지 동의어 |
|---|---|---|
| 모듈 | NestJS `@Module()`로 정의된 도메인 단위. 18개. | 서비스(MSA 문맥), 마이크로서비스 |
| 스키마 | PostgreSQL 내 도메인별 네임스페이스 (`users`, `products` 등) | 데이터베이스 (단일 인스턴스) |
| 도메인 이벤트 | 모듈 간 비동기 통신 단위. NestJS EventEmitter 또는 pg-boss outbox로 처리 | 메시지, 큐 메시지 |
| outbox | 트랜잭션 내 도메인 이벤트를 DB에 기록하고 pg-boss 워커가 폴링 처리하는 패턴 | 트랜잭셔널 outbox |
| 콘솔(console) | 판매자(seller) + 관리자(admin) 통합 Next.js 웹 (`apps/console`) | 어드민, 대시보드 |
| 고객 앱 | Flutter 기반 iOS/Android 쇼핑 앱 (`mobile/customer-app`) | 유저 앱, user-app |
| 워커(worker) | pg-boss 백그라운드 잡 처리 프로세스 (`apps/worker`) | 컨슈머, 큐 워커 |
| strangler | 특정 모듈이 병목 시 해당 모듈만 별도 서비스로 분리하는 점진적 전환 패턴 | — |
| cursor 페이지네이션 | OFFSET 대신 마지막 항목 id를 cursor로 사용하는 무한 스크롤형 목록 패턴 (ADR-007·NFR-001) | 오프셋 페이지네이션 |
| variant | 상품 옵션 조합별 SKU 단위 (optionName·optionValue 인라인 흡수). 재고는 variant 단위로 관리 | (SKU와 혼용 주의) |
| append-only | inventory_logs 등 이력 테이블은 INSERT만 허용, UPDATE·DELETE 금지 (이력 보존) | — |

---

## 6. 알려진 제약 및 기술 부채

| 항목 | 내용 | 영향 범위 | 관련 spec |
|---|---|---|---|
| 13개 도메인 모듈 빈 스텁 | auth·user·seller·product·inventory 외 13개 모듈(cart~admin)은 4계층 골격만 존재 | 해당 모듈 | Stage 3 |
| inventory 재고입고 소유권 미검증 (SEC-002/IDOR) | `POST /inventory/:variantId/stock-in` 이 APPROVED 여부만 확인, variantId→product→seller 소유권 미검증 → 임의 APPROVED 판매자가 타 상품 재고·상태 조작 가능 | `inventory`·`product` | GAP-005 — 003 거래 spec에서 수정 |
| cross-schema plain String 참조 (P-001·ADR-001) | users·products 스키마 간 FK 없음. Wishlist/ProductView.productId·Product.sellerId·InventoryLog.variantId 등 plain String 참조 → DB 수준 참조 무결성 없음(의도적), 삭제 시 고아 레코드 가능 | users·products 스키마 | 002-catalog |
| pino-pretty 미설치 | 로컬 `NODE_ENV=development` 에서 pino-pretty transport 모듈 오류. e2e 는 `NODE_ENV=production`(JSON 로그) 우회 중. 해소: `pnpm add -D pino-pretty --filter backend` | `apps/backend` 로컬 dev 로그 | 001-skeleton-bootstrap |
| 검색 성능 한계 | PostgreSQL tsvector/pg_trgm은 OpenSearch 대비 성능·기능 열위. 트래픽 증가 시 Meilisearch 도입 필요 | `search` 모듈 | — |
| 단일 DB 단일 장애점 | Fly Postgres 단일 인스턴스. HA 옵션 미설정 시 장애 시 다운타임 발생 | 전체 | — |
| 이메일 알림 제공자 미결정 | notification 모듈의 이메일 발송 SaaS(Resend·Mailgun 등) 미선정 | `notification` 모듈 | [TBD] |
| 비용 추정 불확실 | 실제 트래픽·데이터 크기에 따라 Fly Postgres 요금 재산정 필요 | 인프라 | — |
