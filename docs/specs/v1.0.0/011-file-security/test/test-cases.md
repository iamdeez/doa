---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive)
---

# Test Cases: 011-file-security

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
- [케이스 상세](#케이스-상세)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류)](#미커버-항목-사전-분류)

---

## SC × 시나리오 매트릭스

> 테스트 함수명은 실제 spec 파일의 `it('...')` 식별자 기준.
> 신규 단위 테스트: file.service.spec **8** 케이스(7→15) — presign 1(SC-004) + getById 2(SC-001·002) +
> confirm 6(SC-005~010). SC-003(getById 미존재)은 006 기존 `when_missing_then_NotFound` 가 새 시그니처로
> 유지.

| SC-ID | 수용 기준 | Happy Path | Edge Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|
| SC-001 | 타인 getById 거부 | — | `when_owned_by_other_then_Forbidden (SEC-FIND-006-01)` | file.service.spec.ts::getById | [env:unit] |
| SC-002 | 본인 getById 반환 | `when_owned_by_user_then_returns_meta` | — | 〃 | [env:unit] |
| SC-003 | 미존재 getById | — | `when_missing_then_NotFound` | 〃(006 기존 유지) | [env:unit] |
| SC-004 | 비허용 MIME presign 거부 + repo 미호출 | — | `when_contentType_not_allowed_then_BadRequest (SEC-FIND-006-02)` | file.service.spec.ts::presign | [env:unit] |
| SC-005 | PENDING confirm 전이+size | `when_owner_confirms_then_status_UPLOADED_and_size_set` | — | file.service.spec.ts::confirm (GAP-006-02) | [env:unit] |
| SC-006 | 타인 confirm 거부 + updateStatus 미호출 | — | `when_owned_by_other_then_Forbidden` | 〃 | [env:unit] |
| SC-007 | 미존재 confirm | — | `when_missing_then_NotFound` | 〃 | [env:unit] |
| SC-008 | 이미 UPLOADED 멱등 | — | `when_already_uploaded_then_idempotent_no_update` | 〃 | [env:unit] |
| SC-009 | size 상한 초과 거부 + findById 미호출 | — | `when_size_over_limit_then_BadRequest` | 〃 | [env:unit] |
| SC-010 | size 비양수 거부 | — | `when_size_not_positive_then_BadRequest` | 〃 | [env:unit] |

---

## 케이스 상세

### SC-001 (when_owned_by_other_then_Forbidden)

- 선행: `mockRepo.findById.mockResolvedValue({ id: 'file-001', ownerId: 'user-002' })`.
- 입력: `service.getById('user-001', 'file-001')`.
- 단언: `rejects.toBeInstanceOf(ForbiddenException)`(메타 IDOR 차단 — SEC-FIND-006-01).

### SC-002 (when_owned_by_user_then_returns_meta)

- 선행: `mockRepo.findById.mockResolvedValue({ id: 'file-001', ownerId: 'user-001' })`.
- 입력: `service.getById('user-001', 'file-001')`.
- 단언: `resolves.toBe(file)`(본인 소유 메타 반환).

### SC-003 (when_missing_then_NotFound)

- 선행: `mockRepo.findById.mockResolvedValue(null)`.
- 입력: `service.getById('user-001', 'file-001')`.
- 단언: `rejects.toBeInstanceOf(NotFoundException)`(006 기존 테스트가 새 시그니처로 유지).

### SC-004 (when_contentType_not_allowed_then_BadRequest)

- 입력: `service.presign('user-001', { purpose: PRODUCT_IMAGE, contentType: 'application/pdf' })`.
- 단언: `rejects.toBeInstanceOf(BadRequestException)` + `mockRepo.create` **미호출**(allowlist 외 →
  레코드 미생성, SEC-FIND-006-02).

### SC-005 (when_owner_confirms_then_status_UPLOADED_and_size_set)

- 선행: `mockRepo.findById.mockResolvedValue({ id, ownerId: 'user-001', status: PENDING })` +
  `mockRepo.updateStatus.mockResolvedValue({ id, status: UPLOADED, size: 1234 })`.
- 입력: `service.confirm('user-001', 'file-001', 1234)`.
- 단언: `expect(mockRepo.updateStatus).toHaveBeenCalledWith('file-001', FileStatus.UPLOADED, 1234)`.

### SC-006 (when_owned_by_other_then_Forbidden)

- 선행: `mockRepo.findById.mockResolvedValue({ id, ownerId: 'user-002', status: PENDING })`.
- 입력: `service.confirm('user-001', 'file-001', 100)`.
- 단언: `rejects.toBeInstanceOf(ForbiddenException)` + `mockRepo.updateStatus` **미호출**.

### SC-007 (when_missing_then_NotFound)

- 선행: `mockRepo.findById.mockResolvedValue(null)`.
- 입력: `service.confirm('user-001', 'file-001', 100)`.
- 단언: `rejects.toBeInstanceOf(NotFoundException)`.

### SC-008 (when_already_uploaded_then_idempotent_no_update)

- 선행: `mockRepo.findById.mockResolvedValue({ id, ownerId: 'user-001', status: UPLOADED })`.
- 입력: `service.confirm('user-001', 'file-001', 100)`.
- 단언: `resolves.toBe(uploaded)`(기존 레코드 그대로) + `mockRepo.updateStatus` **미호출**(멱등).

### SC-009 (when_size_over_limit_then_BadRequest)

- 입력: `service.confirm('user-001', 'file-001', MAX_FILE_SIZE_BYTES + 1)`.
- 단언: `rejects.toBeInstanceOf(BadRequestException)` + `mockRepo.findById` **미호출**(size 검증이
  DB 조회보다 먼저).

### SC-010 (when_size_not_positive_then_BadRequest)

- 입력: `service.confirm('user-001', 'file-001', 0)`.
- 단언: `rejects.toBeInstanceOf(BadRequestException)`(경계 — `size <= 0`).

---

## 외부 의존성 명시

### fixture / mock

- `mockRepo`: `create`·`findById`·`updateStatus`·`delete` jest.fn(). SC-004 는 `create` 미호출, SC-006·008
  은 `updateStatus` 미호출, SC-009 는 `findById` 미호출 단언.
- `FILE_STORAGE`: `StubFileStorage`(useClass — 결정적 URL `https://r2.stub.local/{key}`, 무네트워크).
- 상수: `MAX_FILE_SIZE_BYTES`(`file.constants`) — SC-009 의 상한+1 입력.
- enum: `FilePurpose`·`FileStatus`(`@prisma/client`).
- 식별자 상수: `USER_ID='user-001'`·`OTHER_USER_ID='user-002'`·`FILE_ID='file-001'`.

### 환경 변수

- 단위 테스트: 별도 환경 변수 불필요(전부 mock, DB 연결 없음).

### 외부 서비스

- 단위: DB·네트워크 연결 없음. 전부 mock(StubFileStorage 도 무네트워크).

---

## 미커버 항목 (사전 분류)

| 항목 | 미커버 사유 | 카테고리 | 권장 검증 방법 |
|---|---|---|---|
| confirm `size` 비정수 전용 단위 테스트 | `@IsInt`(DTO) + `Number.isInteger`(service) 이중 검증되나 비정수(예: 1.5) 전용 it() 없음. SC-009·010 의 service 범위·양수 분기가 동형 size 검증 구조 커버 | (1) 단위테스트 가능 | `when_size_not_integer_then_BadRequest` 추가 권장 |
| confirm size R2 HEAD 교차검증 e2e | 클라이언트 보고 size ↔ 실제 업로드 크기 교차검증은 stub 모델에서 불가(무네트워크). 실제 R2 전환 후속 | (2) 설계(범위 외) | R2 실연동 후 confirm 시점 객체 HEAD 교차검증 + e2e |
| `GET /files/:id` 403/404·confirm e2e | HTTP 요청 → JwtAuthGuard → service 소유권/전이의 end-to-end 통합 시나리오 없음. service 단위 테스트로 검증 갈음 | (2) 설계(범위 외) | 파일 메타 IDOR·confirm e2e(타인 403·confirm 200) 후속 보강 |
