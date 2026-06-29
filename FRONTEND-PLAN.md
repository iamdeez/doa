# DOA Market 프론트엔드 계획 (FRONTEND-PLAN)

> 백엔드 18개 도메인(30테이블) 실구현 완료를 전제로, 프론트엔드(판매자·관리자 콘솔 웹 + 고객 Flutter 앱)
> 구축 로드맵을 정의한다. 결정 사항은 §1, 단계별 실행은 §4~§6.
>
> - **기준 시점**: 2026-06-29, 백엔드 커밋 `6c4ddae` (마이그레이션 13차, unit 255 / e2e·static 84)
> - **상위 문서**: 전체 아키텍처는 `REBUILD-PLAN.md`. 본 문서는 그 프론트엔드 부분의 실행 계획.

## 목차

- [1. 확정 결정](#1-확정-결정)
- [2. 현재 상태](#2-현재-상태)
- [3. 대상 아키텍처](#3-대상-아키텍처)
- [4. Phase 0 — 공유 기반 (OpenAPI 코드젠)](#4-phase-0--공유-기반-openapi-코드젠)
- [5. Phase 1~4 — 콘솔 완성 (판매자·관리자 웹)](#5-phase-14--콘솔-완성-판매자관리자-웹)
- [6. Phase 5~8 — 고객 Flutter 앱](#6-phase-58--고객-flutter-앱)
- [7. 백엔드 라우트 ↔ 화면 매핑](#7-백엔드-라우트--화면-매핑)
- [8. 위험·미결 사항](#8-위험미결-사항)

---

## 1. 확정 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| **작업 순서** | console 먼저 완성 → 그 다음 Flutter 고객 앱 | 공유 레이어를 console에서 먼저 안정화하면 Flutter 계약이 명확. 한 번에 한 앱 집중. |
| **타입 공유** | 백엔드 OpenAPI 도입 → 코드젠 | 18개 도메인 수기 동기화 부담 제거, 계약 SSOT=백엔드. console=openapi-typescript, Flutter=openapi-generator(dart). |
| **Flutter 상태관리** | Riverpod | 현대 표준, 컴파일 타임 안전·테스트 용이, 비동기 서버 상태에 적합. |
| 콘솔 스택 | Next.js 15(App Router)·React 19·TanStack Query·Tailwind 4 (기존 유지) | 이미 console에 구축됨. |
| 모노레포 | Turborepo + pnpm workspace (기존 유지) | apps/console·apps/backend·packages 공존. |

---

## 2. 현재 상태

### 2-1. apps/console (부분 구축 — 약 30%)

- **인프라**: Next 15 App Router, React 19, TanStack Query, Tailwind 4, `(dashboard)` 라우트 그룹, `lib/auth.tsx`(인증 컨텍스트)·`lib/token-store.ts`·`lib/api.ts`·`lib/config.ts`.
- **구현 화면**: `/login`, `/dashboard`, `/seller/register`, `/seller/products`(목록·신규·상세), `/admin/sellers`(승인), `/account/{profile,addresses,wishlist}`.
- **공유 패키지 사용**: `@doa/api-client`·`@doa/shared-types`·`@doa/ui`.

### 2-2. packages (기초 단계)

| 패키지 | 상태 | 비고 |
|---|---|---|
| `@doa/shared-types` | 수기 작성, 001/002 도메인(auth·user·product·inventory·seller)만 | commerce 이후 11개 도메인 타입 누락 |
| `@doa/api-client` | HttpClient + 위 도메인 메서드 | 누락 도메인 메서드 없음 |
| `@doa/ui` | button·card·field·feedback·page-header·cn | 기본 컴포넌트만 |

### 2-3. mobile/customer-app

- **미존재** (Flutter 신규 착수 대상).

### 2-4. 백엔드 (완성, 프론트 소비 대상)

27개 컨트롤러 라우트 표면(§7). OpenAPI/Swagger **미설치** → Phase 0에서 도입.

---

## 3. 대상 아키텍처

```
doa-next/ (Turborepo)
├── apps/
│   ├── backend/         NestJS (완성) + @nestjs/swagger(Phase 0 추가)
│   └── console/         Next.js 판매자·관리자 웹 (Phase 1~4 완성)
├── packages/
│   ├── shared-types/    OpenAPI codegen 산출 타입(Phase 0 전환)
│   ├── api-client/      생성 타입 기반 typed 클라이언트
│   └── ui/              공유 React 컴포넌트(확장)
└── mobile/
    └── customer_app/    Flutter 고객 앱(Phase 5~8) + Riverpod + openapi-generator(dart)
```

**역할 분리**:
- **console** = 판매자(seller) + 관리자(admin) 운영 웹. 역할 기반 라우팅(`/seller/*`, `/admin/*`, 공통 `/account/*`).
- **customer_app** = 고객 쇼핑 앱(검색·장바구니·주문·결제·리뷰·알림). 스토어 배포 대상.

---

## 4. Phase 0 — 공유 기반 (OpenAPI 코드젠)

> **선행 필수**. 콘솔·Flutter 양쪽의 타입·클라이언트 SSOT를 만든다.

### 0-1. 백엔드 OpenAPI 노출
- `@nestjs/swagger` 추가, `main.ts`에 `SwaggerModule` 설정 → `/api-docs`(개발) + `openapi.json` 빌드 산출.
- 기존 DTO(class-validator)에 `@ApiProperty` 보강(필요 최소). enum·CursorPage·ApiErrorBody 등 공통 스키마 등록.
- **주의**: 백엔드는 SDD 산출물 대상 — `@nestjs/swagger` 도입은 별도 spec(`docs/specs/v1.1.0/0XX-openapi`)으로 진행(데코레이터 추가 = 소스 변경).

### 0-2. console 타입·클라이언트 코드젠
- `openapi-typescript`로 `openapi.json` → `packages/shared-types`(생성물) 전환. 수기 타입은 점진 폐기(생성 타입으로 대체, 호환 alias 유지).
- `@doa/api-client`를 생성 타입 기반으로 재작성(도메인별 메서드 18개 군 전부).

### 0-3. 산출물
- `packages/shared-types`: 자동 생성 타입(18개 도메인 전체).
- `packages/api-client`: typed 메서드 전 도메인 커버, 인증 토큰 주입·refresh 흐름 유지.
- 완료 기준: console 기존 화면이 생성 타입으로 typecheck 통과(회귀 0).

---

## 5. Phase 1~4 — 콘솔 완성 (판매자·관리자 웹)

> 각 Phase는 SDD 파이프라인 1개 spec 단위로 진행 권장. 공통 UI(테이블·폼·모달·페이지네이션)는 `@doa/ui`로 추출.

### Phase 1 — 판매자 운영: 주문·배송
- `/seller/orders` — 주문 목록·상세(상태 필터), 주문 확인(confirmed→preparing).
- `/seller/orders/[id]/ship` — 송장 등록(`POST /shipments`), 배송 상태 업데이트.
- 백엔드: `seller/orders`, `shipments`.

### Phase 2 — 판매자 운영: 재고·쿠폰·정산·통계
- `/seller/inventory` — variant 재고 조회·입고(`inventory`).
- `/seller/coupons` — 쿠폰 생성·발급(`sellers/me/coupons`). discountValue 양수 검증 UX(010 정합).
- `/seller/settlements` — 본인 정산 내역(`settlements`).
- `/seller/dashboard` — 판매 요약(`seller/stats`).

### Phase 3 — 관리자 운영
- `/admin/banners` — 배너 CRUD·노출기간(`admin/banners`).
- `/admin/coupons` — 관리자 쿠폰(`admin/coupons`).
- `/admin/settlements` — 전체 정산(`admin/settlements`).
- `/admin/stats` — 플랫폼 overview(`admin/stats`).
- `/admin/users` — 사용자 목록(`admin/users`).
- `/admin/audit-logs` — 관리자 감사 로그(`admin/audit-logs`, 013).

### Phase 4 — 공통·마감
- `/account/notifications` — 인앱 알림(`notifications`, 009 연동).
- `/account/coupons` — 보유 쿠폰(`users/me/coupons`).
- 파일 업로드 UX — presign→PUT→confirm 3단계(`files`, 011 정합), 상품·배너 이미지에 연결.
- 권한 가드 정비(역할별 라우트 접근), 에러·로딩·빈상태 표준화, E2E(Playwright) 스모크.

---

## 6. Phase 5~8 — 고객 Flutter 앱

> `mobile/customer_app/` 신규. Riverpod + openapi-generator(dart) 클라이언트.

### Phase 5 — 앱 골격·인증
- Flutter 프로젝트 생성, Riverpod·go_router·dio 설정, openapi-generator로 dart 클라이언트 생성.
- 회원가입·로그인·토큰 저장(secure storage)·자동 refresh.

### Phase 6 — 탐색·상품
- 홈(배너 `banners` 노출), 검색(`search`)·카테고리(`categories`), 상품 목록·상세(`products`), 리뷰 조회(`products/:id/reviews`), 찜.

### Phase 7 — 구매 플로우
- 장바구니(`cart`), 주문 생성(`orders`, 쿠폰 적용 `users/me/coupons`), 결제(`payments`, Idempotency-Key), 주문 내역·상세·배송 추적(`shipments` tracking).

### Phase 8 — 부가·마감
- 리뷰 작성(`reviews`), 인앱 알림(`notifications`), 프로필·배송지, 이미지 업로드(`files`).
- 스토어 배포 준비(아이콘·스플래시·빌드 설정).

---

## 7. 백엔드 라우트 ↔ 화면 매핑

| 백엔드 라우트 | console(판매자/관리자) | customer_app(Flutter) |
|---|---|---|
| `auth` | 로그인 | 회원가입·로그인 |
| `users`·`sellers/me` | 계정 프로필 | 프로필 |
| `sellers`(등록·승인) | 판매자 등록 / 관리자 승인 | — |
| `products`·`categories`·`inventory` | 판매자 상품·재고 | 상품 탐색·상세 |
| `search` | — | 검색 |
| `cart`·`orders`·`payments` | — | 장바구니·주문·결제 |
| `seller/orders`·`shipments` | 판매자 주문·배송 | (고객) 배송 추적 |
| `reviews`·`products/:id/reviews` | — | 리뷰 작성·조회 |
| `*/coupons`(seller·admin·users) | 쿠폰 발급·관리 | 보유 쿠폰·적용 |
| `settlements`·`admin/settlements` | 판매자·관리자 정산 | — |
| `seller/stats`·`admin/stats` | 대시보드 | — |
| `banners`·`admin/banners` | 배너 관리 | 배너 노출 |
| `notifications` | 인앱 알림 | 인앱 알림 |
| `files` | 이미지 업로드 | 이미지 업로드 |
| `admin/users`·`admin`(audit) | 사용자·감사 로그 | — |

---

## 8. 위험·미결 사항

| 항목 | 내용 | 대응 |
|---|---|---|
| OpenAPI 데코레이터 보강 범위 | 18개 도메인 DTO에 `@ApiProperty` 추가 시 소스 변경량 큼 | Phase 0에서 enum·응답 형태 등 핵심만 우선, 점진 보강 |
| 수기 shared-types 전환 호환 | 기존 console 화면이 수기 타입 의존 | 생성 타입에 alias 매핑으로 단계 전환(회귀 0 목표) |
| 결제 PG 연동 | 백엔드는 `PaymentGatewayPort` + stub. 실 PG 미연동 | Flutter Phase 7은 stub 결제 흐름 기준, 실 PG는 별도 |
| R2 실연동 | 파일은 stub URL. 실제 업로드 경로 미연동(011) | 이미지 업로드 UX는 presign/confirm 계약 기준, 실 R2는 별도 |
| 디자인 시스템 | `@doa/ui` 기본 컴포넌트만 | Phase 1~4에서 공통 컴포넌트 추출·확장 |
| 인증 토큰 보안 | console=메모리/스토어, Flutter=secure storage | TS Secure Context 주의(crypto.randomUUID 회피) |
