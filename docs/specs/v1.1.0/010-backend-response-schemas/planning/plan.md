---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 03:37
상태: 확정 (retroactive)
---

# Plan: 010-backend-response-schemas

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [사전 영향도 분석 결과](#사전-영향도-분석-결과)
- [핵심 설계](#핵심-설계)
- [인터페이스 계약](#인터페이스-계약)
- [테스트 전략](#테스트-전략)
- [기타 고려사항](#기타-고려사항)

> Branch: 010-backend-response-schemas | Date: 2026-06-30 | Spec: spec/spec.md
>
> **역문서화 주의**: 이 문서는 이미 구현된 코드에서 설계 의도를 역추출하였다.

---

## 사전 검증 (Constitution Gates)

- [x] 성능 원칙: DTO 클래스는 런타임에 사용되지 않으므로 처리 속도에 영향 없음.
- [x] 호환성 원칙: 컨트롤러 반환 타입 및 런타임 동작 미변경. 기존 클라이언트 회귀 없음.
- [x] 테스트 원칙: 모든 FR-XXX에 SC-XXX가 대응되며 검증 가능.
- [x] 스펙 범위 원칙: 런타임 직렬화 변환 및 제네릭 페이지네이션 통합은 범위 외로 명시.

**예외 사항**: 없음.

---

## 기술 컨텍스트

- **언어 / 런타임**: Node.js 20 + TypeScript 5, NestJS 10
- **주요 의존성**: `@nestjs/swagger` (OpenAPI 데코레이터), `@prisma/client` (enum 참조),
  `openapi-typescript` (codegen)
- **테스트 프레임워크**: Jest (NestJS 기본)
- **코드 생성 파이프라인**:
  1. `pnpm --filter backend openapi:gen` → `apps/backend/openapi.json` 갱신
  2. `pnpm --filter @doa/shared-types gen` → `packages/shared-types/src/openapi.gen.ts` 갱신

---

## 사전 영향도 분석 결과

### 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 |
|---|---|---|
| `apps/backend/src/modules/admin/dto/admin-response.dto.ts` | 신규 | AdminUserResponse, AdminUserListResponse |
| `apps/backend/src/modules/admin/admin.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/auth/dto/auth-response.dto.ts` | 신규 | RegisterResponse, LoginResponse |
| `apps/backend/src/modules/auth/auth.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/banner/dto/banner-response.dto.ts` | 신규 | BannerResponse |
| `apps/backend/src/modules/banner/banner.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/cart/dto/cart-response.dto.ts` | 신규 | CartItemResponse, CartResponse |
| `apps/backend/src/modules/cart/cart.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/coupon/dto/coupon-response.dto.ts` | 신규 | CouponResponse, UserCouponResponse, IssueCouponResponse |
| `apps/backend/src/modules/coupon/coupon.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/notification/dto/notification-response.dto.ts` | 신규 | NotificationResponse, NotificationListResponse |
| `apps/backend/src/modules/notification/notification.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/order/dto/order-response.dto.ts` | 신규 | OrderAddressSnapshotResponse, OrderItemResponse, OrderResponse, OrderDetailResponse, OrderListResponse |
| `apps/backend/src/modules/order/order.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/product/dto/product-response.dto.ts` | 신규 | ProductImageResponse, VariantResponse, CategoryResponse, ProductSummaryResponse, ProductCardResponse, ProductDetailResponse, ProductListResponse, SearchProductsResponse |
| `apps/backend/src/modules/product/product.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/review/dto/review-response.dto.ts` | 신규 | ReviewResponse, ReviewListResponse |
| `apps/backend/src/modules/review/review.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/search/search.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 (product-response.dto 참조) |
| `apps/backend/src/modules/seller/dto/seller-response.dto.ts` | 신규 | SellerProfileResponse (admin.controller.ts에서 참조) |
| `apps/backend/src/modules/settlement/dto/settlement-response.dto.ts` | 신규 | SettlementResponse |
| `apps/backend/src/modules/settlement/settlement.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/shipping/dto/shipping-response.dto.ts` | 신규 | ShippingAddressResponse, ShippingAddressListResponse |
| `apps/backend/src/modules/shipping/shipping.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/stats/dto/stats-response.dto.ts` | 신규 | SellerStatsResponse |
| `apps/backend/src/modules/stats/stats.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/src/modules/user/dto/user-response.dto.ts` | 신규 | UserProfileResponse, WishlistItemResponse, WishlistResponse, RecentViewItemResponse, RecentViewResponse |
| `apps/backend/src/modules/user/user.controller.ts` | 수정 | @ApiOkResponse 어노테이션 추가 |
| `apps/backend/package.json` | 수정 | openapi:gen 스크립트 NODE_ENV=production 추가 |
| `apps/backend/openapi.json` | 수정 | 코드 생성 산출물 — 스키마 32→73 |
| `packages/shared-types/src/openapi.gen.ts` | 수정 | 코드 생성 산출물 — 2xx 타입 갱신 |

---

## 핵심 설계

### 문서 전용 DTO 패턴

컨트롤러는 Prisma 엔티티를 직접 반환하되, `@ApiOkResponse({ type: XxxResponse })` 로
OpenAPI 스펙에 응답 스키마를 선언한다. 런타임에는 DTO 인스턴스가 생성되지 않는다.

```typescript
// 문서 전용 DTO — 런타임 변환 없음
export class ProductListResponse {
  @ApiProperty({ type: [ProductSummaryResponse] })
  items!: ProductSummaryResponse[];

  @ApiProperty({ type: String, required: false, nullable: true })
  nextCursor!: string | null;
}

// 컨트롤러 — DTO 타입은 어노테이션에만 사용
@ApiOkResponse({ type: ProductListResponse })
@Get()
async findAll(...): Promise<{ items: Product[]; nextCursor: string | null }> {
  return this.productService.findAll(...);
}
```

### P-005 금전 필드 패턴

```typescript
@ApiProperty({ type: String, example: '30000.00', description: '금전 — Decimal 직렬화 문자열 (P-005)' })
price!: string;
```

### P-001 cross-schema 필드 패턴

```typescript
@ApiProperty({ description: 'cross-schema plain String — users.sellers.id (P-001)' })
sellerId!: string;
```

### openapi:gen bug fix

```json
// 수정 전
"openapi:gen": "nest build && node dist/openapi.js"

// 수정 후 — pino-pretty가 NODE_ENV=production에서 비활성화되어 silent exit 방지
"openapi:gen": "nest build && NODE_ENV=production node dist/openapi.js"
```

### seller 도메인 특이사항

`seller-response.dto.ts` 는 admin 컨트롤러(관리자 승인 대기·처리 API)에서 참조하며,
별도 seller 컨트롤러 변경 없이 admin.controller.ts 에 import 된다.

---

## 인터페이스 계약

- **런타임 불변**: 기존 컨트롤러 반환 타입(`Promise<Prisma.Product>` 등)은 변경되지 않는다.
- **OpenAPI 계약**: `@ApiOkResponse({ type })` 어노테이션이 `openapi.json` 의 응답 스키마를
  결정한다. 신규 DTO 클래스명이 `components.schemas` 키가 된다.
- **codegen 소비자**: `packages/shared-types/src/openapi.gen.ts` 의 타입은 프론트엔드
  (`apps/console`, `apps/flutter-customer`)가 소비한다.

---

## 테스트 전략

| SC 식별자 | 테스트 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|
| SC-001 | 정적 검증 (파일 존재) | 14개 dto 파일 존재 확인 | git ls-files | 14개 파일 출력 |
| SC-002 | 정적 검증 (코드 분석) | 컨트롤러 @ApiOkResponse 부착 확인 | git diff + grep | 각 컨트롤러에 @ApiOkResponse 추가 확인 |
| SC-003 | 정적 검증 (코드 분석) | 금전 필드 type: String 확인 | grep ApiProperty | type: String 선언 확인 |
| SC-004 | 정적 검증 (파일 읽기) | package.json openapi:gen 스크립트 | cat package.json | NODE_ENV=production 포함 |
| SC-005 | 정적 검증 (JSON 파싱) | openapi.json schemas 수 확인 | jq .components.schemas openapi.json | 73개 |
| SC-006 | 정적 검증 (JSON 파싱) | 2xx content 정의 오퍼레이션 수 | 파싱 스크립트 | 62/89 |
| SC-007 | 정적 검증 (파일 존재) | openapi.gen.ts 갱신 확인 | git diff --stat | openapi.gen.ts 변경 있음 |
| SC-008 | 자동화 테스트 | 백엔드 전체 테스트 실행 | pnpm test | 261 PASS, 0 FAIL |
| SC-009 | 정적 검증 (코드 분석) | wishlist/recent-views DTO 필드 | grep WishlistItemResponse | productId만 포함 |

---

## 기타 고려사항

- **순서 의존**: DTO 파일 생성 → 컨트롤러 어노테이션 추가 → `openapi:gen` 실행 → codegen
  순으로 진행해야 한다. 어노테이션 없이 gen을 실행하면 빈 스키마가 생성된다.
- **pino-pretty silent exit**: `NODE_ENV` 미설정 시 pino-pretty가 초기화를 시도하다 exit 1로
  종료되어 `openapi.json` 생성이 실패했다. 생성 실패 시 파일이 빈 상태로 남아 이를
  커밋하면 codegen도 실패한다.
- **void 204 제외**: logout(`POST /auth/logout`), 배너·카트·쿠폰·리뷰·배송지 삭제 등
  `@HttpCode(204)` 응답은 content 없음이 올바른 표현이므로 의도적으로 제외한다.
