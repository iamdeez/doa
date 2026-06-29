---
작성: Docs Agent (retroactive)
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정 (retroactive)
---

# Spec Input: 009-flutter-customer-app

> 수집 일시: 2026-06-30 | 맥락: 001~008 콘솔 사이클 이후 소비자 채널 Flutter 앱 신규 구현.
> 커밋 `a3fc463`(base `a94ff47`) 기준 retroactive 재구성.

## 목차

- [수집 진행 상태](#수집-진행-상태)
- [원 요청 맥락](#원-요청-맥락)
- [질문 분석 근거](#질문-분석-근거-question-analysis-basis)
- [카테고리별 수집 내용](#카테고리별-수집-내용)

## 수집 진행 상태

| 카테고리 | 상태 | 답변 완료 항목 |
|---|---|---|
| 1. 배경 및 목적 | 완료 | [Q1, Q2, Q3] |
| 2. 사용자 & 이해관계자 | 완료 | [Q4] |
| 3. 핵심 기능 | 완료 | [Q-A~J] |
| 4. 데이터 & 입출력 | 완료 | [Q-K] |
| 5. 제약조건 | 완료 | [Q5] |
| 6. 예외 & 실패 시나리오 | 완료 | [Q6] |

## 원 요청 맥락

사용자 지시: **Flutter 소비자 앱 신규 구현**. 001~008 차수로 완성된 NestJS 백엔드 및 판매자·관리자 콘솔
위에 소비자용 모바일 앱을 추가한다. 핵심 쇼핑 플로우(탐색→상세→장바구니→결제→주문·배송 조회→리뷰)를
Flutter + Riverpod으로 구현하며, Dio + FlutterSecureStorage로 JWT 인증을 관리한다.
본 문서는 커밋 `a3fc463`(base `a94ff47`)을 정식 SDD 포맷으로 역문서화하기 위한 입력 재구성이다.

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션·근거 | 채택 결과 |
|---|---|---|---|
| Q-A | 상태 관리 | A:Provider(레거시) / B:Riverpod / C:BLoC | **B 채택** — `flutter_riverpod ^3.3.2`. ProviderScope + ConsumerWidget + FutureProvider.autoDispose 패턴. 코드 생성(build_runner) 미사용. |
| Q-B | HTTP 클라이언트 | A:http 패키지 / B:Dio | **B 채택** — `dio ^5.10.0`. InterceptorsWrapper로 Bearer 주입·401 refresh·익명 요청 분기. |
| Q-C | JWT 영속 | A:SharedPreferences / B:FlutterSecureStorage | **B 채택** — `flutter_secure_storage ^10.3.1`. accessToken·refreshToken 분리 저장. |
| Q-D | 라우팅 | A:go_router(선언됨) / B:Navigator.push/MaterialPageRoute | **B 채택(실제)** — go_router가 pubspec.yaml에 선언되어 있으나 실제 화면 전환은 `Navigator.push(MaterialPageRoute)` 직접 사용. DoaApp은 switch(AuthStatus) 분기로 최상위 라우팅. |
| Q-E | 이미지 캐싱 | A:Image.network / B:CachedNetworkImage | **B 채택** — `cached_network_image ^3.4.1`. |
| Q-F | 금액 파싱 | A:int 직접 변환 / B:num.tryParse(String) | **B 채택** — 백엔드 Decimal 필드가 JSON 직렬화상 문자열로 오므로 `num.tryParse` 방어 변환. |
| Q-G | 결제 idempotency | A:클라이언트 생성 없음 / B:uuid v4 생성 | **B 채택** — `uuid ^4.5.3`. `Uuid().v4()`를 `POST /payments` idempotencyKey로 전송. |
| Q-H | 쿠폰 전달 방식 | A:할인 금액 계산 후 전달 / B:userCouponId만 전달 | **B 채택** — SEC-FIND-004 준수. 결제 화면은 `userCouponId`를 `POST /orders`에 전달하며 서버가 할인 적용. |
| Q-I | 디자인 시스템 | A:별도 구축 / B:Material3 + 커스텀 토큰 | **B 채택** — `AppTheme.light()`(Material3), `DoaColors`(blue/canvas/surface 등), `DoaRadius`(control/card/pill), Pretendard 폰트. |
| Q-J | 찜·최근 본 상품 조회 | A:단일 목록 API(상품 정보 포함) / B:N+1(목록 조회 후 개별 GET) | **B 채택(실제)** — 백엔드가 상품 정보 포함 응답을 제공하지 않으므로 `Future.wait`로 개별 `GET /products/:id`를 병렬 호출. |

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

Q1. 왜 만드는가?
- 001~008 차수로 완성된 백엔드·콘솔 위에 소비자가 실제로 상품을 구매할 수 있는 채널이 필요하다.
  Flutter 앱으로 소비자 쇼핑 플로우를 제공하고 모바일 MVP를 완성한다.

Q2. 현재 어떻게? (009 이전)
- 소비자 채널 없음. 백엔드 API만 존재하며 소비자가 접근할 UI가 없는 상태.

Q3. 성공 판단 기준
- 로그인·홈·상품상세·장바구니·결제·주문내역·리뷰 작성 플로우가 실제 백엔드와 연동하여 동작.
  `flutter analyze` 0 issues. 기존 백엔드 API 회귀 0.

### [카테고리 2] 사용자 & 이해관계자

Q4. 사용자 역할
- **비인증 소비자**: 홈·상품 탐색·상품 상세·리뷰 조회 가능.
- **인증 소비자**: 장바구니·결제·주문·찜·쿠폰·주소록·리뷰 작성 등 전체 기능 접근.

### [카테고리 3] 핵심 기능

**Must (구현됨):**
- `lib/main.dart`: Flutter 진입점. `initializeDateFormatting('ko_KR')` + `ProviderScope` + `DoaApp`.
- `lib/app.dart`: `DoaApp`. `authControllerProvider` watch → AuthStatus별 화면 분기(unknown=Splash, authenticated=AppShell, unauthenticated=LoginScreen).
- `lib/core/providers.dart`: `secureStorageProvider`, `tokenStoreProvider`, `dioProvider`, `apiClientProvider`, `AuthController(Notifier<AuthStatus>)`.
- `lib/core/api_client.dart`: Dio + InterceptorsWrapper. Bearer 주입·401 refresh(single flight `_refreshing`)·`extra['anonymous']` 분기.
- `lib/core/token_store.dart`: FlutterSecureStorage 래퍼. accessToken·refreshToken 저장·읽기·삭제.
- `lib/features/shell/app_shell.dart`: IndexedStack 4탭(카테고리·홈·히스토리·마이페이지). BottomNavigationBar.
- `lib/features/auth/login_screen.dart`: 이메일·비밀번호 TextEditingController. 비밀번호 토글·자동로그인 체크박스. `POST /auth/login`.
- `lib/features/home/home_screen.dart`: `homeProductsProvider`(GET /search/products?size=20&sort=latest, 익명). 검색바·히어로 배너(하드코딩)·카테고리 그리드(하드코딩)·상품 2열 그리드.
- `lib/features/product/product_detail_screen.dart`: `productDetailProvider`(GET /products/:id)·`productReviewsProvider`(GET /products/:id/reviews?take=20). 찜 토글·리뷰 섹션·액션바(장바구니/구매).
- `lib/features/product/variant_sheet.dart`: 옵션·수량 스테퍼·합계. `POST /cart/items`. buyNow 분기.
- `lib/features/cart/cart_screen.dart`: `cartProvider`(GET /cart). 수량 변경(PUT)·삭제(DELETE)·결제 진행.
- `lib/features/checkout/checkout_screen.dart`: 배송지·쿠폰 선택. `POST /orders` → `POST /payments`. uuid v4 idempotencyKey.
- `lib/features/order/order_history_screen.dart`: `ordersProvider`(GET /orders?limit=30). 상태 필터 드롭다운.
- `lib/features/order/order_detail_screen.dart`: `orderDetailProvider`(GET /orders/:id). 리뷰 가능 여부(delivered/completed). 배송 추적 버튼.
- `lib/features/order/delivery_tracking_screen.dart`: `trackingProvider`(GET /shipments/:id/tracking). 4단계 스테퍼.
- `lib/features/review/review_write_screen.dart`: 별점(1~5)·내용. `POST /reviews`.
- `lib/features/wishlist/wishlist_screen.dart`: `wishlistProvider`(GET /users/me/wishlist → Future.wait GET /products/:id). 개별·전체 삭제.
- `lib/features/history/history_screen.dart`: `recentViewsProvider`(GET /users/me/recent-views → Future.wait GET /products/:id, max 30). 추천 상품 재사용.
- `lib/features/coupon/coupon_box_screen.dart`: `myCouponsProvider`(GET /users/me/coupons). ChoiceChip 탭 필터.
- `lib/features/address/address_book_screen.dart`: `addressBookProvider`(GET /users/me/addresses). 기본설정·수정·삭제.
- `lib/features/address/address_edit_screen.dart`: 추가(POST)/수정(PATCH). 기본 배송지 토글.
- `lib/features/mypage/mypage_screen.dart`: 프로필(하드코딩)·퀵카드(주문/찜/쿠폰함)·섹션 메뉴(일부 미연결)·로그아웃.
- `lib/features/search/search_screen.dart`: `searchProvider`(GET /search/products?q=&size=20, 익명). 키워드 제출.
- `lib/theme/app_theme.dart`: `DoaColors`·`DoaRadius`·`AppTheme.light()`.

**제외(Out of Scope):**
- 소셜 로그인(UI 플레이스홀더), 1:1 문의/FAQ/공지/알림설정(미연결), 카테고리 API(하드코딩), 아이디/비밀번호 찾기.

### [카테고리 4] 데이터 & 입출력

Q-K. 백엔드 엔드포인트 목록 (구현에서 추출)

| 메서드 | 경로 | 화면 | 인증 |
|---|---|---|---|
| POST | /auth/login | LoginScreen | 익명 |
| POST | /auth/refresh | ApiClient interceptor | 익명 |
| GET | /search/products | HomeScreen, SearchScreen | 익명 |
| GET | /products/:id | ProductDetailScreen, WishlistScreen, HistoryScreen | OptionalJWT |
| GET | /products/:id/reviews | ProductDetailScreen | 익명 |
| POST | /users/me/wishlist | ProductDetailScreen | 인증 |
| DELETE | /users/me/wishlist/:productId | ProductDetailScreen, WishlistScreen | 인증 |
| GET | /users/me/wishlist | WishlistScreen | 인증 |
| GET | /users/me/recent-views | HistoryScreen | 인증 |
| POST | /cart/items | VariantSheet | 인증 |
| GET | /cart | CartScreen | 인증 |
| PUT | /cart/items/:variantId | CartScreen | 인증 |
| DELETE | /cart/items/:variantId | CartScreen | 인증 |
| GET | /users/me/addresses | CheckoutScreen, AddressBookScreen | 인증 |
| POST | /users/me/addresses | AddressEditScreen | 인증 |
| PATCH | /users/me/addresses/:id | AddressEditScreen | 인증 |
| PATCH | /users/me/addresses/:id/default | AddressBookScreen, AddressEditScreen | 인증 |
| DELETE | /users/me/addresses/:id | AddressBookScreen | 인증 |
| GET | /users/me/coupons | CouponBoxScreen | 인증 |
| GET | /users/me/coupons?status=unused | CheckoutScreen | 인증 |
| POST | /orders | CheckoutScreen | 인증 |
| POST | /payments | CheckoutScreen | 인증 |
| GET | /orders | OrderHistoryScreen | 인증 |
| GET | /orders/:id | OrderDetailScreen | 인증 |
| GET | /shipments?orderId= | OrderDetailScreen | 인증 |
| GET | /shipments/:id/tracking | DeliveryTrackingScreen | 인증 |
| POST | /reviews | ReviewWriteScreen | 인증 |

**응답 파싱 방식**: 전 화면이 `Map<String,dynamic>` 동적 파싱. 타입드 모델 미사용.

### [카테고리 5] 제약조건

Q5. 기술 스택 제약
- Flutter SDK ^3.9.2, Dart 3.x.
- 신규 의존: flutter_riverpod ^3.3.2, dio ^5.10.0, flutter_secure_storage ^10.3.1, cached_network_image ^3.4.1, intl ^0.20.3, uuid ^4.5.3.
- go_router ^17.2.3 선언됨(pubspec.yaml)이나 실제 화면 전환에 미사용.
- 백엔드 baseUrl은 `lib/core/env.dart`에서 관리(gitignore).
- `flutter analyze` 0 issues 유지.

### [카테고리 6] 예외 & 실패 시나리오

Q6. 엣지 케이스
- 401 refresh 실패 → 로그아웃(토큰 삭제) 처리(단, 무한 재시도 방지를 위해 `extra['retried']=true` 플래그 사용).
- 찜 추가 시 409 → 이미 찜한 상태로 수렴 처리(에러로 취급 안 함).
- 장바구니/주문 금액: 백엔드 Decimal → JSON 문자열로 수신. `num.tryParse` 방어 변환.
- 결제 후 장바구니·쿠폰 provider invalidate로 UI 최신화.
- 최근 본 상품: 최대 30건. 상품 정보 N+1 병렬 조회(`Future.wait`).
