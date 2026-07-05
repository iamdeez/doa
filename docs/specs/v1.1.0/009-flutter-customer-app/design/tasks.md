---
작성: Docs Agent (retroactive)
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정 (retroactive)
---

# Tasks: 009-flutter-customer-app

> Branch: 009-flutter-customer-app | Date: 2026-06-30 | Plan: [plan.md](../planning/plan.md)
>
> 이미 구현·커밋된 코드를 기반으로 retroactive 작성한 태스크 목록.
> 모든 태스크는 구현 완료 상태이며 체크박스는 완료 처리되어 있다.

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md의 모든 `[NEEDS CLARIFICATION]` 항목이 해소되었는가? (없음 — retroactive)
- [x] plan.md의 Constitution Gates가 모두 통과(또는 예외 기재)되었는가?
- [x] CHANGES.md에서 이전 작업의 "후속 작업 시 주의사항"을 확인했는가? (008 참조)

---

## 태스크 목록

### Phase 1. 기반 구성

- [x] **T001** — Flutter 프로젝트 기반 및 의존성 설정
  - 구현 파일: `mobile/customer_app/pubspec.yaml`
  - 관련 요구사항: `NFR-001~007`
  - 상세: flutter_riverpod, dio, flutter_secure_storage, cached_network_image, intl, uuid, go_router 의존성 선언.
  - 완료 기준: `flutter pub get` 성공.

- [x] **T002** `[P]` — 디자인 시스템(테마·색상·반경)
  - 구현 파일: `lib/theme/app_theme.dart`
  - 관련 요구사항: `NFR-004`
  - 상세: `DoaColors`(blue=0xFF1F62E6, canvas, surface, muted, fg 계열, border, danger, star), `DoaRadius`(control=10.0, card=14.0, pill=999.0), `AppTheme.light()`(Material3·Pretendard·ColorScheme·AppBarTheme·ElevatedButton·OutlinedButton·InputDecoration·BottomNavigationBar).
  - 완료 기준: `AppTheme.light()` 반환 정상.

### Phase 2. 인증 핵심

- [x] **T003** — TokenStore (JWT 영속)
  - 구현 파일: `lib/core/token_store.dart`
  - 관련 요구사항: `FR-001, FR-002, FR-005, NFR-002`
  - 상세: FlutterSecureStorage 래퍼. `accessToken`·`refreshToken` getter. `save(access, refresh)`, `saveAccess(access)`, `clear()`.
  - 완료 기준: 토큰 저장·읽기·삭제 동작.

- [x] **T004** — ApiClient (Dio + Interceptor)
  - 구현 파일: `lib/core/api_client.dart`
  - 관련 요구사항: `FR-003, FR-004, NFR-001, NFR-003`
  - 상세: Dio 인스턴스. `baseOptions`(baseUrl, connectTimeout 10s, receiveTimeout 10s). `InterceptorsWrapper` — onRequest: Bearer 주입(extra['anonymous'] 분기); onError: 401 → `_ensureRefreshed()`(single-flight `_refreshing` Future) → 재시도(extra['retried']=true) or logout.
  - 완료 기준: Bearer 주입·401 단일 refresh 재시도 구조 확인.

- [x] **T005** — Riverpod Providers + AuthController
  - 구현 파일: `lib/core/providers.dart`
  - 관련 요구사항: `FR-001, FR-002, FR-005`
  - 상세: `secureStorageProvider`, `tokenStoreProvider`, `dioProvider`, `apiClientProvider`. `AuthController(Notifier<AuthStatus>)` — build(): `_restore()`, login(email, password): POST /auth/login, logout(): clear + state=unauthenticated.
  - 완료 기준: AuthStatus 전이(unknown→authenticated/unauthenticated) 동작.

### Phase 3. 앱 구조

- [x] **T006** — main.dart + DoaApp
  - 구현 파일: `lib/main.dart`, `lib/app.dart`
  - 관련 요구사항: `FR-001, NFR-005`
  - 상세: `initializeDateFormatting('ko_KR')`, `ProviderScope`, `DoaApp`. DoaApp: `authControllerProvider` watch → AuthStatus별 화면 분기.
  - 완료 기준: 앱 실행 시 스플래시→인증 상태 결정 후 화면 분기.

