---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive)
---

# Diff: 011-file-security

## 목차

- [커밋 메시지용 한 줄 요약](#커밋-메시지용-한-줄-요약)
- [변경 요약](#변경-요약)
- [변경 파일 및 라인 수](#변경-파일-및-라인-수)
- [Diff](#diff)

## 커밋 메시지용 한 줄 요약

- **KO**: 011 파일 보안 보강 — 메타 소유자 전용 조회 + presign MIME allowlist + 업로드 confirm (SEC-FIND-006-01/02, GAP-006-02)
- **EN**: 011 file security hardening — owner-scoped meta read, presign MIME allowlist, upload confirm (SEC-FIND-006-01/02, GAP-006-02)

## 변경 요약

- **file.service — 메타 소유자 전용(SEC-FIND-006-01)**: `getById` 시그니처를 `(id)` → `(userId, id)` 로
  변경하고 소유권 검증 추가 — `findById → null` 404, `file.ownerId !== userId` → 403 ForbiddenException,
  본인 소유만 메타 반환. 메타 IDOR 차단. `ForbiddenException` import 추가.
- **file.service — presign MIME allowlist(SEC-FIND-006-02)**: `presign` 진입부에서 `ALLOWED_CONTENT_TYPES`
  (image/jpeg·png·webp·gif) allowlist 검증 — 외 contentType → 400 BadRequest(create 이전, repo 미호출).
  `BadRequestException` import 추가.
- **file.service — 업로드 confirm(GAP-006-02)**: `confirm(userId, id, size)` 신규 — size 검증
  (`!Number.isInteger || <=0 || > MAX_FILE_SIZE_BYTES` → 400, findById 이전) → 미존재 404 → 타인 403 →
  이미 UPLOADED 멱등(no-op 반환) → PENDING 이면 `updateStatus(id, UPLOADED, size)`. 고아 PENDING 해소 경로.
- **file.constants(신규)**: `ALLOWED_CONTENT_TYPES`(이미지 4종)·`MAX_FILE_SIZE_BYTES`(10MiB).
- **dto/confirm-file.dto(신규)**: `ConfirmFileDto { @IsInt @Min(1) size }`.
- **file.repository**: `updateStatus(id, status, size)` 신규(files.files 전용 — `fileAsset.update`).
- **file.controller**: `GET /files/:id`(소유자 전용 — `@CurrentUser().userId` 주입) + `POST /files/:id/confirm`
  (신규 라우트). FileController 기존 `@UseGuards(JwtAuthGuard)`.
- **테스트**: file.service.spec 에 8건 추가(7→15) — presign 1(allowlist 거부) + getById 2(본인 반환·
  타인 403) + confirm 6(전이·타인·미존재·멱등·상한·비양수).
- **해결**: SEC-FIND-006-01(메타 IDOR, Low) / SEC-FIND-006-02(presign 입력 무검증, Low) / GAP-006-02
  (confirm 부재, Low) 완전 해결. schema·마이그레이션 변경 0(FileAsset 기존 status/size 재사용).

## 변경 파일 및 라인 수

> 범위: `apps/backend`. base `cfa787c`(010 SDD 문서 커밋) → `88de003`(011 완료). `git diff --numstat` 직접 카운트.

| 파일 | 추가 | 삭제 |
|---|---|---|
| `apps/backend/src/modules/file/file.service.ts` | +38 | -2 |
| `apps/backend/src/modules/file/file.service.spec.ts` | +89 | -3 |
| `apps/backend/src/modules/file/file.controller.ts` | +14 | -3 |
| `apps/backend/src/modules/file/file.repository.ts` | +12 | -0 |
| `apps/backend/src/modules/file/file.constants.ts` (신규) | +12 | -0 |
| `apps/backend/src/modules/file/dto/confirm-file.dto.ts` (신규) | +9 | -0 |

**합계 (apps/backend)**: 6 files changed, 174 insertions(+), 8 deletions(-).

> 본 011 SDD 문서 세트(`docs/specs/v1.0.0/011-file-security/**`) 와 `CHANGES.md` 의 011 항목, 그리고
> 006 문서의 SEC-FIND-006-01/02 / GAP-006-02·03·04 상태 갱신은 `88de003` 코드 커밋 **이후** retroactive
> 로 별도 추가되었다(코드 diff 범위 외).

## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 이며 전체 캡처는 중복·비효율이다.
> 변경 내용은 위 "변경 요약" · "변경 파일 및 라인 수" 절로 추적하고, 라인 단위 diff 가 필요하면 아래로 재생성한다:
>
> ```bash
> git diff cfa787c 88de003 -- apps/backend   # base commit: cfa787c
> ```
