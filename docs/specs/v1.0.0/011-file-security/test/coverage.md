---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive)
---

# Coverage: 011-file-security

## 목차

- [실행 요약](#실행-요약)
- [SC × 시나리오 커버리지 매트릭스](#sc--시나리오-커버리지-매트릭스)
- [커버리지 요약](#커버리지-요약)
- [STALE_SC 경고](#stale_sc-경고)

---

## 실행 요약

> 본 retroactive 검증은 011 완료 커밋 `88de003`(base `cfa787c`) 기준으로 main session 이 게이트를 직접
> 재실행·코드리뷰하여 확인한 수치다. 신규 단위 테스트 개수는 실제 spec 파일의 `it()` 를 직접 카운트했다.

| 항목 | 본 retroactive 검증 (HEAD `88de003`) |
|---|---|
| tsc `--noEmit` | **EXIT 0** |
| Unit 테스트 (src/) | **25 suites / 253 PASS** (010 대비 +8) |
| e2e + Static 테스트 (test/) | **16 suites / 84 PASS** (변화 없음 — 신규 e2e/static 없음) |
| 011 신규 단위 테스트 | **8** (file.service.spec 7→15 — presign 1 + getById 2 + confirm 6, `it()` 직접 카운트) |
| 011 회귀 | **0** (001~010 전체 PASS) |
| 마이그레이션 | **없음** (스키마 무변경 — FileAsset 기존 status/size 컬럼 재사용) |

> **신규 단위 8 산정 근거(사실 기준)**:
> - `file.service.spec.ts` 가 011 에서 7→15 케이스로 확장(+8) — describe `presign` 신규 1건
>   (`when_contentType_not_allowed_then_BadRequest`) + describe `getById` 신규 2건(`when_owned_by_user_then_returns_meta`·
>   `when_owned_by_other_then_Forbidden`) + describe `confirm (GAP-006-02)` 신규 6건. 기존 getById
>   `when_found_then_returns_meta` 는 011 에서 `when_owned_by_user_then_returns_meta`(소유권 단언 포함)로
>   대체되었고, `when_missing_then_NotFound` 는 새 시그니처로 유지(SC-003).
> - 010 baseline 245 + 8 = 253 로 정합. suites 수 무변(기존 file.service.spec 확장 — 신규 suite 아님).
> - e2e+static 16/84 는 010 과 동일(011 은 신규 e2e/static 미추가 — 메타 IDOR·confirm e2e 없음).

### 실행 커맨드

```bash
cd apps/backend
npx tsc --noEmit -p tsconfig.json                                              # EXIT 0
npx jest --testPathPattern="src/"                                              # 25 suites / 253 PASS
npx jest --config ./test/jest-e2e.json                                         # 16 suites / 84 PASS (변화 없음)
```

---

## SC × 시나리오 커버리지 매트릭스

| SC-ID | 수용 기준 | 케이스 | 상태 |
|---|---|---|---|
| SC-001 | 타인 getById 거부 | when_owned_by_other_then_Forbidden | PASS |
| SC-002 | 본인 getById 반환 | when_owned_by_user_then_returns_meta | PASS |
| SC-003 | 미존재 getById | when_missing_then_NotFound | PASS |
| SC-004 | 비허용 MIME presign 거부 + repo 미호출 | when_contentType_not_allowed_then_BadRequest | PASS |
| SC-005 | PENDING confirm 전이+size | when_owner_confirms_then_status_UPLOADED_and_size_set | PASS |
| SC-006 | 타인 confirm 거부 + updateStatus 미호출 | when_owned_by_other_then_Forbidden | PASS |
| SC-007 | 미존재 confirm | when_missing_then_NotFound | PASS |
| SC-008 | 이미 UPLOADED 멱등 | when_already_uploaded_then_idempotent_no_update | PASS |
| SC-009 | size 상한 초과 거부 + findById 미호출 | when_size_over_limit_then_BadRequest | PASS |
| SC-010 | size 비양수 거부 | when_size_not_positive_then_BadRequest | PASS |

---

## 커버리지 요약

| 항목 | 수 |
|---|---|
| 전체 SC | 10 (getById 3 + presign 1 + confirm 6) |
| PASS (직접 커버) | 10 |
| INDIRECT (간접 커버) | 0 |
| GAP | 0 (단, confirm size 비정수 전용 테스트·R2 HEAD 교차검증 e2e 는 coverage-gap.md 참조) |

> 모든 SC(SC-001~010)가 직접 커버되었다. confirm 의 size 비정수 분기(`@IsInt` + `Number.isInteger`)는
> 동형 분기(size 범위·양수 — SC-009·010)로 같은 size 검증 구조가 커버되며 전용 테스트는 없다
> (coverage-gap.md). 011 은 신규 GAP 으로 size 신뢰경계(R2 HEAD 교차검증 부재, Low)만 남기고, 006 의
> SEC-FIND-006-01 / SEC-FIND-006-02 / GAP-006-02 를 RESOLVED 처리한다.

---

## STALE_SC 경고

STALE_SC 검출 결과: **0건**

검출 대상: 011 git diff(`git diff cfa787c 88de003 -- apps/backend`) 변경 파일 내 테스트 SC 번호.
`file.service.spec.ts` 의 추가 테스트는 docstring·describe 에 `SEC-FIND-006-01`·`SEC-FIND-006-02`·
`GAP-006-02` 라벨과 행위 기반 `it('when_..._then_...')` 명명을 사용한다(spec.md SC 와의 매핑은 본
coverage.md·test-cases.md 가 담당). semantic mismatch 없음.
