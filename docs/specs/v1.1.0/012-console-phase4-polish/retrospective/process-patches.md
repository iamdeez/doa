---
작성: Retrospective Agent
버전: v1.0
최종 수정: 2026-06-30 23:43
상태: 적용 완료 (PROC-001 보강 → 05-test.md, docs-change-logs/2026-06-30-001.md / PROC-002 측정 전용·변경 없음)
---

# Process Patches: 012-console-phase4-polish

## 목차

- [PROC-001 — STALE_SC(선행 spec SC 번호 재사용) 처리 관행 확정](#proc-001)
- [PROC-002 — 직전 N=3 차수 적용 패치 효과 측정 결과](#proc-002)

---

## PROC-001

- **현재 프로세스**: spec 마다 SC-XXX 번호가 001 부터 재시작(`01-design-rules.md §3-1`)하므로, 동일 파일(예: `auth.service.spec.ts`)에 선행 spec 의 SC 번호가 잔존하면 본 차수 Test Agent 가 STALE_SC 로 검출한다. 본 차수는 PATCH-A18 rule(1)에 따라 `(v1.0.0/001 spec)` 출처 주석을 5개 describe 블록에 추가(옵션 A) → STALE_SC 경고 0건으로 silence 처리했다.
- **문제점**: team-lead 가 "SC 번호 전역 유니크화 vs 출처주석 관행" 검토를 요청. SC 번호를 전역 유니크화하면 spec 마다 SC-001 부터 시작하는 기존 컨벤션(`01-design-rules.md §3-1`)과 충돌하고, 모든 spec 의 SC 채번을 전역 카운터로 바꿔야 하는 광범위한 변경이 발생한다.
- **개선 방향 (검토 결과: 현행 유지 — 변경 불요)**:
  - SC 번호 전역 유니크화는 **채택하지 않는다**. spec 단위 SC 재시작은 spec 추적성·가독성에 유리하며 글로벌 컨벤션의 근간이다. 전역화 비용·소급 영향이 이익을 초과.
  - 출처 주석(PATCH-A18 rule(1)) 관행을 **표준 해소책으로 유지**한다. 본 차수에서 5건 검출 → 출처 주석 → 0건으로 정상 작동(이미 검증됨).
  - **보강 제안 (선택, SHOULD)**: `05-test.md` AUTHORING/EXECUTION 의 STALE_SC 처리 절에, "선행 spec 의 SC 번호가 동일 테스트 파일에 잔존하는 것은 SC 단위 재시작 컨벤션의 정상 부산물이며, 출처 주석(옵션 A) silence 가 표준 해소책이다 — 이상 징후로 매 차수 사용자 에스컬레이션 금지(단, 출처 주석이 없는 진짜 STALE 은 에스컬레이션 유지)"를 1줄 명시. 매 차수 동일 사안이 사용자 결정 대기로 반복 표면화되는 것을 방지.
- **영향 범위**: `~/.claude/agents/05-test.md` (STALE_SC 절). SC 채번 컨벤션(`01-design-rules.md`)은 **무변경**.

---

## PROC-002

> PROC-008(직전 N=3 차수 적용 패치 효과 측정) — 본 차수(012) pipeline-log 에서 직접 관찰된 패치 발휘 결과. 직전 spec retrospective 산출물 미로드 상태이므로, 본 차수 실행 로그에 발휘 흔적이 남은 패치만 측정 대상으로 한다.

| 패치 | 의도 | 본 차수 효과 | 효과 발휘 여부 |
|---|---|---|---|
| PATCH-A11 (context.md 부정합 사전 점검) | Design 단계에서 context.md 와 코드 부정합 사전 식별 | GAP-002(shared/auth 현행화 누락) 정확히 식별 → Docs/Retro 위임 | O |
| PATCH-A15 (신규 의존성 자가 점검) | 신규 의존 도입 시 Deploy 활성 필요 여부 자가 판정 | selection-phases.md 에서 `@playwright/test`(npm devDep, 로컬 E2E 전용) → Deploy 비활성 정당 판정 | O |
| PATCH-A18 (STALE_SC 출처주석 silence) | 선행 spec SC 번호 잔존 오탐 억제 | 5b/5a 에서 5건 검출 → 출처주석 → 0건 silence | O |
| PROC-001(research §F 호출측 테스트 식별) | FR 변경의 호출 측 마이그레이션 사전 열거 | research.md §F — FR-001 additive·호출측 마이그레이션 0건 식별 | O |
| PROC-002(PATCH-CXT 코드 검증) | context 갱신 패치의 코드 사실 검증 강제 | GAP-002 갱신 권고에 admin-ids.ts·admin.guard·auth.service·dto 코드 위치+diff 검증 첨부 | O |
| PROC-014(사후 운영 검증 피드백 사이클) | 파이프라인 종료 후 운영 결함 피드백 경로 명시 | spec.md "사후 운영 검증 피드백 사이클" 절에 StubFileStorage→R2·ADMIN_USER_IDS 미설정 2개 시나리오+수동 검증 권고 기재 | O |

- **효과 미발휘(X) 사례**: 없음. 단, OBS-001(5b coverage 문서 자가 정합성 미흡)은 기존 어떤 패치로도 커버되지 않은 신규 결함 → 본 차수 신규 안전망으로 PATCH-001(agent-patches.md) 등록. main session 이 이미 OBS-001 로 기록(트리거 §12(c)) → PATCH 도출로 정상 연결(PROC-003 (2)(a) 경로).
- **측정 범위 N=3**: 직전 1개 spec(011) 의 적용 패치만이 아니라 누적 안정화 패치(A11/A15/A18/PROC-001/002/014)를 본 차수 실행 흔적 기준으로 측정. 6개 패치 전부 발휘 → 안정화 확인, 차기 측정 대상에서 자동 제외 후보.
- **영향 범위**: 측정 전용. 신규 프로세스 변경 없음.