- [x] **T007** — AppShell (탭 네비게이션)
  - 구현 파일: `lib/features/shell/app_shell.dart`
  - 관련 요구사항: (구조)
  - 상세: IndexedStack([CategoryScreen, HomeScreen, HistoryScreen, MyPageScreen]). 초기 탭 인덱스 1(HomeScreen). BottomNavigationBar 4탭.
  - 완료 기준: 탭 전환 시 상태 유지(IndexedStack).

### Phase 4. 탐색·상품

- [x] **T008** — LoginScreen
  - 구현 파일: `lib/features/auth/login_screen.dart`
  - 관련 요구사항: `FR-002, SC-001`
  - 상세: 이메일·비밀번호 TextField. 비밀번호 토글. 자동로그인 체크박스. `authControllerProvider.notifier.login()` 호출. DioException 에러 표시. 소셜 로그인 `_SocialRow` UI 플레이스홀더.
  - 완료 기준: 로그인 성공 시 AppShell 전환.

- [x] **T009** — HomeScreen
  - 구현 파일: `lib/features/home/home_screen.dart`
  - 관련 요구사항: `FR-006, FR-008, SC-003`
  - 상세: `homeProductsProvider`(GET /search/products?size=20&sort=latest, 익명). RefreshIndicator. 검색바(tap→SearchScreen). 히어로 배너(하드코딩). 카테고리 그리드(하드코딩 10개). 상품 2열 GridView. `_ProductCard`(CachedNetworkImage, num.tryParse 가격, tap→ProductDetailScreen).
  - 완료 기준: 최신 상품 목록 렌더링.

- [x] **T010** `[P]` — SearchScreen
  - 구현 파일: `lib/features/search/search_screen.dart`
  - 관련 요구사항: `FR-007, SC-003`
  - 상세: `searchProvider`(GET /search/products?q={keyword}&size=20, 익명). `onSubmitted` 트리거. 결과 ListView.
  - 완료 기준: 키워드 검색 결과 표시.

- [x] **T011** — ProductDetailScreen
  - 구현 파일: `lib/features/product/product_detail_screen.dart`
  - 관련 요구사항: `FR-009, FR-010, FR-011, SC-004`
  - 상세: `productDetailProvider`(GET /products/:id, auth). `productReviewsProvider`(GET /products/:id/reviews?take=20, 익명). `_WishlistHeart`(POST/DELETE wishlist, 409 수렴). `_ReviewSection`(별점, 날짜). `_ActionBar`(장바구니/구매 버튼 → showVariantSheet).
  - 완료 기준: 상세·리뷰·찜 토글 동작.

- [x] **T012** — VariantSheet
  - 구현 파일: `lib/features/product/variant_sheet.dart`
  - 관련 요구사항: `FR-012, FR-016, SC-005`
  - 상세: 옵션 선택, 수량 스테퍼, 합계(단가×수량). `POST /cart/items {variantId, quantity}`. buyNow=true → CartScreen 이동; false → SnackBar.
  - 완료 기준: 장바구니 추가 또는 즉시 구매 분기.

### Phase 5. 장바구니·결제

- [x] **T013** — CartScreen
  - 구현 파일: `lib/features/cart/cart_screen.dart`
  - 관련 요구사항: `FR-013, FR-014, FR-015, SC-006`
  - 상세: `cartProvider`(GET /cart). `_CartRow`(PUT 수량, DELETE 삭제, invalidate). `_Checkout`(합계 sum, push CheckoutScreen).
  - 완료 기준: 수량 변경·삭제·합계·결제 이동 동작.

- [x] **T014** — CheckoutScreen
  - 구현 파일: `lib/features/checkout/checkout_screen.dart`
  - 관련 요구사항: `FR-017~021, SC-007`
  - 상세: `addressesProvider`·`unusedCouponsProvider`. 배송지 선택·쿠폰 선택(`_CouponSheet`, __none__ sentinel). `_placeOrder`: POST /orders → POST /payments(idempotencyKey: Uuid().v4()). invalidate cart+coupons. AlertDialog 성공.
  - 완료 기준: 주문+결제 순차 호출, idempotency key 포함.

### Phase 6. 주문·리뷰

- [x] **T015** — OrderHistoryScreen
  - 구현 파일: `lib/features/order/order_history_screen.dart`
  - 관련 요구사항: `FR-022, SC-008`
  - 상세: `ordersProvider`(GET /orders?limit=30). 상태 필터 드롭다운. `_OrderCard` tap→OrderDetailScreen.
  - 완료 기준: 주문 목록·필터·상세 이동.

