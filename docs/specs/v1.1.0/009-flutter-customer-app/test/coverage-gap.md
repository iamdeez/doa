---
작성: Docs Agent (retroactive)
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정 (retroactive)
---

# Coverage Gap: 009-flutter-customer-app

> SC 전체가 정적 구조 리뷰로 COVERED 처리되었으나, 자동화 테스트가 없어
> 런타임 회귀를 잡지 못하는 구조적 갭을 기록한다.

## 목차

- [커버리지 갭 목록](#커버리지-갭-목록)
- [우선순위별 보강 권고](#우선순위별-보강-권고)

---

## 커버리지 갭 목록

| 갭 ID | 관련 SC | 갭 내용 | 심각도 |
|---|---|---|---|
| CG-001 | SC-001~002 | AuthController·ApiClient Interceptor 단위 테스트 없음. Mock Dio로 Bearer 주입·401 refresh·single-flight 검증 불가. | High |
| CG-002 | SC-007 | CheckoutScreen _placeOrder 흐름(POST /orders → POST /payments) 통합 테스트 없음. idempotencyKey uuid 생성 자동 검증 불가. | High |
| CG-003 | SC-010, SC-011 | N+1 조회 패턴(wishlistProvider·recentViewsProvider Future.wait) Mock 없이 실제 API에 의존. | Medium |
| CG-004 | SC-004 | 찜 409 수렴 처리 자동 검증 없음. 수동 시나리오만 가능. | Medium |
| CG-005 | SC-003~013 | Provider 단위 테스트 전무. `FutureProvider.autoDispose` 데이터 흐름 자동 검증 불가. | Medium |
| CG-006 | SC-014 | `flutter analyze`는 정적 분석만. 런타임 타입 오류(Map<String,dynamic> 파싱)는 미검출. | Low |

---

## 우선순위별 보강 권고

**High (차기 스펙에서 보강 권고)**:
- `AuthController` 단위 테스트: `ProviderContainer` + Mock TokenStore로 _restore·login·logout 상태 전이 검증.
- `ApiClient` Interceptor 테스트: Mock HttpClient·DioAdapter로 Bearer 주입·401 refresh 재시도·retried 플래그 검증.

**Medium (로드맵)**:
- `CheckoutScreen` 통합 테스트: Mock Dio로 POST /orders→POST /payments 순차 호출·uuid 포함 검증.
- Provider 단위 테스트: `ProviderContainer`로 homeProductsProvider·cartProvider 등 데이터 흐름 검증.

**Low (기술 부채 추적)**:
- 타입드 모델 도입(GAP-009-01 해소) 후 타입 안전 테스트 작성.
- N+1 패턴 해소(GAP-009-02) 후 단일 API 호출 검증.
