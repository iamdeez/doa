---
작성: Security Agent
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive)
---

# 보안 감사 결과 — 011-file-security

## 목차

- [검토 범위](#검토-범위)
- [요약](#요약)
- [SEC-FIND-006-01 / SEC-FIND-006-02 해결 검증](#sec-find-006-01--sec-find-006-02-해결-검증)
- [Constitution 보안 조항 이행 현황](#constitution-보안-조항-이행-현황)
- [NFR 보안 요구사항 이행 현황](#nfr-보안-요구사항-이행-현황)
- [OWASP Top 10 점검 결과](#owasp-top-10-점검-결과)
- [긍정 확인 사항](#긍정-확인-사항)
- [권고사항](#권고사항)

---

## 검토 범위

### 검토 대상 파일 (DIFF-011-file-security.md 기반)

| 파일 | 검토 이유 |
|---|---|
| `file/file.service.ts` | `getById` 소유권 검증(IDOR 차단)·`presign` MIME allowlist·`confirm` size/소유권/멱등 |
| `file/file.constants.ts` | `ALLOWED_CONTENT_TYPES`(MIME allowlist)·`MAX_FILE_SIZE_BYTES`(크기 상한) |
| `file/dto/confirm-file.dto.ts` | confirm 입력 검증(`@IsInt`·`@Min(1)`) |
| `file/file.repository.ts` | `updateStatus` cross-schema 격리(P-001) |
| `file/file.controller.ts` | `GET /files/:id`(소유자 전용)·`POST /files/:id/confirm` 인증·라우팅 |
| `file/file.service.spec.ts` | 소유권·allowlist·confirm 단위 테스트(SC-001~010) |

### 제외 파일 및 사유

- `file/file-storage.port.ts`·`file/stub-file-storage.ts` — 011 변경 없음(P-002 stub 추상화 불변)
- `file/dto/presign.dto.ts` — 011 변경 없음(MIME allowlist 는 service 레벨 `ALLOWED_CONTENT_TYPES` 로 적용)
- `prisma/schema.prisma` — 011 변경 없음(FileAsset 기존 status/size 재사용)

---

## 요약

| 항목 | 내용 |
|---|---|
| 검토 대상 파일 수 | 6개 |
| Critical 건수 | 0 |
| High 건수 | 0 |
| Medium 건수 | 0 |
| Low 건수 | 0 (잔여 size 신뢰경계는 권고사항으로 기록 — gaps.md GAP-011-01) |
| 전체 취약점 건수 | 0 |
| 판정 | **COMPLETE** — Critical/High/Medium/Low 0건. 본 spec 의 목적인 SEC-FIND-006-01·SEC-FIND-006-02(006, Low) 를 RESOLVED 로 검증 확정 |

---

## SEC-FIND-006-01 / SEC-FIND-006-02 해결 검증

> 006-search-notification-file 의 Low 발견 2건 — 파일 메타 IDOR·presign 입력 무검증. 011 이 해결 대상.

| 식별자 | 006 상태 (취약) | 011 해결 (코드 근거) | 판정 |
|---|---|---|---|
| SEC-FIND-006-01 (A01 메타 IDOR) | `getById(id)` 가 소유권 검증 없이 메타(`key`·`url`·`ownerId`·`contentType`) 반환. `GET /files/:id` 는 JwtAuthGuard 만 — 인증 사용자가 타인 파일 메타 조회 가능 | `getById(userId, id)` 가 `findById → null` 404, `file.ownerId !== userId` → 403 ForbiddenException. `FileController.getById` 가 `@CurrentUser().userId` 주입. 메타 엔드포인트 소유자 전용(공개 표시는 publicUrl 직접 사용) | RESOLVED |
| SEC-FIND-006-02 (A04 입력 무검증) | `presign` 이 클라이언트 `contentType` 무검증 수용(allowlist 부재), 크기 상한 없음 | `presign` 이 `ALLOWED_CONTENT_TYPES`(image/jpeg·png·webp·gif) allowlist 검증 — 외 contentType → 400 BadRequest(create 이전, repo 미호출). 크기 상한은 confirm 단계 `MAX_FILE_SIZE_BYTES`(10MiB) | RESOLVED |
| 메타 IDOR 경로(A01) | 인증 사용자 A → 임의 file id → 타인(B) 메타 획득 | 소유권 검증으로 타인 메타 조회 시 403 — 메타 IDOR 표면 제거 | 완전 차단 |
| 업로드 입력 표면(A04) | 임의 content-type·과대 파일 presign 표면 | allowlist(MIME) + confirm 단계 size 상한(10MiB)으로 비허용 MIME·과대 size 거부 | 차단(신뢰경계 한계 잔존 — 아래) |

**판정**: SEC-FIND-006-01 → **RESOLVED (011, 커밋 88de003)**(`getById` 소유권 검증). SEC-FIND-006-02 →
**RESOLVED (011, 커밋 88de003)**(presign MIME allowlist + confirm size 상한). 추가로 GAP-006-02(confirm
부재)도 `POST /files/:id/confirm` 으로 해결되어 고아 PENDING 누적 경로가 해소되었다. 006
security-report.md(SEC-FIND-006-01·02)·gaps.md(GAP-006-02·03·04)·test/coverage-gap.md 의 해당 항목
상태가 RESOLVED(011)로 갱신된다.

> **size 신뢰경계 잔존(Low 권고, 범위 외)**: confirm 의 `size` 는 클라이언트 보고값이며 서버가 실제
> 업로드 크기를 교차검증하지 않는다(stub 무네트워크 — 실제 R2 미연동). `MAX_FILE_SIZE_BYTES` 상한은
> 클라이언트 신뢰 기반이다. 실제 R2 전환 시 객체 HEAD 교차검증이 필요하다(gaps.md GAP-011-01,
> coverage-gap.md). 현재 stub 모델에서 실제 업로드가 발생하지 않아 실질 위험은 낮다.

---

## Constitution 보안 조항 이행 현황

| 조항 | 이행 여부 | 비고 |
|---|---|---|
| P-001 (모듈 경계 원칙) | 이행 | `getById`·`confirm`·`updateStatus` 는 `FileRepository`(files.files 전용)만 경유. `ownerId` 는 cross-schema plain String. 타 도메인 모델 직접 참조 없음 |
| P-002 (외부 의존 추상화) | 이행 | 신규 npm 의존 0. `FileStoragePort`/`StubFileStorage`(무네트워크) 불변. `@nestjs/common` 예외·`class-validator`(기존)만 |
| P-005 (결제·정산 정합성) | 해당 없음 | file 모듈 금전 필드 0. `size` 는 byte 정수(금전 아님) |

---

## NFR 보안 요구사항 이행 현황

| ID | 요구사항 | 이행 여부 | 비고 |
|---|---|---|---|
| NFR-001 | 자원 소유권(IDOR 차단) — 메타 조회 확장 | 이행 | `getById`·`confirm` 에 `ownerId === userId` 소유권 검증(403/404). file.delete·notification.markRead 와 동형 패턴. 메타 IDOR 표면 제거 |
| NFR-002 | 호환성(breaking 시그니처 회귀 0) | 이행 | `getById(userId, id)` 호출 측 단일 갱신(controller). presign·delete 불변. 회귀 0(전체 PASS) |
| NFR-003 | 외부 의존 무·stub 유지(P-002) | 이행 | 신규 npm 0. AWS SDK 0. stub 추상화 불변 |
| NFR-004 | 입력 검증 다층화 | 이행 | confirm size 가 DTO(`@IsInt`·`@Min(1)`) + service(`Number.isInteger`·1..10MiB) 이중 검증. 상한은 service 단일 권위 |

---

## OWASP Top 10 점검 결과

| OWASP | 항목 | 점검 결과 | 근거 |
|---|---|---|---|
| A01 | 접근 제어 취약점 | **해결** | `getById` 메타 IDOR(SEC-FIND-006-01)를 소유권 검증(403/404)으로 차단. `confirm` 도 소유자 전용. delete 의 기존 소유권 패턴과 일관 |
| A03 | 인젝션 | 양호 | Prisma 파라미터화 쿼리만(`update where:{id}`). raw SQL 미사용 |
| A04 | 안전하지 않은 설계 | **해결** | presign contentType allowlist(SEC-FIND-006-02) + confirm size 상한으로 업로드 입력 제약. 상태 전이(PENDING→UPLOADED) 멱등 설계 |
| A05 | 보안 설정 오류 | 양호 | FileController 전역 `@UseGuards(JwtAuthGuard)`. 전역 ValidationPipe(ConfirmFileDto 검증) |
| A06 | 취약한 컴포넌트 | 양호 | 기존 검증 라이브러리(class-validator·Prisma·@nestjs/common) 재사용. 신규 패키지 0 |
| A08 | 소프트웨어 무결성 | 양호 | confirm 멱등(최초 size 보존). presign 키 `randomUUID()`·`key @unique`(006). size 신뢰경계는 R2 후속 |

---

## 긍정 확인 사항

| 항목 | 확인 내용 |
|---|---|
| **메타 IDOR 차단** | `getById(userId, id)` 가 `ownerId !== userId` 시 403, 미존재 404. 임의 file id 열거로 타인 메타(key·url·ownerId) 획득 불가. 메타 엔드포인트 소유자 전용(공개 표시는 publicUrl 직접 사용 경로 — 분리) |
| **업로드 입력 allowlist** | presign 이 `ALLOWED_CONTENT_TYPES`(이미지 4종) 외 contentType 을 400 으로 거부하고 레코드를 생성하지 않음(create 미호출). 비허용 MIME 업로드 표면 제거 |
| **confirm 멱등·검증 순서** | size 검증을 DB 조회 전 수행(잘못된 size 는 DB 부하 없이 차단). 이미 UPLOADED 면 멱등(no-op, 최초 size 보존) — 재시도·중복 호출 안전 |
| **소유권 가드 일관성** | `getById`·`confirm`·`delete` 가 동일 `ownerId === userId` 소유권 패턴 공유. notification.markRead 의 userId 소유권과도 동형 |
| **비파괴·additive 변경** | schema·마이그레이션 무변경. `confirm`·`updateStatus`·constants·dto 는 신규(additive), `getById` breaking 은 호출 측 단일 갱신. P-002 stub 불변 |

---

## 권고사항

### 일반 권고 (Informational)

- **confirm size R2 HEAD 교차검증(GAP-011-01, Low)**: confirm 의 `size` 는 클라이언트 신뢰 기반이다.
  실제 R2 전환 시 confirm 시점에 R2 객체 HEAD(또는 presign content-length-range 정책)로 보고 size ↔
  실제 업로드 크기를 교차검증하여 신뢰경계를 좁히길 권장한다(현재 stub 모델에서 실질 위험 낮음).
- **presign 시점 Content-Type 바인딩(실제 R2)**: 현재 allowlist 는 presign 입력 검증까지만 적용된다.
  실제 R2 전환 시 presigned URL 에 content-type 을 바인딩하여 클라이언트가 다른 타입으로 업로드하지
  못하도록 강제하길 권장한다(범위 외).
- **메타 IDOR·confirm 통합 e2e 보강**: `GET /files/:id`(타인 403)·`POST /files/:id/confirm`(소유자 200·
  UPLOADED)의 end-to-end 통합 테스트 후속 보강 권장. 현재 핵심 분기는 service 단위 테스트(SC-001~010)로
  커버되어 실질 위험은 낮다(coverage-gap.md).
- **confirm size 비정수 전용 테스트**: `@IsInt`·`Number.isInteger` 이중 검증의 비정수 분기 전용 단위
  테스트(SC-010 과 동형) 추가 권장(coverage-gap.md).
