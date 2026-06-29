---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive)
---

# Plan: 011-file-security

> Branch: 011-file-security | Date: 2026-06-29 | Spec: [../spec/spec.md](../spec/spec.md)

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [사전 영향도 분석 결과](#사전-영향도-분석-결과)
- [핵심 설계](#핵심-설계)
- [결정 기록 (ADRs)](#결정-기록-adrs)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> `constitution.md`(P-001~P-007) 존재 → 해당 조항을 Gates 로 사용한다(constitution 우선). spec.md NFR
> (NFR-001~004)은 P-002 외부 의존 추상화·보안 IDOR 차단을 구체화하며 충돌(완화) 없음.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: file 모듈이 자기 소유 스키마(files.files) 외 타 도메인 모델을 직접 참조하지 않음]
  → PASS. `getById`·`presign`·`confirm` 은 `FileRepository`(files.files 전용) 만 경유한다. `ownerId` 는 cross-schema plain String(users.users.id 참조하나 FK 미선언) — 타 도메인 모델 직접 참조 없음.
- [x] **P-002 AWS 의존 금지 / 외부 의존 추상화 원칙**: [Pass 기준: `@aws-sdk/*` 및 신규 npm 의존 0건, R2 stub 유지]
  → PASS. 신규 npm 의존 0건(`package.json` 변경 없음). `FileStoragePort`/`StubFileStorage`(무네트워크 결정적 URL) 불변. `BadRequestException`·`ForbiddenException`·`NotFoundException`(`@nestjs/common`, 기존)·`class-validator`(`@IsInt`·`@Min`, 기존)만 사용.
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 외부 저장소 0건]
  → PASS. DB 스키마·마이그레이션 변경 0. FileAsset 기존 `status`·`size` 컬럼 재사용(`updateStatus`).
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: 클라우드 전용 API 결합 0건]
  → PASS. 순수 service 레벨 검증·상태 전이 로직. 클라우드 전용 API 0(R2 는 여전히 stub 추상화).
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: 금전 수치 Decimal]
  → PASS(해당 없음). file 모듈에 금전 필드 없음. `size` 는 byte 정수(금전 아님) — Decimal 대상 아님.
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건]
  → PASS. FR-001 은 SC-001~003, FR-002 는 SC-004, FR-003 은 SC-005~010(단위). NFR-002 는 회귀 0 으로 충족.
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건]
  → PASS. 변경 범위 = file.service(getById 소유권 + presign allowlist + confirm 신규)·file.controller(GET/confirm)·file.repository(updateStatus)·file.constants(신규)·dto/confirm-file.dto(신규)·file.service.spec(+8). 전부 FR-001~003 추적 가능. schema·마이그레이션 무변경. 범위 외 리팩토링 0.

> **예외 사항**: 없음. P-001~P-007 전부 통과(예외 0건).

> **Gates 판정**: P-001~P-007 전부 통과(예외 0건). Design Agent(3단계) 진입 가능.

---

## 기술 컨텍스트

> 006 의 확정 스택을 재확정. 011 고유 변경만 명시.

- **언어 / 런타임**: TypeScript 5.4 / Node.js 20.x. pnpm + Turborepo.
- **백엔드 프레임워크**: NestJS 11.x. file 모듈 4계층(controller·service·repository·port/stub).
- **ORM / DB**: Prisma `^6.19.0` multiSchema + PostgreSQL 16. **DB 스키마·마이그레이션 변경 0** —
  FileAsset 의 기존 `status`(FileStatus enum: PENDING/UPLOADED)·`size`(Int) 컬럼(006 정의) 재사용.
- **인증**: `JwtAuthGuard` + `@CurrentUser()`(006 기존 공유 모듈). 소유권 검증은 service 레벨
  (`ownerId === userId`).
- **예외 타입**: `BadRequestException`(MIME allowlist·size 범위)·`ForbiddenException`(소유권)·
  `NotFoundException`(미존재) — 전부 `@nestjs/common` 기존.
