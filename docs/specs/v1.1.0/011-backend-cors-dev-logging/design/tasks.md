---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 13:56
상태: 확정 (retroactive)
---

# Tasks: 011-backend-cors-dev-logging

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [구현 완료 기준](#구현-완료-기준)

> Branch: 011-backend-cors-dev-logging | Date: 2026-06-30 | Plan: ../planning/plan.md
>
> **역문서화 주의**: 이미 적용된 변경(base `1fe3489` → working tree)을 기준으로 재구성한다.
> 모든 태스크는 완료 상태로 기록한다.

---

## 전제 조건

- [x] spec.md의 모든 `[NEEDS CLARIFICATION]` 항목이 해소되었는가?
- [x] plan.md의 Constitution Gates가 모두 통과(또는 예외 기재)되었는가?
- [x] CHANGES.md에서 이전 작업(010)의 "후속 작업 시 주의사항"을 확인했는가?

---

## 태스크 목록

> 역문서화 기준 — 모든 태스크 완료됨.

### Phase 1. CORS 활성화

- [x] **T001** — main.ts 부트스트랩에 CORS 활성화
  - 구현 파일: `apps/backend/src/main.ts`
  - 관련 요구사항: `FR-001`
  - 상세: `useLogger` 직후 `app.enableCors({ origin: process.env['CORS_ORIGIN']?.split(',') ?? true, credentials: true })` 삽입
  - 완료 기준: enableCors 호출 존재 + origin fallback 표현식 확인 (SC-001, SC-002)

### Phase 2. dev 로깅 의존성 보강

- [x] **T002** `[P]` — pino-pretty devDependency 추가
  - 구현 파일: `apps/backend/package.json`
  - 관련 요구사항: `FR-002`
  - 상세: `devDependencies` 에 `"pino-pretty": "^13.1.3"` 추가
  - 완료 기준: package.json devDeps 에 pino-pretty 존재 (SC-003)

- [x] **T003** — pnpm-lock 반영
  - 구현 파일: `pnpm-lock.yaml`
  - 관련 요구사항: `FR-003`
  - 상세: `pnpm install` 로 `pino-pretty@13.1.3` + 전이 의존성 트리 lock
  - 완료 기준: pnpm-lock 에 pino-pretty@13.1.3 항목 존재 (SC-004)

### Phase 3. 환경변수 문서화 (GAP-011-01 해소)

- [x] **T004** `[P]` — CORS_ORIGIN 문서화
  - 구현 파일: `apps/backend/.env.example`, `.claude/docs/infra.md`
  - 관련 요구사항: `FR-004`
  - 상세: `.env.example` 에 `CORS_ORIGIN` + fail-open 주의 주석 추가. `infra.md` §7 배포 체크리스트 항목·§8 알려진 제약 행 추가.
  - 완료 기준: `.env.example` 에 `CORS_ORIGIN` 존재 + `infra.md` §7 등재 (SC-006)

### Phase 4. 검증

- [x] **T005** — 회귀 테스트
  - 테스트 명령: `pnpm --filter backend test`
  - 검증 대상: `SC-005` (NFR-002 회귀 무발생)
  - 시나리오: 기존 261개 테스트 전량 PASS 확인

---

## 구현 완료 기준

- [x] 모든 태스크 체크박스가 완료 처리되었다.
- [x] `pnpm --filter backend test` 가 261 PASS 를 반환한다.
- [x] `git status` 에 의도치 않은 파일이 없다.
- [x] **GAP-011-01 해소**: `.env.example` 에 `CORS_ORIGIN` 추가 + `infra.md` 보강 완료.