- [x] **T016** — OrderDetailScreen + DeliveryTrackingScreen
  - 구현 파일: `lib/features/order/order_detail_screen.dart`, `lib/features/order/delivery_tracking_screen.dart`, `lib/features/order/order_status.dart`
  - 관련 요구사항: `FR-023, FR-024, FR-025, SC-008`
  - 상세: `orderDetailProvider`(GET /orders/:id). 리뷰 가능(delivered/completed) → OutlinedButton → ReviewWriteScreen. `_DeliveryButton`: GET /shipments?orderId= → DeliveryTrackingScreen. `trackingProvider`(GET /shipments/:id/tracking). 4단계 스테퍼.
  - 완료 기준: 상세·배송 추적·리뷰 이동 동작.

- [x] **T017** — ReviewWriteScreen
  - 구현 파일: `lib/features/review/review_write_screen.dart`
  - 관련 요구사항: `FR-026, SC-009`
  - 상세: 별점(1~5) 선택. 리뷰 내용 TextField. `POST /reviews {orderItemId, rating, content}`. 성공 → pop(true) + SnackBar.
  - 완료 기준: 리뷰 저장 성공.

### Phase 7. 마이페이지 기능

- [x] **T018** — WishlistScreen
  - 구현 파일: `lib/features/wishlist/wishlist_screen.dart`
  - 관련 요구사항: `FR-027, FR-029, SC-010`
  - 상세: `wishlistProvider`(GET /users/me/wishlist → Future.wait GET /products/:id). `_remove`(DELETE 개별). `_clearAll`(전체 삭제). tap→ProductDetailScreen.
  - 완료 기준: 찜 목록 표시·삭제.

- [x] **T019** `[P]` — HistoryScreen (최근 본 상품)
  - 구현 파일: `lib/features/history/history_screen.dart`
  - 관련 요구사항: `FR-028, SC-011`
  - 상세: `recentViewsProvider`(GET /users/me/recent-views → Future.wait GET /products/:id, max 30). `_Recommendations`: homeProductsProvider 재사용.
  - 완료 기준: 최근 본 상품 표시.

- [x] **T020** `[P]` — CouponBoxScreen
  - 구현 파일: `lib/features/coupon/coupon_box_screen.dart`
  - 관련 요구사항: `FR-030, SC-012`
  - 상세: `myCouponsProvider`(GET /users/me/coupons). ChoiceChip 탭(all/unused/used/expired). `_CouponCard`(PERCENTAGE/AMOUNT 레이블·만료일·최소주문). RefreshIndicator.
  - 완료 기준: 쿠폰 목록·탭 필터 동작.

- [x] **T021** `[P]` — AddressBookScreen + AddressEditScreen
  - 구현 파일: `lib/features/address/address_book_screen.dart`, `lib/features/address/address_edit_screen.dart`
  - 관련 요구사항: `FR-031~033, SC-013`
  - 상세: `addressBookProvider`(GET /users/me/addresses). 기본설정(PATCH /:id/default)·수정·삭제(AlertDialog 확인). AddressEditScreen: POST(추가)/PATCH(수정) + 기본 배송지 토글.
  - 완료 기준: 주소 CRUD·기본 설정 동작.

- [x] **T022** `[P]` — MyPageScreen
  - 구현 파일: `lib/features/mypage/mypage_screen.dart`
  - 관련 요구사항: (구조)
  - 상세: `_ProfileRow`(하드코딩). `_QuickCard`(주문/찜/쿠폰함 링크). `_Section`(쇼핑정보·고객서비스 — 일부 미연결). 로그아웃 버튼.
  - 완료 기준: 퀵카드 3종 화면 이동·로그아웃 동작.

### Phase 8. 테스트

- [x] **T023** — flutter analyze
  - 관련 요구사항: `NFR-006, SC-014`
  - 검증: `flutter analyze` 0 issues.
  - 완료 기준: analyze 0 issues.

- [x] **T024** `[P]` — AppTheme 위젯 테스트
  - 구현 파일: `test/app_theme_test.dart`
  - 관련 요구사항: `NFR-004`
  - 상세: AppTheme.light() 테마가 올바른 Material3 설정을 반환하는지 검증.
  - 완료 기준: 위젯 테스트 PASS.

---

## 구현 완료 기준

- [x] 모든 태스크 체크박스가 완료 처리되었다.
- [x] `flutter analyze` 0 issues.
- [x] `git status`에 의도치 않은 파일이 없다.
