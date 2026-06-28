---
작성: Performance Agent
버전: v1.0
최종 수정: 2026-06-28 16:46
상태: 확정
---

# 성능 측정 및 최적화 결과 — 001-skeleton-bootstrap

## 목차

- [검토 범위](#검토-범위)
- [Constitution 성능 원칙 조항 이행 현황](#constitution-성능-원칙-조항-이행-현황)
- [성능 목표](#성능-목표)
- [Baseline 측정 결과](#baseline-측정-결과)
- [병목 지점 분석](#병목-지점-분석)
- [최적화 적용 내역](#최적화-적용-내역)
- [최종 측정 결과](#최종-측정-결과)
- [미달성 항목 및 사유](#미달성-항목-및-사유)
- [회귀 테스트 결과](#회귀-테스트-결과)

---

## 검토 범위

### 검토 대상 파일

본 spec은 신규 프로젝트(그린필드)로 DIFF의 모든 파일이 신규(+). research.md 영향 범위 분석에서 NFR 성능 목표와 직결된 경로상의 파일을 확정한다.

| 파일 | 검토 이유 | NFR 연관 |
|---|---|---|
| `apps/backend/src/health/health.controller.ts` | GET /health 핸들러 — NFR-001 직접 대상 | NFR-001 |
| `apps/backend/src/modules/auth/auth.service.ts` | POST /auth/login의 bcrypt.compare·JWT sign·DB 조회 — NFR-002 지배적 요인 | NFR-002 |

### 제외 파일 및 사유

| 제외 파일 | 사유 |
|---|---|
| `apps/backend/src/modules/auth/auth.controller.ts` | 라우팅 계층. 성능 핫패스 없음(auth.service.ts가 실제 처리 담당) |
| `apps/backend/src/modules/auth/auth.repository.ts` | DB 접근 계층이나 bcrypt가 지배적 요인. research.md에서 DB 쿼리(findUserByEmail, createRefreshToken)는 bcrypt 대비 미미 |
| 17개 스텁 모듈 | 빈 골격 — 비즈니스 로직 없음 |
| `*.spec.ts`, `test/` | 테스트 코드 — 프로덕션 실행 경로 아님 |

---

## Constitution 성능 원칙 조항 이행 현황

constitution.md에는 명시적 성능 조항(P-00X)이 없다. 성능 기준은 spec.md NFR-001·NFR-002로만 정의된다.

| 관련 조항 | 내용 | 이행 여부 |
|---|---|---|
| P-006. 테스트 원칙 | 모든 FR-XXX는 SC-XXX와 검증 시나리오를 가져야 한다 | 이행 — SC-008(NFR-001)·SC-027(NFR-002) 테스트 존재, 32/32 PASS |
| P-007. 스펙 범위 원칙 | spec.md 범위를 벗어나는 변경 금지 | 이행 — 성능 최적화(bcrypt cost 10)는 ADR-001 허용 범위 내. 범위 외 변경 없음 |

---

## 성능 목표

| PERF-ID | NFR-ID | SC-ID | 목표값 | 측정 조건 | 측정 방법 |
|---|---|---|---|---|---|
| PERF-001 | NFR-001 | SC-008 | GET /health P95 ≤ 200ms | 로컬/dev 환경(PostgreSQL Docker Compose), 연속 50회 요청 | E2E 테스트 (health.e2e-spec.ts) |
| PERF-002 | NFR-002 | SC-027 | POST /auth/login P95 ≤ 500ms | 로컬/dev 환경(PostgreSQL Docker Compose), 연속 50회 요청 | E2E 테스트 (auth.e2e-spec.ts) |

---

## Baseline 측정 결과

> 5b Test Agent(EXECUTION) 2차 재검증 시점(2026-06-28) 측정값. 측정 도구: Jest + Supertest E2E.

| PERF-ID | 측정값 | 목표값 | 목표 달성 여부 |
|---|---|---|---|
| PERF-001 | P95 < 200ms (SC-008 PASS 확인) | ≤ 200ms | PASS |
| PERF-002 | P95 ≈ 139ms (분포 95~158ms) | ≤ 500ms | PASS |

**참고 — 1차 측정(GAP-003 발생 당시)**:

| 조건 | PERF-002 측정값 | 결과 |
|---|---|---|
| BCRYPT_SALT_ROUNDS=12 | P95 = 859ms | FAIL |
| BCRYPT_SALT_ROUNDS=10 (수정 후) | P95 ≈ 139ms | PASS |

---

## 병목 지점 분석

### PERF-001 (GET /health)

`health.controller.ts`의 `check()` 메서드는 DB 접근 없이 `{ status: "ok" }` 객체를 즉시 반환한다. ADR-006 결정으로 DB 연결 상태 미포함. 응답 지연은 NestJS 프레임워크 라우팅 오버헤드(수 ms 이내)와 TCP 왕복 시간만으로 구성된다. 병목 없음.

| 병목 원인 | 유형 | 처리 |
|---|---|---|
| 해당 없음 | — | — |

### PERF-002 (POST /auth/login)

`auth.service.ts`의 `login()` 실행 경로:

1. `authRepository.findUserByEmail()` — Prisma 단순 조회 (users.users WHERE email=?) — 수 ms
2. `bcrypt.compare(plain, hash)` — **지배적 요인**. cost 10에서 약 60~120ms (ADR-001 허용 범위)
3. `jwtService.signAsync()` × 2 (access + refresh) — 각 수 ms
4. `authRepository.createRefreshToken()` — Prisma INSERT — 수 ms

P95 ≈ 139ms는 bcrypt cost 10 처리 시간에 DB 왕복 시간이 더해진 결과다. NFR-002(500ms)에 충분한 여유(약 361ms 마진)가 있다.

| PERF-ID | 병목 원인 | 유형 |
|---|---|---|
| PERF-002 | bcrypt.compare (cost 10) — login P95의 주요 기여 요인 | 구현 수준 (ADR-001 허용 범위 내, GAP-003 해소 완료) |

**아키텍처 수준 성능 문제**: 없음. 단일 DB(P-003), 모듈 경계(P-001) 원칙 준수 하에 설계된 호출 경로는 정상이다.

---

## 최적화 적용 내역

5b Test Agent(EXECUTION) 단계에서 GAP-003으로 기록된 bcrypt cost 수정이 Development Agent에 의해 이미 적용되었다. Performance Agent 단계에서의 추가 최적화는 없다.

| PERF-ID | 적용 내용 | 변경 파일 | 적용 주체 | constitution 조항 준수 |
|---|---|---|---|---|
| PERF-002 | `BCRYPT_SALT_ROUNDS` 12 → 10 (ADR-001 허용 범위 내) | `apps/backend/src/modules/auth/auth.service.ts` L19 | Development Agent (GAP-003) | P-006·P-007 준수. constitution 성능 조항 없음 |

코드 주석(auth.service.ts L17-18)에 수정 근거 명시:
```
// cost 12 에서 P95 859ms → NFR-002(500ms) 초과.
// cost 10 은 ADR-001 허용 범위 내이며 P95 목표 충족.
```

---

## 최종 측정 결과

| PERF-ID | Baseline | 최종값 | 목표값 | 목표 달성 여부 |
|---|---|---|---|---|
| PERF-001 | P95 < 200ms | P95 < 200ms (변동 없음 — 단순 핸들러) | ≤ 200ms | PASS |
| PERF-002 | P95 ≈ 139ms (cost 10 적용 후) | P95 ≈ 139ms | ≤ 500ms | PASS |

---

## 미달성 항목 및 사유

없음. NFR-001·NFR-002 모두 달성.

---

## 회귀 테스트 결과

5b Test Agent(EXECUTION) 재검증 기준 (2026-06-28):

| 항목 | 결과 |
|---|---|
| 전체 테스트 수 | 32 |
| 통과 | 32 |
| 실패 | 0 |
| SC-008 (PERF-001) | PASS |
| SC-027 (PERF-002) | PASS |

Performance Agent 단계에서의 코드 변경 없음 → 추가 테스트 실행 불필요. 회귀 없음.
