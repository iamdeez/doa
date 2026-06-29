---
작성: Design Agent → Security Agent → Docs Agent 누적
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive)
---

# Gaps — 011-file-security

> 기획/설계 공백 누적 기록. 3단계 이후 모든 Agent 가 누적.

## 목차

- [신규 GAP](#신규-gap)
- [해결한 선행 발견·공백](#해결한-선행-발견공백)

---

## 신규 GAP

### GAP-011-01

- **출처**: Design Agent / Security Agent (research·security-report)
- **유형**: 보안 신뢰경계 (Low — 권고) — confirm size 클라이언트 신뢰·실제 업로드 크기 교차검증 부재
- **컨텍스트**: `file.service.ts` `confirm(userId, id, size)`, `file.constants.ts` `MAX_FILE_SIZE_BYTES`
- **내용**: `confirm` 의 `size` 는 클라이언트가 보고하는 값이며, 서버가 실제 업로드된 객체의 바이트 수를
  교차검증하지 않는다. 현재 `StubFileStorage`(무네트워크, 실제 업로드 미발생)에서는 서버가 실제 크기를
  알 수 있는 경로가 없어 `MAX_FILE_SIZE_BYTES`(10MiB) 상한 검증이 클라이언트 신뢰 기반이다. 악의적
  클라이언트가 실제보다 작은 size 를 보고하면 상한 검증을 우회할 수 있다.
- **수정 방향**: 실제 R2 전환 시 confirm 시점에 R2 객체 HEAD(또는 presign 정책의 content-length-range)로
  보고 size ↔ 실제 업로드 크기를 교차검증. presign 시점 content-type 바인딩도 함께 적용.
- **영향**: 낮음 — 현재 stub 모델에서 실제 업로드가 발생하지 않아 표면 제한적. 실제 R2 전환 spec 에서
  처리 필요.
- **상태**: OPEN — 실제 R2 전환 spec 위임(Low 권고). security-report.md 권고사항·coverage-gap.md 와 동일 사안.

> 그 외 `confirm` size 비정수 전용 테스트 부재와 메타 IDOR·confirm 통합 e2e 부재는 모두 *테스트 보강
> 권고*(coverage-gap.md)일 뿐 기획/설계 공백(GAP)이 아니다. 전자는 동형 분기(size 범위·양수 — SC-009·
> 010)가 같은 조건식을 직접 단언하여 커버하고, 후자는 차단 권위인 service 소유권·allowlist·전이 로직이
> 단위 테스트(SC-001~010)로 직접 검증된다. 메타 IDOR 차단·confirm 전이의 핵심 로직은 전부 직접 커버된다.

---

## 해결한 선행 발견·공백

| 식별자 | 선행 spec | 등급 | 011 해결 | 상태 |
|---|---|---|---|---|
| SEC-FIND-006-01 | 006-search-notification-file | Low | `getById(userId, id)` 소유권 검증(`ownerId !== userId → 403`, 미존재 404). 메타 IDOR 차단. security/security-report.md "해결 검증" 참조 | **RESOLVED (011, 커밋 88de003)** |
| SEC-FIND-006-02 | 006-search-notification-file | Low | `presign` `ALLOWED_CONTENT_TYPES` allowlist(외 contentType → 400, repo 미호출) + confirm 단계 `MAX_FILE_SIZE_BYTES`(10MiB) 상한 | **RESOLVED (011, 커밋 88de003)** |
| GAP-006-02 | 006-search-notification-file | Low | `POST /files/:id/confirm`(소유자 전용) — PENDING→UPLOADED 전이 + size 기록, 이미 UPLOADED 멱등, size 범위 위반 400. 고아 PENDING 누적 해소 경로 | **RESOLVED (011, 커밋 88de003)** |
| GAP-006-03 (=SEC-FIND-006-01) | 006-search-notification-file | Low | SEC-FIND-006-01 교차기재 — 동일 사안(메타 IDOR) | **RESOLVED (011)** |
| GAP-006-04 (=SEC-FIND-006-02) | 006-search-notification-file | Low | SEC-FIND-006-02 교차기재 — 동일 사안(presign 입력 무검증) | **RESOLVED (011)** |

> 006-search-notification-file/security/security-report.md 의 SEC-FIND-006-01·02, 006/gaps.md 의
> GAP-006-02·03·04, 006/test/coverage-gap.md 의 해당 항목 상태가 본 spec 으로 RESOLVED(011) 갱신된다.
