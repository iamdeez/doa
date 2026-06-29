---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive)
---

# 테스트 실행 결과 — 011-file-security

## 목차

- [실행 요약](#실행-요약)
- [실패 목록](#실패-목록)
- [SC 매핑표 검증](#sc-매핑표-검증)
- [설계 문서 정합성](#설계-문서-정합성)
- [회귀 탐지](#회귀-탐지)

---

## 실행 요약

> 본 retroactive 검증은 011 완료 커밋 `88de003`(base `cfa787c`)에서 main session 이 게이트를 직접
> 재실행·코드리뷰하여 확인했다. 신규 단위 테스트 개수는 실제 spec 파일의 `it()` 를 직접 카운트했다(추측 금지).

| 항목 | 결과 (HEAD `88de003`) |
|---|---|
| 실행 일시 | 2026-06-29 20:39 |
| tsc `--noEmit` | **EXIT 0** |
| Unit 테스트 (apps/backend, rootDir: src) | **253 PASS** / 0 FAIL / 25 suites |
| e2e + Static 테스트 (apps/backend, test/) | **84 PASS** / 0 FAIL / 16 suites |
| 전체 통과 여부 | **PASS** |
| 001~010 회귀 여부 | **없음** |
| 011 신규 단위 테스트 | **8** (file.service.spec 7→15 — presign 1 + getById 2 + confirm 6) |
| 마이그레이션 | **없음** (스키마 무변경) |

### 010 → 011 델타

| 항목 | 010 완료(`cfa787c`) | 011 완료(`88de003`) | 델타 |
|---|---|---|---|
| Unit suites / PASS | 25 / 245 | 25 / 253 | **+8 PASS** (presign 1 + getById 2 + confirm 6) / suites 무변 |
| e2e + static suites / PASS | 16 / 84 | 16 / 84 | 변화 없음 |

> **신규 단위 8 산정(직접 카운트)**: `file.service.spec.ts` 의 011 추가분 — describe `presign` 1
> (`when_contentType_not_allowed_then_BadRequest`) + describe `getById` 2(`when_owned_by_user_then_returns_meta`·
> `when_owned_by_other_then_Forbidden`) + describe `confirm (GAP-006-02)` 6 = 8(7→15). 245 + 8 = 253 정합.
> base `cfa787c` 는 010 SDD 문서 커밋(코드 무변경)이므로 010 코드 완료(`2664da3`)와 동일한 245 unit 이다.

### 실행 커맨드

```bash
cd /Users/krystal/workspace/doa/doa-next/apps/backend
npx tsc --noEmit -p tsconfig.json                                              # EXIT 0
npx jest --testPathPattern="src/"                                              # 25 suites / 253 PASS
npx jest --config ./test/jest-e2e.json                                         # 16 suites / 84 PASS
```

---

## 실패 목록

**실패 없음.** tsc EXIT 0, unit 253 + e2e/static 84 = 전체 PASS.

---

## SC 매핑표 검증

| SC-ID | 관련 테스트 | 통과 여부 |
|---|---|---|
| SC-001 | file.service.spec.ts: when_owned_by_other_then_Forbidden (getById) | PASS |
| SC-002 | file.service.spec.ts: when_owned_by_user_then_returns_meta | PASS |
| SC-003 | file.service.spec.ts: when_missing_then_NotFound (getById) | PASS |
| SC-004 | file.service.spec.ts: when_contentType_not_allowed_then_BadRequest | PASS |
| SC-005 | file.service.spec.ts: when_owner_confirms_then_status_UPLOADED_and_size_set | PASS |
| SC-006 | file.service.spec.ts: when_owned_by_other_then_Forbidden (confirm) | PASS |
| SC-007 | file.service.spec.ts: when_missing_then_NotFound (confirm) | PASS |
| SC-008 | file.service.spec.ts: when_already_uploaded_then_idempotent_no_update | PASS |
| SC-009 | file.service.spec.ts: when_size_over_limit_then_BadRequest | PASS |
| SC-010 | file.service.spec.ts: when_size_not_positive_then_BadRequest | PASS |

---

## 설계 문서 정합성

### plan.md 현행화 점검

- 메타 소유권 — `getById(userId, id)` 가 `findById → null` 404, `ownerId !== userId` 403, 본인 메타 반환 — plan.md ADR-001·FR-001 과 일치 ✓
- presign allowlist — `presign` 진입부에서 `ALLOWED_CONTENT_TYPES.includes(contentType)` false → `BadRequestException`(create 이전) — plan.md ADR-002·FR-002 와 일치 ✓
- confirm 전이 — size 검증(findById 이전) → 404 → 403 → UPLOADED 멱등 → `updateStatus(id, UPLOADED, size)` — plan.md §핵심 설계 3·ADR-003·004·FR-003 과 일치 ✓
- 상수 — `ALLOWED_CONTENT_TYPES`(이미지 4종)·`MAX_FILE_SIZE_BYTES`(10MiB) — plan.md 인터페이스 계약과 일치 ✓
- repository — `updateStatus(id, status, size)` files.files 전용 — plan.md FR-003·P-001 과 일치 ✓
- DTO — `ConfirmFileDto { @IsInt @Min(1) size }` — plan.md ADR-005·NFR-004 와 일치 ✓
- 스키마 — schema.prisma·마이그레이션 변경 0(FileAsset 기존 status/size 재사용) — plan.md 데이터 모델과 일치 ✓

### 발견된 한계·관찰

- **confirm size 비정수 전용 테스트 부재**: `@IsInt` + `Number.isInteger` 이중 검증이나 전용 it() 없음
  (동형 분기 SC-009·010 으로 커버). coverage-gap.md 기록. 신규 GAP 아님.
- **confirm size 클라이언트 신뢰경계**: 보고 size 의 실제 업로드 크기 교차검증 부재(stub 한계). gaps.md
  GAP-011-01(Low 권고). 실제 R2 전환 후속.
- **메타 IDOR·confirm e2e 부재**: service 단위 검증으로 갈음. coverage-gap.md 기록. 신규 GAP 아님.

### 001~010 회귀 확인

- file.service.spec.ts: 011 의 `getById` breaking 시그니처는 호출 측(FileController) 단일 갱신으로
  처리되어 기존 file 테스트(presign happy·키 형식·delete 소유권)가 전부 PASS → 회귀 0. `presign` allowlist 는
  정상(허용 MIME) 경로를 변형하지 않는다.
- 기타 모듈(search/notification/order/coupon/banner/stats/admin/review/shipping/settlement 등): 011
  미변경, 전체 PASS.

---

## 회귀 탐지

011 이 추가/변경한 파일 (`git diff cfa787c 88de003 -- apps/backend` 기준):
- `src/modules/file/file.service.ts`: `getById(userId, id)` 소유권 + `presign` allowlist + `confirm` 신규 (+38 -2)
- `src/modules/file/file.constants.ts`: `ALLOWED_CONTENT_TYPES`·`MAX_FILE_SIZE_BYTES` (신규 +12)
- `src/modules/file/dto/confirm-file.dto.ts`: `ConfirmFileDto` (신규 +9)
- `src/modules/file/file.repository.ts`: `updateStatus` (+12)
- `src/modules/file/file.controller.ts`: GET /files/:id(소유자 전용) + POST /files/:id/confirm (+14 -3)
- `src/modules/file/file.service.spec.ts`: presign 1 + getById 2 + confirm 6 (+89 -3)

010 baseline(245 unit) 대비 011 신규 8 → 253 unit (회귀 0). e2e+static 16 suites/84 PASS, 전체
PASS·회귀 0 을 확인했다. 마이그레이션 없음(스키마 무변경).
