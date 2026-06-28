---
작성: Retrospective Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 검토중
---

# Process Patches: 001-skeleton-bootstrap

> 프로세스·흐름 제어 개선 제안. 적용 주체 = main session (사용자 승인 후).

## 목차

- [PROC-001: gaps.md "코드 검증" 기재 시 실제 grep/Read 강제](#proc-001-gapsmd-코드-검증-기재-시-실제-grepread-강제)
- [PROC-002: 모델 가용성 의존 Agent 의 SendMessage 재개 정책](#proc-002-모델-가용성-의존-agent-의-sendmessage-재개-정책)
- [PROC-003: 컨테이너 빌드 경로 정합성 사전 점검 (Design/Development)](#proc-003-컨테이너-빌드-경로-정합성-사전-점검-designdevelopment)

---

## PROC-001: gaps.md "코드 검증" 기재 시 실제 grep/Read 강제

- **현재 프로세스**: gaps.md 의 문서-갱신-필요 GAP(예: context.md/infra.md 갱신)에 "코드 검증: ... 확인" 항목을 기재할 수 있으나, 실제 파일 grep/Read 후 라인 근거를 남기도록 강제하는 규약이 없다. retrospective 단계의 PATCH-CXT 작성은 PROC-002(이 프로젝트 글로벌 규칙)로 코드 검증이 강제되지만, **gaps.md 를 작성하는 Docs/Design/Deploy Agent 단계**는 미보호.
- **문제점**: GAP-004 item 1 이 context.md 현재 버전 갱신 근거로 `package.json "version":"1.0.0" 확인` 을 기재했으나 실제 값은 `0.0.1` 이었다(scaffold 기본값). 코드 확인 없는 "검증" 기재가 retrospective 까지 전파되어, retrospective 가 PROC-002 로 재검증하지 않았다면 잘못된 근거가 context.md 에 박제될 뻔했다.
- **개선 방향**: gaps.md 형식 규약(pipeline-conventions §6)에 추가 — "GAP 항목에 '코드 검증' 을 기재할 때는 grep/Read 로 직접 확인한 **파일 경로 + 라인 번호 + 확인 사실**을 명시한다. 미확인 시 '코드 검증: 미수행' 으로 명시하고 단정적 사실 기재를 금지한다." 또는 각 Agent 정의의 gaps.md 기록 절에 동일 강제 추가.
- **영향 범위**: pipeline-conventions §6(gaps.md 형식), 06-docs.md / 03-design.md / deploy.md(gaps.md 기록 절), retrospective PROC-002 와 정합.

---

## PROC-002: 모델 가용성 의존 Agent 의 SendMessage 재개 정책

- **현재 프로세스**: Agent 정의 frontmatter `model:` 이 고정 모델(fable)을 지정한다. 모델이 unavailable 일 때 main session 이 다른 모델(opus)로 대체 spawn 한다. 그러나 SendMessage 재개(다회차 대화/재작업)는 원래 Agent 정의의 model 로 되살아난다.
- **문제점**: OBS-1·OBS-2 — fable(Fable 5) unavailable 상태에서 02/03/07 단계마다 opus 대체가 필요했고, 특히 OBS-2 처럼 SendMessage 재개 시 fable 로 되살아나 다시 unavailable 실패 → 재작업이 '새 spawn + model override' 로만 가능했다. 재개 경로(SendMessage)가 모델 가용성 fallback 을 보존하지 못해 컨텍스트 보존 이점을 잃고 새 spawn 비용 발생.
- **개선 방향**: orchestration/recovery 규약에 추가 — "frontmatter `model:` 로 고정 모델을 지정한 Agent 가 모델 unavailable 로 대체 spawn 된 경우, 해당 단계의 후속 재작업·재개는 SendMessage 재개가 아니라 **동일 override 모델로 새 spawn** 한다(재개 시 원 model 로 회귀하여 재실패하므로). main session 은 pipeline-log '단계 시작' 비고에 override 모델을 기록하여 재작업 시 동일 모델 적용을 보장한다." 근본 해결은 PATCH-004(frontmatter model 재검토)와 병행.
- **영향 범위**: pipeline-recovery.md(재개 정책), pipeline-protocols.md(SendMessage 재개), agent frontmatter(PATCH-004 연계).

---

## PROC-003: 컨테이너 빌드 경로 정합성 사전 점검 (Design/Development)

- **현재 프로세스**: Dockerfile 의 정합성(특히 pnpm 워크스페이스에서 Prisma client 생성 경로)이 최종 선택 단계인 Deploy Agent 의 동적 docker build 검증에서야 확인된다. 4 Development 의 빌드 자가 검증은 typecheck(`tsc --noEmit`) 중심이며 docker build 를 포함하지 않는다.
- **문제점**: OBS-5 — `apps/backend/Dockerfile` L53 의 `.prisma` COPY 경로가 pnpm hoist 구조와 불일치하여 docker build 실패. 이를 Deploy 단계(6단계 후)에서야 동적으로 발견·수정. FR-014/SC-022 가 docker build 성공을 요구하므로, 빌드 정합성은 더 이른 단계에서 검증 가능했다.
- **개선 방향**: (1) 3 Design 영향 파일 분석에 "컨테이너 빌드 산출물 경로(Prisma generate 출력 등)가 Dockerfile COPY 대상과 일치하는지" 점검 항목 추가, 또는 (2) 4 Development 구현 완료 기준에 "FR-014(docker build) 가 SC 로 존재하면, 로컬에서 `docker build` 1회 실행하여 성공 확인" 추가. PATCH-001(docker.md 패턴)과 병행하면 Development 단계에서 경로 패턴을 사전 적용 가능.
- **영향 범위**: 03-design.md(영향 파일 분석), 04-development.md(구현 완료 기준), docker.md(PATCH-001 연계).
