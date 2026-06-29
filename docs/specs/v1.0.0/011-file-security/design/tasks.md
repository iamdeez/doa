---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive — 전 태스크 구현 완료)
---

# Tasks: 011-file-security

> Branch: 011-file-security | Date: 2026-06-29 | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [Test Authoring Contract](#test-authoring-contract)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목 해소(미결 사항: 없음)
- [x] plan.md Constitution Gates(P-001~P-007) 통과(예외 0건)
- [x] CHANGES.md 의 이전 작업(010-coupon-discount-validation) "후속 작업 시 주의사항" 확인
- [x] DB Design Agent 비활성(스키마 변경 0 — FileAsset 기존 status/size 컬럼 재사용, 마이그레이션 불필요)

> A = 데이터(repository·dto), B = 도메인(service·constants), C = 인터페이스(controller), D = 테스트(5a).
> 레이어 A→B→C→D 의존 순.

---

## 태스크 목록

> 레이어: A 데이터 / B 도메인 / C 인터페이스 / D 테스트(5a).

### Step 1. 상수·DTO·repository (A·B 기반)

- [x] **T001** — `file.constants.ts` 신규(`ALLOWED_CONTENT_TYPES`·`MAX_FILE_SIZE_BYTES`)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/file/file.constants.ts`
  - 관련 요구사항: FR-002, FR-003
  - 상세: `ALLOWED_CONTENT_TYPES = ['image/jpeg','image/png','image/webp','image/gif'] as const`,
    `MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024`.
  - 완료 기준: presign·confirm 이 import 하여 검증에 사용.

- [x] **T002** — `ConfirmFileDto` 신규
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/file/dto/confirm-file.dto.ts`
  - 관련 요구사항: FR-003, NFR-004
  - 상세: `class ConfirmFileDto { @IsInt() @Min(1) size!: number }`(class-validator 기존).
  - 완료 기준: `POST /files/:id/confirm` body 검증 계약.

- [x] **T003** — `FileRepository.updateStatus` 신규
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/file/file.repository.ts`
  - 관련 요구사항: FR-003
  - 상세: `updateStatus(id, status: FileStatus, size: number)` — `prisma.tx.fileAsset.update({ where:{id}, data:{ status, size } })`. files.files 전용(P-001).
  - 완료 기준: confirm 의 PENDING→UPLOADED 전이에서 호출.

### Step 2. service 보안·전이 로직 (B — 핵심)

- [x] **T004** — `getById(userId, id)` 소유권 검증
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/file/file.service.ts`
  - 관련 요구사항: FR-001
  - 상세: 시그니처 `getById(id)` → `getById(userId, id)`. `findById → null` → 404, `ownerId !== userId` → 403, 본인 → 메타 반환. `ForbiddenException` import 추가.
  - 완료 기준: 메타 IDOR(SEC-FIND-006-01) 차단. 호출 측(controller) 갱신, 잔여 참조 0.

- [x] **T005** — `presign` MIME allowlist 검증
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/file/file.service.ts`
  - 관련 요구사항: FR-002
  - 상세: `presign` 진입부에서 `ALLOWED_CONTENT_TYPES.includes(data.contentType)` false → `BadRequestException`(create 이전, repo 미호출). `BadRequestException` import 추가.
  - 완료 기준: 비허용 MIME → 400 + `fileRepository.create` 미호출(SEC-FIND-006-02).

- [x] **T006** — `confirm(userId, id, size)` 신규
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/file/file.service.ts`
  - 관련 요구사항: FR-003
  - 상세: size 검증(`!Number.isInteger || <=0 || > MAX_FILE_SIZE_BYTES` → 400, findById 이전) → `findById → null` 404 → `ownerId !== userId` 403 → `status===UPLOADED` 멱등 반환 → `updateStatus(id, UPLOADED, size)`.
  - 완료 기준: PENDING→UPLOADED 전이 + size 기록, 멱등, size 범위 위반 400(GAP-006-02).

### Step 3. controller 라우트 (C)

- [x] **T007** — `GET /files/:id`(소유자 전용) + `POST /files/:id/confirm` 신규
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/file/file.controller.ts`
  - 관련 요구사항: FR-001, FR-003
  - 상세: `getById(@CurrentUser() user, @Param('id') id)` → `fileService.getById(user.userId, id)`. `confirm(@CurrentUser() user, @Param('id') id, @Body() dto: ConfirmFileDto)` → `fileService.confirm(user.userId, id, dto.size)`(@Post(':id/confirm')). FileController 는 기존 `@UseGuards(JwtAuthGuard)`.
  - 완료 기준: 두 라우트 인증·소유자 전용 동작.

### Step 4. 테스트 (D 레이어 — 5a Test Agent AUTHORING)

> 본 Step 은 **5a Test Agent(AUTHORING)** 가 작성(TDD Red). 아래 [Test Authoring Contract](#test-authoring-contract) 가 입력.

- [x] **T008** — 보안·confirm 단위 테스트 (`file.service.spec.ts` 확장) — SC-001~010 (+8, 7→15)
  - describe `presign` 신규 1건: `when_contentType_not_allowed_then_BadRequest (SEC-FIND-006-02)`(SC-004)
  - describe `getById` 신규 2건: `when_owned_by_user_then_returns_meta`(SC-002), `when_owned_by_other_then_Forbidden (SEC-FIND-006-01)`(SC-001) — 기존 `when_missing_then_NotFound`(SC-003) 유지
  - describe `confirm (GAP-006-02)` 신규 6건: `when_owner_confirms_then_status_UPLOADED_and_size_set`(SC-005), `when_owned_by_other_then_Forbidden`(SC-006), `when_missing_then_NotFound`(SC-007), `when_already_uploaded_then_idempotent_no_update`(SC-008), `when_size_over_limit_then_BadRequest`(SC-009), `when_size_not_positive_then_BadRequest`(SC-010)

---

## Test Authoring Contract

> **5a Test Agent(AUTHORING) 입력 contract**. production canonical 심볼 명시(추측 단언 금지).

### Production canonical 심볼

| 심볼 | canonical 형태 |
|---|---|
| `FileService` | `presign(userId, { purpose, contentType })`·`getById(userId, id)`·`confirm(userId, id, size)`·`delete(userId, id)` |
| `FileRepository`(mock) | `create(data)`·`findById(id)`·`updateStatus(id, status, size)`·`delete(id)` |
| `FILE_STORAGE` | `StubFileStorage`(useClass — 결정적 URL, 무네트워크) |
| 예외 | `BadRequestException`(MIME allowlist·size 범위)·`ForbiddenException`(소유권)·`NotFoundException`(미존재) — `@nestjs/common` |
| 상수 | `MAX_FILE_SIZE_BYTES`(`file.constants`) — size 상한 단언 입력 |
| enum | `FilePurpose`·`FileStatus`(`@prisma/client`) |

### mock 재현 규약

- **presign allowlist(1건)**: `service.presign('user-001', { purpose: PRODUCT_IMAGE, contentType: 'application/pdf' })` → `rejects.toBeInstanceOf(BadRequestException)` + `expect(mockRepo.create).not.toHaveBeenCalled()`.
- **getById 소유권(2건)**: `mockRepo.findById.mockResolvedValue({ id, ownerId })` → 본인(`ownerId===userId`) `resolves.toBe(file)`, 타인 `rejects.toBeInstanceOf(ForbiddenException)`.
- **confirm(6건)**: `mockRepo.findById.mockResolvedValue({ id, ownerId, status })` + `mockRepo.updateStatus.mockResolvedValue(...)`. PENDING+owner → `expect(mockRepo.updateStatus).toHaveBeenCalledWith(FILE_ID, FileStatus.UPLOADED, 1234)`. 타인 → Forbidden + `updateStatus` 미호출. UPLOADED → `resolves.toBe(uploaded)` + `updateStatus` 미호출. size>limit → BadRequest + `findById` 미호출. size=0 → BadRequest.

### SC → 테스트 매핑

| SC-ID | 수용 기준 | 테스트 파일·describe | 비고 |
|---|---|---|---|
| SC-001 | 타인 getById 거부 | file.service.spec.ts::getById (1) | [env:unit] |
| SC-002 | 본인 getById 반환 | 〃 (1) | [env:unit] |
| SC-003 | 미존재 getById | 〃 (1) | [env:unit] (기존 유지) |
| SC-004 | 비허용 MIME presign 거부 + repo 미호출 | file.service.spec.ts::presign (1) | [env:unit] |
| SC-005 | PENDING confirm 전이+size | file.service.spec.ts::confirm (GAP-006-02) (1) | [env:unit] |
| SC-006 | 타인 confirm 거부 + updateStatus 미호출 | 〃 (1) | [env:unit] |
| SC-007 | 미존재 confirm | 〃 (1) | [env:unit] |
| SC-008 | 이미 UPLOADED 멱등 | 〃 (1) | [env:unit] |
| SC-009 | size 상한 초과 거부 + findById 미호출 | 〃 (1) | [env:unit] |
| SC-010 | size 비양수 거부 | 〃 (1) | [env:unit] |

---

## 구현 완료 기준

- [x] 모든 A·B·C 태스크 체크박스 완료(4단계), D 태스크 완료(5a)
- [x] `pnpm --filter backend test` 전체 PASSED — 001~010 회귀 0 + 011 신규 SC `[TypeScript/NestJS]`
- [x] `tsc --noEmit` 0 error
- [x] `getById(` breaking 시그니처 잔여 참조 0(controller 1건만 갱신)
- [x] schema·마이그레이션 변경 0(FileAsset 기존 status/size 재사용)
- [x] `package.json` 신규 의존 0. AWS SDK 0
- [x] git status 의도치 않은 파일 없음