- **입력 검증**: `class-validator`(`@IsInt`·`@Min(1)`, 기존) — `ConfirmFileDto.size`. 상한(10MiB)은
  service `MAX_FILE_SIZE_BYTES` 상수.
- **테스트 프레임워크**: Jest(`*.spec.ts`, src rootDir). 단위([env:unit] — SC-001~010).
- **환경변수**: 신규 0. **신규 의존성**: 0건.

---

## 사전 영향도 분석 결과

> 상세는 [../design/research.md](../design/research.md) 참조. 본 절은 영향 파일 요약.

### 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 | 레이어 |
|---|---|---|---|
| `src/modules/file/file.service.ts` | 수정 | `getById(userId, id)` 소유권 검증(403/404) + `presign` MIME allowlist + `confirm` 신규(size 검증·멱등·전이) | B |
| `src/modules/file/file.constants.ts` | 신규 | `ALLOWED_CONTENT_TYPES`(이미지 4종)·`MAX_FILE_SIZE_BYTES`(10MiB) | B |
| `src/modules/file/dto/confirm-file.dto.ts` | 신규 | `ConfirmFileDto { size: @IsInt @Min(1) }` | A(입력 계약) |
| `src/modules/file/file.repository.ts` | 수정 | `updateStatus(id, status, size)` 신규 | A |
| `src/modules/file/file.controller.ts` | 수정 | `GET /files/:id`(소유자 전용, userId 주입) + `POST /files/:id/confirm` 신규 | C |
| `src/modules/file/file.service.spec.ts` | 수정(확장) | allowlist 거부·getById 소유권·confirm 6건(SC-001~010) — +8(7→15) | D |

> `prisma/schema.prisma`·`package.json`·`file-storage.port.ts`·`stub-file-storage.ts`·`dto/presign.dto.ts`
> 변경 0건.

---

## 핵심 설계

### 1. 메타 조회 소유자 전용 (FR-001 — IDOR 차단)

```
getById(userId, id):
  file = fileRepository.findById(id)
  if !file:                  throw 404 NotFound        # 미존재
  if file.ownerId !== userId: throw 403 Forbidden       # 타인 소유 (메타 IDOR 차단)
  return file
```

- `FileController.getById` 가 `@CurrentUser().userId` 를 주입하여 호출(시그니처 breaking — `getById(id)`
  → `getById(userId, id)`). `delete` 의 기존 소유권 패턴과 동형.

### 2. presign MIME allowlist (FR-002 — 업로드 입력 제약)

```
presign(userId, { purpose, contentType }):
  if contentType not in ALLOWED_CONTENT_TYPES:  throw 400 BadRequest   # repo 미호출
  key = {purpose}/{userId}/{uuid}
  { uploadUrl, publicUrl } = storage.getPresignedUploadUrl(key, contentType)
  file = fileRepository.create({ ownerId, purpose, key, url, contentType, size: 0, status: PENDING })
  return { id, key, uploadUrl, url }
```

- `ALLOWED_CONTENT_TYPES = [image/jpeg, image/png, image/webp, image/gif]`. allowlist 검증이 `create`
  **이전**에 수행되어 비허용 MIME 은 레코드를 남기지 않는다(SC-004 의 create 미호출 단언).

### 3. 업로드 confirm (FR-003 — 상태 전이·size 기록)

```
confirm(userId, id, size):
  if !Number.isInteger(size) || size <= 0 || size > MAX_FILE_SIZE_BYTES:  throw 400  # findById 미호출
  file = fileRepository.findById(id)
  if !file:                  throw 404 NotFound
  if file.ownerId !== userId: throw 403 Forbidden                          # updateStatus 미호출
  if file.status === UPLOADED: return file                                 # 멱등 (no-op)
  return fileRepository.updateStatus(id, UPLOADED, size)
```

