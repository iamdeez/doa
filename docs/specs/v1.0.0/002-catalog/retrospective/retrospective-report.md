---
작성: Retrospective Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# 회고 분석 리포트

> 대상: v1.0.0/002-catalog (카탈로그 4도메인 — user·seller·product·inventory 실구현)
> 파이프라인: 1~6단계 + 선택단계(DB Design·Security·Performance) 정상 완료. 서킷 브레이커 미발동.

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

| GAP | 유형 | 발견 단계 | 발생(원인) 단계 | 상태 | 사전 방지 질문 | 귀결 |
|---|---|---|---|---|---|---|
| GAP-001 | 문서-갱신 / 설계 (seed vs `package.json` 무변경) | Design(3) | Planning(2) | RESOLVED by DB Design | "카테고리 seed 를 어떤 메커니즘(prisma.seed key vs 마이그레이션 INSERT)으로 전달하며, 그것이 NFR-005·plan '무변경' 서술과 양립하는가?" | DB Design 이 마이그레이션 `INSERT ... ON CONFLICT DO NOTHING` 대안 채택으로 `package.json` 무변경 유지. 비블로킹 해소. 패치 불요(대안 절차가 정상 작동). |
| GAP-002 | 문서-갱신 (context.md §1·§2·§6) | Docs(6) | — (구현 진척 반영) | OPEN→Retrospective 위임 | — | PATCH-CXT-001·002·003 |
| GAP-003 | 문서-갱신 (context.md §3.2·§4·§5) | Docs(6) | — (구현 진척 반영) | OPEN→Retrospective 위임 | — | PATCH-CXT-004·005·006 |
| GAP-004 | 보안 / 권한 상승 (SEC-001 자가 승인 High) | Security(선택) | **Spec(1)·Planning(2)** | RESOLVED by Security 재실행 | "승인/상태 부여 엔드포인트(`approve`/`reject`)에서 호출자가 자기 자신을 대상으로 권한을 부여하는 자가 승인이 trivially 가능한가? ASM-005 의 'admin RBAC 후속' 타협이 그 위험을 수용 가능 수준으로 낮추는가?" | OBS-1 대응 PATCH-001 + PROC-003. 핵심 재작업 유발 GAP. |
| GAP-005 | 보안 / IDOR (SEC-002 재고 입고 소유권 미검증 Medium) | Security(선택) | Design(3)·Development(4) | OPEN (003 이전 수정 권고) | "재고 입고(`stock-in`)가 APPROVED 여부만 보는데, variantId 소유권(variant→product→seller)을 검증하지 않으면 경쟁사 상품 재고/상태 조작이 가능한가?" | PATCH-CXT-003 §6 제약 등재 + 003-commerce 이전 수정 권고. 본 spec 비블로킹. |

**역추적 핵심**: GAP-004 가 유일한 단계 복귀 유발 GAP 이다. 발견은 Security 단계였으나 **발생은 Spec(ASM-005 도출)·Planning(FR-015/016 설계)** 이다. spec.md FR-015 주석과 ASM-005 가 "admin role 검증은 JWT 수준으로 간소화, RBAC 은 후속" 으로 타협을 *문서화* 했으나, "자가 승인이 2단계 공격으로 trivially 성립" 한다는 **권한 상승 위험 자체** 를 식별·평가하지 않았다. 타협의 문서화 ≠ 위험의 평가. (OBS-1 과 동일 결론.)

### 1b. OBS-XXX 기반 PATCH 도출

> agent-observations.md 파일은 미존재. main session 이 Context 로 전달한 OBS-1~4 를 기준으로 도출.

