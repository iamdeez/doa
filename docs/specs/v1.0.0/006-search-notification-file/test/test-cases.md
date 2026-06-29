---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive)
---

# Test Cases: 006-search-notification-file

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
  - [검색 (SC-001~003)](#검색-sc-001003)
  - [알림 (SC-004~007)](#알림-sc-004007)
  - [파일 (SC-008~010)](#파일-sc-008010)
  - [통합·정적 (SC-011, SC-053)](#통합정적-sc-011-sc-053)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류)](#미커버-항목-사전-분류)

---

## SC × 시나리오 매트릭스

> 테스트 함수명은 실제 spec 파일의 `it('...')` 식별자 기준.
> 신규 단위 테스트: search 5 + notification 8 + file 7 = **20**. 통합 부팅 4(e2e) + 정적 cross-schema 2 규칙.

### 검색 (SC-001~003)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-001 | page/size 정규화·skip/take·클램핑·sort 기본 | `when_no_pagination_params_then_defaults_page1_size20_skip0`, `when_page3_size10_then_skip_is_20` | `when_size_exceeds_max_then_clamped` | — | search.service.spec.ts | [env:unit] |
| SC-002 | 필터 passthrough + 메타 wrap | `when_filters_provided_then_passed_through`, `when_result_returned_then_wraps_with_page_size_meta` | — | — | search.service.spec.ts | [env:unit] |
| SC-003 | ACTIVE·OUT_OF_STOCK 한정·tiebreaker id desc·Decimal 가격 | (코드 구조 검증 — `ProductRepository.searchProducts`) | — | — | product.repository.ts (정적 코드) | [env:static] |

### 알림 (SC-004~007)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-004 | create 위임 | `when_create_then_delegates_to_repository` | — | — | notification.service.spec.ts::create | [env:unit] |
| SC-005 | list 정규화·메타 | `when_no_params_then_default_page1_size20_skip0`, `when_page2_size10_then_skip_is_10` | `when_size_exceeds_max_then_clamped_to_100` | — | notification.service.spec.ts::list | [env:unit] |
| SC-006 | markRead 본인/타인/미존재 | `when_owned_by_user_then_marks_read` | — | `when_notification_missing_then_NotFound`, `when_owned_by_other_user_then_Forbidden` | notification.service.spec.ts::markRead | [env:unit] |
| SC-007 | markAllRead 변경 건수 | `when_called_then_returns_updated_count` | — | — | notification.service.spec.ts::markAllRead | [env:unit] |

### 파일 (SC-008~010)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-008 | presign key·PENDING·결정적 URL·키 유일 | `when_presign_then_key_format_and_pending_record_created` | `when_presign_twice_then_keys_are_unique` | — | file.service.spec.ts::presign | [env:unit] |
| SC-009 | getById 미존재/존재 | `when_found_then_returns_meta` | — | `when_missing_then_NotFound` | file.service.spec.ts::getById | [env:unit] |
| SC-010 | delete 본인/타인/미존재 | `when_owned_by_user_then_deletes` | — | `when_missing_then_NotFound`, `when_owned_by_other_then_Forbidden` | file.service.spec.ts::delete | [env:unit] |

### 통합·정적 (SC-011, SC-053)

| SC-ID | 수용 기준 | Happy Path | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|
| SC-011 | AppModule 부팅 + 공개/인증 라우트 | `when_get_search_products_then_200_with_page_meta`, `when_get_notifications_without_token_then_401`, `when_presign_without_token_then_401` | `when_invalid_sort_then_400` | search-notification-file.e2e-spec.ts | [env:integration] |
| SC-053 | notification·file Repository cross-schema 직접 참조 0 | `when_inspect_NotificationRepository__006__then_no_cross_schema_prisma_access`, `when_inspect_FileRepository__006__then_no_cross_schema_prisma_access` | — | test/static/cross-schema.spec.ts | [env:static] |

---

## 외부 의존성 명시

### fixture / mock

- `mockProductService`(search): `{ searchProducts }` jest.fn() — `mockResolvedValue({items:[], total:0})`
- `mockRepo`(notification): `{ create, findById, listByUser, markRead, markAllRead }` jest.fn()
- `mockRepo`(file): `{ create, findById, delete }` jest.fn()
- `StubFileStorage`: 실제 클래스 사용(`{ provide: FILE_STORAGE, useClass: StubFileStorage }`) — 결정적 URL, 무네트워크
- 상수 fixture: `USER_ID='user-001'`, `OTHER_USER_ID='user-002'`, `NOTI_ID='noti-001'`, `FILE_ID='file-001'`
- e2e: `Test.createTestingModule({imports:[AppModule]})` + `ValidationPipe({whitelist, forbidNonWhitelisted, transform})`

### 환경 변수

- 단위 테스트: 별도 환경 변수 불필요(전부 mock, DB 연결 없음).
- 통합 부팅 테스트(`search-notification-file.e2e-spec.ts`): PostgreSQL 기동 + 마이그레이션 적용 + `.env`(`DATABASE_URL`·`JWT_*`) 전제.

### 외부 서비스

- 단위·정적: DB·네트워크 연결 없음. 파일 storage 는 `StubFileStorage`(무네트워크 결정적 URL).
- 통합: AppModule 부팅이 실제 PostgreSQL 연결을 요구(GET /search/products 200 확인용).

---

## 미커버 항목 (사전 분류)

| 항목 | 미커버 사유 | 카테고리 | 권장 검증 방법 |
|---|---|---|---|
| 알림 도메인 이벤트 연동 (이벤트→create→조회) | `NotificationService.create()` 가 공개 진입점만 제공하고 주문·배송·정산·리뷰 이벤트 핸들러에서 호출하는 연동이 미구현 → 실제 알림 생성 경로·통합 시나리오가 production 에 없으므로 테스트 대상 부재 | (3) 기능 미구현 | 후속 spec 에서 이벤트 핸들러 연동 + 통합 시나리오 테스트 (GAP-006-01) |
| 파일 PENDING→UPLOADED 확정(confirm) | 업로드 확정 엔드포인트가 production 에 없음 → size 갱신·상태 전이 검증 대상 부재 | (3) 기능 미구현 | 후속 spec 에서 confirm 엔드포인트 + 상태 전이 테스트 (GAP-006-02) |
| `GET /files/:id` 소유권 검증 | production 에 소유권 검증 로직 자체가 없음(임의 인증 사용자 노출) → 403 단언 대상 부재 | (3) 기능 미구현 | 비공개 purpose 도입 시 ownerId 검증 + 403 테스트 (SEC-FIND-006-01) |
| presign contentType allowlist·크기 상한 | production 에 MIME allowlist·크기 검증 없음(stub 모델) → 거부 단언 대상 부재 | (3) 기능 미구현 | 실제 R2 전환 시 content-type 바인딩·크기 제한 + 거부 테스트 (SEC-FIND-006-02) |
| `ProductService/Repository.searchProducts` 직접 단위 테스트 | search.service.spec 가 `mockProductService.searchProducts` 호출 인자를 단언하나, ProductService/Repository 의 searchProducts 자체(상태 필터·정렬·Decimal)는 직접 단위 테스트 미작성. e2e 부팅(200)으로 간접 커버 | (1) 단위테스트 가능 | product.service.spec/e2e 에 검색 질의 직접 테스트(상태 필터·정렬·가격 범위) 추가 권장 |
