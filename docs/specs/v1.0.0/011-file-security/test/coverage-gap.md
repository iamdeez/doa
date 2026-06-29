---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive)
---

# Coverage Gap: 011-file-security

## 목차

- [미커버 항목 목록](#미커버-항목-목록)
- [confirm size 비정수 전용 테스트 부재 (상세)](#confirm-size-비정수-전용-테스트-부재-상세)
- [confirm size 클라이언트 신뢰·R2 HEAD 교차검증 부재 (상세)](#confirm-size-클라이언트-신뢰r2-head-교차검증-부재-상세)
- [메타 IDOR·confirm 통합 e2e 부재 (상세)](#메타-idorconfirm-통합-e2e-부재-상세)
- [신규 단위 테스트 수 기록](#신규-단위-테스트-수-기록)

---

## 미커버 항목 목록

> 모든 spec.md SC(SC-001~010)는 직접 커버(PASS). 아래는 SC 로 정의되지 않았거나 동형 분기로 갈음되어
> 전용 자동 단언이 없는 항목, 또는 stub 모델 한계로 검증 대상이 없는 항목이다.

| 항목 | 미커버 시나리오 | 카테고리 | 검증 방법 | 담당 | 비고 |
|---|---|---|---|---|---|
| confirm `size` 비정수 전용 테스트 | 소수 size(예: 1.5) 거부 | (1) 단위테스트 가능 | `when_size_not_integer_then_BadRequest` 추가 | 개발 | `@IsInt`(DTO) + `Number.isInteger`(service) 이중 검증. SC-009·010(범위·양수)이 동형 size 검증 분기 커버 |
| confirm size R2 HEAD 교차검증 | 클라이언트 보고 size ↔ 실제 업로드 크기 교차검증 | (3) 기능 미구현(stub 한계) | 실제 R2 전환 시 confirm 시점 객체 HEAD 교차검증 | 후속 spec | size 는 여전히 클라이언트 신뢰 기반(gaps.md GAP-011-01). stub 무네트워크로 실제 크기 미상 |
| 메타 IDOR·confirm 통합 e2e | HTTP `GET /files/:id`(타인 403)·`POST /files/:id/confirm`(200) end-to-end | (2) 설계(범위 외) | 파일 보안 e2e(타인 메타 403·confirm 전이) | 후속 보강 | service 단위 테스트(SC-001~010)로 핵심 분기 직접 단언 |

---

## confirm size 비정수 전용 테스트 부재 (상세)

**현상**: `confirm` 의 size 검증(`!Number.isInteger(size) || size <= 0 || size > MAX_FILE_SIZE_BYTES`)
중 **비정수**(예: `1.5`) 거부를 직접 단언하는 단위 테스트가 없다.

**근본 원인 (코드 근거)**:
- size 검증은 `Number.isInteger`(비정수)·`<= 0`(비양수)·`> MAX_FILE_SIZE_BYTES`(상한)의 단일 조건식이며,
  SC-010(`size=0`, 비양수)과 SC-009(`MAX_FILE_SIZE_BYTES+1`, 상한)가 같은 조건식의 두 분기를 직접
  단언한다. DTO `@IsInt` 가 1차 방어이므로 service `Number.isInteger` 분기의 결함 위험은 낮다.

**위험도**: 낮음. DTO·service 이중 검증이며 동형 분기(SC-009·010)가 같은 조건식을 직접 검증한다.

**권장 수정 방향**: `when_size_not_integer_then_BadRequest` 단위 테스트 1건 추가(SC-010 과 동형).

---

## confirm size 클라이언트 신뢰·R2 HEAD 교차검증 부재 (상세)

**현상**: `confirm(userId, id, size)` 의 `size` 는 클라이언트가 보고하는 값이며, 서버가 실제 업로드된
객체의 바이트 수를 교차검증하지 않는다. `MAX_FILE_SIZE_BYTES`(10MiB) 상한 검증은 **클라이언트 신뢰
기반**이다.

**근본 원인 (설계 결정·stub 한계)**:
- 현재 `StubFileStorage` 는 실제 업로드를 수행하지 않는다(무네트워크 결정적 URL — P-002). 따라서 서버가
  실제 업로드 크기를 알 수 있는 경로(R2 객체 HEAD·presign content-length-range 정책)가 없다.
- 악의적 클라이언트가 실제보다 작은 size 를 보고하면 상한 검증을 우회할 수 있으나, stub 모델에서는 실제
  업로드 자체가 발생하지 않아 표면이 제한적이다.

**위험도**: 낮음(stub 모델). 실제 R2 전환 시 상승 가능 — 이관 필요.

**권장 수정 방향**: 실제 R2 전환 시 confirm 시점에 R2 객체 HEAD(또는 presign 정책의 content-length-range)
로 보고 size ↔ 실제 크기 교차검증. gaps.md GAP-011-01(Low 권고)에 기재.

---

## 메타 IDOR·confirm 통합 e2e 부재 (상세)

**현상**: `GET /files/:id` 의 타인 소유 403·미존재 404 와 `POST /files/:id/confirm` 의 PENDING→UPLOADED
전이를 HTTP 요청 → JwtAuthGuard → service 로 묶어 검증하는 end-to-end 통합 테스트가 없다.

**근본 원인 (설계 결정)**:
- 011 은 라우트·가드(JwtAuthGuard, 006 기존)를 새로 만들지 않고 기존 FileController 에 GET/confirm 을
  추가했으며, 소유권·allowlist·전이·멱등·size 분기의 핵심을 service 단위 테스트(SC-001~010)로 직접
  단언했다.

**위험도**: 낮음. 메타 IDOR 차단·confirm 전이의 핵심 로직이 단위 테스트로 직접 커버된다.

**권장 수정 방향**: 파일 보안 e2e(타인 메타 `GET /files/:id` → 403, 소유자 confirm → 200·UPLOADED)
후속 보강.

---

## 신규 단위 테스트 수 기록

011 신규 단위 테스트는 **8건**(file.service.spec 7→15)이며, 실제 spec 파일의 `it()` 를 직접 카운트하여
확정했다(자가 보고 신뢰하지 않음):

| 파일 | 011 신규 케이스 수 | 구성 |
|---|---|---|
| `file.service.spec.ts` | 8 (7→15) | presign 1(allowlist 거부) + getById 2(본인 반환·타인 403) + confirm 6(전이·타인·미존재·멱등·상한·비양수) |
| **합계** | **8** | 010 baseline 245 + 8 = 253 unit (정합) |

> `file.service.spec.ts` 는 011 에서 describe `confirm (GAP-006-02)` 신규 6건과 `presign`·`getById` 의
> 보안 케이스를 더했다(기존 getById `when_found_then_returns_meta` → `when_owned_by_user_then_returns_meta`
> 로 소유권 단언 강화 대체, `when_missing_then_NotFound` 는 새 시그니처로 유지). 신규 suite 가 아니라
> 기존 suite 확장이며, e2e+static(16/84)에는 변화가 없다(011 은 신규 e2e/static 미추가). 본 카운트는
> 추적 정확성 목적이다.