| OBS | 관찰 요지 | 도출 패치 |
|---|---|---|
| OBS-1 | ASM-005(자가 승인 타협)가 Security 에서 SEC-001 High 로 표면화. 승인/권한부여 엔드포인트의 권한 상승 위험을 Spec/Planning 이 사전 식별·완화하지 못함. | **PATCH-001** (01-spec.md·02-planning.md 권한 모델 사전 평가 체크), **PROC-003** (cross-stage 권한 상승 사전 평가 흐름) |
| OBS-2 | Docs 재호출(SEC-001 반영) 시 SendMessage 재개로는 `user_permitted_overwrite` 플래그 전달 불가 → BLOCKED. 새 Agent 호출 Context 에 `user_permitted_overwrite:true` 전달로 해소. | **PROC-002** (기존 산출물 덮어쓰기 재작업 = 새 Agent 호출 필요, pipeline-recovery.md 명문화) |
| OBS-3 | Performance 1차 호출 세션 한도 중단(산출물 0) → 한도 리셋 후 동일 prompt 재호출 정상 완료. 001 Deploy 와 동일 패턴 재발. | **PROC-001** (장시간 파이프라인 선택단계 세션 한도 중단·재호출 패턴 명문화) |
| OBS-4 | fable 모델 unavailable → opus 대체. 001 PATCH-004(model:opus)로 이미 반영, 002 정상 동작. | 신규 패치 불요. §2 효과 측정에 O 기록. |

---

## 2. 재작업 패턴 분석

### 재작업·복귀 사이클

단 1개의 복귀 캐스케이드가 발생했으며, 모두 GAP-004(SEC-001 High)에서 비롯되었다.

```
Security(선택) gate FAIL — SEC-001 High (19:30, 캐스케이딩으로 Performance 스킵)
  → Development(4) 복귀: AdminGuard(fail-closed) + seller approve/reject 적용 (20:18~20:21)
  → Test EXECUTION(5b) 재검증: 98→101 PASS (+3 admin 회귀) (20:25)
  → Docs(6) 재실행: DIFF-002 v1.1·CHANGES 갱신 (20:27~20:32)
  → Security(재실행): SEC-001 RESOLVED, Critical/High 0 → COMPLETE, 캐스케이딩 해제 (20:34~20:38)
  → Performance(선택): NFR-001 PASS (21:22~21:27)
```

- **서킷 브레이커**: 미발동. 각 단계는 1회 재작업으로 통과(동일 단계 3회 초과 없음).
- **반복 원인**: 단일 근본 원인(SEC-001). 권한 상승 위험을 1단계(Spec)에서 잡았다면 4→5b→6→Security→Performance 의 약 1시간 캐스케이드를 회피 가능했다.
- **5b [B] 결함 4파일 수정** (정상 재작업 아님 — PPG-1 AUTHORING 특성): AUTHORING(5a)이 production 구현 전 가정한 메서드명·클래스명·페이로드가 실제와 불일치(`publishProduct→publish`, `ProductService→ProductEventsHandler` 등 다수). 5b 가 production 불변·테스트 측 정정으로 자체 수정. PPG-1 병렬 구조의 구조적 특성이나, 불일치 건수(4파일·30+ 항목)가 많아 tasks.md Test Authoring Contract 의 메서드 시그니처 고정도로 저감 여지 있음 → **PROC-004**.

### PROC-008 적용 완료 패치 효과 측정 (N=3, 표준 출력 — PROC-003)

> 측정 대상: 직전 N=3 차수의 적용 완료 패치. 본 버전 폴더에 선행 spec 은 001-skeleton-bootstrap 1개뿐 → 실측 N=1.

| 패치 | 의도 | 본 차수 효과 | 효과 발휘 여부 |
|---|---|---|---|
| PATCH-004 (001차) `model: opus` (fable unavailable 대체) | Planning·Design·Retrospective 의 모델 미가용 대체 | 002 에서 Planning·Design·Retrospective opus 정상 동작 (OBS-4) | O |
| (001차) Deploy 세션 한도 중단 관찰 — **완화 패치 미생성** | (해당 없음 — 패치로 승격되지 않음) | 002 Performance 에서 동일 세션 한도 중단 재발(OBS-3). 완화 절차 부재로 재발 차단 실패 | X (부분 미발휘) |

