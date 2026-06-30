---
작성: Retrospective Agent
버전: v1.0
최종 수정: 2026-06-30 23:43
상태: 적용 완료 (PATCH-001·PATCH-002 — 2026-06-30, docs-change-logs/2026-06-30-001.md)
---

# Agent Patches: 012-console-phase4-polish

> 적용 주체 = main session (사용자 승인 후). 본 Agent 는 제안만 한다.
> context.md / infra.md 갱신 패치(PATCH-CXT)는 `context-infra-updates.md` 에 분리 기재.

## 목차

- [PATCH-001 — 05-test.md EXECUTION coverage SC 원문 대조 가드](#patch-001)
- [PATCH-002 — 02-planning.md 미검증 외부 enum/상수 리터럴 표기 규율](#patch-002)

---

## PATCH-001

**대상 파일**: `~/.claude/agents/05-test.md` (Test Agent — EXECUTION 모드)
**대상 섹션**: EXECUTION 모드 — coverage.md / coverage-gap.md 작성 절차
**적합성**: 범용 O (모든 프로젝트의 5b EXECUTION 이 coverage 문서를 생성) / 역할정합 O (coverage.md·coverage-gap.md 는 EXECUTION 모드 단일 소유 산출물)

- **현재 내용** (agent-observations.md OBS-001 발췌 기반): EXECUTION 모드는 SC 커버리지 매트릭스·coverage-gap 을 작성하되, 각 SC 행의 "수용 기준" 설명과 "검증 파일" 경로를 spec.md 원문·실제 생성 파일과 1:1 대조하는 강제 점검 항목이 없다.
- **관찰(OBS-001)**: 5b 가 `coverage.md`·`coverage-gap.md` 에서 SC-021~025 를 spec.md 정의(로그인·판매자/관리자 접근·리다이렉트·타이밍)와 전혀 다른 "이미지 업로드 E2E"(presign 3단계·10장 제한)로 기재하고, 존재하지 않는 파일(`image-upload-flow.spec.ts`·`admin-access.spec.ts`)·태스크(T020/T021)를 참조했음에도 gate: PASS("설계 문서 정합성 이상 없음")로 보고. main session 이 spec.md SC 원문과 대조해 불일치를 포착 → REWORK_NEEDED 정정. 실제 테스트(315 PASS)·실제 e2e 파일(auth/seller/admin/guard.spec.ts)은 정합이었고 **문서만** 오기재.
- **추정 원인**: SC 번호만 보고 설명을 임의 재구성(spec 범위 외 이미지 업로드를 E2E SC 로 기재). spec.md 원문 인용·실제 파일 경로 검증 절차 부재.
- **변경 내용** (05-test.md EXECUTION 모드 coverage 작성 절차에 가드 신설):
  1. coverage.md / coverage-gap.md 의 각 SC 행 "수용 기준" 열은 **spec.md 의 해당 SC 원문을 복사**한다(요약·재구성 금지). 복사 후 spec.md 의 SC-ID 와 텍스트 동일성을 자체 대조한다.
  2. "검증 파일" 열은 **실제 생성·존재하는 테스트 파일 경로만** 기재한다(Glob/Read 로 존재 확인). 미생성·추측 파일명 기재 금지.
  3. "태스크" 열은 tasks.md 에 실재하는 T-ID 만 참조한다.
  4. gate: PASS 판정 전, DEFERRED(env:e2e-docker) SC 를 포함한 전 SC 행에 대해 위 1~3 자체 점검을 수행하고 통과 시에만 PASS 보고. (특히 파이프라인 내 미실행 DEFERRED SC 는 실행 결과가 없어 설명 재구성 유혹이 크므로 원문 복사 강제가 핵심.)
- **변경 근거**: OBS-001 (트리거 §12(c) — main 의 산출물 품질 의문 제기).

---

## PATCH-002

**대상 파일**: `~/.claude/agents/02-planning.md` (Planning Agent)
**대상 섹션**: plan.md 핵심 설계 — 코드 예시 작성 규율
**적합성**: 범용 O (모든 언어/프로젝트에서 plan 이 외부 enum·상수를 인용) / 역할정합 O (plan.md 작성 규율은 Planning Agent 소유)

- **현재 내용** (GAP-001 발췌 기반): Planning Agent 는 외부 enum/상수 값을 plan.md 코드 예시에 사용할 때, 미검증 값을 **그럴듯한 실값처럼** 구체 리터럴로 표기할 수 있다. 본 차수 plan.md L128 은 `purpose: FilePurpose; // 'PRODUCT' | 'BANNER'` 로 표기했으나 실제 Prisma `FilePurpose` enum 값은 `PRODUCT_IMAGE·REVIEW_IMAGE·PROFILE` 로, `'PRODUCT'`·`'BANNER'` 둘 다 미존재였다.
- **관찰(GAP-001)**: plan 은 별도로 "기타 고려사항 — FilePurpose enum 확인"(L354)에서 Design 에게 실값 검증을 **명시적으로 위임**했고 Design 이 RESOLVED 처리했다. 즉 위임 절차 자체는 정상 작동했으나, 코드 예시 본문에는 미검증 추정값이 실값처럼 박혀 있어 검증을 건너뛸 경우 오해·400 오류 위험이 남았다.
- **변경 내용**: plan.md 코드 예시에서 **소스로 검증하지 않은 외부 enum/상수 값**은 구체 리터럴 대신 `[TO-VERIFY: <enum명> 실값 — Design 확인]` 형태의 명시적 미검증 마커로 표기한다. 검증을 후속 단계에 위임하는 경우 "기타 고려사항" 위임 노트와 코드 예시 마커를 일관시킨다(코드 예시에는 확정값처럼 쓰고 노트에서만 "확인 필요"라고 적는 이중 표기 금지).
- **변경 근거**: GAP-001 (설계-가정-불일치). 위임은 정상이었으나 코드 예시의 추정 리터럴이 검증 누락 시 함정이 됨. 본 차수는 Design 이 잡아 무해했으나 사전 차단 가치 있음.
- **강제도 권고**: SHOULD (위임 절차가 이미 동작하므로 MUST 아님). 단, `01-design-rules.md §3-2 코드 예시 작성 원칙`(상수명 사용 권장)과 동일 계열의 보완.
