---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-30 17:44
상태: 작성중
---

# Gaps: 012-console-phase4-polish

> 이 단계(3단계 Design Agent)에서 최초 생성. 이후 모든 Agent 가 누적 기록한다.
> 형식: `pipeline-conventions.md §6`.

## 목차

- [GAP-001](#gap-001)
- [GAP-002](#gap-002)

---

## GAP-001

- **유형**: 설계-가정-불일치
- **출처**: Design Agent
- **컨텍스트**: B. ImageUpload 공용 컴포넌트 (FR-002) / D. 배너 이미지 업로드 (FR-004) — `purpose` 값
- **내용**: plan.md 핵심 설계 B·D 가 `<ImageUpload>` 의 `purpose` prop 을 `'PRODUCT' | 'BANNER'` (FilePurpose enum) 으로 가정했으나, 실제 Prisma `FilePurpose` enum(`apps/backend/prisma/schema.prisma:694`) 의 값은 **`PRODUCT_IMAGE` · `REVIEW_IMAGE` · `PROFILE`** 3종뿐이다. `'PRODUCT'`·`'BANNER'` 둘 다 존재하지 않는다. presign DTO(`presign.dto.ts`)가 `@IsEnum(FilePurpose)` 로 검증하므로 미존재 값 전송 시 400.
- **영향**: ImageUpload `purpose` prop 타입·상품/배너 호출 시 전달값 결정 필요.
- **상태**: RESOLVED by Design Agent
- **해소 내용**:
  - `purpose` 는 storage key prefix 용도일 뿐 contentType allowlist 와 무관(`file.service.ts:48` `key = ` `${purpose}/${userId}/${uuid}`). plan.md "기타 고려사항 — FilePurpose enum 확인" 이 "기존 enum 값 사용(enum 확장은 범위 외)" 을 사전 위임함.
  - 해소: console 측 `FilePurpose` 타입은 `@doa/shared-types` 에 문자열 union(`'PRODUCT_IMAGE' | 'REVIEW_IMAGE' | 'PROFILE'`)으로 신규 추가(@prisma/client 는 백엔드 전용이라 console import 불가). ImageUpload `purpose: FilePurpose`.
  - 상품 이미지(FR-003): `'PRODUCT_IMAGE'`.
  - 배너 이미지(FR-004): `'PRODUCT_IMAGE'` (이미지 allowlist 동일·소유자 검증 동일하므로 기능상 무해. 3개 enum 중 BANNER 의미 매칭값 부재 — key prefix 만의 의미적 차선택. enum 확장은 범위 외).
  - tasks.md T001(shared-types FilePurpose union 추가)·T006(ImageUpload)·T007·T008 에 반영.

---

## GAP-002

- **유형**: 문서-갱신-필요
- **출처**: Design Agent (PATCH-A11 context.md 부정합 사전 점검)
- **컨텍스트**: `.claude/docs/context.md` §2 핵심 모듈 — `shared/auth`(L103)
- **내용**: context.md L103 `shared/auth` 설명이 `AdminGuard(ADMIN_USER_IDS env 기반, fail-closed)` 로 기술됨. 본 spec 변경 후:
  - AdminGuard 의 파싱 로직(콤마분리·trim·빈값필터·includes)이 신규 `shared/auth/admin-ids.ts` 의 순수 헬퍼 `isAdminUserId()` 로 추출되고 AdminGuard 가 이를 위임(행위 보존, ADR-001).
  - `GET /auth/me` 응답에 `isAdmin` 필드가 추가되어 동일 판정 로직이 응답 데이터로도 노출됨(FR-001).
- **평가**: 기존 정의 `AdminGuard(ADMIN_USER_IDS env 기반, fail-closed)` 자체는 변경 후에도 유효(AdminGuard 는 여전히 env 기반·fail-closed). 다만 (a) 공유 헬퍼 `admin-ids.ts` 의 존재, (b) `GET /auth/me` 의 isAdmin 노출은 미반영. 부정합(오류)은 아니나 **현행화 누락**.
- **상태**: RESOLVED (2026-07-01) — Retrospective PATCH-CXT-001 로 context.md §2 shared/auth 행 현행화 적용 완료 (.claude/docs-change-logs/2026-06-30-001.md). 갱신 텍스트와 코드 사실 일치 검증됨.
- **갱신 권고** (Docs Agent 작성, PROC-002 코드 검증 포함):
  - **갱신 대상**: `.claude/docs/context.md` §2 공통(shared)·인프라 모듈 표, `shared/auth` 행
  - **현행 텍스트** (L103):
    ```
    | `shared/auth` | `src/shared/auth/` | JwtStrategy · JwtAuthGuard · OptionalJwtAuthGuard · AdminGuard(`ADMIN_USER_IDS` env 기반, fail-closed) · `@CurrentUser` 데코레이터 |
    ```
  - **갱신 텍스트**:
    ```
    | `shared/auth` | `src/shared/auth/` | JwtStrategy · JwtAuthGuard · OptionalJwtAuthGuard · `isAdminUserId(userId, rawEnv)` 헬퍼(`admin-ids.ts` — ADMIN_USER_IDS 파싱·fail-closed 순수 함수) · AdminGuard(`ADMIN_USER_IDS` env 기반, fail-closed — `isAdminUserId` 위임) · `@CurrentUser` 데코레이터 · `GET /auth/me` 응답에 `isAdmin: boolean` 노출 |
    ```
  - **코드 검증** (PROC-002):
    - `admin-ids.ts` 존재: `apps/backend/src/shared/auth/admin-ids.ts` L9 — `export function isAdminUserId(userId: string, rawEnv: string | undefined): boolean` — 확인
    - AdminGuard 위임: `apps/backend/src/shared/auth/admin.guard.ts` — `isAdminUserId` import·호출 확인(git diff f0489a1 기준 +4/-7)
    - AuthService isAdmin: `apps/backend/src/modules/auth/auth.service.ts` — `getProfile()` 반환에 `isAdmin: isAdminUserId(...)` 추가(+4/-1) 확인
    - AuthProfileResponse: `apps/backend/src/modules/auth/dto/auth-response.dto.ts` — `isAdmin: boolean` 필드 추가(+3) 확인
    - 갱신 권고 텍스트와 코드 사실 일치 — 검증 완료