**효과 미발휘(X) 후속 처리** (PROC-003 (2)): 001 차수의 세션 한도 관찰이 OBS/패치로 승격되지 않아 002 에서 동일 패턴이 재발했다. PATCH-OBS-001 trigger 에는 해당하지 않으나 명백한 반복 시스템 마찰이므로 본 차수에서 안전망으로 **PROC-001** 을 신규 등록한다.

---

## 3. 설계 워크플로우 준수 점검

| 항목 | 준수 | 근거 |
|---|---|---|
| ① CHANGES.md 확인 | ✓ | Spec/Planning 이 001 완료·후속 주의사항 확인. pipeline-log 헤더 "이전 spec: 001 완료" |
| ② constitution.md 확인 | ✓ | Planning P2 — P-001~P-007 전부 PASS 검증 |
| ③ context.md 확인 | ✓ | Spec/Planning/Design 필수 읽기에 context.md 포함 |
| ④ infra.md 확인 | ✓ | Planning·Performance 가 참조 (배포·NFR 관련) |
| ⑤ spec.md [NEEDS CLARIFICATION] 해소 | ✓ | 0건 (spec.md 미결사항 = 없음) |
| ⑥ plan.md Constitution Gates 통과 | ✓ | P-001~P-007 PASS, cross-schema 회피 설계 |
| ⑦ research.md 코드베이스 분석 포함 | ✓ | Design D1 — auth 패턴·Prisma 확장·cross-schema·cursor/decreaseStock/이벤트 토폴로지 분석 |
| ⑧ tasks.md 전제 조건 체크 | ✓ | Development §7 체크8 — B-2 전제조건(CLARIFICATION 0·Gates PASS·data-model 확인) PASS |

워크플로우 위반 0건. PPG-1(4+5a) 병렬 spawn·동기화·5b 진입 규약 정상 준수.

---

## 4. 구조 개선 필요성

- **역할 경계 (Spec↔Planning↔Security)**: 권한 상승 위험 식별이 Security 단계까지 미뤄졌다. 권한 부여·상태 전이 엔드포인트(approve/reject/publish 등)의 위험은 Spec(가정 도출 시)·Planning(엔드포인트 설계 시)에서 사전 평가하는 것이 비용 효율적이다. → PATCH-001·PROC-003 으로 Spec/Planning 에 경량 체크 추가. 누락된 Agent 신설은 불요(기존 Security 가 안전망으로 정상 작동).
- **선택 단계 활성화 기준**: DB Design Y / Security Y / Performance Y / Deploy N 판정 적절. Security 활성화가 SEC-001 을 잡아낸 결정적 안전망이었다 — 활성화 기준 유효성 입증.
- **PPG-1 AUTHORING contract 정밀도**: §2 의 [B] 4파일 불일치는 tasks.md Test Authoring Contract 가 메서드 시그니처를 충분히 고정하지 못한 데서 기인. → PROC-004(비블로킹 개선).

---

## 5. 작업 기록 분석

- 모든 Agent 가 필수 읽기 문서를 읽고 §7 8개 체크를 runs/pipeline-log 에 기록(요약·생략 없음). constitution·context·infra 참조 적절.
- Agent 간 Context 충분: Security 가 DIFF-002-catalog.md 를 입력으로 정확히 수신, Performance 가 test-report P95 를 입력으로 수신.
- **비효율 패턴 1 (반복)**: 초기 단계(Spec·Planning·DB Design)의 `agent 시작/작업 절차` 이벤트 다수가 `[시각 미확인]` 으로 기록됨(pipeline-log L15~93 등). 후기 단계(Test EXECUTION·Security·Performance)는 분 단위 실시각 기록. §10(이벤트마다 date 재획득) 준수 편차. 본 회고 환경에서도 Bash 미제공으로 동일 한계 — 시스템 차원 미흡이므로 강제 패치보다 관찰 기록으로 남긴다(저severity).
- **비효율 패턴 2**: Security·Docs 재실행 시 §6.2 단축이 정상 적용(동일 세션 내 재호출 식별)되어 토큰 절약 — 모범 동작.

