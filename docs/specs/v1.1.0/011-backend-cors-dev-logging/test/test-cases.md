---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 13:56
상태: 확정 (retroactive)
---

# Test Cases: 011-backend-cors-dev-logging

## 목차

- [검증 방식 개요](#검증-방식-개요)
- [SC 검증 케이스](#sc-검증-케이스)
- [회귀 검증](#회귀-검증)

> **역문서화 주의**: 본 차수는 부팅 구성·의존성 변경으로 신규 단위 테스트를 추가하지 않았다.
> 검증은 정적 확인(코드/lock 존재) + 기존 261 테스트 회귀 무발생으로 갈음한다(plan.md 예외 사항).

---

## 검증 방식 개요

| 변경 | 검증 방식 | 사유 |
|---|---|---|
| CORS 활성화 | 정적 확인 | 부팅 단계 전역 설정 — 단위 테스트 부적합 |
| pino-pretty 추가 | 정적 확인 | 의존성 선언 + lock 반영 확인 |
| 회귀 | Jest 전체 실행 | 기존 261 테스트 무회귀 |

---

## SC 검증 케이스

### SC-001 / SC-002 — CORS 활성화 + origin fallback

- **명령**: `grep -n "enableCors" apps/backend/src/main.ts`
- **기대**: `app.enableCors({ origin: process.env['CORS_ORIGIN']?.split(',') ?? true, credentials: true })`
- **판정**: 호출 존재 + `?? true` fallback 표현식 확인 → PASS

### SC-003 — pino-pretty devDependency

- **명령**: `grep -n "pino-pretty" apps/backend/package.json`
- **기대**: `devDependencies` 블록에 `"pino-pretty": "^13.1.3"`
- **판정**: 매칭 → PASS

### SC-004 — pnpm-lock 반영

- **명령**: `grep -n "pino-pretty@13.1.3" pnpm-lock.yaml`
- **기대**: lock 에 `pino-pretty@13.1.3` 항목 + 전이 의존성(`colorette`·`dateformat` 등)
- **판정**: 매칭 → PASS

### SC-006 — CORS_ORIGIN 환경변수 문서화 (GAP-011-01)

- **명령**: `grep -n "CORS_ORIGIN" apps/backend/.env.example .claude/docs/infra.md`
- **기대**: `.env.example` 에 `CORS_ORIGIN=` 항목 + fail-open 주석, `infra.md` §7 체크리스트 항목
- **판정**: 양쪽 매칭 → PASS

---

## 회귀 검증

### SC-005 — 기존 테스트 무회귀

- **명령**: `pnpm --filter backend test`
- **기대**: `Tests: 261 passed, 261 total` / `Test Suites: 25 passed, 25 total`
- **판정**: 010 검증 시점과 동일 261 PASS 유지 → PASS

> CORS·의존성 추가는 런타임 핸들러 로직을 바꾸지 않으므로 테스트 수·통과 수에 변화가 없어야
> 정상이다(회귀 무발생이 곧 정상 신호).
