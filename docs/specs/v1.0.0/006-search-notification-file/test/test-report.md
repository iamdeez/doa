---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive)
---

# 테스트 실행 결과 — 006-search-notification-file

## 목차

- [실행 요약](#실행-요약)
- [실패 목록](#실패-목록)
- [SC 매핑표 검증](#sc-매핑표-검증)
- [설계 문서 정합성](#설계-문서-정합성)
- [회귀 탐지](#회귀-탐지)

---

## 실행 요약

> 본 retroactive 검증은 006 완료 커밋 `f2f061a` 에서 main session 이 게이트를 직접 재실행·코드리뷰하여
> 확인했다. 신규 단위 테스트 개수는 실제 spec 파일의 `it()` 를 직접 카운트하여 산정했다(추측 금지).

| 항목 | 결과 (HEAD `f2f061a`) |
|---|---|
| 실행 일시 | 2026-06-29 17:50 |
| tsc `--noEmit` | **EXIT 0** |
| Unit 테스트 (apps/backend, rootDir: src) | **209 PASS** / 0 FAIL / 21 suites |
| e2e + Static 테스트 (apps/backend, test/) | **73 PASS** / 0 FAIL / 15 suites |
| 전체 통과 여부 | **PASS** |
| 002~005 회귀 여부 | **없음** |
| AppModule 부팅 | 정상 — SearchModule·NotificationModule·FileModule 3개 DI 등록 |
| 006 신규 단위 테스트 | **20** (search.service.spec 5 + notification.service.spec 8 + file.service.spec 7) |

### 005 → 006 델타

| 항목 | 005 완료(`b174133`) | 006 완료(`f2f061a`) | 델타 |
|---|---|---|---|
| Unit suites / PASS | 18~21 / 189 | 21 / 209 | **+20 PASS** (search 5 + notification 8 + file 7) |
| e2e + static suites / PASS | — / — | 15 / 73 | 신규 `search-notification-file.e2e`(4) + cross-schema 규칙(+2) 포함 |

> **신규 단위 20 산정(직접 카운트)**: `grep -cE '\bit\(' ` 기준 — search.service.spec.ts=5,
> notification.service.spec.ts=8, file.service.spec.ts=7. 합 20 = 005 baseline 189 + 20 = 209 정합.

### 실행 커맨드

```bash
cd /Users/krystal/workspace/doa/doa-next/apps/backend
npx tsc --noEmit -p tsconfig.json                                              # EXIT 0
npx jest --testPathPattern="src/"                                              # 21 suites / 209 PASS
npx jest --config ./test/jest-e2e.json                                         # 15 suites / 73 PASS (e2e + static)
```

> **DB 의존 e2e 명시**: `search-notification-file.e2e-spec.ts`·`orders.e2e-spec.ts`·
> `payments.e2e-spec.ts`·`products.e2e-spec.ts`·`auth.e2e-spec.ts`·`health.e2e-spec.ts` 는
> PostgreSQL 연결을 요구한다. `search-notification-file.e2e` 는 AppModule 부팅으로 SearchModule·
> NotificationModule·FileModule DI 와이어링 + 공개/인증 라우트(200/401/400)를 검증한다(SC-011).

---

## 실패 목록

**실패 없음.** tsc EXIT 0, unit 209 + e2e/static 73 = 전체 PASS.

---

## SC 매핑표 검증

| SC-ID | 관련 테스트 | 통과 여부 |
|---|---|---|
| SC-001 | search.service.spec.ts: when_no_pagination_params_then_defaults_page1_size20_skip0, when_page3_size10_then_skip_is_20, when_size_exceeds_max_then_clamped | PASS |
| SC-002 | search.service.spec.ts: when_filters_provided_then_passed_through, when_result_returned_then_wraps_with_page_size_meta | PASS |
| SC-003 | product.repository.ts searchProducts 코드 구조(status in [ACTIVE, OUT_OF_STOCK]·orderBy id desc·Prisma.DecimalFilter) | PASS (정적) |
| SC-004 | notification.service.spec.ts: when_create_then_delegates_to_repository | PASS |
| SC-005 | notification.service.spec.ts: when_no_params_then_default_page1_size20_skip0, when_page2_size10_then_skip_is_10, when_size_exceeds_max_then_clamped_to_100 | PASS |
| SC-006 | notification.service.spec.ts: when_notification_missing_then_NotFound, when_owned_by_other_user_then_Forbidden, when_owned_by_user_then_marks_read | PASS |
| SC-007 | notification.service.spec.ts: when_called_then_returns_updated_count | PASS |
| SC-008 | file.service.spec.ts: when_presign_then_key_format_and_pending_record_created, when_presign_twice_then_keys_are_unique | PASS |
| SC-009 | file.service.spec.ts: when_missing_then_NotFound, when_found_then_returns_meta | PASS |
| SC-010 | file.service.spec.ts: when_missing_then_NotFound, when_owned_by_other_then_Forbidden, when_owned_by_user_then_deletes | PASS |
| SC-011 | search-notification-file.e2e-spec.ts: when_get_search_products_then_200_with_page_meta, when_invalid_sort_then_400, when_get_notifications_without_token_then_401, when_presign_without_token_then_401 | PASS |
| SC-053 | test/static/cross-schema.spec.ts: when_inspect_NotificationRepository__006__then_no_cross_schema_prisma_access, when_inspect_FileRepository__006__then_no_cross_schema_prisma_access | PASS |

---

## 설계 문서 정합성

### plan.md 현행화 점검

- 검색 모듈 자체 테이블 없음 — `ProductService.searchProducts` DI read-only — plan.md ADR-001 과 구현
  일치 ✓ (`SearchRepository` 빈 클래스, providers 미등록)
- 객체 스토리지 추상화 — `FileStoragePort` + `StubFileStorage`(무네트워크, `https://r2.stub.local/{key}`)
  + `FILE_STORAGE` 토큰 — plan.md ADR-004 와 일치 ✓
- 알림 정렬 미읽음 우선→최신순→id desc — plan.md ADR-008 과 일치 ✓ (notification.repository orderBy)
- 자원 소유권(notification.markRead·file.delete 의 404/403) — plan.md 인터페이스 계약과 일치 ✓
- cross-schema 금지: cross-schema.spec.ts 에 NotificationRepository·FileRepository 규칙 반영 ✓
- 금전 필드 부재(P-005 해당 없음): notifications·file_assets 에 Decimal 금전 필드 0 — data-model.md 와
  일치 ✓

### 발견된 한계

- **알림 이벤트 미연동**: `NotificationService.create()` 공개 진입점만, 도메인 이벤트 핸들러 호출 부재.
  코드 수정 없이 후속 spec 위임(GAP-006-01).
- **파일 confirm 부재**: PENDING→UPLOADED 전이 엔드포인트 없음(GAP-006-02).
- **`GET /files/:id` 소유권 미검증**(SEC-FIND-006-01)·**presign 입력 무검증**(SEC-FIND-006-02): Low,
  후속 위임.

### 002~005 회귀 확인

- product.service.spec.ts: 006 의 `searchProducts` 는 additive 공개이며 기존 메서드 시그니처 불변 →
  002~005 product 기존 테스트 PASS.
- order/payment/coupon/review/shipping/settlement 등 기타 모듈: 모든 기존 테스트 PASS.

---

## 회귀 탐지

006 이 추가/변경한 테스트 파일 (`git diff b174133 f2f061a` 기준):
- `src/modules/search/search.service.spec.ts`: 신규 (+101, 5 케이스)
- `src/modules/notification/notification.service.spec.ts`: 신규 (+138, 8 케이스)
- `src/modules/file/file.service.spec.ts`: 신규 (+146, 7 케이스)
- `test/search-notification-file.e2e-spec.ts`: 신규 (+81, 4 케이스 — AppModule 부팅·라우트, SC-011)
- `test/static/cross-schema.spec.ts`: 확장 (+27 — NotificationRepository(006)·FileRepository(006) 규칙 2건)

005 baseline(189 unit) 대비 006 신규 20 → 209 unit (회귀 0). e2e+static 15 suites/73 PASS, 전체
PASS·회귀 0 을 확인했다.
