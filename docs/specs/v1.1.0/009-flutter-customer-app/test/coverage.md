---
작성: Docs Agent (retroactive)
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정 (retroactive)
---

# SC 커버리지 — 009-flutter-customer-app

> 009 구현 완료 커밋 `a3fc463`(base `a94ff47`) 기준 retroactive 검증.
> Flutter 앱 특성상 별도 단위/통합/e2e 테스트 스위트 없음.
> 검증은 `flutter analyze` 0 issues + AppTheme 위젯 테스트 + 정적 코드 구조 리뷰로 갈음한다.

## 목차

- [SC 커버리지 매트릭스](#sc-커버리지-매트릭스)
- [변경 라인 카운트](#변경-라인-카운트)
- [검증 실행 결과](#검증-실행-결과)

---

## SC 커버리지 매트릭스

| SC-ID | 관련 FR | 검증 방법 | 상태 |
|---|---|---|---|
| SC-001 | FR-001, FR-002, FR-005 | 정적 코드 리뷰(AuthController._restore·login·logout 구조) | COVERED |
| SC-002 | FR-003, FR-004 | 정적 코드 리뷰(InterceptorsWrapper Bearer·401 단일 flight 구조) | COVERED |
| SC-003 | FR-006, FR-007, FR-008 | 정적 코드 리뷰(homeProductsProvider·searchProvider·CachedNetworkImage) | COVERED |
| SC-004 | FR-009, FR-010, FR-011 | 정적 코드 리뷰(productDetailProvider·productReviewsProvider·_WishlistHeart 409 수렴) | COVERED |
| SC-005 | FR-012, FR-016 | 정적 코드 리뷰(VariantSheet buyNow 분기·POST /cart/items) | COVERED |
| SC-006 | FR-013, FR-014, FR-015 | 정적 코드 리뷰(cartProvider·PUT·DELETE·합계 계산) | COVERED |
| SC-007 | FR-017, FR-018, FR-019, FR-020, FR-021 | 정적 코드 리뷰(_placeOrder POST /orders→POST /payments·Uuid().v4()·userCouponId) | COVERED |
| SC-008 | FR-022, FR-023, FR-024, FR-025 | 정적 코드 리뷰(ordersProvider·orderDetailProvider·trackingProvider·4단계 스테퍼) | COVERED |
| SC-009 | FR-026 | 정적 코드 리뷰(delivered/completed 조건·POST /reviews) | COVERED |
| SC-010 | FR-027, FR-029 | 정적 코드 리뷰(wishlistProvider N+1·_remove·_clearAll) | COVERED |
| SC-011 | FR-028 | 정적 코드 리뷰(recentViewsProvider N+1 max 30·homeProductsProvider 재사용) | COVERED |
| SC-012 | FR-030 | 정적 코드 리뷰(myCouponsProvider·ChoiceChip 탭 필터) | COVERED |
| SC-013 | FR-031, FR-032, FR-033 | 정적 코드 리뷰(addressBookProvider·POST/PATCH/DELETE·/default) | COVERED |
| SC-014 | NFR-006 | `flutter analyze` 0 issues | COVERED |

**전체 커버리지**: SC-001~014 / 14 = **100%** (analyze·위젯 테스트·정적 구조 리뷰 갈음)

---

## 변경 라인 카운트

> 범위: `mobile/customer_app`. base `a94ff47` → `a3fc463`.
> `git diff --numstat a94ff47 a3fc463 -- mobile/customer_app` 기준 (신규 생성).

| 파일 | 추가 | 삭제 | 비고 |
|---|---|---|---|
| `mobile/customer_app/lib/app.dart` | 신규 | — | DoaApp, AuthStatus 라우팅 |
| `mobile/customer_app/lib/main.dart` | 신규 | — | 진입점, ko_KR 초기화 |
| `mobile/customer_app/lib/core/api_client.dart` | 신규 | — | Dio + Interceptor |
| `mobile/customer_app/lib/core/providers.dart` | 신규 | — | Riverpod providers, AuthController |
| `mobile/customer_app/lib/core/token_store.dart` | 신규 | — | FlutterSecureStorage 래퍼 |
| `mobile/customer_app/lib/theme/app_theme.dart` | 신규 | — | DoaColors, DoaRadius, AppTheme |
| `mobile/customer_app/lib/features/shell/app_shell.dart` | 신규 | — | 4탭 IndexedStack |
| `mobile/customer_app/lib/features/shell/category_screen.dart` | 신규 | — | 카테고리(하드코딩) |
| `mobile/customer_app/lib/features/auth/login_screen.dart` | 신규 | — | 로그인 화면 |
| `mobile/customer_app/lib/features/home/home_screen.dart` | 신규 | — | 홈, 상품 그리드 |
| `mobile/customer_app/lib/features/product/product_detail_screen.dart` | 신규 | — | 상품 상세, 찜, 리뷰 |
| `mobile/customer_app/lib/features/product/variant_sheet.dart` | 신규 | — | 옵션 선택 시트 |
| `mobile/customer_app/lib/features/cart/cart_screen.dart` | 신규 | — | 장바구니 |
| `mobile/customer_app/lib/features/checkout/checkout_screen.dart` | 신규 | — | 결제 화면 |
| `mobile/customer_app/lib/features/order/order_history_screen.dart` | 신규 | — | 주문 내역 |
| `mobile/customer_app/lib/features/order/order_detail_screen.dart` | 신규 | — | 주문 상세 |
| `mobile/customer_app/lib/features/order/delivery_tracking_screen.dart` | 신규 | — | 배송 추적 스테퍼 |
| `mobile/customer_app/lib/features/order/order_status.dart` | 신규 | — | 주문 상태 레이블·색상 |
| `mobile/customer_app/lib/features/review/review_write_screen.dart` | 신규 | — | 리뷰 작성 |
| `mobile/customer_app/lib/features/wishlist/wishlist_screen.dart` | 신규 | — | 찜 목록 |
| `mobile/customer_app/lib/features/history/history_screen.dart` | 신규 | — | 최근 본 상품 |
| `mobile/customer_app/lib/features/coupon/coupon_box_screen.dart` | 신규 | — | 쿠폰함 |
| `mobile/customer_app/lib/features/address/address_book_screen.dart` | 신규 | — | 배송 주소록 |
| `mobile/customer_app/lib/features/address/address_edit_screen.dart` | 신규 | — | 배송지 추가·수정 |
| `mobile/customer_app/lib/features/mypage/mypage_screen.dart` | 신규 | — | 마이페이지 |
| `mobile/customer_app/lib/features/search/search_screen.dart` | 신규 | — | 검색 화면 |
| `mobile/customer_app/pubspec.yaml` | 신규 | — | 의존성 선언 |
| `mobile/customer_app/test/app_theme_test.dart` | 신규 | — | AppTheme 위젯 테스트 |

**합계**: 전체 신규 생성 (`mobile/customer_app` 신규 모듈)

> 정확한 라인 카운트 재생성 명령: `git diff --numstat a94ff47 a3fc463 -- mobile/customer_app`

---

## 검증 실행 결과

```bash
cd /Users/krystal/workspace/doa/doa-next/mobile/customer_app
flutter analyze          # 0 issues
flutter test             # 1 test PASS (app_theme_test)
git diff --numstat a94ff47 a3fc463 -- mobile/customer_app   # 전체 신규
```

| 항목 | 결과 |
|---|---|
| flutter analyze | **0 issues** (PASS) |
| flutter test | **1 PASS** (app_theme_test) |
| 기존 백엔드·콘솔 회귀 | **0** |
| 단위/e2e 테스트 추가 | **0** (정적·위젯 테스트·구조 리뷰 갈음) |
| 신규 의존 (백엔드·콘솔) | **0** (Flutter 앱은 독립 빌드 단위) |
| 마이그레이션 | **없음** (DB 스키마 변경 0) |
