---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정
---

# Diff: 009-flutter-customer-app

## 커밋 메시지용 한 줄 요약

- **KO**: feat(mobile): Flutter 고객 앱 MVP 구현 — 인증·홈·상품·장바구니·결제·주문·찜·쿠폰·주소록
- **EN**: feat(mobile): Flutter customer app MVP — auth, home, product, cart, checkout, orders, wishlist, coupons, address book

## 변경 요약

- **신규 모듈 `mobile/customer_app`**: Flutter/Dart SDK ^3.9.2 기반 고객 앱 전체를 신규 생성
- **인증**: Riverpod `AuthController` + Dio `InterceptorsWrapper`로 Bearer JWT 주입, 401 single-flight refresh, TokenStore(FlutterSecureStorage) 영속화
- **라우팅**: `DoaApp`에서 `AuthStatus` switch — unknown→SplashScreen, authenticated→AppShell(4탭), unauthenticated→LoginScreen
- **탭 구성**: IndexedStack 4탭 (카테고리/홈/주문내역/마이페이지), 홈 기본 표시
- **상품·홈·검색**: `homeProductsProvider`·`searchProvider`·`productDetailProvider`·`productReviewsProvider` — Riverpod `FutureProvider.autoDispose(.family)`
- **옵션 선택·장바구니**: `VariantSheet` buyNow 분기, `cartProvider` PUT/DELETE, `_Checkout` 합계 계산
- **결제**: `_placeOrder` — POST /orders → POST /payments, `Uuid().v4()` idempotencyKey, `userCouponId` 전달 (SEC-FIND-004 준수)
- **주문·배송**: 주문 내역/상세/배송 추적 4단계 스테퍼
- **리뷰**: delivered/completed 조건부 POST /reviews
- **찜·최근 본**: N+1 `Future.wait` 패턴 (GAP-009-02), 전체·개별 삭제
- **쿠폰함**: ChoiceChip 4탭 필터 (all/unused/used/expired)
- **배송 주소록**: POST/PATCH/DELETE + PATCH /:id/default
- **디자인 시스템**: `DoaColors`, `DoaRadius`, `AppTheme.light()` (Material3, Pretendard)
- **테스트**: `app_theme_test.dart` 위젯 테스트 1건, `flutter analyze` 0 issues

## 변경 파일 및 라인 수

| 파일 | 추가 | 삭제 |
|---|---|---|
| `mobile/customer_app/lib/app.dart` | 신규 | — |
| `mobile/customer_app/lib/main.dart` | 신규 | — |
| `mobile/customer_app/lib/core/api_client.dart` | 신규 | — |
| `mobile/customer_app/lib/core/providers.dart` | 신규 | — |
| `mobile/customer_app/lib/core/token_store.dart` | 신규 | — |
| `mobile/customer_app/lib/theme/app_theme.dart` | 신규 | — |
| `mobile/customer_app/lib/features/shell/app_shell.dart` | 신규 | — |
| `mobile/customer_app/lib/features/shell/category_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/auth/login_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/home/home_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/product/product_detail_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/product/variant_sheet.dart` | 신규 | — |
| `mobile/customer_app/lib/features/cart/cart_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/checkout/checkout_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/order/order_history_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/order/order_detail_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/order/delivery_tracking_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/order/order_status.dart` | 신규 | — |
| `mobile/customer_app/lib/features/review/review_write_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/wishlist/wishlist_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/history/history_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/coupon/coupon_box_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/address/address_book_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/address/address_edit_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/mypage/mypage_screen.dart` | 신규 | — |
| `mobile/customer_app/lib/features/search/search_screen.dart` | 신규 | — |
| `mobile/customer_app/pubspec.yaml` | 신규 | — |
| `mobile/customer_app/test/app_theme_test.dart` | 신규 | — |

> 정확한 라인 카운트: `git diff --numstat a94ff47 a3fc463 -- mobile/customer_app`

## Diff

> 전체 diff 는 박제하지 않는다 — git 이 형상관리 SoT.
> base commit + 재생성 명령만 기록:
> `git diff a94ff47 a3fc463 -- mobile/customer_app`
