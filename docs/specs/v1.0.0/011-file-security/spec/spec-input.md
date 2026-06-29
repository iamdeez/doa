---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive)
---

# Spec Input: 011-file-security

> 수집 일시: 2026-06-29 | 맥락: 006 보안 발견(SEC-FIND-006-01/02)·설계 공백(GAP-006-02) 후속 보강 →
> 정식 SDD 문서화

## 목차

- [수집 진행 상태](#수집-진행-상태)
- [원 요청 맥락](#원-요청-맥락)
- [질문 분석 근거](#질문-분석-근거-question-analysis-basis)
- [카테고리별 수집 내용](#카테고리별-수집-내용)

## 수집 진행 상태

| 카테고리 | 상태 | 답변 완료 항목 |
|---|---|---|
| 1. 배경 및 목적 | 완료 | [Q1, Q2, Q3] |
| 2. 사용자 & 이해관계자 | 완료 | [Q4] |
| 3. 핵심 기능 | 완료 | [Q-A~D] |
| 4. 데이터 & 입출력 | 완료 | [Q-E] |
| 5. 제약조건 | 완료 | [Q5] |
| 6. 예외 & 실패 시나리오 | 완료 | [Q6] |

## 원 요청 맥락

사용자 지시: **006 파일 보안 후속 보강** — 006-search-notification-file 의 SEC-FIND-006-01(`GET /files/:id`
소유권 미검증, 메타 IDOR)·SEC-FIND-006-02(presign contentType allowlist·크기 상한 부재)·GAP-006-02
(PENDING→UPLOADED confirm 부재)를 해소하는 패치. 메타 조회를 소유자 전용으로 막고(`getById(userId, id)`),
presign 에 이미지 MIME allowlist 를 적용하며(`ALLOWED_CONTENT_TYPES`), 업로드 확정 엔드포인트(`POST
/files/:id/confirm`)로 상태 전이·size 기록을 추가했다. 본 문서는 그 패치를 정식 SDD 포맷으로 보강하기
위한 입력 재구성이다.

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션·근거 | 채택 결과 |
|---|---|---|---|
| Q-A | 메타 조회 스코핑 | A:public/비공개 purpose 분기 / B:일괄 소유자 전용 | **B 채택**(공개 표시는 publicUrl 직접 사용 경로 — 메타 엔드포인트는 소유자 전용으로 단순화) |
| Q-B | 메타 IDOR 응답 | `403 Forbidden`(타인 소유) + `404 NotFound`(미존재) vs 일괄 404 | **403/404 분리 채택**(file.delete·notification.markRead 의 기존 소유권 패턴과 일관) |
| Q-C | presign 입력 제약 위치 | DTO `@IsIn(MIME)` / service allowlist | **service allowlist 채택**(`ALLOWED_CONTENT_TYPES` 상수 단일 권위, repo 미호출 단언 용이) |
| Q-D | 크기 상한 강제 시점 | presign 시점 / confirm 시점 | **confirm 시점 채택**(presign 시점에는 실제 크기 미상 — stub 무네트워크. confirm 에서 보고 size 를 `MAX_FILE_SIZE_BYTES` 로 검증) |
| Q-E | confirm 재호출 처리 | 멱등(no-op) / 재전이 오류 | **멱등 채택**(이미 UPLOADED 면 기존 레코드 그대로 반환 — 클라이언트 재시도 안전) |

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

Q1. 왜 만드는가?
- 006 의 파일 모듈 Low 발견 3건 해소: (1) `GET /files/:id` 소유권 미검증(메타 IDOR, SEC-FIND-006-01),
  (2) presign contentType allowlist·크기 상한 부재(SEC-FIND-006-02), (3) PENDING→UPLOADED confirm 부재
  (고아 PENDING 누적, GAP-006-02).

Q2. 현재 어떻게? (011 이전)
- `getById(id)` 가 소유권 검증 없이 메타 반환(JwtAuthGuard 만). `presign` 이 contentType 무검증 수용.
  `FileService` 에 confirm/markUploaded 메서드 없음 — presign 레코드는 항상 PENDING·size=0.

Q3. 성공 판단 기준
- 타인 메타 조회 403·미존재 404·본인 조회 정상. 비허용 MIME presign 400 + repo 미호출. confirm 으로
  PENDING→UPLOADED 전이·size 기록, 이미 UPLOADED 면 멱등, size 범위 위반 400.

### [카테고리 2] 사용자 & 이해관계자

Q4. 사용자 역할
- 파일 소유자(인증 사용자): 메타 조회·업로드 confirm 의 직접 대상. 소유권 검증의 보호 대상.
- 플랫폼 운영자: presign MIME allowlist·크기 상한 정책의 이해당사자.

### [카테고리 3] 핵심 기능

**Must:**
- `getById(userId, id)`: 미존재 404, `ownerId !== userId` 403, 본인 메타 반환.
- `presign(userId, data)`: `ALLOWED_CONTENT_TYPES`(image/jpeg·png·webp·gif) allowlist 외 → 400, repo 미호출.
- `confirm(userId, id, size)`: size 검증(정수·1..10MiB) → 미존재 404 → 타인 403 → 이미 UPLOADED 멱등 →
  PENDING 이면 `updateStatus(id, UPLOADED, size)`.
- `FileRepository.updateStatus(id, status, size)`: status·size 갱신(신규).
- `ConfirmFileDto { size: @IsInt @Min(1) }`(신규).
- `file.constants`: `ALLOWED_CONTENT_TYPES`·`MAX_FILE_SIZE_BYTES`(10MiB)(신규).

**제외(Out of Scope):**
- R2 실연동 presign Content-Type 바인딩·실제 크기 강제, confirm size 의 R2 HEAD 교차검증,
  public/비공개 purpose 분기, 고아 PENDING TTL 배치.

### [카테고리 4] 데이터 & 입출력

- `getById(userId: string, id: string): Promise<FileAsset>` — 위반 시 403/404, 정상이면 메타.
- `presign(userId, { purpose, contentType }): Promise<PresignResult>` — allowlist 외 contentType →
  `BadRequestException`(create 미호출).
- `confirm(userId: string, id: string, size: number): Promise<FileAsset>` — size 범위 위반 400,
  미존재 404, 타인 403, 이미 UPLOADED 멱등, PENDING 이면 UPLOADED+size.
- `updateStatus(id, status, size): Promise<FileAsset>` — Prisma update(status·size).
- schema 변경 없음(FileAsset.status/size 기존 컬럼 재사용). 마이그레이션 0.

### [카테고리 5] 제약조건

Q5. 기술 스택 제약
- P-002: 외부 SDK 무, `FileStoragePort`/`StubFileStorage` stub 유지(무네트워크). 신규 npm 0.
- 호환성: `getById` 시그니처 breaking(`id` → `userId, id`) — 호출 측 `FileController.getById` 단일
  갱신. `presign`·`delete` 불변. `confirm`·`updateStatus` additive.
- 스키마 무변경: FileAsset 기존 status/size 컬럼 재사용. 마이그레이션 0.

### [카테고리 6] 예외 & 실패 시나리오

Q6. 엣지 케이스
- 타인 메타 조회 → 403(SC-001). 미존재 → 404(SC-003).
- 비허용 MIME(application/pdf) presign → 400 + create 미호출(SC-004).
- confirm: 타인 403 + updateStatus 미호출(SC-006), 미존재 404(SC-007), 이미 UPLOADED 멱등(SC-008),
  size>10MiB → 400 + findById 미호출(SC-009), size=0 → 400(SC-010).
- size 비정수 → 400(`@IsInt` DTO + `Number.isInteger` service 이중 — SC-009·010 이 동형 분기 커버).
