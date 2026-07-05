---
작성: Docs Agent (retroactive)
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정 (retroactive)
---

# Spec: 009-flutter-customer-app

> Branch: 009-flutter-customer-app | Date: 2026-06-30 | Version: v1.1.0
>
> 이미 구현·커밋된 코드(커밋 `a3fc463`, base `a94ff47`)를 retroactive 문서화한 요구사항 명세.
> "무엇을 만들었는가"는 `mobile/customer_app/lib/` 소스에서 역추론하였다.

## 목차

- [배경 및 목적](#배경-및-목적)
- [사용자 스토리](#사용자-스토리-user-stories)
- [기능 요구사항](#기능-요구사항-functional-requirements)
- [비기능 요구사항](#비기능-요구사항-non-functional-requirements)
- [수용 기준](#수용-기준-acceptance-criteria)
- [요구사항 구조화 매트릭스](#요구사항-구조화-매트릭스)
- [범위 외](#범위-외-out-of-scope)
- [미결 사항](#미결-사항-open-questions)

---

## 배경 및 목적

DOA Market 플랫폼의 소비자용 Flutter 모바일 앱(`mobile/customer_app`)을 신규 구현한다. 기존
웹 기반 판매자·관리자 콘솔(001~008 차수)과 동일한 NestJS 백엔드 API를 소비하며, 소비자가
상품을 탐색·구매·주문 관리·리뷰 작성까지 완수할 수 있는 풀 쇼핑 사이클을 제공한다.

- **이전 상태**: 소비자 채널 없음(콘솔만 존재).
- **목표**: 로그인·홈·상품상세·장바구니·결제·주문이력·리뷰·마이페이지 핵심 플로우를 단일 Flutter 앱으로 제공.
- **기술 선택**: Flutter(Dart) + Riverpod 상태관리 + Dio HTTP + FlutterSecureStorage JWT 영속.

---

## 사용자 스토리 (User Stories)

- **US-001**: 소비자로서, 이메일·비밀번호로 로그인하여 인증된 쇼핑 경험을 원한다.
- **US-002**: 소비자로서, 홈 화면에서 최신 상품을 탐색하고 검색으로 원하는 상품을 찾고 싶다.
- **US-003**: 소비자로서, 상품 상세 페이지에서 리뷰를 확인하고 장바구니·즉시 구매를 선택하고 싶다.
- **US-004**: 소비자로서, 장바구니에서 수량을 조정하고 결제 화면으로 진행하고 싶다.
- **US-005**: 소비자로서, 결제 화면에서 배송지·쿠폰을 선택하고 주문을 완료하고 싶다.
- **US-006**: 소비자로서, 주문 내역에서 상태를 확인하고 배송 추적을 하고 싶다.
- **US-007**: 소비자로서, 구매 완료된 상품에 별점과 리뷰를 남기고 싶다.
- **US-008**: 소비자로서, 찜한 상품과 최근 본 상품을 마이페이지에서 관리하고 싶다.
- **US-009**: 소비자로서, 보유 쿠폰을 쿠폰함에서 확인하고 주문 시 사용하고 싶다.
- **US-010**: 소비자로서, 배송 주소를 추가·수정·기본 설정하고 싶다.

---

## 기능 요구사항 (Functional Requirements)

### 인증 (Auth)

- **FR-001**: 앱 시작 시 FlutterSecureStorage에 저장된 JWT를 복원하여 인증 상태를 초기화한다.
- **FR-002**: 이메일·비밀번호로 `POST /auth/login`을 호출하여 JWT(accessToken·refreshToken)를 획득·저장한다.
- **FR-003**: API 요청 시 Authorization Bearer 헤더에 accessToken을 자동 주입한다.
- **FR-004**: 401 응답 수신 시 `POST /auth/refresh`로 단일 flight refresh를 수행하고 원 요청을 재시도한다.
- **FR-005**: 로그아웃 시 FlutterSecureStorage에서 토큰을 삭제하고 로그인 화면으로 전환한다.

### 홈 · 탐색 (Discovery)

- **FR-006**: 홈 화면에서 `GET /search/products?size=20&sort=latest`로 최신 상품 목록을 표시한다 (익명 요청).
- **FR-007**: 검색 화면에서 키워드 입력 시 `GET /search/products?q=&size=20`을 호출하여 결과를 표시한다.
- **FR-008**: 상품 목록에서 `CachedNetworkImage`로 상품 이미지를 표시하고 가격을 한국어 포맷으로 렌더링한다.

### 상품 상세 (Product Detail)

- **FR-009**: `GET /products/:id`로 상품 상세를 조회한다 (인증 사용자인 경우 OptionalJwtAuthGuard가 최근 본 상품 기록).
- **FR-010**: `GET /products/:id/reviews?take=20`으로 상품 리뷰 목록을 표시한다.
- **FR-011**: 찜 버튼으로 `POST /users/me/wishlist` (찜 추가) 또는 `DELETE /users/me/wishlist/:productId` (찜 취소)를 호출한다. 409 응답은 이미 찜한 상태로 처리한다.
- **FR-012**: 하단 액션바에서 옵션 시트를 열어 옵션·수량 선택 후 장바구니 추가 또는 즉시 구매를 실행한다.

### 장바구니 (Cart)

- **FR-013**: `GET /cart`로 장바구니 항목을 조회하고 전체 합계를 계산한다.
- **FR-014**: 장바구니 항목의 수량을 `PUT /cart/items/:variantId {quantity}`로 변경한다.
- **FR-015**: 장바구니 항목을 `DELETE /cart/items/:variantId`로 삭제한다.
- **FR-016**: 옵션 선택 시트에서 `POST /cart/items {variantId, quantity}`로 상품을 장바구니에 추가한다.

### 결제 (Checkout)

- **FR-017**: `GET /users/me/addresses`로 배송지 목록을 조회하여 선택한다.
- **FR-018**: `GET /users/me/coupons?status=unused`로 사용 가능 쿠폰을 조회하여 선택한다.
- **FR-019**: `POST /orders {items, shippingAddress, userCouponId?}`로 주문을 생성한다.
- **FR-020**: `POST /payments {orderId, idempotencyKey: Uuid().v4()}`로 결제를 생성한다. idempotencyKey는 uuid v4를 사용한다.
- **FR-021**: 쿠폰 선택 시 coupon의 `userCouponId`를 전달하며 할인 금액이 아닌 쿠폰 ID만 서버에 전송한다(SEC-FIND-004 준수).

### 주문 · 배송 (Order & Delivery)

- **FR-022**: `GET /orders?limit=30`으로 주문 내역을 조회하고 상태별 필터를 제공한다.
- **FR-023**: `GET /orders/:id`로 주문 상세를 조회하고 상품별 리뷰 작성 가능 여부를 표시한다.
- **FR-024**: 주문 상세에서 `GET /shipments?orderId=`로 배송 정보를 조회하고 배송 추적 화면으로 이동한다.
- **FR-025**: `GET /shipments/:id/tracking`으로 배송 추적 이력(List)을 4단계 스테퍼로 표시한다.

### 리뷰 작성 (Review)

- **FR-026**: 배송 완료·구매 확정된 주문 항목에서 `POST /reviews {orderItemId, rating, content}`로 리뷰를 작성한다.

### 찜 · 최근 본 상품 (Wishlist & History)

- **FR-027**: `GET /users/me/wishlist`로 찜 목록을 조회하고 각 항목에 대해 `GET /products/:id`로 상품 정보를 가져온다.
- **FR-028**: `GET /users/me/recent-views`로 최근 본 상품 ID 목록을 조회하고 각 항목에 대해 `GET /products/:id`로 상품 정보를 가져온다 (최대 30건).
- **FR-029**: 찜 목록에서 `DELETE /users/me/wishlist/:productId`로 개별 찜 삭제 및 전체 삭제를 지원한다.

### 쿠폰함 (Coupon Box)

- **FR-030**: `GET /users/me/coupons`로 보유 쿠폰 전체를 조회하고 상태(전체/사용가능/사용완료/만료) 탭으로 필터링한다.

### 배송 주소록 (Address Book)

- **FR-031**: `GET /users/me/addresses`로 배송 주소록을 조회한다.
- **FR-032**: `POST /users/me/addresses`로 주소를 추가하고, `PATCH /users/me/addresses/:id`로 수정한다.
- **FR-033**: `PATCH /users/me/addresses/:id/default`로 기본 배송지를 설정하고, `DELETE /users/me/addresses/:id`로 삭제한다.

---

## 비기능 요구사항 (Non-Functional Requirements)

- **NFR-001**: Dio HTTP 연결 타임아웃 10초 / 응답 타임아웃 10초.
- **NFR-002**: JWT 토큰은 FlutterSecureStorage에 영속하여 앱 재시작 후에도 인증 상태를 복원한다.
- **NFR-003**: 401 refresh는 단일 flight로 처리하여 동시 요청 시 중복 refresh를 방지한다.
- **NFR-004**: Material3 디자인 시스템(DoaColors, DoaRadius, AppTheme)을 앱 전역에 적용한다.
- **NFR-005**: `intl` 패키지로 한국어 날짜(DateFormat 'ko_KR')·숫자(NumberFormat '#,###') 포맷을 사용한다.
- **NFR-006**: `flutter analyze` 0 issues.
- **NFR-007**: 상품 이미지는 CachedNetworkImage로 캐싱하여 불필요한 네트워크 재요청을 방지한다.

---

## 수용 기준 (Acceptance Criteria)

- **SC-001** (`FR-001~005` 관련): 앱 시작 시 저장 토큰 복원으로 인증 상태를 결정하고, 로그인·로그아웃이 AuthStatus(unknown/authenticated/unauthenticated)에 따라 화면 라우팅을 올바르게 전환한다.
- **SC-002** (`FR-003~004` 관련): 모든 인증 요청에 Bearer 헤더가 주입되고, 401 수신 시 단일 flight refresh 후 재시도한다.
- **SC-003** (`FR-006~008` 관련): 홈 화면에서 최신 상품 목록이 렌더링되고 검색 화면에서 키워드 검색이 동작한다.
- **SC-004** (`FR-009~011` 관련): 상품 상세에서 리뷰 목록·찜 토글이 동작하고, 인증 사용자의 상품 조회 시 최근 본 상품이 기록된다.
- **SC-005** (`FR-012, FR-016` 관련): 옵션 시트에서 옵션·수량 선택 후 장바구니 추가 또는 즉시 구매(CartScreen 이동)가 동작한다.
- **SC-006** (`FR-013~015` 관련): 장바구니 화면에서 항목 조회·수량 변경·삭제가 동작하고 합계 금액이 정확히 계산된다.
- **SC-007** (`FR-017~021` 관련): 결제 화면에서 배송지 선택·쿠폰 선택·주문+결제 API 호출이 순서대로 실행된다. 결제 생성 시 idempotencyKey(uuid v4)가 포함된다.
- **SC-008** (`FR-022~025` 관련): 주문 내역에서 상태 필터·주문 상세·배송 추적이 동작한다.
- **SC-009** (`FR-026` 관련): 배송 완료·구매 확정 상품에 한해 리뷰 작성 버튼이 노출되고 리뷰 저장이 완료된다.
- **SC-010** (`FR-027~029` 관련): 찜 목록에서 상품 조회·개별 삭제·전체 삭제가 동작한다.
- **SC-011** (`FR-028` 관련): 최근 본 상품 목록이 조회되고 홈 추천 상품이 함께 표시된다.
- **SC-012** (`FR-030` 관련): 쿠폰함에서 전체/상태별 쿠폰 목록이 표시된다.
- **SC-013** (`FR-031~033` 관련): 배송 주소록에서 추가·수정·삭제·기본 설정이 동작한다.
- **SC-014** (`NFR-006` 관련): `flutter analyze`가 0 issues를 반환한다.

---

## 요구사항 구조화 매트릭스

| US | FR | SC | 화면 / 모듈 |
|---|---|---|---|
| US-001 | FR-001~005 | SC-001, SC-002 | LoginScreen, AuthController, ApiClient |
| US-002 | FR-006~008 | SC-003 | HomeScreen, SearchScreen |
| US-003 | FR-009~012 | SC-004, SC-005 | ProductDetailScreen, VariantSheet |
| US-004 | FR-013~016 | SC-005, SC-006 | CartScreen, VariantSheet |
| US-005 | FR-017~021 | SC-007 | CheckoutScreen |
| US-006 | FR-022~025 | SC-008 | OrderHistoryScreen, OrderDetailScreen, DeliveryTrackingScreen |
| US-007 | FR-026 | SC-009 | ReviewWriteScreen |
| US-008 | FR-027~029 | SC-010, SC-011 | WishlistScreen, HistoryScreen |
| US-009 | FR-030 | SC-012 | CouponBoxScreen |
| US-010 | FR-031~033 | SC-013 | AddressBookScreen, AddressEditScreen |

---

## 범위 외 (Out of Scope)

- **소셜 로그인**: LoginScreen에 카카오·구글·네이버 버튼 UI가 존재하나 동작 미구현(플레이스홀더).
- **아이디 찾기 / 비밀번호 재설정**: UI 링크(`_LinkRow`)가 존재하나 연결 없음.
- **1:1 문의하기 / FAQ / 공지사항**: MyPageScreen 메뉴 항목이 존재하나 화면 미구현(onTap: null).
- **알림 설정**: MyPageScreen 항목 존재, 화면 미구현.
- **카테고리 API 연동**: CategoryScreen은 하드코딩 10개 항목으로 구현(GET /categories 미호출).
- **마일리지 포인트 / 개인정보수정 / 고객센터**: MyPageScreen 항목 존재, 화면 미연결.
- **낙관적 업데이트**: 찜·장바구니 등 모든 mutation은 서버 응답 후 invalidate 방식.
- **오프라인 지원 / 푸시 알림**: 범위 외.

---

## 미결 사항 (Open Questions)

없음 (retroactive 문서화 — 구현 사실 기준).
