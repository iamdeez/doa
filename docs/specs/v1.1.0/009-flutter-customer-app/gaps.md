---
작성: Docs Agent (retroactive)
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정 (retroactive)
---

# Gaps: 009-flutter-customer-app

> 구현 과정에서 발견된 설계 공백·기술 부채를 기록한다.
> 출처: Docs Agent, 컨텍스트: 009-flutter-customer-app retroactive 분석

## 목차

- [GAP 목록](#gap-목록)
- [GAP 상세](#gap-상세)

---

## GAP 목록

| GAP-ID | 유형 | 내용 | 상태 |
|---|---|---|---|
| GAP-009-01 | 기술부채 | `Map<String,dynamic>` 동적 파싱 — 타입드 모델 부재 | 미해결 |
| GAP-009-02 | 기술부채(성능) | 찜 목록·최근 본 상품 N+1 조회 패턴 | 미해결 |
| GAP-009-03 | 테스트 | AuthController·ApiClient 단위 테스트 부재 | 미해결 |
| GAP-009-04 | 기능 | 카테고리 화면 하드코딩 — GET /categories API 미연동 | 미해결 |
| GAP-009-05 | 기능 | 마이페이지 프로필·1:1문의·FAQ·공지·알림설정 미구현 | 미해결 |
| GAP-009-06 | 기능 | 소셜 로그인 UI 존재, 동작 미구현 | 미해결 |

---

## GAP 상세

### GAP-009-01 — Map<String,dynamic> 동적 파싱 (기술부채)

- **유형**: 기술부채 (구조적 안전성)
- **상태**: 미해결
- **발견 위치**: 전체 Flutter 소스 (`lib/` 전체)
- **내용**: 백엔드 API 응답을 `Map<String,dynamic>`으로 직접 파싱하며 타입드 모델 클래스(Freezed, json_serializable 등)가 없음. 필드명 오타나 타입 불일치가 런타임에서야 발견된다.
- **영향 범위**: 전체 Provider·Screen — JSON 파싱 코드 전부
- **갱신 권고**: 차기 스펙에서 Freezed + json_serializable 기반 모델 레이어 도입 권고. GAP 해소 후 coverage-gap.md CG-006(타입드 모델 테스트)도 자동 해소 가능.
- **관련 spec**: `docs/specs/v1.1.0/009-flutter-customer-app/spec/spec.md` NFR-007

---

### GAP-009-02 — N+1 조회 패턴 (기술부채·성능)

- **유형**: 기술부채 (성능)
- **상태**: 미해결
- **발견 위치**:
  - `lib/features/wishlist/wishlist_screen.dart` — `wishlistProvider`
  - `lib/features/history/history_screen.dart` — `recentViewsProvider`
- **내용**: 찜 목록(GET /users/me/wishlist)·최근 본 상품(GET /users/me/recent-views) 모두 ID 목록을 먼저 받은 후 `Future.wait`으로 각 상품의 GET /products/:id를 N번 병렬 호출한다. 아이템 수만큼 API 요청이 증가하여 서버 부하와 응답 지연을 유발한다.
- **영향 범위**: WishlistScreen, HistoryScreen
- **갱신 권고**: 백엔드에서 `/users/me/wishlist?expand=product` 또는 별도 일괄 조회 엔드포인트를 제공하여 단일 요청으로 상품 데이터를 포함한 응답을 반환하도록 개선 권고.
- **관련 spec**: `docs/specs/v1.1.0/009-flutter-customer-app/spec/spec.md` NFR-003(성능)

---

### GAP-009-03 — AuthController·ApiClient 단위 테스트 부재

- **유형**: 테스트
- **상태**: 미해결
- **발견 위치**: `lib/core/providers.dart`, `lib/core/api_client.dart`
- **내용**: Bearer 주입·401 single-flight refresh·_restore 상태 전이 등 핵심 인증 흐름이 자동화 단위 테스트 없이 정적 구조 리뷰로만 검증된다. 런타임 회귀 위험 존재.
- **영향 범위**: SC-001~002 전체
- **갱신 권고**: `ProviderContainer` + Mock TokenStore + DioAdapter 기반 단위 테스트 추가. coverage-gap.md CG-001·CG-002 참조.
- **관련 spec**: `docs/specs/v1.1.0/009-flutter-customer-app/spec/spec.md` SC-001, SC-002

---

### GAP-009-04 — 카테고리 화면 하드코딩

- **유형**: 기능
- **상태**: 미해결
- **발견 위치**: `lib/features/shell/category_screen.dart`
- **내용**: 카테고리 화면이 정적 하드코딩 그리드로 구현됨. GET /categories API 연동 없음. 관리자 콘솔에서 카테고리 변경 시 앱 업데이트 필요.
- **영향 범위**: CategoryScreen (AppShell index=0)
- **갱신 권고**: 차기 스펙에서 GET /categories API 연동 및 동적 렌더링 구현.
- **관련 spec**: 009 spec.md §범위 외

---

### GAP-009-05 — 마이페이지 미구현 기능

- **유형**: 기능
- **상태**: 미해결
- **발견 위치**: `lib/features/mypage/mypage_screen.dart`
- **내용**: 마이페이지에서 다음 기능이 `onTap: null`(미구현) 상태: 1:1문의, FAQ, 공지사항, 알림설정. 프로필 이메일(`user@email.com`)도 하드코딩.
- **영향 범위**: MyPageScreen
- **갱신 권고**: 차기 스펙에서 GET /users/me 프로필 연동 + 1:1문의·FAQ 화면 구현.
- **관련 spec**: 009 spec.md §범위 외

---

### GAP-009-06 — 소셜 로그인 미구현

- **유형**: 기능
- **상태**: 미해결
- **발견 위치**: `lib/features/auth/login_screen.dart` (`_SocialRow`)
- **내용**: UI에 Kakao·Naver 소셜 로그인 버튼이 존재하나 동작 미구현 (`onTap: null` 또는 빈 함수).
- **영향 범위**: LoginScreen
- **갱신 권고**: 차기 스펙에서 OAuth2 소셜 로그인 흐름 구현.
- **관련 spec**: 009 spec.md §범위 외