- size 검증을 **가장 먼저** 수행(잘못된 size 는 DB 조회 전 차단 — SC-009 의 findById 미호출). 소유권
  검증 후 멱등 분기. `updateStatus` 는 PENDING→UPLOADED 단일 전이에만 호출.

---

## 결정 기록 (ADRs)

| ADR-ID | 결정 항목 | 채택안 | 대안(검토했으나 미채택) | 근거(spec FR/NFR) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | 메타 조회 스코핑 | 일괄 소유자 전용(`getById(userId, id)`) | public/비공개 purpose 분기 | FR-001, NFR-001 (공개 표시는 publicUrl 직접 사용 — 메타 엔드포인트 단순화) | file.service·file.controller |
| ADR-002 | presign 입력 제약 위치 | service `ALLOWED_CONTENT_TYPES` allowlist | DTO `@IsIn(MIME)` | FR-002 (상수 단일 권위·repo 미호출 단언 용이) | file.service·file.constants |
| ADR-003 | 크기 상한 강제 시점 | confirm 단계 `MAX_FILE_SIZE_BYTES` | presign 시점 | FR-003, NFR-004 (presign 시점엔 실제 크기 미상 — stub 무네트워크) | file.service |
| ADR-004 | confirm 재호출 | 멱등(이미 UPLOADED 면 no-op 반환) | 재전이 오류(409) | FR-003 (클라이언트 재시도 안전) | file.service |
| ADR-005 | size 검증 다층 | DTO `@IsInt @Min(1)` + service 정수·1..10MiB 재검증 | DTO 단독 | NFR-004 (상한은 정책 상수 — service 권위) | dto/confirm-file.dto·file.service |

---

## 인터페이스 계약

### 011 신규/변경 인터페이스

```ts
// FileService.getById — 시그니처 breaking: (id) → (userId, id), 소유권 검증 추가
getById(userId: string, id: string): Promise<FileAsset>;   // 미존재 404, ownerId!==userId 403

// FileService.presign — 시그니처 불변, contentType allowlist 검증 추가(내부)
presign(userId: string, data: { purpose: FilePurpose; contentType: string }): Promise<PresignResult>;
// allowlist 외 contentType → BadRequestException (fileRepository.create 미호출)

// FileService.confirm — 신규(additive)
confirm(userId: string, id: string, size: number): Promise<FileAsset>;
// size 범위 위반 400, 미존재 404, 타인 403, 이미 UPLOADED 멱등, PENDING→UPLOADED+size

// FileRepository.updateStatus — 신규(additive)
updateStatus(id: string, status: FileStatus, size: number): Promise<FileAsset>;

// ConfirmFileDto — 신규
class ConfirmFileDto { @IsInt() @Min(1) size!: number; }

// 상수(신규)
ALLOWED_CONTENT_TYPES = ['image/jpeg','image/png','image/webp','image/gif'] as const;
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;   // 10MiB
```

### 하위 호환성 / 방어 코드

- **`getById` breaking 시그니처**: 호출 측은 `FileController.getById` 단일 지점이며 `@CurrentUser().userId`
  주입으로 함께 갱신. grep 으로 `getById(` 호출 잔여 참조 0건 확인(컨트롤러 1건만).
- **`presign`·`delete` 외부 시그니처 불변**: 정상(허용 MIME·소유자) 경로 기존 동작 회귀 0.
- **`FileStoragePort` 불변**: `getPresignedUploadUrl`·`getPublicUrl` 시그니처·stub 구현 변경 0(P-002).
- **`confirm`·`updateStatus` additive**: 신규이므로 기존 호출 측 영향 0. confirm 의 멱등 분기가 클라이언트
  중복 호출에 대한 방어.

---

## 데이터 모델

> 상세는 [../db-design/data-model.md](../db-design/data-model.md) 참조.

