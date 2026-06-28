---
작성: Retrospective Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# 회고 분석 리포트

> 대상: v1.0.0/001-skeleton-bootstrap (DOA Market 재구축 — 프로젝트 최초 spec, 그린필드)
> 소스: gaps.md(GAP-001~009) + pipeline-log.md 전문 + runs/ 11건 + 산출물 전체 + main session OBS-1~5
> agent-observations.md 미존재 → 분석 1b 는 main session 이 task 로 전달한 OBS-1~5 를 사용한다.

## 목차

- [1. gaps.md + agent-observations.md 기반 패치 도출](#1-gapsmd--agent-observationsmd-기반-패치-도출)
- [2. 재작업 패턴 분석](#2-재작업-패턴-분석)
- [3. 설계 워크플로우 준수 점검](#3-설계-워크플로우-준수-점검)
- [4. 구조 개선 필요성](#4-구조-개선-필요성)
- [5. 작업 기록 분석](#5-작업-기록-분석)
- [6. 전역 규칙·참조 문서·스킬 개선 검토](#6-전역-규칙참조-문서스킬-개선-검토)
- [7. 우선 개선 항목](#7-우선-개선-항목)
- [8. memory 저장 후보 (사용자 검토 필요)](#8-memory-저장-후보-사용자-검토-필요)

---

## 1. gaps.md + agent-observations.md 기반 패치 도출

### 1a. GAP-ID 역추적

| GAP | 발견 단계 | 발생 단계 | 사전 방지 질문 | 귀속 패치 |
|---|---|---|---|---|
| GAP-001 (Prisma 빈 스키마 CREATE SCHEMA 미생성) | 3 Design | 설계(Prisma 동작 특성) | "선언만 되고 모델 없는 스키마가 migrate SQL 에 포함되는가?" | **없음 (모범 사례)** — Design Agent 가 research.md 외부 도구 동작 검증 절차로 사전 식별, T-A4 안전망 분해. SC-006 PASS. |
| GAP-002 (logout JwtAuthGuard 오적용) | 5b Test EXEC | 4 Development | "구현된 가드 적용이 plan.md 인터페이스 계약 표의 인증 요구와 일치하는가?" | PATCH-002 (Development Agent 인터페이스 계약 대조 체크) |
| GAP-003 (bcrypt cost 12 → P95 859ms 미달) | 5b Test EXEC | 4 Development (ADR 범위 상한 선택) | "NFR 성능에 직접 영향하는 파라미터를 ADR 이 '범위'로 두면 상한 선택 시 NFR 위반 가능한가?" | PATCH-003 (Planning ADR 성능 파라미터 단일 권장값) |
| GAP-004 (context.md 갱신) | 6 Docs | 6 (갱신 위임) | — | PATCH-CXT-001~005 (agent-patches.md) + **PROC-001** (코드 검증 오기재 — 아래) |
| GAP-005 (infra.md 갱신) | 6 Docs | 6 (갱신 위임) | — | PATCH-CXT-006~009 (agent-patches.md) |
| GAP-006 (.env.example 미사용 변수 JWT_ACCESS_TTL/REFRESH_TTL) | Y Deploy | 4 Development (.env.example ↔ 코드 불일치) | "선언한 env 를 실제 코드(jwt.config.ts)가 읽는가?" | PATCH-002 파생(코드↔설정 정합) / 즉시 정정 권장 |
| GAP-007 (Dockerfile HEALTHCHECK 미설정) | Y Deploy | 4/Y | — | 선택 개선 (다음 Dockerfile 수정 시) |
| GAP-008 (Rate Limiting 미적용) | Y Security | 설계 범위 (Stage 2+) | — | 다음 spec 처리 (SEC-002) |
| GAP-009 (helmet 미적용) | Y Security | 설계 범위 (Stage 2+) | — | 다음 spec 처리 (SEC-003) |

**역추적 핵심 발견 — GAP-004 의 "코드 검증" 오기재**: GAP-004 item 1 은 context.md §1 현재 버전 갱신 근거로 `apps/backend/package.json "version": "1.0.0" 확인` 을 기재했으나, 실제 package.json 은 `"version": "0.0.1"` (scaffold 기본값 미갱신). gaps.md 의 "코드 검증" 필드가 실제 파일 확인 없이 기재된 사례다. retrospective 의 PATCH-CXT 작성은 PROC-002 (이 프로젝트 글로벌 규칙) 로 코드 검증이 강제되나, **gaps.md 작성 단계(Docs/Design/Deploy 등)** 는 동일 보호가 없다 → **PROC-001 신규 등록**. 본 차수 PATCH-CXT-001 은 spec 릴리즈 버전(docs/specs/v1.0.0) 을 근거로 v1.0.0 갱신하되, package.json 0.0.1 정정은 별도 코드 변경 항목으로 분리(agent-patches.md 참조).

### 1b. OBS-XXX 기반 PATCH 도출 (main session 전달 OBS)

| OBS | 관찰 요지 | 도출 패치 |
|---|---|---|
| OBS-1 | fable 모델 unavailable → 02/03/07 Agent 를 opus 로 대체(사용자 승인). 해당 Agent frontmatter `model: fable` | PATCH-004 (Agent frontmatter model 필드 재검토 — 사용자 확인 필요) |
| OBS-2 | `model: fable` Agent 는 SendMessage 재개 시 fable 로 되살아나 재차 unavailable. 재작업이 '새 spawn + model override' 로만 가능 | PROC-002 (모델 가용성 의존 Agent 재개 정책) |
| OBS-3 | Spec Agent 1차 시도가 spec.md 직전 background 정지 (SendMessage 재개로 해소) | 일시적 환경 — 패치 불요 (PROC-002 운영 가이드에 포함) |
| OBS-4 | Deploy Agent 1차 호출 세션 한도 중단 → 동일 prompt 재호출 정상 | 일시적 환경 — 패치 불요 |
| OBS-5 | Deploy 단계 docker build 실패(pnpm 워크스페이스 Prisma client 경로 L53) 를 동적 검증으로 발견·수정. Development/Design 에서 Dockerfile-pnpm-prisma 경로 정합성 사전 점검 부재 | PATCH-001 (docker.md pnpm+Prisma 패턴) + PROC-003 (사전 점검 흐름) |

---

## 2. 재작업 패턴 분석

### 재작업 이력

| 차수 | 유형 | 단계 | 원인 | 서킷 브레이커 |
|---|---|---|---|---|
| 1 | 산출물 품질 재작업 | 5b → 4 복귀 (PPG 부분 재진행, Development 만) | GAP-002(logout 가드) + GAP-003(bcrypt cost) 2건 동시 | 미발동 (재작업 1회) |
| — | 환경/모델 가용성 재시작 (산출물 결함 아님) | 1 Spec / 2 Planning / Y Deploy | OBS-3(background 정지) / OBS-1·2(fable unavailable, 재spawn) / OBS-4(세션 한도) | 미발동 |

- **유의미한 산출물 재작업은 1회(5b→4)** 뿐이며, 모두 [A] 구현 오류로 Development Agent 가 자체 수정 후 5b 재검증 PASS(32/32). 서킷 브레이커 발동 없음.
- 나머지 재시작은 모두 **인프라/모델 가용성** 사유로 산출물 품질과 무관. fable 모델 의존(OBS-1·2)이 재시작 비용의 주된 반복 원인이다.
- [B] 테스트 자체 오류 2건(jwt mock 키 / pino-pretty 환경)은 Test EXECUTION 이 단계 내 자체 정정 → 재작업 카운트 외.

### PROC-008 직전 N=3 차수 적용 완료 패치 효과 측정

| 패치 | 의도 | 본 차수 효과 | 효과 발휘 여부 |
|---|---|---|---|
| (해당 없음) | — | 본 spec 은 **프로젝트 최초 spec** — 직전 차수 적용 완료 패치가 존재하지 않음 | 측정 불가 (N=0) |

> 단, 본 차수에서 도출되는 패치(PATCH-001~004 / PROC-001~003)는 다음 차수(002-*)의 PROC-008 측정 대상이 된다.

### PROC-014 사후 운영 검증 피드백 사이클 점검

- (a) 본 spec 파이프라인 종료 후 운영 결함 피드백: **현재 미발생** (파이프라인 진행 중).
- (b) 통합 검증([env:integration] 11개 SC): plan.md 옵션 A 채택 — main session + 사용자가 PostgreSQL Docker + .env 환경 구축 후 Test EXECUTION 이 **실제 실행**하여 검증(pipeline-log "통합 검증 환경 구축"). 옵션 C(파이프라인 내 스킵)가 아니므로 사후 검증 누락 위험 낮음.
- (c) 사후 모니터링 계획: spec.md "사후 운영 검증 피드백 사이클" 절(범위 외 §)에 3개 시나리오(전체 auth 흐름 수동 확인 / docker 이미지 /health / CI push 트리거) + 결함 발견 시 cycle 2 재진입 경로가 **합의 기재됨**. 양호.
- 결론: 사후 검증 피드백 사이클이 spec 자체에 명시되어 PROC-014 기준 충족. 추가 패치 불요.

---

## 3. 설계 워크플로우 준수 점검

| # | 점검 항목 | 결과 |
|---|---|---|
| ① | CHANGES.md 확인 | N/A (최초 spec — 이전 CHANGES.md 부재). Docs 단계에서 신규 생성 |
| ② | constitution.md 확인 | PASS — Planning P2 에서 P-001~P-007 전체 Gates 검증, 전 Agent 시작 절차에서 읽음 |
| ③ | context.md 확인 | PASS — 전 Agent 필수 읽기. Design/DB Design 이 §4·§5 도메인 모델·용어 기반 설계 |
| ④ | infra.md 확인 | PASS — Deploy/Performance 가 배포·성능 제약 참조 |
| ⑤ | spec.md [NEEDS CLARIFICATION] 해소 | PASS — 0건. 매트릭스 매핑 누락 0 |
| ⑥ | plan.md Constitution Gates | PASS — P-001~P-007 전체 통과(P-005 결제·정산 vacuous pass 명시) |
| ⑦ | research.md 코드베이스 분석 | PASS — 그린필드이므로 핀 버전 동작 검증 + Prisma multiSchema 리스크 분석으로 갈음 |
| ⑧ | tasks.md 전제 조건 체크 | PASS — 전제조건 3개 PASS, 레이어 F·A·B·C·D 분해 |

- 워크플로우 위반 0건. AWAITING_USER(Planning [env:integration] 옵션 결정) 가 정상 절차로 해소.

---

## 4. 구조 개선 필요성

- **Agent 역할 경계**: 명확. PPG-1(4 Development + 5a Test AUTHORING) 병렬 정상 동기화, 5b→4 부분 재진행도 PPG 운용 규칙대로 Development 만 재호출.
- **누락 Agent**: 없음. 본 spec 의 4개 영역(DB·배포·보안·성능)에 대해 선택 Agent 4개 모두 활성화 — selection-phases.md 가 각 영역의 **명시적 FR/NFR** 을 근거로 제시하여 over-activation 아님. 캐스케이딩 블로킹(Security Medium 이하 → Performance 진행) 정상 작동.
- **흐름 제어 1건 개선 후보**: OBS-5 의 docker build 실패가 **최종 선택 단계(Deploy)** 의 동적 검증에서야 발견됨. 컨테이너 빌드 경로 정합성은 4 Development 의 빌드 자가 검증 또는 3 Design 의 영향 파일 분석에서 선식별 가능 → PROC-003.

---

## 5. 작업 기록 분석

- **필수 문서 읽기**: runs/ 11건 모두 §7 시작 절차 8개 체크박스를 완전 형태로 기록. constitution/context/infra 참조 일관.
- **시각 기록**: run-002(Planning)·일부 pipeline-log 항목이 Bash 도구 미제공으로 분 단위 시각을 `[시각 미확인]` 처리 — §10 규약 준수(추측 기재 안 함). 단, 이로 인해 단계별 소요 시간 정밀 분석 제약. 환경 제약이며 위반 아님.
- **비효율 반복 패턴**: fable 모델 의존(OBS-1·2)으로 02/03/07 단계마다 opus 대체 + 재spawn 발생 — 모델 가용성 fallback 부재가 반복 비용. PROC-002 로 운영 가이드화.
- **모범 패턴**: Design Agent 의 research.md 외부 동작 검증(GAP-001 사전 식별) 과 Test EXECUTION 의 [B] 자체 정정(B-1/B-2)이 후속 단계 부담을 줄임.

---

## 6. 전역 규칙·참조 문서·스킬 개선 검토

agent-rules.md §12 기준 검토. 각 전역 패치 후보는 agent-patches.md 에 적합성 2단계 검토 결과를 명시한다.

| 후보 | 대상 | 적합성 |
|---|---|---|
| PATCH-001 | `~/.claude/rules/on-demand/docker.md` — pnpm workspace + Prisma client generate 경로 멀티스테이지 패턴 | 범용 O (pnpm monorepo + Prisma 조합은 OS·프로젝트 불문), 역할정합 O (Docker 빌드 규칙) |
| PATCH-002 | `~/.claude/agents/04-development.md` — 구현 시 plan.md 인터페이스 계약 표(가드·인증 요구·env 사용) 대조 자가 점검 | 범용 O, 역할정합 O |
| PATCH-003 | `~/.claude/agents/02-planning.md` — NFR 성능에 직접 영향하는 파라미터의 ADR 표기는 '허용 범위' 대신 환경 기준 단일 권장값 | 범용 O, 역할정합 O |
| PATCH-004 | `~/.claude/agents/{02,03,07}.md` frontmatter `model: fable` 재검토 | 범용 O (글로벌 Agent 정의), 역할정합 O — **단 fable unavailable 은 사용자 환경 사실 → 사용자 확인 필수** |
| PROC-001 | gaps.md "코드 검증" 기재 시 실제 grep/Read 강제 (모든 Agent) | (process-patches.md) |
| PROC-002 | 모델 가용성 의존 Agent 의 SendMessage 재개 정책 | (process-patches.md) |
| PROC-003 | 컨테이너 빌드 경로 정합성 사전 점검(Design/Development) | (process-patches.md) |

- **잔존 참조 grep 점검**: 본 차수 전역 문서 파일 이동·삭제 이력 없음 → grep 점검 해당 없음.
- **constitution.md 변경 필요성(분석 7)**: GAP-008(rate limiting)·GAP-009(helmet) 가 보안 baseline 부재를 드러냈으나, 이는 spec 수준 처리(다음 spec)가 적합하며 constitution 은 불변 원칙. **constitution 조항 추가·개정 불요**. 보안 baseline 의 constitution 승격 여부는 팀 합의 사항으로만 기록(강행 안 함).

---

## 7. 우선 개선 항목

> 심각도 기준: Critical 전체 + High 상위 3개.

**Critical**: 없음 (파이프라인 32/32 PASS, Critical/High 취약점 0건, 서킷 브레이커 미발동).

**High (상위 3개)**:

1. **PROC-001 (gaps.md 코드 검증 오기재 차단)** — GAP-004 가 package.json 1.0.0 으로 오기재(실제 0.0.1). 문서 신뢰성 직결. gaps.md 에 "코드 검증" 을 기재하는 모든 Agent 가 실제 grep/Read 후 라인 근거 명시하도록 강제.
2. **PATCH-001 + PROC-003 (pnpm+Prisma Dockerfile 경로 사전 점검)** — OBS-5. 배포 직전 단계에서야 docker build 실패 발견. 모노레포 Prisma 빌드는 반복 발생 가능 패턴이므로 docker.md 패턴화 + 4단계 빌드 자가 검증.
3. **PATCH-002 (Development 인터페이스 계약 대조)** — GAP-002·GAP-006. 구현이 plan.md 인터페이스 계약(가드 적용/env 사용)과 어긋난 사례 2건. 구현 완료 전 계약 표 대조 체크 추가.

---

## 8. memory 저장 후보 (사용자 검토 필요)

핵심 원칙 §8 의 4기준(범용성·최우선 중요도·반복 검증·글로벌 흡수 불가능)을 모두 충족하는 항목만 등재한다.

**없음.**

- 검토한 후보(pnpm+Prisma Dockerfile 경로 / fable 모델 fallback / ADR 성능 파라미터 단일값)는 각각 기준 (c) 반복 검증(본 spec 1회 관찰만) 또는 기준 (d) 글로벌 흡수 가능(docker.md·Agent 정의 패치로 더 잘 해결됨)에 걸려 memory 후보에서 제외한다. memory 는 마지막 수단이며, 본 차수 학습은 전역 패치(PATCH/PROC)로 흡수하는 것이 적합하다.
- fable 모델 unavailable 은 **사용자 환경 특정 사실**이라 범용성(기준 a) 미충족 → memory 아님.
