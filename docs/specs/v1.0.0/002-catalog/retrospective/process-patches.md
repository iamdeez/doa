---
작성: Retrospective Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 검토중
---

# Process Patches: 002-catalog

> 적용 주체 = main session (사용자 승인 후). 본 Agent 는 제안만 한다.

## 목차

- [PROC-001 — 장시간 파이프라인 선택단계 세션 한도 중단·재호출 패턴](#proc-001--장시간-파이프라인-선택단계-세션-한도-중단재호출-패턴)
- [PROC-002 — 기존 산출물 덮어쓰기 재작업은 새 Agent 호출 필요](#proc-002--기존-산출물-덮어쓰기-재작업은-새-agent-호출-필요)
- [PROC-003 — 권한 상승 위험 cross-stage 사전 평가 흐름](#proc-003--권한-상승-위험-cross-stage-사전-평가-흐름)
- [PROC-004 — PPG-1 Test Authoring Contract 메서드 시그니처 고정도 강화](#proc-004--ppg-1-test-authoring-contract-메서드-시그니처-고정도-강화)

---

## PROC-001 — 장시간 파이프라인 선택단계 세션 한도 중단·재호출 패턴

- **현재 프로세스**: 세션 사용 한도 도달 시 Phase Agent spawn 이 산출물 0 으로 중단될 수 있으나, 이에 대한 표준 복구 절차가 orchestration 흐름·docs 에 명문화되어 있지 않다.
- **문제점**: 002 Performance Agent 1차 호출이 세션 한도로 중단(산출물 0) → 한도 리셋 후 동일 prompt 재호출로 정상 완료(OBS-3). 001-skeleton-bootstrap 의 Deploy 단계에서도 동일 패턴이 관찰되어 **2차수 연속 재발**. 매번 ad-hoc 으로 대응 중.
- **개선 방향**: "Phase Agent 가 세션/사용 한도로 산출물 미생성 중단된 경우 = 단계 결함이 아니므로 복귀 불요. 한도 리셋 후 **동일 prompt·동일 단계 재호출**(직전 산출물 없음 → overwrite 무관). pipeline-log 에 `재호출(세션 한도)` 비고로 기록." 을 명문화. 선택단계(Deploy/Security/Performance)는 파이프라인 후반부라 누적 세션 소모가 커 특히 빈발 — 해당 단계 진입 전 한도 여유 점검 권장(SHOULD).
- **영향 범위**: `~/.claude/rules/on-demand/claude-code-tools.md` §4(비동기·재개) 또는 `~/.claude/docs/pipeline-recovery.md` 재개 절차. orchestration(main session) 흐름.

---

## PROC-002 — 기존 산출물 덮어쓰기 재작업은 새 Agent 호출 필요

- **현재 프로세스**: 재작업 시 SendMessage 재개로 Phase Agent 컨텍스트를 이어가는 것을 권장하나(agent-rules §5), 기존 산출물 **덮어쓰기**가 필요한 재작업에서 SendMessage 재개로는 `user_permitted_overwrite` 권한 플래그를 전달할 수 없다.
- **문제점**: SEC-001 반영을 위해 Docs Agent 를 재호출(DIFF-002·CHANGES 갱신)할 때, coordinator(SendMessage) 메시지에 `user_permitted_overwrite` 권한이 없어 BLOCKED. main 이 사용자 직접 승인 후 **새 Agent 호출 Context** 에 `user_permitted_overwrite:true` 를 전달하여 해소(OBS-2). 절차가 문서화되지 않아 1회 BLOCKED 우회 비용 발생.
- **개선 방향**: pipeline-recovery.md / pipeline-protocols.md 에 명문화 — "이미 생성된 산출물을 **덮어쓰는** 재작업(예: DIFF/CHANGES 재생성, 보고서 갱신)은 SendMessage 재개가 아니라 **새 Agent 도구 호출**로 수행하며, 호출 prompt Context 에 `user_permitted_overwrite: true`(사용자 승인 후)를 명시한다. SendMessage 재개는 신규 산출물 추가·미완성분 이어쓰기에 한한다."
- **영향 범위**: `~/.claude/docs/pipeline-recovery.md`(재개·복구), `~/.claude/docs/pipeline-protocols.md`(통신 규약), agent-rules §5 SendMessage 패턴 주석.

---

## PROC-003 — 권한 상승 위험 cross-stage 사전 평가 흐름

- **현재 프로세스**: 권한 모델 위험은 Security 선택 단계(활성화 시)에서 사후 감사로 잡힌다. Spec/Planning 은 권한 타협을 ASM/주석으로 *문서화* 하되 위험을 *평가* 하는 단계가 없다.
- **문제점**: ASM-005(seller 자가 승인 JWT-only 타협)가 Security 에서 SEC-001 High 로 표면화되어 4→5b→6→Security→Performance 약 1시간 복귀 캐스케이드 유발(GAP-004, OBS-1). 위험 평가가 1단계로 당겨졌다면 회피 가능했다. 또한 Security 가 **비활성화** 된 spec 이었다면 자가 승인 취약점이 운영까지 유출됐을 것 — 안전망이 선택 단계에만 의존하는 구조적 약점.
- **개선 방향**: PATCH-001(01-spec.md·02-planning.md 권한 모델 사전 평가 체크)을 흐름 차원에서 강제 — Spec 가정 도출 시 권한 부여/상태 전이 엔드포인트의 자가·타인 자원 조작 가능성을 평가하고, 수용 시 단순 ASM 이 아닌 *위험 수용 근거* 를 남긴다. Security 비활성 spec 에서도 최소 방어선이 Spec/Planning 에 존재하도록 한다.
- **영향 범위**: `~/.claude/agents/01-spec.md`, `02-planning.md`(PATCH-001 과 연동), selection-phases 판정 시 권한 변경 spec 의 Security 활성화 권고.

---

## PROC-004 — PPG-1 Test Authoring Contract 메서드 시그니처 고정도 강화

- **현재 프로세스**: PPG-1 에서 Test Agent(AUTHORING, 5a)가 Development(4)와 병렬로 테스트를 작성한다. AUTHORING 은 tasks.md 의 Test Authoring Contract 를 근거로 production 메서드명·클래스명·페이로드를 *가정* 한다.
- **문제점**: 5b 에서 [B] 설계 결함 4파일·30+ 항목 정정 발생 — `publishProduct→publish`, `deactivateProduct→deactivate`, `ProductService→ProductEventsHandler`(별도 클래스), 페이로드 `{productId,variantId,newStock}→{productId,totalStock}`, `'insufficient stock'→'Insufficient stock'` 등. production 불변·테스트 측 정정으로 자체 해소됐으나 정정량이 많다. PPG-1 병렬 구조의 구조적 특성이나, contract 정밀도로 저감 여지.
- **개선 방향**: 03-design.md 의 tasks.md D 레이어 Test Authoring Contract 작성 시, 단순 SC↔테스트 매핑을 넘어 **각 SC 가 검증할 production 심볼(클래스명·메서드 시그니처·이벤트 페이로드 키)을 canonical 형태로 명시**하도록 강화. 이벤트 핸들러가 service 와 별도 클래스(ProductEventsHandler 등)인 경우 그 분리를 contract 에 명기. 대소문자·예외 메시지 등 리터럴 단언은 production 상수 참조를 권장.
- **영향 범위**: `~/.claude/agents/03-design.md`(tasks.md D 레이어 contract 절), `~/.claude/agents/05-test.md`(AUTHORING 모드 가정 출처 명확화). 비블로킹·Low.
