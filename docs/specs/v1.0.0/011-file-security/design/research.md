---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive)
---

# Research: 011-file-security

## 목차

- [분석 우선순위 게이트 결과](#분석-우선순위-게이트-결과)
- [선행 발견(006) 분석](#선행-발견006-분석)
- [기존 코드베이스 분석](#기존-코드베이스-분석)
  - [클래스·모듈 계층 구조](#클래스모듈-계층-구조)
  - [영향 범위 분석 (호출 측 전수 목록)](#영향-범위-분석-호출-측-전수-목록)
- [영향 파일 목록](#영향-파일-목록)
- [public URL 모델에서 메타 스코핑](#public-url-모델에서-메타-스코핑)
- [confirm 패턴 (PENDING→UPLOADED)](#confirm-패턴-pendinguploaded)
- [size 신뢰경계 한계](#size-신뢰경계-한계)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 분석 우선순위 게이트 결과

- **변경 대상 모듈(plan §핵심 설계)**: `file`(service `getById` 소유권 + `presign` allowlist + `confirm`
  신규, repository `updateStatus` 신규, constants·dto 신규, controller GET/confirm). schema·port/stub·
  presign.dto **변경 없음**.
- §A·B·C 분석은 file.service·file.repository·file.controller 로 한정.
- §D(다단계 병렬 파이프라인): 미해당.
- §E(동일 가드 결정 통합): 해당 — `getById`·`confirm`·`delete` 가 동일 `ownerId === userId` 소유권 가드
  패턴을 공유(인가 표면은 JwtAuthGuard 기존, service 레벨 소유권 일관화).
- 외부 라이브러리 검증(§4): **신규 라이브러리 0건**. 기존 `@nestjs/common` 예외·`class-validator`
  (`@IsInt`·`@Min`)·Prisma 만.
- §F(production 시그니처 변경): **해당** — `FileService.getById(id)` → `getById(userId, id)` breaking
  변경. 호출 측 전수(`FileController.getById` 1건) 갱신. `presign`·`delete` 불변, `confirm`·`updateStatus`
  additive.

---

## 선행 발견(006) 분석

> 006-search-notification-file 의 Low 발견 3건(파일 모듈) — 011 이 해결 대상.

| 항목 | 006 상태 (취약/공백) | 코드 근거 |
|---|---|---|
| 메타 IDOR (SEC-FIND-006-01) | `getById(id)` 가 소유권 검증 없이 메타(`key`·`url`·`ownerId`·`contentType`) 반환. `GET /files/:id` 는 `JwtAuthGuard` 만 | `file.service.ts`(006) `getById`·`file.controller.ts` |
| presign 입력 무검증 (SEC-FIND-006-02) | `presign` 이 클라이언트 `contentType` 무검증 수용(MIME allowlist 부재), 크기 상한 없음, `size=0` placeholder | `file.service.ts`(006) `presign`·`dto/presign.dto.ts` |
| confirm 부재 (GAP-006-02) | `FileService` 에 `presign`·`getById`·`delete` 만 — PENDING→UPLOADED 전이·size 기록 경로 없음 | `file.service.ts`(006), `schema.prisma` `FileAsset.status`/`size` |

**메타 IDOR 경로(006)**: 인증 사용자 A 가 임의 파일 id 로 `GET /files/:id` 호출 → 소유권 검증 부재 →
타인(B) 소유 파일 메타(key·url·ownerId) 획득. 006 시점 public URL 모델에서는 Low 였으나 메타 스코핑
부재 자체가 표면.

**고아 PENDING 경로(006)**: presign 으로 `status=PENDING`·`size=0` 레코드 생성 후 클라이언트가 presigned
URL 로 PUT 업로드해도 서버에 완료를 알릴 경로가 없어 PENDING 레코드가 영구 잔존(누적).

---

## 기존 코드베이스 분석

> context.md §2 핵심 모듈 목록을 기준선. 본 절은 변경 대상 한정 정밀 분석.

### 클래스·모듈 계층 구조

- **OOP 상속/추상 클래스 없음**: 변경 대상은 NestJS `@Injectable()` concrete 클래스(`FileService`·
  `FileRepository`·`FileController`). `FileStoragePort` 는 인터페이스(stub `StubFileStorage` 구현 — 변경 없음).
- **모듈 DI 토폴로지(실측)**: `FileService` 생성자 — `FileRepository`, `FILE_STORAGE`(StubFileStorage,
  006 기존). 011 은 새 DI 의존을 추가하지 않는다.
- **import 추가**: `ForbiddenException`·`BadRequestException`(`@nestjs/common`) — `getById`·`presign`·
  `confirm` 의 소유권·allowlist·size 검증용. `NotFoundException` 은 006 기존. 신규 패키지 아님.
- **constants·dto 신규 파일**: `file.constants.ts`(상수), `dto/confirm-file.dto.ts`(`@IsInt`·`@Min`,
  class-validator 기존).

### 영향 범위 분석 (호출 측 전수 목록)

- **`FileService.getById`(breaking 시그니처)**: 호출 측은 `FileController.getById` 1건. `@CurrentUser()
  .userId` 를 주입하여 `getById(user.userId, id)` 로 호출하도록 함께 갱신. grep 으로 `getById(` 잔여
  참조 0건(컨트롤러 외 호출 없음) 확인.
- **`FileService.presign`(내부 변경)**: 외부 시그니처 불변. 호출 측(`FileController.presign`) 변경 없이
  동작. 정상(허용 MIME) presign 은 allowlist 통과 후 기존과 동일.
- **`FileService.confirm`(신규)·`FileRepository.updateStatus`(신규)**: additive. 외부 호출 측 0(신규
  추가). `confirm` 은 `FileController.confirm`(신규 라우트)에서만 호출.
- **`FileService.delete`(불변)**: 011 변경 없음. 기존 소유권 패턴 유지(`getById`·`confirm` 과 동형).

---

## 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 | 레이어 |
|---|---|---|---|
| `src/modules/file/file.service.ts` | 수정 | `getById(userId, id)` 소유권(403/404) + `presign` MIME allowlist + `confirm` 신규(+ `ForbiddenException`·`BadRequestException` import) | B |
| `src/modules/file/file.constants.ts` | 신규 | `ALLOWED_CONTENT_TYPES`·`MAX_FILE_SIZE_BYTES` | B |
| `src/modules/file/dto/confirm-file.dto.ts` | 신규 | `ConfirmFileDto { size }` | A |
| `src/modules/file/file.repository.ts` | 수정 | `updateStatus(id, status, size)` 신규 | A |
| `src/modules/file/file.controller.ts` | 수정 | `GET /files/:id`(userId 주입) + `POST /files/:id/confirm` 신규 | C |
| `src/modules/file/file.service.spec.ts` | 수정(확장) | allowlist 거부·getById 소유권 403·confirm 6건(SC-001~010) — +8(7→15) | D |

> `prisma/schema.prisma`·`package.json`·`file-storage.port.ts`·`stub-file-storage.ts`·`dto/presign.dto.ts`
> 변경 0건.

---

## public URL 모델에서 메타 스코핑

- 006 의 파일 모델은 **public URL 모델**이다 — `presign` 이 `publicUrl`(`https://r2.stub.local/{key}`)
  을 반환하고, 도메인(상품·리뷰)은 이 URL 을 레코드에 저장해 **직접** 표시한다. 즉 공개 이미지 표시는
  메타 엔드포인트(`GET /files/:id`)를 거치지 않는다.
- 따라서 메타 엔드포인트를 **소유자 전용**으로 막아도 공개 이미지 표시 기능은 영향이 없다. 006
  security-report 가 제안한 "공개/비공개 purpose 분기"(권고-001) 대신, 011 은 메타 엔드포인트를 일괄
  소유자 전용으로 단순화했다(공개 표시는 publicUrl 직접 사용 — 메타 노출 표면 제거가 분기보다 단순·안전).
- `getById`·`confirm`·`delete` 가 동일 `ownerId === userId` 소유권 가드를 공유하여 file 자원 접근 일관성
  확보(notification.markRead 의 userId 소유권 패턴과도 동형).

---

## confirm 패턴 (PENDING→UPLOADED)

- 006 security-report 권고-002·GAP-006-02 가 제안한 `POST /files/:id/confirm` 패턴을 채택.
- **상태 머신**: `FileStatus` enum(PENDING/UPLOADED, 006 기존). presign → PENDING(size=0), confirm →
  UPLOADED(size=보고값). 전이는 단방향(PENDING→UPLOADED)이며 confirm 이 유일 전이 경로.
- **멱등성**: 이미 UPLOADED 인 레코드에 confirm 재호출 시 `updateStatus` 미호출·기존 레코드 반환. 클라이언트
  네트워크 재시도·중복 호출에 안전(ADR-004). 최초 기록 size 보존.
- **검증 순서**: size 범위 → findById → 소유권 → 멱등 → updateStatus. size 검증을 DB 조회보다 먼저 수행해
  잘못된 입력을 DB 부하 없이 차단(SC-009 findById 미호출 단언이 이 순서 고정).

---

## size 신뢰경계 한계

- confirm 의 `size` 는 **클라이언트가 보고하는 값**이다. 현재 `StubFileStorage` 는 실제 업로드를 수행하지
  않으므로(무네트워크 결정적 URL), 서버가 실제 업로드 바이트 수를 알 수 있는 경로가 없다. 따라서
  `MAX_FILE_SIZE_BYTES` 상한 검증은 클라이언트 신뢰 기반이며, 악의적 클라이언트가 실제보다 작은 size 를
  보고하면 상한 검증을 우회할 수 있다.
- **완화/이관**: 실제 R2 전환 시 confirm 시점에 R2 객체 HEAD(또는 presign 정책의 content-length-range)
  로 보고 size ↔ 실제 업로드 크기를 교차검증해야 한다. 011 은 stub 모델에서 가능한 service 레벨 정수·
  범위 검증까지 수행하고, 실제 크기 강제는 R2 실연동 후속으로 이관한다(범위 외 — gaps.md GAP-011-01,
  coverage-gap.md).

---

## 엣지 케이스 및 한계

- **getById 미존재 vs 타인 소유 순서**: `findById` 후 null → 404, 그다음 `ownerId !== userId` → 403.
  미존재가 소유권 판정보다 먼저(SC-003·001 분리 단언).
- **presign allowlist 경계**: `ALLOWED_CONTENT_TYPES` 는 이미지 4종(jpeg·png·webp·gif). 그 외(예:
  application/pdf·text/html)는 400 + create 미호출(SC-004). 현재 purpose(상품·리뷰·프로필)는 모두
  이미지이므로 allowlist 가 정합.
- **confirm size 비정수**: `Number.isInteger(size)` 가 false → 400. `@IsInt`(DTO)가 1차, service 가
  2차 방어. 전용 SC 는 없으나 SC-009·010 의 service 범위·양수 분기가 동형 size 검증 구조를 커버
  (coverage-gap.md).
- **confirm size 경계**: `size <= 0` 거부(SC-010, 0 경계), `size > MAX_FILE_SIZE_BYTES` 거부(SC-009,
  10MiB+1 경계). 정확히 `MAX_FILE_SIZE_BYTES`(10MiB)는 통과(`>` 만 거부).
- **size 신뢰경계(한계)**: confirm 보고 size 의 실제 업로드 크기 교차검증 부재(위 §size 신뢰경계 — Low
  잔여, 범위 외).

가정-실제 불일치 현재 미발견.