---

## 6. 전역 규칙·참조 문서·스킬 개선 검토

| 후보 | 대상 | 적합성(범용/역할정합) | 처리 |
|---|---|---|---|
| 권한 부여·상태 전이 엔드포인트 권한 상승 사전 평가 | `~/.claude/agents/01-spec.md`, `02-planning.md` | 범용 O(모든 도메인 권한 모델) / 역할정합 O | PATCH-001 |
| 세션 한도 중단·동일 prompt 재호출 패턴 | `~/.claude/rules/on-demand/claude-code-tools.md` §4 또는 orchestration 흐름 | 범용 O(장시간 파이프라인 공통) / 역할정합 O | PROC-001 |
| 기존 산출물 덮어쓰기 재작업 = 새 Agent 호출(`user_permitted_overwrite` Context), SendMessage 재개 불가 | `~/.claude/docs/pipeline-recovery.md`, `pipeline-protocols.md` | 범용 O(모든 재작업 overwrite) / 역할정합 O | PROC-002 |
| PPG-1 Test Authoring Contract 메서드 시그니처 고정도 강화 | `~/.claude/agents/03-design.md` (tasks.md D 레이어 contract) | 범용 O(TDD Red 가정 drift) / 역할정합 O | PROC-004 |

- constitution.md 변경 필요성: **없음**. 본 spec 은 P-001~P-007 을 모두 준수했고 조항과의 현실 괴리 없음.
- 잔존 참조 grep: 전역 문서 파일 이동·삭제 이력 없음 → grep 점검 불요.
- 환경 태깅: PATCH-001 내용은 언어·OS 불문(권한 모델 일반) → 태그 불요.

---

## 7. 우선 개선 항목

> 심각도 기준: Critical 전체 + High 상위 3개.

| 순위 | 항목 | 심각도 | 패치 |
|---|---|---|---|
| 1 | 권한 부여·승인 엔드포인트 권한 상승 위험 사전 평가(Spec/Planning) — SEC-001 약 1시간 캐스케이드 재작업의 근본 원인 | High | PATCH-001 + PROC-003 |
| 2 | 기존 산출물 덮어쓰기 재작업 시 새 Agent 호출 필요(SendMessage overwrite 불가) 명문화 — 재작업마다 마찰 | High | PROC-002 |
| 3 | 장시간 파이프라인 선택단계 세션 한도 중단·재호출 패턴 명문화 — 001·002 연속 재발 | High | PROC-001 |
| 4 | context.md/infra.md 구현 현행화(GAP-002·003) | Medium | PATCH-CXT-001~007 |
| 5 | SEC-002 IDOR(재고 입고 소유권) — 003 이전 수정 권고, §6 제약 등재 | Medium | PATCH-CXT-003(§6), 003 backlog |
| 6 | PPG-1 AUTHORING 메서드 시그니처 drift 저감 | Low | PROC-004 |

---

## 8. memory 저장 후보 (사용자 검토 필요)

핵심 원칙 §8 의 4기준(범용성·최우선 중요도·반복 검증·글로벌 흡수 불가능)을 **모두** 충족하는 항목만 등재한다. 본 차수 검토 결과:

**없음.**

- 권한 상승 사전 평가(OBS-1)·세션 한도 재호출(OBS-3)·SendMessage overwrite(OBS-2)·AUTHORING drift 는 모두 **글로벌 규칙·Agent 정의·전역 docs 패치로 더 잘 해결**되므로 기준 (d) 미충족 → memory 가 아닌 PATCH-001 / PROC-001~004 로 처리.
- 세션 한도 재발(001·002)은 기준 (c) 반복 검증을 충족하나 (d) 미충족(orchestration 문서 패치가 더 적합)으로 제외.
- 따라서 memory 저장 후보 없음. 실제 memory 작성은 어떤 경우에도 main session 책임이며, 본 Agent 는 위 판단만 제공한다.
