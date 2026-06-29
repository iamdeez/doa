---
작성: Planning Agent (DB Design Agent 비활성 — stub)
버전: v1.0
최종 수정: 2026-06-29 20:39
상태: 확정 (retroactive)
---

# Data Model: 011-file-security

## 목차

- [요약](#요약)
- [재사용 대상 필드 (변경 없음)](#재사용-대상-필드-변경-없음)
- [마이그레이션](#마이그레이션)

---

## 요약

**스키마 변경 없음 — FileAsset 의 기존 `status`/`size` 컬럼 재사용, 마이그레이션 불필요.**

011 은 service/repository 레벨의 소유권 검증(`getById`)·MIME allowlist(`presign`)·업로드 확정
(`confirm` + `updateStatus`)만 변경하며, DB 형상(테이블·컬럼·enum·인덱스·제약)에는 영향이 없다. confirm
의 상태 전이(PENDING→UPLOADED)와 size 기록은 006 에서 이미 정의된 `FileAsset.status`·`FileAsset.size`
컬럼을 `update` 로 갱신할 뿐이다. 따라서 Database Design Agent 는 비활성(selection-phases.md: DB Design
= N)이며, 본 문서는 "스키마 변경 없음" 을 명시적으로 기록하는 stub 이다.

- 신규 테이블: 0
- 신규/변경 컬럼: 0
- 신규 enum: 0 (FileStatus PENDING/UPLOADED 는 006 기존)
- 신규 인덱스·제약: 0
- 신규 마이그레이션: 0

---

## 재사용 대상 필드 (변경 없음)

011 의 보안·확정 로직은 006-search-notification-file 에서 정의된 `files.files`(FileAsset) 테이블의 기존
컬럼을 **읽기/갱신**한다(스키마 변경 없음).

| 모델 | 컬럼 | 타입 | 정의 spec | 011 사용 |
|---|---|---|---|---|
| `FileAsset` | `ownerId` | String (cross-schema plain, FK 미선언) | 006 | `getById`·`confirm` 소유권 검증(`ownerId === userId`) |
| `FileAsset` | `status` | FileStatus enum (PENDING/UPLOADED) | 006 | `confirm` 이 `updateStatus` 로 PENDING→UPLOADED 전이 |
| `FileAsset` | `size` | Int | 006 | `confirm` 이 `updateStatus` 로 실제 size 기록(presign 시 0 placeholder) |
| `FileAsset` | `contentType` | String | 006 | `presign` 이 `ALLOWED_CONTENT_TYPES` 로 검증 후 저장 |

> `FileStatus` enum(PENDING/UPLOADED)이 006 에 이미 존재하므로 011 의 confirm 전이는 enum 변경 없이
> 기존 값만 사용한다. DB 타입·제약 변경은 필요 없다.

---

## 마이그레이션

**없음.** 011 은 신규 마이그레이션을 생성하지 않는다. `prisma migrate status` 는 010 완료 시점과 동일
(up-to-date) 상태를 유지한다(010·011 모두 스키마 무변경).
