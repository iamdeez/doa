---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (구현 완료 — retroactive 문서화)
---

# Spec: 011-file-security

> Branch: 011-file-security | Date: 2026-06-29 | Version: v1.0.0
>
> 본 문서는 이미 구현·검증이 완료된 코드(커밋 `88de003`, base `cfa787c`)를 근거로 정식 SDD
> 포맷으로 retroactive 작성되었다. 모든 요구사항·수용 기준은 실제 구현된 `file` 모듈의 파일 보안
> 보강 코드(`FileService.getById` 소유권 검증·`presign` MIME allowlist·`confirm` 신규 + `file.constants`
> ·`ConfirmFileDto` ·`FileRepository.updateStatus`)와 단위 테스트(`file.service.spec.ts` 7→15, +8)에서
> 확인한 사실을 기준으로 한다.

## 목차

- [배경 및 목적](#배경-및-목적)
- [선행 spec 영향 추적](#선행-spec-영향-추적)
- [사용자 스토리](#사용자-스토리)
- [기능 요구사항](#기능-요구사항)
- [비기능 요구사항](#비기능-요구사항)
- [수용 기준](#수용-기준)
- [요구사항 구조화 매트릭스](#요구사항-구조화-매트릭스)
- [해결된 선행 보안 발견·공백](#해결된-선행-보안-발견공백)
- [범위 외](#범위-외)
- [미결 사항](#미결-사항)

---

## 배경 및 목적

006-search-notification-file 의 보안 감사·설계 공백 점검에서 `file` 모듈에 대해 세 건의 Low 등급
발견이 식별되었다.

1. **SEC-FIND-006-01 (Low, A01)**: `GET /files/:id` 가 소유권 검증 없이 `JwtAuthGuard` 만 적용되어,
   임의 인증 사용자가 타인 소유 파일의 메타(`key`·`url`·`ownerId`·`contentType`)를 조회할 수 있었다
   (메타 IDOR). 006 시점에는 모든 파일이 public URL 모델이라 메타 노출이 모델과 정합하여 Low 로
   분류되었으나, 비공개 purpose 도입 시 정보 노출로 이어질 수 있는 메타 스코핑 부재였다.
2. **SEC-FIND-006-02 (Low, A04)**: `presign` 이 클라이언트 `contentType` 을 무검증 수용하고(허용 MIME
   allowlist 부재) 파일 크기 상한이 없어, 실제 R2 전환 시 임의 content-type·과대 파일 업로드 표면이
   되었다(`PresignDto` 는 `purpose`·`contentType` 형식만 검증).
3. **GAP-006-02 (Low, 기능 공백)**: presign 으로 생성된 `FileAsset` 은 항상 `status=PENDING`·`size=0`
   이며 이를 `UPLOADED` 로 전이하거나 실제 size 를 기록하는 경로가 없어, 고아 PENDING 레코드가 누적될
   수 있었다.

011 은 이 세 발견을 **파일 메타 소유자 전용 조회(IDOR 차단) + presign MIME allowlist(업로드 입력 제약)
+ 업로드 confirm(상태 전이·size 기록)** 으로 해소한다. `getById` 가 소유권 검증으로 메타 IDOR 를
차단하고, `presign` 이 이미지 4종 allowlist 외 contentType 을 400 으로 거부하며, 신규 `POST /files/:id/
confirm` 이 소유자의 업로드 완료를 PENDING→UPLOADED 로 전이(멱등)하면서 실제 size 를 검증·기록한다.
크기 상한은 confirm 단계에서 `MAX_FILE_SIZE_BYTES`(10MiB)로 강제한다.

> 단순화 결정: public/비공개 purpose 를 구분하는 대신 메타 엔드포인트(`GET /files/:id`)를 **일괄 소유자
> 전용**으로 단순화했다. 상품·리뷰 이미지의 공개 표시는 `publicUrl` 직접 사용 경로이며, 메타 조회
> 엔드포인트는 소유자만 접근한다.

---

## 선행 spec 영향 추적

| 선행 spec | 식별된 연동 항목 | 인지 시점 | 식별 경로 |
|---|---|---|---|
| v1.0.0/006-search-notification-file | `GET /files/:id` 소유권 미검증(SEC-FIND-006-01, Low — 메타 IDOR). 011 이 `getById(userId, id)` 소유권 검증(403/404)으로 해결. | 2026-06-29 | file.service.ts·file.controller.ts |
| v1.0.0/006-search-notification-file | presign contentType allowlist·크기 상한 부재(SEC-FIND-006-02, Low). 011 이 presign MIME allowlist(이미지 4종, 400 거부) + confirm 단계 size 상한(10MiB)으로 해결. | 2026-06-29 | file.service.ts·file.constants.ts |
| v1.0.0/006-search-notification-file | 파일 PENDING→UPLOADED 확정(confirm) 부재(GAP-006-02, Low — 고아 PENDING 누적). 011 이 `POST /files/:id/confirm`(소유자 전용, 멱등, size 검증)으로 해결. | 2026-06-29 | file.service.ts·file.repository.ts·file.controller.ts |

---

## 사용자 스토리

- **US-001**: 파일 소유자로서, 내 파일의 메타를 나만 조회할 수 있어, 타인이 임의 파일 id 열거로 내
  파일 메타(key·url·ownerId)를 획득하지 못하기를 원한다.
- **US-002**: 플랫폼 운영자로서, presign 단계에서 허용된 이미지 MIME 만 수용되어, 비허용 콘텐츠 타입의
  업로드 표면이 차단되기를 원한다.
- **US-003**: 파일 소유자로서, presigned URL 업로드 완료 후 서버에 업로드를 확정(confirm)하여 파일이
  UPLOADED 로 전이되고 실제 크기가 기록되며, 고아 PENDING 레코드가 누적되지 않기를 원한다.

---

## 기능 요구사항

- **FR-001**: `FileService.getById(userId, id)` 가 파일 메타 조회를 **소유자 전용**으로 강제한다 —
  미존재 → `404 NotFound`, `file.ownerId !== userId` → `403 Forbidden`, 본인 소유 → 메타 반환.
  `GET /files/:id`(JwtAuthGuard) 가 인증 사용자 id 로 호출하여 메타 IDOR(SEC-FIND-006-01)를 차단한다.

- **FR-002**: `FileService.presign(userId, data)` 가 `data.contentType` 을 `ALLOWED_CONTENT_TYPES`
  (`image/jpeg`·`image/png`·`image/webp`·`image/gif`) allowlist 로 검증한다 — allowlist 외 contentType →
  `400 BadRequest`, 이 경우 `fileRepository.create` 는 호출되지 않는다(레코드 미생성). 허용 MIME 만
  presign 진행(SEC-FIND-006-02).

- **FR-003**: 신규 `FileService.confirm(userId, id, size)` 가 소유자의 업로드 완료를 확정한다 —
  (a) `size` 가 정수 아님·`size <= 0`·`size > MAX_FILE_SIZE_BYTES`(10MiB) → `400 BadRequest`(이 경우
  `fileRepository.findById` 미호출), (b) 미존재 → `404 NotFound`, (c) `file.ownerId !== userId` →
  `403 Forbidden`(이 경우 `updateStatus` 미호출), (d) `file.status === UPLOADED` → 멱등(no-op, 기존
  레코드 그대로 반환·`updateStatus` 미호출), (e) PENDING → `FileRepository.updateStatus(id, UPLOADED,
  size)` 로 상태 전이 + size 기록. `POST /files/:id/confirm`(JwtAuthGuard) 가 진입점이다(GAP-006-02).

---

## 비기능 요구사항

- **NFR-001** (보안 / IDOR 차단): 파일 자원의 소유권 검증을 메타 조회(`getById`)에도 확장하여,
  notification.markRead·file.delete 와 동일한 `ownerId === userId` 소유권 패턴(403/404)을 일관 적용한다.
  메타 IDOR 표면을 제거한다.

- **NFR-002** (호환성 / breaking 시그니처 변경): `FileService.getById` 시그니처가 `getById(id)` →
  `getById(userId, id)` 로 변경된다. 호출 측은 `FileController.getById`(인증 사용자 id 주입) 단일
  지점이며 함께 갱신된다. `presign`·`delete` 외부 시그니처는 불변이고, `confirm`·`updateStatus` 는
  순수 additive 신규다. 정상(소유자·허용 MIME) 경로의 기존 동작은 회귀 0 으로 유지된다.

- **NFR-003** (외부 의존 무·stub 유지 / P-002): 011 은 신규 npm 의존을 0건 추가한다. `BadRequestException`
  ·`ForbiddenException`·`NotFoundException`(`@nestjs/common`, 기존)·`class-validator`(`@IsInt`·`@Min`,
  기존)만 사용하고, `FileStoragePort`/`StubFileStorage` 추상화(무네트워크 결정적 URL)를 변경하지 않는다.

- **NFR-004** (입력 검증 다층화): confirm 의 size 검증은 DTO 레벨(`ConfirmFileDto` `@IsInt`·`@Min(1)`)과
  service 레벨(`MAX_FILE_SIZE_BYTES` 상한·정수·양수 재검증)에서 이중으로 수행한다. 상한(10MiB)은 타입
  조건과 무관한 정책 상수이므로 service 가 단일 권위로 강제한다.

---

## 수용 기준

> **환경 태그 규약**:
> | 태그 | 의미 |
> |---|---|
> | `[env:unit]` | 단위 테스트(mock)로 판정 가능 |

- **SC-001** (`FR-001` 관련): 타인 소유 파일을 `getById` 로 조회하면 `403 Forbidden` 이 발생한다 —
  `ownerId=user-002`, 호출자 `user-001` → ForbiddenException. [env:unit]

- **SC-002** (`FR-001` 관련): 본인 소유 파일을 `getById` 로 조회하면 메타가 반환된다 —
  `ownerId=user-001`, 호출자 `user-001` → 파일 메타 반환. [env:unit]

- **SC-003** (`FR-001` 관련): 미존재 파일을 `getById` 로 조회하면 `404 NotFound` 가 발생한다 —
  `findById → null` → NotFoundException. [env:unit]

- **SC-004** (`FR-002` 관련): allowlist 외 contentType 으로 presign 하면 `400 BadRequest` 가 발생하고
  `fileRepository.create` 는 호출되지 않는다 — `contentType=application/pdf` → BadRequestException,
  create 미호출. [env:unit]

- **SC-005** (`FR-003` 관련): 소유자가 PENDING 파일을 confirm 하면 `UPLOADED` 로 전이되고 size 가
  기록된다 — `status=PENDING`·size=1234 → `updateStatus(id, UPLOADED, 1234)` 호출. [env:unit]

- **SC-006** (`FR-003` 관련): 타인 소유 파일을 confirm 하면 `403 Forbidden` 이 발생하고 `updateStatus`
  는 호출되지 않는다 — `ownerId=user-002`, 호출자 `user-001` → ForbiddenException, updateStatus 미호출.
  [env:unit]

- **SC-007** (`FR-003` 관련): 미존재 파일을 confirm 하면 `404 NotFound` 가 발생한다 —
  `findById → null` → NotFoundException. [env:unit]

- **SC-008** (`FR-003` 관련): 이미 UPLOADED 인 파일을 confirm 하면 멱등(no-op)으로 기존 레코드를 그대로
  반환하고 `updateStatus` 는 호출되지 않는다 — `status=UPLOADED` → 입력 레코드 반환, updateStatus 미호출.
  [env:unit]

- **SC-009** (`FR-003` 관련): size 가 상한(`MAX_FILE_SIZE_BYTES`)을 초과하면 `400 BadRequest` 가
  발생하고 `findById` 는 호출되지 않는다 — `size=MAX_FILE_SIZE_BYTES+1` → BadRequestException,
  findById 미호출. [env:unit]

- **SC-010** (`FR-003` 관련): size 가 양수가 아니면(`size <= 0`) `400 BadRequest` 가 발생한다 —
  `size=0` → BadRequestException. [env:unit]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건.
> MoSCoW: Must / Should / Could / Won't

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-001 | FR-001 | NFR-001, NFR-002 | SC-001, SC-002, SC-003 | unit | Must |
| US-002 | FR-002 | NFR-003 | SC-004 | unit | Must |
| US-003 | FR-003 | NFR-002, NFR-004 | SC-005, SC-006, SC-007, SC-008, SC-009, SC-010 | unit | Must |

> 모든 FR(FR-001~003)이 SC 로 직접 커버되며, 매핑 누락 0건이다. NFR-002(호환성·breaking 시그니처)는
> `getById(userId, id)` 호출 측 단일 갱신 + 기존 단위 테스트 회귀 0(전체 PASS)으로 충족하며 별도 신규
> SC 없음(부재가 곧 상태). confirm 의 size 비정수 분기(FR-003 (a) 일부)는 `@IsInt`(DTO) + `Number.isInteger`
> (service) 이중 검증으로 구현되며, SC-009·010 의 service 상한·양수 경계가 동형 size 검증 분기를
> 커버한다(coverage-gap.md 기록).

---

## 해결된 선행 보안 발견·공백

| 식별자 | 선행 spec | 등급 | 011 해결 내용 | 상태 |
|---|---|---|---|---|
| SEC-FIND-006-01 | 006-search-notification-file | Low | `getById(userId, id)` 소유권 검증 — `ownerId !== userId → 403`, 미존재 → 404. 메타 IDOR 차단(FR-001, SC-001~003) | **RESOLVED (011, 커밋 88de003)** |
| SEC-FIND-006-02 | 006-search-notification-file | Low | `presign` 이 `ALLOWED_CONTENT_TYPES`(이미지 4종) allowlist 검증 — 외 contentType → 400, repo 미호출. 크기 상한은 confirm 단계 `MAX_FILE_SIZE_BYTES`(10MiB)(FR-002·003, SC-004·009) | **RESOLVED (011, 커밋 88de003)** |
| GAP-006-02 | 006-search-notification-file | Low | `POST /files/:id/confirm`(소유자 전용) — PENDING→UPLOADED 전이 + size 기록, 이미 UPLOADED 면 멱등, size 범위 위반 400. 고아 PENDING 해소 경로 확보(FR-003, SC-005~010) | **RESOLVED (011, 커밋 88de003)** |

> 006 의 GAP-006-03(SEC-FIND-006-01 교차기재)·GAP-006-04(SEC-FIND-006-02 교차기재)도 동일 사안으로
> 본 spec 에서 RESOLVED(011) 처리된다. 006-search-notification-file/security/security-report.md·gaps.md·
> test/coverage-gap.md 의 해당 항목 상태가 갱신된다.

---

## 범위 외

- **R2 실연동 시 presign 시점 Content-Type 바인딩·실제 업로드 크기 강제**: 현재 `StubFileStorage`
  (무네트워크)에서는 presign 시점에 content-type·content-length 를 presigned URL 에 바인딩하지 않는다.
  실제 R2 전환 시 presign 정책으로 content-type 바인딩·크기 강제를 이관하는 변경은 본 spec 범위 외다.
- **confirm size 의 R2 HEAD 교차검증**: confirm 에 클라이언트가 보고하는 `size` 는 여전히 **신뢰 기반**
  이다. 실제 R2 객체 HEAD 로 보고 size 와 실제 업로드 크기를 교차검증하는 것은 R2 실연동 후속이며 본
  spec 범위 외다(coverage-gap.md·gaps.md 기록).
- **public/비공개 purpose 구분**: 메타 엔드포인트를 purpose 별로 공개/비공개 분기하는 대신 일괄 소유자
  전용으로 단순화했다. 상품·리뷰 이미지의 공개 표시는 `publicUrl` 직접 사용 경로이며 메타 엔드포인트
  분기는 본 spec 에서 다루지 않는다.
- **고아 PENDING TTL 배치 정리**: confirm 으로 정상 전이 경로는 확보했으나, confirm 되지 않은 채 잔존
  하는 PENDING 레코드의 TTL 기반 배치 정리 정책은 본 spec 범위 외다(운영 정책 후속).

---

## 미결 사항

없음 — 본 spec 은 구현 완료 코드를 기준으로 retroactive 작성되었으며, 모든 요구사항·수용 기준이 실제
구현과 대조 확인되었다. 011 은 size 신뢰경계(R2 HEAD 교차검증 부재)를 Low 등급 잔여 권고로 남기되
(gaps.md), 006 의 SEC-FIND-006-01 / SEC-FIND-006-02 / GAP-006-02 를 RESOLVED 처리한다.
