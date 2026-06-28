# DOA Market 재구축 기획안 (Rebuild Plan)

> **작성일**: 2026-06-28
> **목표**: AWS 의존을 완전히 제거하고, 모듈러 모놀리스 + Fly.io 기반으로
> 서버 비용을 최소화하여 신규 설계·구축·배포한다.
> **결정 전제**: 모듈러 모놀리스 / Fly.io / 백지 신규 설계 / 전체 범위(백엔드·웹·앱·인프라)

---

## 목차

- [1. 배경 및 목표](#1-배경-및-목표)
- [2. 현재(As-Is) 분석](#2-현재as-is-분석)
  - [2.1 기존 자산](#21-기존-자산)
  - [2.2 AWS 의존 지점](#22-aws-의존-지점)
  - [2.3 문제점](#23-문제점)
- [3. 목표(To-Be) 아키텍처](#3-목표to-be-아키텍처)
  - [3.1 핵심 원칙](#31-핵심-원칙)
  - [3.2 전체 구성도](#32-전체-구성도)
- [4. 기술 스택 결정](#4-기술-스택-결정)
- [5. AWS → 비-AWS 컴포넌트 매핑](#5-aws--비-aws-컴포넌트-매핑)
- [6. 도메인 모듈 설계](#6-도메인-모듈-설계)
- [7. 데이터 모델 전략](#7-데이터-모델-전략)
- [8. 비동기·이벤트 처리 전략](#8-비동기이벤트-처리-전략)
- [9. 프론트엔드·모바일 전략](#9-프론트엔드모바일-전략)
- [10. 배포·CI/CD 전략](#10-배포cicd-전략)
- [11. 예상 비용 비교](#11-예상-비용-비교)
- [12. 구축 로드맵](#12-구축-로드맵)
- [13. 리스크 및 고려사항](#13-리스크-및-고려사항)
- [14. 제안 폴더 구조](#14-제안-폴더-구조)

---

## 1. 배경 및 목표

기존 DOA Market은 16~18개 마이크로서비스로 구성된 오픈마켓(이커머스) 플랫폼이며,
AWS(ECS Fargate, RDS 7개, DynamoDB, OpenSearch, S3, EventBridge, ElastiCache, Lambda)에
깊이 결합되어 있다. 트래픽 규모 대비 인프라 고정비가 과도하고, AWS 종속으로 운영 복잡도가 높다.

**목표**:

- **AWS 완전 제거**: AWS 전용 SDK·서비스 의존을 0으로 만든다.
- **비용 최소화**: 컨테이너/DB 수를 최소화하여 월 고정비를 1/10 수준으로 절감한다.
- **운영 단순화**: 단일 배포 단위(모듈러 모놀리스)로 배포·관측·디버깅을 단순화한다.
- **기능 보존**: 기존 18개 도메인의 핵심 기능을 모듈 경계로 계승한다.

**비목표(Out of Scope)**:

- 신규 비즈니스 기능 추가 (재구축은 동등 기능 이전이 우선).
- 멀티 리전·고가용성 과잉 설계 (트래픽 성장 시 단계적 도입).

---

## 2. 현재(As-Is) 분석

### 2.1 기존 자산

| 코드베이스 | 규모 | 성격 |
|---|---|---|
| `doa-market` | 약 752 소스 파일 | 주력. MSA 16개 + admin/seller 웹 + user-app + Terraform/CDK. **AWS ECS Fargate** 결합 |
| `doa-market-backend` | 약 487 소스 파일 | MSA 18개, **k8s/helm/argocd**. RabbitMQ·Prometheus·Sequelize 사용(부분 탈-AWS) |
| `doa-market-web` | 약 53 소스 파일 | Next.js 웹, **AWS Amplify** 배포 |
| `openmarket-aws` | 약 382 소스 파일 | 구세대 AWS 백엔드+웹+lambda |
| `openmarket-app` / `openmarket-user-app` | 약 103 / 133 파일 | 구세대 Flutter 앱 |

> 신규 설계는 위 자산을 **참조용**으로만 사용하고, 도메인 모델·API 명세를 계승하여 백지에서 재작성한다.

### 2.2 AWS 의존 지점

| 영역 | AWS 서비스 | 결합 코드 신호 |
|---|---|---|
| 컴퓨트 | ECS Fargate / EKS / Lambda | `infrastructure/terraform`, `k8s`, `lambda` |
| 관계형 DB | RDS PostgreSQL (7개 DB) | `pg`, `typeorm`, `sequelize` |
| NoSQL | DynamoDB (Sessions/Carts/Wishlists/ProductViews/OrderEvents/AuditLogs/Notifications) | 도메인 문서 §2 |
| 검색 | OpenSearch | `@opensearch-project/opensearch` |
| 파일 | S3 + CloudFront | `@aws-sdk/client-s3`, `file-service` |
| 이벤트 버스 | EventBridge + SQS | `@aws-sdk/client-eventbridge` |
| 캐시 | ElastiCache Redis | `ioredis` |
| 시크릿 | Secrets Manager | `@aws-sdk/client-secrets-manager` |
| 관측 | CloudWatch + X-Ray | `winston-cloudwatch`, `aws-xray-sdk` |
| 인증(선택) | Cognito | auth-service |
| 프론트 배포 | Amplify | `doa-market-web/amplify.yml` |

### 2.3 문제점

- **고정비 과다**: 16~18개 상시 컨테이너 + 다수 RDS/ElastiCache/OpenSearch는 트래픽과 무관하게 월 수백 달러 이상.
- **운영 복잡도**: 서비스 간 통신·분산 트랜잭션·관측이 모두 분산되어 디버깅 난이도 상승.
- **AWS 종속**: 마이그레이션 비용이 높고, 비용 통제 수단이 제한적.

---

## 3. 목표(To-Be) 아키텍처

### 3.1 핵심 원칙

1. **모듈러 모놀리스**: 하나의 배포 단위 안에서 도메인을 모듈로 분리한다. 모듈 간 통신은 인-프로세스 인터페이스(또는 도메인 이벤트)로만 한다. 직접 DB 교차 접근 금지.
2. **단일 PostgreSQL + 스키마 분리**: 도메인별 DB를 단일 인스턴스의 스키마로 통합한다. 검색·세션·장바구니 등 NoSQL 용도도 PostgreSQL(JSONB/tsvector)로 흡수한다.
3. **scale-to-zero·저고정비 우선**: 상시 가동 컴포넌트 수를 최소화한다.
4. **클라우드 중립**: 표준 Docker 컨테이너 + 표준 SQL + S3 호환 스토리지만 사용하여, Fly.io 외 다른 플랫폼으로도 이전 가능하게 한다.

### 3.2 전체 구성도

```
[고객 Flutter 앱]   [판매자/관리자 Next.js 웹]
 (App/Play Store)        (Vercel)
      \               /
       \             /  (HTTPS / REST)
        v           v
   ┌─────────────────────────────┐
   │   Fly.io App (Backend)       │
   │   모듈러 모놀리스 (Node.js)   │
   │  ┌────────────────────────┐  │
   │  │ auth · user · seller   │  │
   │  │ product · inventory    │  │
   │  │ cart · coupon · order  │  │
   │  │ payment · shipping     │  │
   │  │ settlement · review    │  │
   │  │ search · notification  │  │
   │  │ file · banner · stats  │  │
   │  │ admin                  │  │
   │  └────────────────────────┘  │
   │   ↑ in-process events / outbox│
   └───────────┬──────────────────┘
               │
    ┌──────────┼───────────────┐
    v          v               v
[Fly Postgres] [Cloudflare R2] [Worker (선택)]
 (스키마 분리)  (S3 호환 파일)   (백그라운드 잡)
```

---

## 4. 기술 스택 결정

| 영역 | 선택 | 근거 |
|---|---|---|
| 런타임 | Node.js + TypeScript | 기존 자산 계승, 생태계 풍부 |
| 웹 프레임워크 | **NestJS (확정)** | 모듈/DI가 모듈러 모놀리스 경계 강제에 유리. 18개 도메인을 NestJS Module로 1:1 매핑 |
| ORM | **Prisma (확정)** | 단일 DB·다중 스키마(`multiSchema`) 지원, 타입 안정성·마이그레이션. (기존 TypeORM/Sequelize 혼재 → 단일화) |
| DB | PostgreSQL 16 (Fly Postgres) | 단일 인스턴스 + 스키마 분리, 검색(tsvector)·JSONB로 NoSQL 흡수 |
| 캐시 | 인-앱 캐시(LRU) → 필요 시 Upstash Redis | 초기엔 외부 캐시 없이 시작, 병목 시 도입 |
| 검색 | PostgreSQL full-text(tsvector + pg_trgm) → 필요 시 Meilisearch | OpenSearch 제거. 규모 커지면 Meilisearch(Fly 단일 컨테이너) |
| 파일 스토리지 | Cloudflare R2 (S3 호환, egress 무료) | S3 SDK 호환 유지하되 egress 비용 0 |
| 비동기 잡 | pg-boss (PostgreSQL 기반 큐) | 별도 메시지 브로커 불필요, 단일 DB로 처리 |
| 인증 | 자체 JWT(Access/Refresh) | Cognito 제거 |
| 관측 | Fly metrics + Sentry(오류) + pino(구조적 로그) | CloudWatch/X-Ray 제거 |
| 웹 호스팅 | Vercel(무료/저비용) 또는 Fly 정적 | Amplify 제거 |
| CI/CD | GitHub Actions → `flyctl deploy` | 단순 파이프라인 |

> 백엔드 프레임워크(NestJS)·ORM(Prisma)는 확정. 검색·캐시는 초기 PostgreSQL/인-앱으로 시작하고 병목 시 도입.

---

## 5. AWS → 비-AWS 컴포넌트 매핑

| 기존 (AWS) | 신규 (비-AWS) | 비고 |
|---|---|---|
| ECS Fargate / EKS / Lambda | Fly.io App (단일 컨테이너, 필요 시 워커 1) | scale-to-zero·오토스케일 |
| RDS PostgreSQL ×7 | Fly Postgres ×1 (도메인별 스키마) | DB 인스턴스 7→1 |
| DynamoDB ×8 테이블 | PostgreSQL 테이블 (JSONB·세션/카트/조회이력) | NoSQL 흡수 |
| OpenSearch | PostgreSQL tsvector/pg_trgm → Meilisearch | 검색 인덱스 |
| S3 + CloudFront | Cloudflare R2 (+ R2 공개 도메인/CDN) | egress 무료 |
| EventBridge + SQS | 인-프로세스 도메인 이벤트 + pg-boss(outbox) | 모놀리스라 대부분 인-프로세스 |
| ElastiCache Redis | 인-앱 LRU → Upstash Redis(필요 시) | 초기 제거 |
| Secrets Manager | Fly secrets (`flyctl secrets set`) | 환경변수 주입 |
| CloudWatch + X-Ray | Fly metrics + Sentry + pino | |
| Cognito | 자체 JWT | |
| Amplify | Vercel / Fly 정적 | |

---

## 6. 도메인 모듈 설계

기존 18개 서비스를 **1개 백엔드 앱 내 18개 모듈**로 재배치한다. 모듈 경계·이벤트는 유지하되 네트워크 호출을 인-프로세스 호출로 대체한다.

| 모듈 | 책임 | 발행 도메인 이벤트(예) |
|---|---|---|
| `auth` | 로그인/JWT/Refresh/비밀번호 재설정/세션 | `auth.login`, `auth.token.refreshed` |
| `user` | 프로필/배송지/찜/최근본상품/등급 | `user.created`, `user.updated` |
| `seller` | 판매자 등록/심사/판매자 정보 | `seller.registered` |
| `product` | 상품/카테고리/옵션/이미지 | `product.created`, `product.updated` |
| `inventory` | 재고/입출고 로그/SKU | `inventory.changed` |
| `cart` | 장바구니 (PostgreSQL 테이블) | — |
| `coupon` | 쿠폰 발급/사용 | `coupon.issued`, `coupon.used` |
| `order` | 주문 생성/상태 전이/주문항목 | `order.created`, `order.completed` |
| `payment` | 결제/환불 (PG 연동) | `payment.completed`, `payment.refunded` |
| `shipping` | 배송/송장/배송추적 | `shipping.dispatched` |
| `settlement` | 판매자 정산 | `settlement.created` |
| `review` | 리뷰/평점 | `review.created` |
| `search` | 상품 검색 인덱싱·질의 | (product 이벤트 구독) |
| `notification` | 알림(이메일/푸시/인앱) | (다수 이벤트 구독) |
| `file` | 파일 업로드/메타데이터 (R2) | `file.uploaded` |
| `banner` | 배너/프로모션 노출 | — |
| `stats` | 집계/통계/대시보드 | (다수 이벤트 구독) |
| `admin` | 공지/시스템 설정/운영 | — |

**모듈 규약**:

- 각 모듈은 `controller`(HTTP) · `service`(도메인 로직) · `repository`(DB) · `events`(발행/구독) 4계층.
- 모듈은 자신의 스키마 테이블만 접근. 타 도메인 데이터는 **공개 인터페이스 또는 이벤트**로만 획득.
- 향후 특정 모듈이 병목이 되면 그 모듈만 별도 서비스로 분리 가능하도록 경계를 유지(strangler-friendly).

---

## 7. 데이터 모델 전략

**단일 PostgreSQL 인스턴스 + 도메인별 스키마**:

```
postgres (단일 인스턴스)
├── schema: users      (users, sellers, addresses, auth_tokens, refresh_tokens)
├── schema: products   (categories, products, product_images, options, variants, inventory, inventory_logs)
├── schema: commerce   (carts, coupons, user_coupons, reviews)
├── schema: orders     (orders, order_items, shipments, shipment_tracking)  ← 월별 파티셔닝 유지
├── schema: payments   (payments, refunds)
├── schema: settlements(settlements, settlement_items)
├── schema: admin      (notices, system_configs, audit_logs)
└── schema: files      (files)
```

**DynamoDB 대체**:

| 기존 DynamoDB | 신규 |
|---|---|
| Sessions | JWT(stateless) + `users.refresh_tokens` 테이블 |
| Carts | `commerce.carts` (user_id + JSONB items) |
| Wishlists | `users.wishlists` |
| ProductViews | `users.product_views` (또는 인-앱 캐시 + 배치 flush) |
| OrderEvents | `orders.order_events` (이벤트 소싱 유지, append-only) |
| AuditLogs | `admin.audit_logs` |
| Notifications | `admin.notifications` |

> 파티셔닝(주문 월별)·인덱스는 기존 설계를 계승한다. 트랜잭션 일관성은 단일 DB라 분산 트랜잭션(Saga) 부담이 크게 감소한다.

---

## 8. 비동기·이벤트 처리 전략

- **인-프로세스 도메인 이벤트**: 모듈 간 결합은 인-앱 이벤트 버스(EventEmitter/NestJS EventEmitter)로 처리. 동일 프로세스라 네트워크·EventBridge 불필요.
- **신뢰성 필요 작업은 Outbox + pg-boss**: 결제 완료 후 정산/알림처럼 유실 불가 작업은 트랜잭션 내 outbox 기록 → pg-boss 워커가 폴링 처리.
- **워커 분리(선택)**: 무거운 백그라운드 잡(이미지 후처리, 통계 집계, 알림 발송)은 Fly의 별도 process group(워커)로 1개만 운영. 트래픽 없으면 최소 사양.
- **스케줄 잡**: pg-boss 스케줄 또는 Fly cron으로 정산 배치·통계 집계 수행.

---

## 9. 프론트엔드·모바일 전략

**채널 구조 (확정)**: 고객은 모바일 앱, 판매자·관리자는 웹이다.

| 채널 | 대상 | 형태 | 빌드·배포 | 비고 |
|---|---|---|---|---|
| 고객 앱 | user | **Flutter** | iOS App Store / Google Play | 쇼핑·검색·주문·결제. 주 채널 |
| 판매자 웹 | seller | **Next.js** | Vercel | 상품·주문·정산 대시보드 |
| 관리자 웹 | admin | **Next.js** | Vercel | 운영·CS·통계 |

| 대상 | 전략 |
|---|---|
| 고객 Flutter 앱 | 도메인 모델 동일하므로 **API 클라이언트 레이어만 교체**(엔드포인트·JWT 재배선). 기존 `user-app` 자산 계승 |
| 판매자/관리자 웹 | App Router, API는 신규 백엔드로 교체. **Vercel** 배포. Amplify 제거 |
| 공통 | OpenAPI(Swagger) 명세를 SoT로 두고 웹·앱 클라이언트 타입 생성 |

### 9.1 웹(판매자·관리자) 통합 방식 (확정: 옵션 A)

고객 웹이 빠지므로 웹은 **seller·admin** 두 인증 대시보드만 남는다. Turborepo 모노레포 + 공유 패키지
(`packages/ui`·`api-client`·`shared-types`) 전제에서 **`apps/console` 1앱 + 역할 기반 라우팅**으로 확정한다.

| 유형 | 인증 | 권한 | 트래픽 | 성격 |
|---|---|---|---|---|
| seller(판매자 센터) | 필수 | 판매자 범위 | 중 | 인증 대시보드 |
| admin(운영 관리자) | 필수 | 강한 권한·전체 데이터 | 낮음 | 내부 도구 |

| 옵션 | 구성 | 장점 | 단점 |
|---|---|---|---|
| **A. console 1앱 통합 (확정)** | `apps/console` 1개에서 역할 기반 라우팅(seller/admin) | 배포 1개, 공유 컴포넌트 최대 재사용, 구축 최단 | 권한 분기 철저해야 함(admin 라우트 가드) |
| B. seller·admin 2앱 분리 | `apps/seller` + `apps/admin` | 권한·번들·도메인 경계 가장 명확 | 보일러플레이트·배포 2개 |

> **확정: 옵션 A**. seller·admin은 둘 다 인증 대시보드라 한 앱에서 역할 라우팅으로 충분하다.
> 강한 권한은 **라우트 가드 + 서버측 RBAC 검증**으로 분리한다(클라이언트 분기만으로 보안 의존 금지).
> 향후 admin이 비대해지면 B로 분리(strangler)한다.

### 9.2 고객 웹 필요 여부 (확정: 앱 only)

고객 주 채널은 Flutter 앱이며, **고객 웹은 두지 않는다(앱 only)**. 비용·작업 최소화 우선.

> 향후 SEO·링크 공유·PC 유입이 필요해지면 **Flutter Web 겸용 빌드**(동일 코드베이스) 또는
> `apps/storefront`(Next.js) 추가로 확장한다. 현 구조는 이 확장을 막지 않는다.

---

## 10. 배포·CI/CD 전략

```
GitHub push (main)
   ↓
GitHub Actions
   ├─ lint + typecheck + test
   ├─ docker build (멀티스테이지)
   └─ flyctl deploy --remote-only
        ↓
   Fly.io (backend app + postgres + worker)

Next.js 웹: Vercel (GitHub 연동 자동 배포)
Flutter: 기존 스토어 배포 파이프라인 유지
```

- **Fly 구성**: `fly.toml` 1개(backend), Postgres는 `fly postgres create`, 시크릿은 `fly secrets`.
- **무중단 배포**: Fly rolling deploy + healthcheck.
- **DB 마이그레이션**: Prisma/Drizzle migrate를 배포 release 단계에서 실행.
- **환경 분리**: `dev`/`prod` Fly app 2개 또는 단일 app + staging machine.

---

## 11. 예상 비용 비교

> **주의**: 아래 수치는 2026년 기준 **개략 추정**이며, 실제 요금·트래픽에 따라 달라진다. 계약 전 각 플랫폼 공식 요금 재확인 필요.

| 항목 | 기존(AWS) 월 추정 | 신규(Fly.io 외) 월 추정 |
|---|---|---|
| 컴퓨트 | ECS Fargate 16~18 태스크 상시 → 수백 $ | Fly 백엔드 1 + 워커 1 (소형) → 약 $5~25 |
| 관계형 DB | RDS ×7 → 수백 $ | Fly Postgres 1 (소형~중형) → 약 $5~30 |
| 검색 | OpenSearch → 수십~수백 $ | PostgreSQL 내장 → $0 |
| 캐시 | ElastiCache → 수십 $ | 인-앱 → $0 (필요 시 Upstash 무료/저가) |
| 파일 | S3+CloudFront egress → 변동 | Cloudflare R2 → 저장만 과금, egress $0 |
| 이벤트/큐 | EventBridge+SQS → 변동 | pg-boss(DB 내) → $0 |
| 웹 호스팅 | Amplify → 변동 | Vercel 무료/저가 → $0~20 |
| **합계(소규모 트래픽)** | **수백 $/월** | **약 $15~75/월** |

핵심 절감 동인: **컨테이너 16→1~2, DB 7→1, 검색·캐시·큐·이벤트버스의 관리형 서비스 제거(PostgreSQL/인-앱으로 흡수), egress 무료 스토리지**.

---

## 12. 구축 로드맵

| 단계 | 내용 | 산출물 |
|---|---|---|
| **0. 기획 확정** | 본 기획안 검토·확정, 프레임워크/ORM 1개 확정 | 확정된 REBUILD-PLAN |
| **1. 골격 구축** | 모노레포·모듈 골격·단일 Postgres 스키마·인증(JWT)·CI 파이프라인 | 배포 가능한 빈 백엔드 |
| **2. 핵심 커머스** | product·inventory·cart·order·payment·user·auth·seller 모듈 | 주문~결제 E2E 동작 |
| **3. 부가 도메인** | coupon·review·shipping·settlement·search·notification·file·banner·stats·admin | 기능 동등성 확보 |
| **4. 프론트 재배선** | Next.js 웹 API 교체(Vercel), Flutter 앱 API 클라이언트 교체 | 웹·앱 통합 동작 |
| **5. 데이터 이관** | (기존 데이터가 있으면) RDS/DynamoDB → PostgreSQL ETL | 마이그레이션 스크립트 |
| **6. 컷오버·관측** | Fly prod 전환, Sentry/metrics, 부하·비용 검증 | 운영 전환 |

> 각 단계는 SDD 파이프라인(spec → plan → tasks → 구현 → 검증)으로 분해하여 진행한다.

---

## 13. 리스크 및 고려사항

| 리스크 | 영향 | 완화책 |
|---|---|---|
| 단일 DB 단일 장애점 | 가용성 | Fly Postgres HA(복제) 옵션, 자동 백업/PITR |
| 모놀리스 스케일 한계 | 성능 | 모듈 경계 유지로 병목 모듈만 추후 분리(strangler) |
| PostgreSQL 검색 한계 | 검색 품질 | 규모 증가 시 Meilisearch 단일 컨테이너 도입 |
| Fly.io 종속 | 이전성 | 표준 Docker·SQL·S3 호환만 사용해 락인 회피 |
| 결제/정산 정합성 | 금전 사고 | outbox + 멱등성 키 + 단일 DB 트랜잭션 활용 |
| 기존 코드 계승 범위 모호 | 일정 | 도메인별 API 명세를 SoT로 고정 후 재작성 |
| 비용 추정 불확실 | 예산 | 단계 1 후 실측치로 재산정 |

---

## 14. 제안 폴더 구조

```
doa-next/                      (신규 Turborepo 모노레포)
├── apps/
│   ├── backend/               NestJS 모듈러 모놀리스
│   │   ├── src/modules/       auth·user·product·order ... (18 NestJS Module)
│   │   ├── src/shared/        공통(이벤트버스·인증 가드·R2 등)
│   │   ├── prisma/            schema.prisma (multiSchema) + migrations
│   │   ├── Dockerfile
│   │   └── fly.toml
│   ├── console/               Next.js — seller·admin(역할 기반)  ※웹 옵션 A 기준
│   └── worker/                pg-boss 백그라운드 잡 (backend와 코드 공유)
├── packages/
│   ├── shared-types/          OpenAPI 기반 공유 타입
│   ├── api-client/            웹 공통 API 클라이언트
│   └── ui/                    공유 UI 컴포넌트
├── mobile/
│   └── customer-app/          Flutter 고객 앱 (스토어 배포, 기존 user-app 계승)
├── .github/workflows/         CI/CD (fly deploy / vercel)
├── turbo.json
└── docs/specs/                SDD 산출물
```

> `apps/console` 단일 웹은 옵션 A(권장) 기준이다. 옵션 B 확정 시 `apps/seller`+`apps/admin`으로 분할한다.
> 고객 웹이 필요해지면(§9.2) `apps/storefront`(Next.js) 또는 Flutter Web 빌드를 추가한다.

---

> **전부 확정 완료**:
> - 백엔드 NestJS · ORM Prisma · 플랫폼 Fly.io · 아키텍처 모듈러 모놀리스
> - 채널 = 고객 Flutter 앱(스토어 only) + 판매자·관리자 통합 웹(`apps/console`, Next.js, Vercel)
> - 데이터 = 단일 PostgreSQL(스키마 분리) · 파일 R2 · 큐 pg-boss · 검색 PostgreSQL FTS
>
> **다음 단계**: 단계 1(골격 구축)을 SDD 파이프라인(`/pipeline` 또는 `/spec`)으로 분해하여
> spec.md 작성에 착수한다.
