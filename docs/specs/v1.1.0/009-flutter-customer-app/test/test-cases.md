---
작성: Docs Agent (retroactive)
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정 (retroactive)
---

# Test Cases: 009-flutter-customer-app

> 본 문서는 구현 완료 코드 기준 retroactive 작성.
> Flutter 앱 특성상 별도 단위/통합 테스트 스위트 없음.
> 검증은 `flutter analyze` + 정적 코드 구조 리뷰로 갈음한다.

## 목차

- [테스트 전략 개요](#테스트-전략-개요)
- [SC-별 테스트 케이스](#sc-별-테스트-케이스)

---

## 테스트 전략 개요

| 검증 방법 | 적용 범위 |
|---|---|
| `flutter analyze` [env:static] | 전체 소스 정적 분석 (NFR-006, SC-014) |
| AppTheme 위젯 테스트 | AppTheme.light() Material3 설정 검증 |
| 정적 코드 구조 리뷰 | 각 SC의 핵심 로직·API 호출·분기 확인 |

단위/통합/e2e 테스트는 본 차수 범위 외.
Mock 기반 위젯 테스트 확대는 GAP-009-03 후속 과제.

---

## SC-별 테스트 케이스

### SC-001 — 인증 상태 초기화 및 라우팅

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-001-1 | 저장 토큰 존재 시 앱 시작 | 정적 코드 리뷰(`AuthController._restore`) | `state = authenticated` → AppShell 표시 |
| TC-001-2 | 저장 토큰 없을 때 앱 시작 | 정적 코드 리뷰 | `state = unauthenticated` → LoginScreen 표시 |
| TC-001-3 | 로그아웃 | 정적 코드 리뷰(`AuthController.logout`) | TokenStore.clear() → `state = unauthenticated` |

### SC-002 — Bearer 주입 및 401 single-flight refresh

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-002-1 | 인증 요청에 Bearer 헤더 주입 | 정적 코드 리뷰(Interceptor onRequest) | `extra['anonymous'] != true` 시 Authorization 헤더 포함 |
| TC-002-2 | 익명 요청 토큰 미주입 | 정적 코드 리뷰 | `extra['anonymous'] == true` 시 헤더 미주입 |
| TC-002-3 | 401 수신 시 refresh 후 재시도 | 정적 코드 리뷰(`_ensureRefreshed`) | `_refreshing` Future 단일 생성, 재시도 요청에 `extra['retried']=true` |
| TC-002-4 | 재시도 요청에서 401 재발 | 정적 코드 리뷰 | `extra['retried']==true` → 재시도 포기 |

### SC-003 — 홈·검색 상품 목록

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-003-1 | 홈 화면 최신 상품 조회 | 정적 코드 리뷰(`homeProductsProvider`) | GET /search/products?size=20&sort=latest 익명 요청 |
| TC-003-2 | 검색 키워드 제출 | 정적 코드 리뷰(`searchProvider`) | GET /search/products?q={keyword}&size=20 호출 |

### SC-004 — 상품 상세·찜 토글

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-004-1 | 상품 상세 조회 | 정적 코드 리뷰(`productDetailProvider`) | GET /products/:id (auth) |
| TC-004-2 | 리뷰 목록 조회 | 정적 코드 리뷰(`productReviewsProvider`) | GET /products/:id/reviews?take=20 (익명) |
| TC-004-3 | 찜 추가 | 정적 코드 리뷰(`_WishlistHeart`) | POST /users/me/wishlist |
| TC-004-4 | 찜 취소 | 정적 코드 리뷰 | DELETE /users/me/wishlist/:productId |
| TC-004-5 | 찜 추가 시 409 수렴 | 정적 코드 리뷰 | 409 → 이미 찜한 상태로 처리(에러 미노출) |

### SC-005 — 옵션 선택 시트

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-005-1 | 장바구니 추가 | 정적 코드 리뷰(`VariantSheet`, buyNow=false) | POST /cart/items → SnackBar |
| TC-005-2 | 즉시 구매 | 정적 코드 리뷰(buyNow=true) | POST /cart/items → CartScreen 이동 |

### SC-006 — 장바구니

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-006-1 | 장바구니 목록 조회 | 정적 코드 리뷰(`cartProvider`) | GET /cart |
| TC-006-2 | 수량 변경 | 정적 코드 리뷰(`_CartRow`) | PUT /cart/items/:variantId {quantity} |
| TC-006-3 | 항목 삭제 | 정적 코드 리뷰 | DELETE /cart/items/:variantId |
| TC-006-4 | 합계 계산 | 정적 코드 리뷰(`_Checkout`) | items 합산 → 총액 표시 |

### SC-007 — 결제

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-007-1 | 주문 생성 | 정적 코드 리뷰(`_placeOrder`) | POST /orders {items, shippingAddress, userCouponId?} |
| TC-007-2 | 결제 생성 + idempotency | 정적 코드 리뷰 | POST /payments {orderId, idempotencyKey: Uuid().v4()} |
| TC-007-3 | 쿠폰 ID 전달 (userCouponId) | 정적 코드 리뷰 | userCouponId만 전달. 할인 금액 미계산 클라이언트. |
| TC-007-4 | 결제 성공 후 invalidate | 정적 코드 리뷰 | cartProvider + unusedCouponsProvider invalidate |

### SC-008 — 주문·배송 추적

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-008-1 | 주문 내역 조회 | 정적 코드 리뷰(`ordersProvider`) | GET /orders?limit=30 |
| TC-008-2 | 주문 상세 조회 | 정적 코드 리뷰(`orderDetailProvider`) | GET /orders/:id |
| TC-008-3 | 배송 추적 진입 | 정적 코드 리뷰(`_DeliveryButton`) | GET /shipments?orderId= → DeliveryTrackingScreen |
| TC-008-4 | 배송 추적 이력 | 정적 코드 리뷰(`trackingProvider`) | GET /shipments/:id/tracking → 4단계 스테퍼 |

### SC-009 — 리뷰 작성

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-009-1 | 리뷰 가능 조건 | 정적 코드 리뷰(`OrderDetailScreen`) | 주문 상태 delivered/completed인 항목만 버튼 노출 |
| TC-009-2 | 리뷰 저장 | 정적 코드 리뷰(`ReviewWriteScreen`) | POST /reviews {orderItemId, rating, content} |

### SC-010 — 찜 목록

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-010-1 | 찜 목록 N+1 조회 | 정적 코드 리뷰(`wishlistProvider`) | GET /users/me/wishlist → Future.wait GET /products/:id |
| TC-010-2 | 개별 찜 삭제 | 정적 코드 리뷰 | DELETE /users/me/wishlist/:productId |
| TC-010-3 | 전체 찜 삭제 | 정적 코드 리뷰(`_clearAll`) | 전체 DELETE 순차 실행 |

### SC-011 — 최근 본 상품

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-011-1 | 최근 본 상품 N+1 조회 | 정적 코드 리뷰(`recentViewsProvider`) | GET /users/me/recent-views → Future.wait GET /products/:id (max 30) |
| TC-011-2 | 추천 상품 | 정적 코드 리뷰(`_Recommendations`) | homeProductsProvider 재사용 |

### SC-012 — 쿠폰함

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-012-1 | 보유 쿠폰 전체 조회 | 정적 코드 리뷰(`myCouponsProvider`) | GET /users/me/coupons |
| TC-012-2 | 탭 필터 | 정적 코드 리뷰 | all/unused/used/expired ChoiceChip 분기 |

### SC-013 — 배송 주소록

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-013-1 | 주소 목록 조회 | 정적 코드 리뷰(`addressBookProvider`) | GET /users/me/addresses |
| TC-013-2 | 주소 추가 | 정적 코드 리뷰(`AddressEditScreen`) | POST /users/me/addresses |
| TC-013-3 | 주소 수정 | 정적 코드 리뷰 | PATCH /users/me/addresses/:id |
| TC-013-4 | 기본 배송지 설정 | 정적 코드 리뷰 | PATCH /users/me/addresses/:id/default |
| TC-013-5 | 주소 삭제 | 정적 코드 리뷰 | DELETE /users/me/addresses/:id (AlertDialog 확인) |

### SC-014 — flutter analyze

| TC-ID | 시나리오 | 검증 방법 | 기대 결과 |
|---|---|---|---|
| TC-014-1 | 정적 분석 | `flutter analyze` [env:static] | 0 issues |
