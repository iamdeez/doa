---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 03:37
상태: 확정 (retroactive)
---

# Research: 010-backend-response-schemas

## 목차

- [기존 코드베이스 분석](#기존-코드베이스-분석)
- [영향 범위 분석](#영향-범위-분석)
- [기술 선택 조사](#기술-선택-조사)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

> **역문서화 주의**: 이 문서는 구현 커밋(a3fc463→1fe3489)에서 역추출한 분석이다.

---

## 기존 코드베이스 분석

### base 상태(a3fc463) 확인

- `apps/backend/openapi.json` → `components.schemas` 수: **32개**
  (모두 요청 DTO 관련. 응답 스키마 0건)
- 2xx 응답에 content 정의된 오퍼레이션 수: **38/89개**
  (대부분 `{ }` 빈 응답 또는 단순 스칼라 응답 설명만 있고 type 참조 없음)
- `openapi:gen` 스크립트: `nest build && node dist/openapi.js`
  → `NODE_ENV` 미설정 시 pino-pretty 초기화 → **silent exit 1** → 파일 미생성

### DTO 패턴 확인

base 코드에서 응답 DTO 파일이 없었으며, 컨트롤러는 아래 패턴으로 반환했다:

```typescript
// base 상태 — @ApiOkResponse 없음
@Get()
async findAll(): Promise<{ items: Product[]; nextCursor: string | null }> {
  return this.productService.findAll(...);
}
```

### 모듈 구조 (의존 경계)

```
modules/
├── admin/          ← seller-response.dto를 cross-import
├── auth/
├── banner/
├── cart/
├── coupon/
├── notification/
├── order/
├── product/        ← search.controller.ts도 이 DTO 사용
├── review/
├── search/         ← product-response.dto 참조
├── seller/         ← DTO만 신규, 컨트롤러 미변경
├── settlement/
├── shipping/
├── stats/
└── user/
```

**P-001 의존 경계**: `user` 모듈은 `product` 모듈에 의존하지 않는다. 따라서
`WishlistItemResponse`, `RecentViewItemResponse`는 `productId: string` 만 포함하고
상품 상세(title, price 등)를 join해 반환하지 않는다.

---

## 영향 범위 분석

### 신규 생성 파일 (14개 DTO)

| 파일 | 노출 클래스 |
|---|---|
| `admin/dto/admin-response.dto.ts` | AdminUserResponse, AdminUserListResponse |
| `auth/dto/auth-response.dto.ts` | RegisterResponse, LoginResponse |
| `banner/dto/banner-response.dto.ts` | BannerResponse |
| `cart/dto/cart-response.dto.ts` | CartItemResponse, CartResponse |
| `coupon/dto/coupon-response.dto.ts` | CouponResponse, UserCouponResponse, IssueCouponResponse |
| `notification/dto/notification-response.dto.ts` | NotificationResponse, NotificationListResponse |
| `order/dto/order-response.dto.ts` | OrderAddressSnapshotResponse, OrderItemResponse, OrderResponse, OrderDetailResponse, OrderListResponse |
| `product/dto/product-response.dto.ts` | ProductImageResponse, VariantResponse, CategoryResponse, ProductSummaryResponse, ProductCardResponse, ProductDetailResponse, ProductListResponse, SearchProductsResponse |
| `review/dto/review-response.dto.ts` | ReviewResponse, ReviewListResponse |
| `seller/dto/seller-response.dto.ts` | SellerProfileResponse |
| `settlement/dto/settlement-response.dto.ts` | SettlementResponse |
| `shipping/dto/shipping-response.dto.ts` | ShippingAddressResponse, ShippingAddressListResponse |
| `stats/dto/stats-response.dto.ts` | SellerStatsResponse |
| `user/dto/user-response.dto.ts` | UserProfileResponse, WishlistItemResponse, WishlistResponse, RecentViewItemResponse, RecentViewResponse |

### 수정 파일 (14개 컨트롤러)

`@ApiOkResponse` 어노테이션만 추가. 반환 타입 및 로직 불변.

| 컨트롤러 | 추가 어노테이션 수 |
|---|---|
| `admin.controller.ts` | 7 |
| `auth.controller.ts` | 11 |
| `banner.controller.ts` | 6 |
| `cart.controller.ts` | 5 |
| `coupon.controller.ts` | 13 |
| `notification.controller.ts` | 9 |
| `order.controller.ts` | 4 |
| `product.controller.ts` | 9 |
| `review.controller.ts` | 6 |
| `search.controller.ts` | 3 |
| `settlement.controller.ts` | 4 |
| `shipping.controller.ts` | 6 |
| `stats.controller.ts` | 4 |
| `user.controller.ts` | 15 |

### 수정 파일 (코드 생성 산출물)

- `apps/backend/openapi.json`: schemas 32→73, 2xx coverage 38→62/89
- `packages/shared-types/src/openapi.gen.ts`: 2xx 응답 타입 갱신 (+562/-61 lines)
- `apps/backend/package.json`: openapi:gen bug fix (+1/-1 line)

---

## 기술 선택 조사

### 문서 전용 DTO vs 런타임 변환 DTO

| 방식 | 장점 | 단점 |
|---|---|---|
| 문서 전용 (선택) | 런타임 영향 0, 구현 빠름, 기존 테스트 회귀 없음 | Prisma 엔티티와 DTO 동기화 수동 관리 필요 |
| 런타임 변환 | 응답 타입 안전성 완전 | `class-transformer`, `ClassSerializerInterceptor` 도입 필요, 기존 반환 타입 전체 수정 |

구현에서는 **문서 전용 DTO** 패턴을 선택했다. 현재 단계에서 런타임 계약을 변경하지 않고
OpenAPI 스키마를 즉시 보강하는 것이 목적이므로 적합한 선택이다.

### `@ApiProperty` enum 처리

```typescript
// Prisma enum을 그대로 참조
import { OrderStatus } from '@prisma/client';

@ApiProperty({ enum: OrderStatus })
status!: OrderStatus;
```

NestJS Swagger가 `enum OrderStatus` 를 openapi.json의 `enum: ['PENDING', 'PAID', ...]` 배열로
변환한다. 별도 enum DTO 파일 없이 Prisma enum을 직접 참조한다.

---

## 엣지 케이스 및 한계

### void(204) 응답 미처리

- `POST /auth/logout` → 204 No Content
- `DELETE /banners/:id`, `DELETE /cart/items/:id` 등 다수

이 엔드포인트들은 `@HttpCode(204)` 를 사용하며 content가 없는 것이 올바른 설계이므로
`@ApiNoContentResponse()` 어노테이션만 있으면 충분하다. 본 스펙 범위에서는 처리하지 않았다.

### 미커버 오퍼레이션 (~27개)

2xx content 미정의 상태로 남은 오퍼레이션:
- 204 void 응답 (logout, 각종 delete)
- `createSettlement` 응답의 `SettlementWithItems.items` 필드 미완성 모델링
- 특수 반환 구조(토큰 refresh 등) 일부

### Decimal 직렬화 의존성

`@ApiProperty({ type: String })` 선언과 실제 Prisma Decimal→string 직렬화는 NestJS의
기본 `JSON.stringify` 에 의존한다. 향후 serializer 변경 시 이 DTO 선언도 함께 수정해야
한다.

### seller DTO cross-import

`seller-response.dto.ts` 는 seller 컨트롤러가 아닌 admin 컨트롤러에서 참조한다.
admin 모듈이 seller 모듈에 의존하는 구조이며, 이는 현재 모노리스 아키텍처에서 허용된
패턴이다.
