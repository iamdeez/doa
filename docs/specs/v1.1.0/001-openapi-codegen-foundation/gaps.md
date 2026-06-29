---
작성: Design Agent → Docs Agent 누적
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (retroactive)
---

# Gaps — 001-openapi-codegen-foundation

> 기획/설계 공백 누적 기록. 3단계 이후 모든 Agent 가 누적.

## 목차

- [신규 GAP](#신규-gap)
- [해결한 선행 설계 공백](#해결한-선행-설계-공백)

---

## 신규 GAP

### GAP-001-01

- **출처**: Design Agent / Test Agent (research·coverage-gap) / Docs Agent
- **유형**: 계약 완성도·운영 자동화 한계 (Low — 권고) — response 스키마 미주석 + 생성물 CI 재생성 검증
  자동화 부재 + api-client 전환 미완
- **컨텍스트**: `apps/backend/openapi.json`(component schemas 32종 전부 입력 DTO), 컨트롤러 응답 타입
  미주석, `openapi:gen`/`gen` 재생성 절차(수동), `packages/api-client`(생성 타입 미전환)
- **내용**: (1) **response 스키마 미주석** — component schemas 32종이 전부 입력(request) DTO 이며, 87
  operations 중 typed 2xx response content 는 36건이다. 컨트롤러가 엔티티/원시값을 반환하나
  `@ApiResponse({ type })`·응답 DTO 가 부여되지 않아 프론트는 응답 타입을 부분적으로만 코드젠에서 얻는다.
  (2) **생성물 CI 재생성 검증 자동화 부재** — `openapi.json`·`openapi.gen.ts` 가 레포에 커밋되나, 백엔드
  DTO 변경 후 양 단계 재실행을 누락하면 생성물 drift 가 발생한다. CI 자동 재생성·diff 0 검증이 없어 사람이
  절차를 지켜야 한다. (3) **api-client 전환 미완** — 001 은 shared-types 생성·재노출까지만이며,
  `@doa/api-client` 18도메인 메서드의 생성 타입 전환은 후속 차수다(수기 타입 한시 유지).
- **수정 방향**: (1) 도메인별 응답 DTO 정의 + `@ApiResponse({ type })` 로 응답 스키마 보강(점진 — FRONTEND
  -PLAN.md §8 정책). (2) CI 에 `openapi:gen` → `gen` 재실행 후 `git diff --exit-code` 게이트 추가. (3) Phase
  0 후속 차수에서 api-client 를 생성 타입 기반 typed 메서드로 재작성·수기 타입 완전 대체.
- **영향**: 낮음 — Phase 0 핵심 목표(입력 계약 SSOT·수기 동기화 부담 제거)는 70 paths/32 schemas 자동
  생성으로 달성. 응답 타입 부분 미획득·생성물 drift 위험·api-client 미전환은 점진 보강 대상이며 기존
  console 화면은 수기 타입으로 회귀 0.
- **상태**: OPEN — 응답 스키마 보강·생성물 CI 검증·api-client 전환은 Phase 0 후속 차수 위임(Low 권고).
  coverage-gap.md 와 동일 사안.

---

## 해결한 선행 설계 공백

| 식별자 | 선행 맥락 | 등급 | 001 해결 | 상태 |
|---|---|---|---|---|
| (수기 shared-types 한계) | FRONTEND-PLAN §2-2 | 구조적 부담 | 백엔드 OpenAPI 자동 생성(70 paths/32 schemas) + 프론트 `openapi-typescript` 코드젠(openapi.gen.ts 3220줄) + 재노출. 계약 SSOT 를 백엔드 코드(DTO+class-validator+JSDoc)로 단일화하여 18도메인 수기 동기화 부담 제거 | **RESOLVED (001, 커밋 678ba1c — 입력 계약 한정. 응답 스키마·api-client 전환은 GAP-001-01 후속)** |

> 본 항목은 정식 식별된 선행 GAP-XXX 가 아닌 FRONTEND-PLAN.md 의 구조적 한계(수기 shared-types
> 18도메인 동기화 부담)이며, 001(Phase 0)이 입력 계약 범위에서 해소한다. 응답 스키마·api-client 전환·
> 생성물 CI 검증은 GAP-001-01 로 후속 위임.
