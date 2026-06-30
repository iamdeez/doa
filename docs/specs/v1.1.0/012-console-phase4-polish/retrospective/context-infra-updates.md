---
작성: Retrospective Agent
버전: v1.0
최종 수정: 2026-06-30 23:43
상태: 적용 완료 (PATCH-CXT-001·PATCH-CXT-002 → context.md, 프로젝트 docs-change-logs/2026-06-30-001.md)
---

# Context / Infra 갱신 패치: 012-console-phase4-polish

> 적용 주체 = main session (사용자 승인 후). 본 Agent 는 직접 수정하지 않는다.
> infra.md: 본 차수는 코드 변경만(배포/컨테이너/CI 무변경 — selection-phases Deploy=N). **infra.md 갱신 패치 없음.**

## 목차

- [PATCH-CXT-001 — context.md §2 shared/auth 현행화 (GAP-002)](#patch-cxt-001)
- [PATCH-CXT-002 — context.md §1 현재 버전 필드 (검토 필요)](#patch-cxt-002)

---

## PATCH-CXT-001

- **대상 파일**: `/Users/krystal/workspace/doa/doa-next/.claude/docs/context.md`
- **대상 섹션**: §2 공통(shared)·인프라 모듈 표 — `shared/auth` 행 (L103)
- **변경 내용**:
  - 현행 텍스트 (L103):
    ```
    | `shared/auth` | `src/shared/auth/` | JwtStrategy · JwtAuthGuard · OptionalJwtAuthGuard · AdminGuard(`ADMIN_USER_IDS` env 기반, fail-closed) · `@CurrentUser` 데코레이터 |
    ```
  - 갱신 텍스트:
    ```
    | `shared/auth` | `src/shared/auth/` | JwtStrategy · JwtAuthGuard · OptionalJwtAuthGuard · `isAdminUserId(userId, rawEnv)` 헬퍼(`admin-ids.ts` — ADMIN_USER_IDS 파싱·fail-closed 순수 함수) · AdminGuard(`ADMIN_USER_IDS` env 기반, fail-closed — `isAdminUserId` 위임) · `@CurrentUser` 데코레이터 · `GET /auth/me` 응답에 `isAdmin: boolean` 노출 |
    ```
- **변경 근거**: GAP-002 (문서-갱신-필요, Design Agent PATCH-A11 사전 점검). 본 spec FR-001/ADR-001 로 (a) 공유 헬퍼 `admin-ids.ts` 신설, (b) AdminGuard 가 헬퍼 위임, (c) `GET /auth/me` 에 isAdmin 노출. 기존 정의가 오류는 아니나 현행화 누락.
- **코드 검증** (PROC-002 — gaps.md GAP-002 의 Docs Agent 검증 재확인):
  - `apps/backend/src/shared/auth/admin-ids.ts` — `export function isAdminUserId(userId, rawEnv): boolean` 존재 (gaps.md L58 검증 기록).
  - `apps/backend/src/shared/auth/admin.guard.ts` — `isAdminUserId` import·위임 (git diff f0489a1 +4/-7).
  - `apps/backend/src/modules/auth/auth.service.ts` — `getProfile()` 반환에 `isAdmin: isAdminUserId(...)` 추가 (+4/-1).
  - `apps/backend/src/modules/auth/dto/auth-response.dto.ts` — `isAdmin: boolean` 필드 추가 (+3).
  - 갱신 텍스트와 코드 사실 일치 — 검증 완료.
- **status**: 적용 가능 (코드 검증 통과).

---

## PATCH-CXT-002

- **대상 파일**: `/Users/krystal/workspace/doa/doa-next/.claude/docs/context.md`
- **대상 섹션**: §1 프로젝트 개요 — "현재 버전" 필드 (L17)
- **변경 내용**: `현재 버전: v1.0.0` → `현재 버전: v1.1.0` (검토 필요)
- **변경 근거**: §7 갱신 이력·§1 본문(L20-22)이 이미 v1.1.0 spec 008~013 완료를 기술하나 §1 "현재 버전" 필드만 v1.0.0 으로 잔존. 본 차수(012)도 `docs/specs/v1.1.0/` 산출물. 필드 정합성 관점에서 v1.1.0 이 현재 개발/적용 버전.
- **코드 검증** (PROC-002): 버전 필드는 코드 심볼이 아닌 릴리즈 라벨이므로 단일 코드 위치 대조 불가. 산출물 경로(`docs/specs/v1.1.0/`)·context §7 갱신이력(008~013)이 근거.
- **status**: 검토중 — 사용자 확인 필요. "현재 버전"의 의미가 (a) 마지막 릴리즈 태그(=v1.0.0 유지 가능)인지 (b) 현재 적용 중 버전(=v1.1.0)인지 프로젝트 컨벤션에 따라 결정. 본 Agent 는 단정하지 않고 후보로만 제시.