**스키마 변경 없음.** FileAsset 의 기존 `status`(FileStatus enum: PENDING/UPLOADED)·`size`(Int) 컬럼
(006 정의)을 재사용한다. `confirm` 은 `updateStatus` 로 이 두 기존 컬럼을 갱신할 뿐 신규 테이블·컬럼·
enum·인덱스·마이그레이션을 만들지 않는다. 011 은 service·repository 레벨 로직만 변경하며 DB 형상에는
영향이 없다.

---

## 테스트 전략

### SC↔테스트 매핑 (요약)

| SC 식별자 | 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | 단위 | Edge | 타인 소유 getById 거부 | ownerId=user-002, 호출 user-001 | ForbiddenException |
| SC-002 | 단위 | Happy | 본인 소유 getById 반환 | ownerId=user-001 | 파일 메타 반환 |
| SC-003 | 단위 | Edge | 미존재 getById | findById→null | NotFoundException |
| SC-004 | 단위 | Edge | 비허용 MIME presign 거부 + repo 미호출 | contentType=application/pdf | BadRequestException, create 미호출 |
| SC-005 | 단위 | Happy | PENDING confirm 전이+size | status=PENDING, size=1234 | updateStatus(id, UPLOADED, 1234) |
| SC-006 | 단위 | Edge | 타인 confirm 거부 + updateStatus 미호출 | ownerId=user-002 | ForbiddenException, updateStatus 미호출 |
| SC-007 | 단위 | Edge | 미존재 confirm | findById→null | NotFoundException |
| SC-008 | 단위 | Edge | 이미 UPLOADED 멱등 | status=UPLOADED | 입력 레코드 반환, updateStatus 미호출 |
| SC-009 | 단위 | Edge(경계) | size 상한 초과 거부 + findById 미호출 | size=MAX_FILE_SIZE_BYTES+1 | BadRequestException, findById 미호출 |
| SC-010 | 단위 | Edge(경계) | size 비양수 거부 | size=0 | BadRequestException |

### smoke_tests

- 필요 여부: N. 011 은 006 의 기존 file 모듈에 소유권 검증·MIME allowlist·confirm 을 추가하는 패치이며
  신규 모듈·AppModule 와이어링·스키마 변경이 없다(라우트는 기존 FileController 에 GET/POST 추가). 단위
  테스트(mock)로 소유권·allowlist·전이·멱등·size 분기를 직접 단언한다. 006 의 기존 e2e 부팅(file 1건
  포함)은 회귀 0 으로 유지된다.

---

## 기타 고려사항

- **메타 엔드포인트 vs 공개 표시 경로 분리**: 메타 조회(`GET /files/:id`)를 소유자 전용으로 막아도
  상품·리뷰 이미지의 **공개 표시**는 영향받지 않는다 — 공개 표시는 presign 응답·도메인 레코드에 저장된
  `publicUrl` 을 직접 사용하는 경로이지 메타 엔드포인트를 거치지 않는다. 따라서 일괄 소유자 전용 단순화가
  공개 이미지 기능을 깨지 않는다(ADR-001).
- **size 신뢰경계(한계)**: confirm 의 `size` 는 클라이언트가 보고하는 값이며 서버가 실제 업로드 크기를
  교차검증하지 않는다(stub 모델 — R2 객체 HEAD 미연동). 따라서 size 상한 검증은 **클라이언트 신뢰 기반**
  이다. 실제 R2 전환 시 객체 HEAD 로 보고 size ↔ 실제 크기 교차검증이 필요하다(범위 외, gaps.md·
  coverage-gap.md 기록).
- **size 검증 순서**: confirm 이 size 범위 검증을 DB 조회(`findById`)보다 **먼저** 수행하므로, 잘못된
  size 요청은 DB 부하 없이 즉시 400 으로 차단된다(SC-009 의 findById 미호출 단언이 이 순서를 고정).
- **멱등성의 부작용 방어**: 이미 UPLOADED 인 파일에 다른 size 로 confirm 을 재호출해도 `updateStatus` 가
  호출되지 않아 최초 기록 size 가 보존된다(ADR-004). 재시도·중복 클라이언트 호출에 안전.
