---
작성: Docs Agent (retroactive)
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정 (retroactive)
---

# Plan: 009-flutter-customer-app

> Branch: 009-flutter-customer-app | Date: 2026-06-30 | Spec: [spec.md](../spec/spec.md)
>
> 이미 구현·커밋된 코드(커밋 `a3fc463`, base `a94ff47`)를 retroactive 문서화한 계획서.
> "어떻게 만들었는가"는 `mobile/customer_app/lib/` 소스에서 역추론하였다.

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [사전 영향도 분석 결과](#사전-영향도-분석-결과)
- [핵심 설계](#핵심-설계)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> 아래 항목을 확인한 후 plan 작성을 시작한다.
> 위반 또는 예외가 있으면 "예외 사항" 항목에 근거를 명시한다.

- [x] P-001 성능 원칙: Dio HTTP 타임아웃 10초. CachedNetworkImage로 이미지 재요청 최소화. FutureProvider.autoDispose로 사용하지 않는 provider 자동 해제.
- [x] P-002 호환성 원칙: Flutter 앱은 독립 빌드 단위로 기존 백엔드·콘솔과 충돌 없음.
- [x] P-003 테스트 원칙: `flutter analyze` 0 issues로 정적 검증 완료. 위젯 테스트 1건(app_theme_test).
- [x] P-004 스펙 범위 원칙: 소비자 쇼핑 플로우 핵심 화면만 구현. 소셜 로그인·FAQ 등은 범위 외.

**예외 사항**:
- 응답 모델 미타입화: 전 화면이 `Map<String,dynamic>` 동적 파싱을 사용한다. 타입 안전성보다 빠른 MVP 구현을 우선하였으며, 향후 typed model 마이그레이션이 필요하다(GAP-009-01).
- N+1 패턴: 찜·최근 본 상품은 목록 조회 후 개별 상품 GET을 `Future.wait`로 병렬 호출한다. 백엔드가 상품 정보 포함 응답을 제공하지 않아 불가피하다(GAP-009-02).

---

## 기술 컨텍스트

- **언어 / 런타임**: Dart 3.x, Flutter SDK ^3.9.2
- **주요 의존성**:
  - `flutter_riverpod ^3.3.2` — 상태 관리(ProviderScope, ConsumerWidget, Notifier, FutureProvider.autoDispose)
  - `dio ^5.10.0` — HTTP 클라이언트(InterceptorsWrapper, Bearer 주입, 401 refresh)
  - `flutter_secure_storage ^10.3.1` — JWT 영속
  - `cached_network_image ^3.4.1` — 상품 이미지 캐싱
  - `intl ^0.20.3` — 한국어 날짜·숫자 포맷
  - `uuid ^4.5.3` — 결제 idempotencyKey 생성
  - `go_router ^17.2.3` — 선언됨, 실제 라우팅 미사용
- **테스트 프레임워크**: flutter_test (위젯 테스트 1건)
- **디자인 시스템**: Material3 + DoaColors + DoaRadius + AppTheme + Pretendard 폰트

---

## 사전 영향도 분석 결과

### 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 |
|---|---|---|
| `mobile/customer_app/` | 신규(전체) | Flutter 소비자 앱 전체 신규 구현 |
| `mobile/customer_app/pubspec.yaml` | 신규 | 의존성 선언 |
| `mobile/customer_app/lib/main.dart` | 신규 | 앱 진입점 |
| `mobile/customer_app/lib/app.dart` | 신규 | DoaApp, AuthStatus 라우팅 |
| `mobile/customer_app/lib/core/api_client.dart` | 신규 | Dio + Interceptor (Bearer, 401 refresh) |
| `mobile/customer_app/lib/core/token_store.dart` | 신규 | FlutterSecureStorage 래퍼 |
| `mobile/customer_app/lib/core/providers.dart` | 신규 | Riverpod providers, AuthController |
| `mobile/customer_app/lib/theme/app_theme.dart` | 신규 | DoaColors, DoaRadius, AppTheme |
| `mobile/customer_app/lib/features/shell/app_shell.dart` | 신규 | IndexedStack 4탭 |
| `mobile/customer_app/lib/features/auth/login_screen.dart` | 신규 | 로그인 화면 |
| `mobile/customer_app/lib/features/home/home_screen.dart` | 신규 | 홈 화면 |
| `mobile/customer_app/lib/features/product/product_detail_screen.dart` | 신규 | 상품 상세 |
| `mobile/customer_app/lib/features/product/variant_sheet.dart` | 신규 | 옵션 선택 시트 |
| `mobile/customer_app/lib/features/cart/cart_screen.dart` | 신규 | 장바구니 |
| `mobile/customer_app/lib/features/checkout/checkout_screen.dart` | 신규 | 결제 화면 |
| `mobile/customer_app/lib/features/order/order_history_screen.dart` | 신규 | 주문 내역 |
| `mobile/customer_app/lib/features/order/order_detail_screen.dart` | 신규 | 주문 상세 |
| `mobile/customer_app/lib/features/order/delivery_tracking_screen.dart` | 신규 | 배송 추적 |
| `mobile/customer_app/lib/features/order/order_status.dart` | 신규 | 주문 상태 레이블·색상 매핑 |
| `mobile/customer_app/lib/features/review/review_write_screen.dart` | 신규 | 리뷰 작성 |
| `mobile/customer_app/lib/features/wishlist/wishlist_screen.dart` | 신규 | 찜 목록 |
| `mobile/customer_app/lib/features/history/history_screen.dart` | 신규 | 최근 본 상품 |
| `mobile/customer_app/lib/features/coupon/coupon_box_screen.dart` | 신규 | 쿠폰함 |
| `mobile/customer_app/lib/features/address/address_book_screen.dart` | 신규 | 배송 주소록 |
| `mobile/customer_app/lib/features/address/address_edit_screen.dart` | 신규 | 배송지 추가·수정 |
| `mobile/customer_app/lib/features/mypage/mypage_screen.dart` | 신규 | 마이페이지 |
| `mobile/customer_app/lib/features/search/search_screen.dart` | 신규 | 검색 화면 |
| `mobile/customer_app/lib/features/shell/category_screen.dart` | 신규 | 카테고리(하드코딩) |
| `mobile/customer_app/test/app_theme_test.dart` | 신규 | AppTheme 위젯 테스트 |

기존 백엔드(`apps/backend`)·콘솔(`apps/console`)·공유 패키지(`packages/`) 영향 없음.

---

## 핵심 설계

### 인증 아키텍처 (FR-001~005)

**AuthController (Notifier<AuthStatus>)**:
- `build()`: `TokenStore.accessToken` 확인 → authenticated/unauthenticated 반환.
- `login(email, password)`: `POST /auth/login` → 토큰 저장 → state = authenticated.
- `logout()`: `TokenStore.clear()` → state = unauthenticated.

**Dio InterceptorsWrapper**:
```
onRequest:
  extra['anonymous'] == true → 헤더 미주입(익명 요청)
  else → Authorization: Bearer {accessToken}

onError (401):
  extra['retried'] == true → 재시도 포기(무한루프 방지)
  else → _ensureRefreshed() [single-flight _refreshing Future]
         → 성공: saveAccess(newToken) + 원 요청 재시도(extra['retried']=true)
         → 실패: TokenStore.clear() + logout
```

**Single-flight refresh**: `_refreshing` Future 필드로 중복 refresh 방지. 동시 401 수신 시 동일 Future 공유.

### 화면 구성 (AppShell)

IndexedStack으로 4탭을 유지. 탭 인덱스 1이 홈(기본 탭).

```
Tab 0: CategoryScreen  — 카테고리(하드코딩 10개)
Tab 1: HomeScreen      — 홈(최신 상품 목록, 기본 탭)
Tab 2: HistoryScreen   — 최근 본 상품 + 추천
Tab 3: MyPageScreen    — 마이페이지
```

### 결제 플로우 (FR-017~021)

```
CheckoutScreen 진입
  ↓ addressesProvider(GET /users/me/addresses) → 배송지 선택
  ↓ unusedCouponsProvider(GET /users/me/coupons?status=unused) → 쿠폰 선택
  ↓ _placeOrder():
      POST /orders { items, shippingAddress, userCouponId? }
      → orderId 획득
      POST /payments { orderId, idempotencyKey: Uuid().v4() }
      → 성공: cartProvider + unusedCouponsProvider invalidate, AlertDialog 성공 안내
```

### 찜·최근 본 상품 N+1 패턴 (FR-027~028)

```dart
final wishlistProvider = FutureProvider.autoDispose((ref) async {
  final ids = await dio.get('/users/me/wishlist');
  return Future.wait(ids.map((id) => dio.get('/products/$id')));
});
```

백엔드가 상품 정보를 포함한 단일 응답을 제공하지 않으므로 `Future.wait`로 병렬 호출.
최근 본 상품은 최대 30건 제한.

---

## 인터페이스 계약

- **백엔드 API 소비 전용**: Flutter 앱은 백엔드 API를 소비만 한다. 백엔드 인터페이스 변경 시 Dio 호출 코드 갱신 필요.
- **JWT 토큰**: `accessToken`/`refreshToken` 키로 FlutterSecureStorage에 저장. TokenStore가 단일 접근 지점.
- **익명 요청**: `dio.options.extra['anonymous'] = true` 또는 `dioProvider`의 익명 Dio 인스턴스를 통해 토큰 미주입.
- **응답 타입**: 전 화면 `Map<String,dynamic>` 파싱. 백엔드 스키마 변경 시 런타임까지 타입 오류 미노출(GAP-009-01).

---

## 데이터 모델

타입드 모델 미정의. 백엔드 응답을 `Map<String,dynamic>`으로 파싱.

주요 필드 규칙:
- 금액 필드(`price`, `totalAmount` 등): 백엔드 Decimal → JSON 문자열. `num.tryParse(field.toString())` 방어 변환.
- 날짜 필드(`createdAt`, `expiresAt` 등): ISO 8601 문자열. `DateTime.tryParse` 변환.
- 쿠폰 타입: `'PERCENTAGE'` / `'AMOUNT'` 문자열 분기.
- 주문 상태: `order_status.dart`의 `orderStatusLabel` Map으로 한국어 변환.

---

## 테스트 전략

| SC 식별자 | 테스트 유형 | 시나리오 요약 | 검증 방법 |
|---|---|---|---|
| SC-001 | 정적 코드 리뷰 | AuthController _restore, login, logout 로직 | 소스 구조 확인 |
| SC-002 | 정적 코드 리뷰 | Interceptor Bearer 주입·401 single-flight refresh 구조 | 소스 구조 확인 |
| SC-003 | 정적 코드 리뷰 | homeProductsProvider·searchProvider 익명 GET | 소스 구조 확인 |
| SC-004 | 정적 코드 리뷰 | productDetailProvider·productReviewsProvider·찜 토글 | 소스 구조 확인 |
| SC-005 | 정적 코드 리뷰 | VariantSheet POST /cart/items·buyNow 분기 | 소스 구조 확인 |
| SC-006 | 정적 코드 리뷰 | cartProvider·PUT·DELETE·합계 계산 | 소스 구조 확인 |
| SC-007 | 정적 코드 리뷰 | _placeOrder POST /orders → POST /payments·uuid | 소스 구조 확인 |
| SC-008 | 정적 코드 리뷰 | ordersProvider·orderDetailProvider·trackingProvider | 소스 구조 확인 |
| SC-009 | 정적 코드 리뷰 | 리뷰 가능 조건(delivered/completed)·POST /reviews | 소스 구조 확인 |
| SC-010 | 정적 코드 리뷰 | wishlistProvider N+1·DELETE 개별·전체 | 소스 구조 확인 |
| SC-011 | 정적 코드 리뷰 | recentViewsProvider N+1·homeProductsProvider 재사용 | 소스 구조 확인 |
| SC-012 | 정적 코드 리뷰 | myCouponsProvider·ChoiceChip 탭 필터 | 소스 구조 확인 |
| SC-013 | 정적 코드 리뷰 | addressBookProvider·POST/PATCH/DELETE·기본 설정 | 소스 구조 확인 |
| SC-014 | [env:static] `flutter analyze` | 0 issues | analyze 실행 결과 |

---

## 기타 고려사항

- **go_router 미사용**: `go_router ^17.2.3`이 pubspec.yaml에 선언되어 있으나 실제 화면 전환은 `Navigator.push(MaterialPageRoute)` 직접 사용. 향후 deep link·네비게이션 스택 관리가 필요해지면 go_router로 전환을 검토한다.
- **HeroBanner·CategoryGrid 하드코딩**: 홈 화면 배너와 카테고리 그리드는 하드코딩. 백엔드 배너·카테고리 API 연동은 후속 스펙.
- **MyPage 프로필 하드코딩**: `_ProfileRow`의 이메일이 `'user@email.com'`으로 하드코딩. 실제 사용자 프로필 API 연동 미구현.
- **결제 성공 후 흐름**: AlertDialog로 성공 안내 후 현재 화면에 머무는 구조. 주문 내역으로 자동 이동 등 UX 개선은 후속.
