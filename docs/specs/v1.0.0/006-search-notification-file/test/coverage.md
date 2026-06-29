---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive)
---

# Coverage: 006-search-notification-file

## 목차

- [실행 요약](#실행-요약)
- [SC × 시나리오 커버리지 매트릭스](#sc--시나리오-커버리지-매트릭스)
- [커버리지 요약](#커버리지-요약)
- [STALE_SC 경고](#stale_sc-경고)

---

## 실행 요약

> 본 retroactive 검증은 006 완료 커밋 `f2f061a` 기준으로 main session 이 게이트를 직접 재실행·코드리뷰하여
> 확인한 수치다. 신규 단위 테스트 개수는 실제 spec 파일의 `it()` 를 직접 카운트하여 확정했다.

| 항목 | 본 retroactive 검증 (HEAD `f2f061a`) |
|---|---|
| tsc `--noEmit` | **EXIT 0** |
| Unit 테스트 (src/) | **21 suites / 209 PASS** (005 대비 +20) |
| e2e + Static 테스트 (test/) | **15 suites / 73 PASS** (신규 `search-notification-file.e2e` 포함) |
| AppModule 부팅 | 정상 — SearchModule·NotificationModule·FileModule 3개 DI 등록 |
| 006 신규 단위 테스트 | **20** (search 5 + notification 8 + file 7 — `it()` 직접 카운트) |
| 006 회귀 | **0** (전체 PASS) |

> **신규 단위 20 산정 근거(사실 기준)**:
> - `search.service.spec.ts` = 5 케이스 (`grep -cE '\bit\(' ` 직접 카운트)
> - `notification.service.spec.ts` = 8 케이스 (create 1 + list 3 + markRead 3 + markAllRead 1)
> - `file.service.spec.ts` = 7 케이스 (presign 2 + getById 2 + delete 3)
> - 합 20 = 005 baseline 189 + 20 = 209 로 정합.
> - 추가로 통합 부팅 `search-notification-file.e2e-spec.ts` 4 케이스 + 정적 `cross-schema.spec.ts`
>   에 NotificationRepository(006)·FileRepository(006) 규칙 2건이 e2e+static 묶음(15 suites/73)에 포함.

### 실행 커맨드

```bash
cd apps/backend
npx tsc --noEmit -p tsconfig.json                                              # EXIT 0
npx jest --testPathPattern="src/"                                              # 21 suites / 209 PASS
npx jest --config ./test/jest-e2e.json                                         # 15 suites / 73 PASS (e2e + static)
```

> 단위 테스트는 `package.json` jest 설정(rootDir: "src")으로 실행한다. e2e·정적 테스트는
> `test/jest-e2e.json`(rootDir: ".") 으로 실행하며 통합 부팅(`search-notification-file.e2e`)은
> PostgreSQL 연결을 요구한다.

---

## SC × 시나리오 커버리지 매트릭스

### 검색 (SC-001~003)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 상태 |
|---|---|---|---|---|---|
| SC-001 | page/size 정규화·클램핑·sort 기본 | when_no_pagination_params_then_defaults_page1_size20_skip0, when_page3_size10_then_skip_is_20 | when_size_exceeds_max_then_clamped | — | PASS |
| SC-002 | 필터 passthrough + 메타 wrap | when_filters_provided_then_passed_through, when_result_returned_then_wraps_with_page_size_meta | — | — | PASS |
| SC-003 | ACTIVE·OUT_OF_STOCK·tiebreaker·Decimal | ProductRepository.searchProducts 코드 구조(상태 in 필터·orderBy id desc·DecimalFilter) | — | — | PASS (정적) |

### 알림 (SC-004~007)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 상태 |
|---|---|---|---|---|---|
| SC-004 | create 위임 | when_create_then_delegates_to_repository | — | — | PASS |
| SC-005 | list 정규화·메타 | when_no_params_then_default_page1_size20_skip0, when_page2_size10_then_skip_is_10 | when_size_exceeds_max_then_clamped_to_100 | — | PASS |
| SC-006 | markRead 본인/타인/미존재 | when_owned_by_user_then_marks_read | — | when_notification_missing_then_NotFound, when_owned_by_other_user_then_Forbidden | PASS |
| SC-007 | markAllRead 변경 건수 | when_called_then_returns_updated_count | — | — | PASS |

### 파일 (SC-008~010)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 상태 |
|---|---|---|---|---|---|
| SC-008 | presign key·PENDING·결정적 URL·키 유일 | when_presign_then_key_format_and_pending_record_created | when_presign_twice_then_keys_are_unique | — | PASS |
| SC-009 | getById 미존재/존재 | when_found_then_returns_meta | — | when_missing_then_NotFound | PASS |
| SC-010 | delete 본인/타인/미존재 | when_owned_by_user_then_deletes | — | when_missing_then_NotFound, when_owned_by_other_then_Forbidden | PASS |

### 통합·정적 (SC-011, SC-053)

| SC-ID | 수용 기준 | 시나리오 | 상태 |
|---|---|---|---|
| SC-011 | AppModule 부팅 + 공개/인증 라우트 | when_get_search_products_then_200_with_page_meta, when_invalid_sort_then_400, when_get_notifications_without_token_then_401, when_presign_without_token_then_401 | PASS |
| SC-053 | notification·file Repository cross-schema 0 | cross-schema.spec.ts NotificationRepository(006)·FileRepository(006) 규칙 | PASS |

---

## 커버리지 요약

| 항목 | 수 |
|---|---|
| 전체 SC | 12 (검색 3 + 알림 4 + 파일 3 + 통합 1 + 정적 1) |
| PASS (직접 커버) | 12 |
| INDIRECT (간접 커버) | 0 |
| GAP | 0 (단, 알림 이벤트 연동·파일 confirm 은 기능 미구현 — coverage-gap.md 참조) |

> 모든 SC(SC-001~011, SC-053)가 직접 커버되었다. 단, 알림 *도메인 이벤트 연동*·파일 *PENDING→UPLOADED
> 확정*·`GET /files/:id` *소유권 검증*·presign *입력 검증* 은 production 기능 자체가 구현되지 않아 SC 로
> 정의되지 않았으며, 이는 의도된 범위 외(GAP-006-01·02, SEC-FIND-006-01·02)로 coverage-gap.md 에 기록한다.

---

## STALE_SC 경고

STALE_SC 검출 결과: **0건**

검출 대상: 006 git diff(`git diff b174133 f2f061a -- apps/backend`) 변경 파일 내 테스트 SC 번호.
`search.service.spec.ts`·`notification.service.spec.ts`·`file.service.spec.ts` 는 docstring 시나리오
주석에 SC 번호를 직접 부착하지 않고 행위 기반 `it('when_..._then_...')` 명명을 사용한다(spec.md SC 와의
매핑은 본 coverage.md·test-cases.md 가 담당). 정적 스펙(`cross-schema.spec.ts` 의
NotificationRepository(006)·FileRepository(006) 라벨)에서 사용된 식별자도 spec.md/data-model.md 정의와
일치한다. semantic mismatch 없음.
