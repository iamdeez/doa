---
작성: Docs Agent (retroactive)
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정 (retroactive)
---

# Research: 009-flutter-customer-app

> 본 문서는 구현 완료 코드(`a3fc463`, base `a94ff47`)를 역분석하여 작성한 retroactive 조사 문서다.

## 목차

- [기존 코드베이스 분석](#기존-코드베이스-분석)
- [기술 선택 조사](#기술-선택-조사)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 기존 코드베이스 분석

### 클래스·모듈 계층 구조

```
ProviderScope
└── DoaApp (ConsumerWidget)
    └── switch(AuthStatus)
        ├── AuthStatus.unknown  → _SplashScreen (로딩 중 빈 Scaffold)
        ├── AuthStatus.authenticated → AppShell (ConsumerStatefulWidget)
        │   └── IndexedStack([CategoryScreen, HomeScreen, HistoryScreen, MyPageScreen])
        └── AuthStatus.unauthenticated → LoginScreen (ConsumerStatefulWidget)

Provider 의존 그래프:
  secureStorageProvider (FlutterSecureStorage)
    └── tokenStoreProvider (TokenStore)
          └── dioProvider (Dio + InterceptorsWrapper)
                └── authControllerProvider (Notifier<AuthStatus>)
                └── (각 feature의 FutureProvider.autoDispose)
```

### 핵심 모듈 목록

| 모듈 / 클래스 | 위치 | 역할 |
|---|---|---|
| `DoaApp` | `lib/app.dart` | 최상위 앱. AuthStatus 라우팅. |
| `AuthController` | `lib/core/providers.dart` | Notifier. JWT 복원·로그인·로그아웃. |
| `ApiClient` | `lib/core/api_client.dart` | Dio 인스턴스. Bearer 주입·401 refresh interceptor. |
| `TokenStore` | `lib/core/token_store.dart` | FlutterSecureStorage 래퍼. accessToken·refreshToken CRUD. |
| `AppShell` | `lib/features/shell/app_shell.dart` | 4탭 IndexedStack BottomNavigationBar. |
| `AppTheme` | `lib/theme/app_theme.dart` | Material3 ThemeData. DoaColors·DoaRadius 정의. |
| 각 FeatureScreen | `lib/features/*/` | 기능별 화면. `FutureProvider.autoDispose`로 데이터 조회. |

### 영향 범위 분석

Flutter 앱은 신규 독립 모듈(`mobile/customer_app/`)로 기존 백엔드·콘솔 코드에 영향 없음.
백엔드 API를 HTTP로만 소비하며 공유 패키지(`packages/`) 미사용.

---

## 기술 선택 조사

### Riverpod vs Provider vs BLoC

| 항목 | Riverpod | Provider | BLoC |
|---|---|---|---|
| 코드 생성 필요 | 선택적 | 불필요 | 불필요 |
| autoDispose | 내장 | 별도 처리 | 별도 처리 |
| 비동기 지원 | FutureProvider | FutureProvider | BLoC 이벤트 |

**채택**: Riverpod `^3.3.2`. 코드 생성(build_runner) 없이 `FutureProvider.autoDispose`·`Notifier`로
충분한 기능 제공. `autoDispose`로 화면 이탈 시 자동 메모리 해제.

### Dio vs http

Dio 채택 이유: `InterceptorsWrapper`로 Bearer 주입·401 refresh·익명 분기를 한 곳에서 처리.
`extra` 맵으로 요청별 메타데이터(anonymous, retried) 전달.

### FlutterSecureStorage vs SharedPreferences

JWT 토큰은 보안 민감 데이터로 iOS Keychain·Android Keystore를 사용하는
`flutter_secure_storage`에 저장. SharedPreferences는 평문 저장으로 부적합.

### go_router 선언 vs 미사용

`go_router ^17.2.3`이 pubspec.yaml에 선언되어 있으나 실제 라우팅은 `Navigator.push(MaterialPageRoute)` 직접 사용.
MVP 단계에서 단순한 imperative navigation으로 충분하다고 판단. Deep link·URL 기반 라우팅이 필요하면 go_router로 전환 예정.

---

## 엣지 케이스 및 한계

### 1. 응답 타입 미정의 (GAP-009-01)

전 화면이 `Map<String,dynamic>` 동적 파싱을 사용한다. 백엔드 응답 스키마 변경 시 런타임까지
타입 오류가 드러나지 않는다. 컴파일 타임 타입 안전성 0.

**한계**: null safety는 Dart 언어 차원에서 보장되지만, Map key 접근 오타·타입 불일치는
런타임에서만 발견 가능.

### 2. N+1 조회 패턴 (GAP-009-02)

찜 목록(`GET /users/me/wishlist`)과 최근 본 상품(`GET /users/me/recent-views`)은
ID 목록만 반환하므로 각 상품에 대해 `GET /products/:id`를 개별 호출한다.
`Future.wait`로 병렬 처리하지만 네트워크 요청 수가 O(N)으로 증가한다.

**한계**: 찜 30건이면 31회 HTTP 요청. 백엔드가 wishlist/recent-views 응답에 상품 정보를
포함하거나 bulk GET 엔드포인트를 제공하면 해소 가능.

### 3. 하드코딩 UI 컴포넌트

- **HomeScreen 배너**: 하드코딩 이미지·텍스트. 백엔드 배너 API 미연동.
- **CategoryScreen**: 하드코딩 10개 항목. `GET /categories` API 미호출.
- **MyPage 프로필**: 이메일이 `'user@email.com'` 하드코딩. `/users/me` API 미연동.

### 4. 결제 성공 후 UX

`POST /payments` 성공 시 AlertDialog를 표시하고 현재 CheckoutScreen에 머문다.
주문 내역으로 자동 이동 또는 성공 화면 전환이 없어 사용자가 수동으로 내비게이션해야 한다.

### 5. 단일 401 재시도

`extra['retried'] = true` 플래그로 무한 재시도를 방지하나, refresh 실패 시 토큰 삭제 후
logout 처리한다. 네트워크 일시 오류와 토큰 만료를 구분하지 않는다.

### 6. 카테고리 화면 미연동

`CategoryScreen`은 카테고리 탭에 배치되어 있으나 하드코딩 데이터만 표시한다.
실제 카테고리별 상품 조회 플로우가 없다.
