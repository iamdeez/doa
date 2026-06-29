---
작성: Retrospective Agent (main session persist)
버전: v1.0
최종 수정: 2026-06-29
상태: 적용 완료 (docs-change-logs/2026-06-29-001)
---

# Process Patches: 003-commerce

## PROC-01: 서킷 브레이커 카운팅 — 동일 원인 반복 vs 독립 결함 연쇄 구분
- 현재: 동일 단계 재작업 3회 초과 시 자동 중단(재작업 횟수만 집계).
- 문제: 본 차수 4단계 재작업 4회(SC-011 / SEC-FIND 5건 / PaymentModule exports / pg-boss import)가 임계 초과했으나 각각 독립적·명확한 단일 결함의 연쇄이고 사용자 진행 의사 명확 → 중단 부적절. 카운팅이 "동일 원인 반복"과 "독립 결함 연쇄"를 구분 못함.
- 개선: 서킷 브레이커 판정 시 재작업 사유 코드/결함 식별자 비교 → (a) 동일 원인 N회 반복이면 중단, (b) 독립 결함 연쇄이면 사용자 확인 게이트("계속/중단" 선택)로 완화. main이 재작업 지시 시 "동일 원인 여부" 1줄 pipeline-log 기록.
- 영향: agent-rules §13, pipeline-quality.md(서킷 브레이커), main 흐름 제어.

## PROC-02: 4단계 런타임 통합 검증 책임 공백
- 현재: 4단계 자가검증 = typecheck + unit. 런타임 부팅(DI·import)·통합 검증은 5b·Security·main e2e 디버깅 의존.
- 문제: DI wiring 결함·모듈 import 비호환이 4단계 게이트 통과(typecheck/unit PASS) → 5b 3차·main 디버깅 누수. "런타임 초기화 검증"이 어느 단계 책임인지 공백.
- 개선: 4단계 완료 기준에 런타임 부팅 1회 검증 의무화(PATCH-01 연계). PPG-1 동기화(4+5a→5b) 진입 전 main이 "런타임 부팅 검증 수행 여부"를 단계 전환 자가검증 항목으로 확인.
- 영향: 04-development.md(PATCH-01), pipeline-quality.md 4단계 게이트, main 단계 전환 자가검증.

## PROC-03: deferred SC 모니터링 계획 명문화 (PROC-014 연계)
- 현재: SC-045/046(주문/결제 P95 integration)이 TEST_JWT_TOKEN 미설정·DB 시드 부재로 deferred("운영환경권장") 분류되어 파이프라인 내 검증 스킵.
- 문제: deferred 된 P95 검증의 차후 점검 일자/모니터링 계획이 spec/plan에 미기재 → 운영 환경 NFR 미달 사후 발견 위험.
- 개선: deferred(운영환경권장) SC는 coverage-gap.md에 "차후 점검 트리거(운영 시드 구성 후 P95 측정)" 1줄 명시 + infra.md §4 모니터링(POST /orders·/payments P95) 연결. Deploy=N으로 e2e 통합 검증 스킵 시 안전망.
- 영향: 05-test.md(coverage-gap 분류 시 트리거 명시), infra.md 모니터링, plan.md NFR 후속 계획.
