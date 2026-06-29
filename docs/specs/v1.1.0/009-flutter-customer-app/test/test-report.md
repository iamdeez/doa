---
작성: Docs Agent (retroactive)
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정 (retroactive)
---

# Test Report: 009-flutter-customer-app

> 009 구현 완료 커밋 `a3fc463`(base `a94ff47`) 기준 retroactive 검증 보고서.
> 007·008과 동일하게 UI 화면 위주로 별도 단위/e2e 테스트 스위트 없음.
> 검증은 `flutter analyze` + AppTheme 위젯 테스트 + 정적 코드 구조 리뷰로 갈음한다.

## 목차

- [검증 요약](#검증-요약)
- [SC별 검증 결과](#sc별-검증-결과)
- [정합성 점검](#정합성-점검)

---

## 검증 요약

| 항목 | 결과 |
|---|---|
| `flutter analyze` | **0 issues** (PASS) |
| `flutter test` | **1/1 PASS** (app_theme_test) |
| SC 전체 커버리지 | **14/14 COVERED** (정적·구조 리뷰 갈음) |
| 기존 백엔드·콘솔 회귀 | **0** (Flutter 앱은 독립 신규 모듈) |
| DB 마이그레이션 | **없음** |
| 신규 백엔드·콘솔 의존 | **없음** |

---

## SC별 검증 결과

| SC-ID | 검증 방법 | 결과 | 비고 |
|---|---|---|---|
| SC-001 | 정적 코드 리뷰(AuthController) | PASS | _restore·login·logout 분기 확인 |
| SC-002 | 정적 코드 리뷰(Interceptor) | PASS | Bearer·401 single-flight·retried 플래그 확인 |
| SC-003 | 정적 코드 리뷰(homeProductsProvider·searchProvider) | PASS | 익명 GET·키워드 파라미터 확인 |
| SC-004 | 정적 코드 리뷰(productDetailProvider·_WishlistHeart) | PASS | OptionalJWT·409 수렴 확인 |
| SC-005 | 정적 코드 리뷰(VariantSheet) | PASS | buyNow 분기·POST /cart/items 확인 |
| SC-006 | 정적 코드 리뷰(cartProvider·_CartRow) | PASS | PUT·DELETE·합계 계산 확인 |
| SC-007 | 정적 코드 리뷰(_placeOrder) | PASS | POST /orders→POST /payments·uuid·userCouponId 확인 |
| SC-008 | 정적 코드 리뷰(ordersProvider·trackingProvider) | PASS | 4단계 스테퍼·배송 조회 확인 |
| SC-009 | 정적 코드 리뷰(OrderDetailScreen·ReviewWriteScreen) | PASS | delivered/completed 조건·POST /reviews 확인 |
| SC-010 | 정적 코드 리뷰(wishlistProvider·_clearAll) | PASS | N+1·개별·전체 삭제 확인 |
| SC-011 | 정적 코드 리뷰(recentViewsProvider) | PASS | N+1 max 30·추천 재사용 확인 |
| SC-012 | 정적 코드 리뷰(myCouponsProvider·ChoiceChip) | PASS | 탭 필터 분기 확인 |
| SC-013 | 정적 코드 리뷰(AddressBookScreen·AddressEditScreen) | PASS | POST/PATCH/DELETE·기본 설정 확인 |
| SC-014 | `flutter analyze` | **PASS** | 0 issues |

---

## 정합성 점검

### spec.md FR → 구현 대조

- **FR-001~005** (인증): `lib/core/providers.dart` AuthController + `lib/core/api_client.dart` Interceptor로 구현. 일치.
- **FR-006~008** (홈·탐색): `lib/features/home/home_screen.dart`·`lib/features/search/search_screen.dart`. 일치.
- **FR-009~012** (상품 상세): `lib/features/product/product_detail_screen.dart`·`variant_sheet.dart`. 일치.
- **FR-013~016** (장바구니): `lib/features/cart/cart_screen.dart`·`variant_sheet.dart`. 일치.
- **FR-017~021** (결제): `lib/features/checkout/checkout_screen.dart`. 일치. uuid v4 idempotencyKey 포함 확인.
- **FR-022~025** (주문·배송): `lib/features/order/` 3개 화면. 일치.
- **FR-026** (리뷰): `lib/features/review/review_write_screen.dart`. 일치.
- **FR-027~029** (찜): `lib/features/wishlist/wishlist_screen.dart`. N+1 패턴 확인(GAP-009-02).
- **FR-028** (최근 본): `lib/features/history/history_screen.dart`. N+1 max 30 확인(GAP-009-02).
- **FR-030** (쿠폰함): `lib/features/coupon/coupon_box_screen.dart`. 일치.
- **FR-031~033** (주소록): `lib/features/address/` 2개 화면. 일치.

### 범위 외 항목 확인

- 소셜 로그인: `login_screen.dart` `_SocialRow` UI 존재·동작 미구현 확인.
- 카테고리 API: `home_screen.dart` 하드코딩 그리드 확인. GET /categories 호출 없음.
- 1:1문의·FAQ·공지·알림설정: `mypage_screen.dart` onTap: null 확인.
- 마이페이지 프로필: `_ProfileRow` 이메일 하드코딩 확인.
