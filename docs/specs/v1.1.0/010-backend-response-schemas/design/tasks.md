---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 03:37
상태: 확정 (retroactive)
---

# Tasks: 010-backend-response-schemas

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [구현 완료 기준](#구현-완료-기준)

> Branch: 010-backend-response-schemas | Date: 2026-06-30 | Plan: planning/plan.md
>
> **역문서화 주의**: 이 문서는 이미 완료된 구현(a3fc463→1fe3489)을 기준으로 재구성한 것이다.
> 모든 태스크는 완료 상태로 기록한다.

---

## 전제 조건

- [x] spec.md의 모든 `[NEEDS CLARIFICATION]` 항목이 해소되었는가?
- [x] plan.md의 Constitution Gates가 모두 통과(또는 예외 기재)되었는가?
- [x] CHANGES.md에서 이전 작업의 "후속 작업 시 주의사항"을 확인했는가?

---

## 태스크 목록

> 역문서화 기준 — 모든 태스크 완료됨.

### Phase 1. Bug Fix

- [x] **T001** — openapi:gen 스크립트 bug fix
  - 구현 파일: `apps/backend/package.json`
  - 관련 요구사항: `FR-005`
  - 상세: `NODE_ENV=production` 추가로 pino-pretty silent exit 수정
  - 완료 기준: `nest build && NODE_ENV=production node dist/openapi.js` 정상 실행

### Phase 2. 응답 DTO 신규 생성 (14개 도메인)

- [x] **T002** — auth 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/auth/dto/auth-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`, `FR-003`
  - 상세: RegisterResponse, LoginResponse DTO 정의

- [x] **T003** `[P]` — admin 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/admin/dto/admin-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`, `FR-004`
  - 상세: AdminUserResponse, AdminUserListResponse DTO 정의

- [x] **T004** `[P]` — banner 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/banner/dto/banner-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`
  - 상세: BannerResponse DTO 정의

- [x] **T005** `[P]` — cart 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/cart/dto/cart-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`, `FR-003`
  - 상세: CartItemResponse, CartResponse DTO 정의

- [x] **T006** `[P]` — coupon 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/coupon/dto/coupon-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`, `FR-003`
  - 상세: CouponResponse, UserCouponResponse, IssueCouponResponse DTO 정의

- [x] **T007** `[P]` — notification 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/notification/dto/notification-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`
  - 상세: NotificationResponse, NotificationListResponse DTO 정의

- [x] **T008** `[P]` — order 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/order/dto/order-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`, `FR-003`, `FR-004`
  - 상세: OrderAddressSnapshotResponse, OrderItemResponse, OrderResponse, OrderDetailResponse, OrderListResponse DTO 정의

- [x] **T009** `[P]` — product 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/product/dto/product-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`, `FR-003`, `FR-004`
  - 상세: ProductImageResponse, VariantResponse, CategoryResponse, ProductSummaryResponse, ProductCardResponse, ProductDetailResponse, ProductListResponse, SearchProductsResponse DTO 정의

- [x] **T010** `[P]` — review 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/review/dto/review-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`, `FR-003`
  - 상세: ReviewResponse, ReviewListResponse DTO 정의

- [x] **T011** `[P]` — seller 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/seller/dto/seller-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`
  - 상세: SellerProfileResponse DTO 정의 (admin.controller.ts 에서 사용)

- [x] **T012** `[P]` — settlement 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/settlement/dto/settlement-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`, `FR-003`
  - 상세: SettlementResponse DTO 정의

- [x] **T013** `[P]` — shipping 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/shipping/dto/shipping-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`
  - 상세: ShippingAddressResponse, ShippingAddressListResponse DTO 정의

- [x] **T014** `[P]` — stats 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/stats/dto/stats-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`, `FR-003`
  - 상세: SellerStatsResponse DTO 정의

- [x] **T015** `[P]` — user 도메인 응답 DTO
  - 구현 파일: `apps/backend/src/modules/user/dto/user-response.dto.ts` (신규)
  - 관련 요구사항: `FR-001`, `FR-007`
  - 상세: UserProfileResponse, WishlistItemResponse(productId만), WishlistResponse, RecentViewItemResponse(productId만), RecentViewResponse DTO 정의

### Phase 3. 컨트롤러 어노테이션 부착 (T001~T015 완료 후)

- [x] **T016** — 14개 컨트롤러 @ApiOkResponse 어노테이션 부착
  - 구현 파일: admin/auth/banner/cart/coupon/notification/order/product/review/search/settlement/shipping/stats/user controller 각각
  - 관련 요구사항: `FR-002`
  - 완료 기준: 각 컨트롤러의 GET 라우트에 @ApiOkResponse({ type }) 부착 확인

### Phase 4. 코드 생성 실행 (T016 완료 후)

- [x] **T017** — openapi:gen 실행 및 산출물 검증
  - 구현 파일: `apps/backend/openapi.json`
  - 관련 요구사항: `FR-006`
  - 명령: `pnpm --filter backend openapi:gen`
  - 완료 기준: schemas 73개, 2xx coverage 62/89

- [x] **T018** — shared-types codegen 실행
  - 구현 파일: `packages/shared-types/src/openapi.gen.ts`
  - 관련 요구사항: `FR-006`, `NFR-005`
  - 명령: `pnpm --filter @doa/shared-types gen`
  - 완료 기준: 오류 없이 실행, 파일 갱신

### Phase 5. 검증

- [x] **T019** — 백엔드 테스트 전체 실행
  - 관련 요구사항: `NFR-002`
  - 명령: `pnpm --filter backend test`
  - 완료 기준: 261 PASS, 0 FAIL

---

## 구현 완료 기준

- [x] 모든 태스크 체크박스가 완료 처리되었다.
- [x] `pnpm --filter backend test` 261 PASS 반환.
- [x] `openapi.json` schemas 73개, 2xx coverage 62/89 확인.
- [x] `git status`에 의도치 않은 파일이 없다.
