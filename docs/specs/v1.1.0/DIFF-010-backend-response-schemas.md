---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 13:49
상태: 확정 (retroactive)
---

# Diff: 010-backend-response-schemas

## 커밋 메시지용 한 줄 요약

- **KO**: feat(backend): 14개 도메인 응답 DTO + `@ApiOkResponse` 부착 — OpenAPI 2xx 응답 스키마 보강(런타임 무변경)
- **EN**: feat(backend): response DTOs for 14 domains + `@ApiOkResponse` — enrich OpenAPI 2xx response schemas (no runtime change)

## 변경 요약

- **문서 전용 응답 DTO 14종 신규**: admin·auth·banner·cart·coupon·notification·order·product·review·seller·settlement·shipping·stats·user 각 도메인에 `*-response.dto.ts` 를 생성하고 `@ApiProperty` 부착. 컨트롤러는 여전히 Prisma 엔티티를 반환하며 DTO 는 OpenAPI 스키마 생성 목적으로만 존재(NFR-001 런타임 무변경).
- **컨트롤러 어노테이션 부착**: 14개 도메인 컨트롤러 + search 컨트롤러의 각 라우트에 `@ApiOkResponse({ type })` / `@ApiOkResponse({ type: [DTO] })` 부착.
- **금전 필드 string 표기(P-005)**: 가격·합계·할인액 등 Prisma `Decimal` → JSON 직렬화 시 문자열이 되는 필드를 DTO 에서 `@ApiProperty({ type: String })` 으로 선언.
- **cross-schema plain String(P-001)**: userId·sellerId 등 외래 모듈 엔티티 ID 는 `@ApiProperty({ description: 'cross-schema plain String … (P-001)' })` 으로 기재(모듈 간 의존 회피).
- **P-001 경계 — wishlist/recent-views**: 찜(`/user/wishlist`)·최근 본 상품(`/user/recent-views`) 응답 DTO 는 `productId: string` 만 포함하고 상품 상세 summary join 을 하지 않음(user→product 모듈 의존 금지).
- **openapi:gen 버그 픽스(FR-005)**: `apps/backend/package.json` 의 `openapi:gen` 스크립트에 `NODE_ENV=production` 추가 — pino-pretty 초기화로 인한 silent exit 수정.
- **코드 생성 파이프라인 재실행**: `apps/backend/openapi.json` 과 `packages/shared-types/src/openapi.gen.ts` 갱신. components.schemas 32→73, typed 2xx 응답 38→62/89.

## 변경 파일 및 라인 수

| 파일 | 추가 | 삭제 |
|---|---|---|
| `apps/backend/openapi.json` | 1773 | 161 |
| `apps/backend/package.json` | 1 | 1 |
| `apps/backend/src/modules/admin/admin.controller.ts` | 7 | 0 |
| `apps/backend/src/modules/admin/dto/admin-response.dto.ts` | 51 | 0 |
| `apps/backend/src/modules/auth/auth.controller.ts` | 11 | 0 |
| `apps/backend/src/modules/auth/dto/auth-response.dto.ts` | 34 | 0 |
| `apps/backend/src/modules/banner/banner.controller.ts` | 6 | 0 |
| `apps/backend/src/modules/banner/dto/banner-response.dto.ts` | 35 | 0 |
| `apps/backend/src/modules/cart/cart.controller.ts` | 5 | 0 |
| `apps/backend/src/modules/cart/dto/cart-response.dto.ts` | 40 | 0 |
| `apps/backend/src/modules/coupon/coupon.controller.ts` | 13 | 0 |
| `apps/backend/src/modules/coupon/dto/coupon-response.dto.ts` | 75 | 0 |
| `apps/backend/src/modules/notification/notification.controller.ts` | 9 | 0 |
| `apps/backend/src/modules/notification/dto/notification-response.dto.ts` | 47 | 0 |
| `apps/backend/src/modules/order/order.controller.ts` | 4 | 0 |
| `apps/backend/src/modules/order/dto/order-response.dto.ts` | 101 | 0 |
| `apps/backend/src/modules/product/product.controller.ts` | 9 | 0 |
| `apps/backend/src/modules/product/dto/product-response.dto.ts` | 125 | 0 |
| `apps/backend/src/modules/review/review.controller.ts` | 6 | 0 |
| `apps/backend/src/modules/review/dto/review-response.dto.ts` | 46 | 0 |
| `apps/backend/src/modules/search/search.controller.ts` | 3 | 0 |
| `apps/backend/src/modules/seller/dto/seller-response.dto.ts` | 35 | 0 |
| `apps/backend/src/modules/settlement/settlement.controller.ts` | 4 | 0 |
| `apps/backend/src/modules/settlement/dto/settlement-response.dto.ts` | 35 | 0 |
| `apps/backend/src/modules/shipping/shipping.controller.ts` | 6 | 0 |
| `apps/backend/src/modules/shipping/dto/shipping-response.dto.ts` | 49 | 0 |
| `apps/backend/src/modules/stats/stats.controller.ts` | 4 | 0 |
| `apps/backend/src/modules/stats/dto/stats-response.dto.ts` | 29 | 0 |
| `apps/backend/src/modules/user/user.controller.ts` | 15 | 0 |
| `apps/backend/src/modules/user/dto/user-response.dto.ts` | 79 | 0 |
| `packages/shared-types/src/openapi.gen.ts` | 562 | 61 |

> seller·settlement 도메인은 응답 DTO 신규 생성분만 이 표에 포함되며, 컨트롤러 어노테이션은
> 직전 차수(004 seller·order·shipping)에서 일부 부착되었다. 정확한 라인 카운트는 아래 재생성 명령으로 확인한다.

## Diff

> 전체 diff 는 박제하지 않는다 — git 이 형상관리 SoT.
> base commit + 재생성 명령만 기록:
> `git diff a3fc463 1fe3489 -- apps/backend/src apps/backend/openapi.json apps/backend/package.json packages/shared-types/src/openapi.gen.ts`
>
> 주의: 커밋 범위 `a3fc463..1fe3489` 중간에 009 docs 커밋(db7cdb5)이 끼어 있으므로,
> 전체 범위 diff 가 아닌 위 경로 한정 diff 로 010 변경분을 추출한다.
