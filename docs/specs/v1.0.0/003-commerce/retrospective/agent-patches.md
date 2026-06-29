---
작성: Retrospective Agent (main session persist)
버전: v1.0
최종 수정: 2026-06-29
상태: 적용 완료 (docs-change-logs/2026-06-29-001)
---

# Agent Patches: 003-commerce

## PATCH-01: 04-development.md — 4단계 완료 기준에 런타임 부팅/e2e 1회 검증 추가
- 대상: `~/.claude/agents/04-development.md` 완료 체크리스트/자가검증
- 변경: 완료 기준에 "구현 완료 후 AppModule 부팅 또는 e2e 1회(또는 docker build)로 런타임 초기화(DI 구성·모듈 import) 1회 검증" 추가. typecheck/unit만으로는 DI wiring·CommonJS/ESM import 비호환·onModuleInit 런타임 실패를 검출하지 못함 명시.
- 근거: OBS-1, 재작업 #3(PaymentModule.exports 누락)·#4(pg-boss default import) — 둘 다 typecheck/unit PASS, AppModule 초기화에서만 실패.
- 상태: 적용 완료 (docs-change-logs/2026-06-29-001)

## PATCH-02: typescript.md — CommonJS `export =` 모듈 default import 금지 규약
- 대상: `~/.claude/rules/on-demand/typescript.md` 신규 절
- 변경: "CommonJS `export = X` 패키지(pg-boss v10 등)를 `import X from 'pkg'`로 가져오면 esModuleInterop 미설정 시 typecheck/unit 통과하나 런타임에서 `default is not a constructor`로 실패. `import X = require('pkg')` 또는 `import * as X` 사용, 또는 tsconfig esModuleInterop 명시." 진단신호+권장패턴.
- 근거: OBS-1/OBS-5, 재작업 #4 (pg-boss 3파일 동일 실패).
- 상태: 적용 완료 (docs-change-logs/2026-06-29-001)

## PATCH-03: 05-test.md — mock↔production 실제 데이터 경로 정합 규약
- 대상: `~/.claude/agents/05-test.md` AUTHORING mock 작성 / EXECUTION [B] 점검
- 변경: (1) AUTHORING — mock이 검증 대상 메서드의 실제 분기 경로를 재현. production이 값을 하드코딩(예 `payments:[]`)해 분기가 한쪽으로만 흐르면, mock이 그 경로 대신 happy 데이터를 주입해 분기를 우회시키지 않는지 점검. (2) EXECUTION — SC 단언이 상태전이 결과/부수효과 호출을 강하게 단언하는지 점검.
- 근거: OBS-2/OBS-4, GAP-004(SC-024 mock이 cancel 환불 미실행을 가림), GAP-005(약한 단언).
- 상태: 적용 완료 (docs-change-logs/2026-06-29-001)

## PATCH-04: 03-design.md — research 외부 라이브러리 채택 시 import 구문 형태 명시
- 대상: `~/.claude/agents/03-design.md` research 외부 라이브러리 조사 절차
- 변경: research가 외부 라이브러리 채택 시 버전·런타임 호환에 더하여 권장 import 구문(default/`require`/namespace)을 1줄 명시. CommonJS `export =` 패키지는 import 형태를 tasks.md 구현 지침에 전달.
- 근거: OBS-5 — pg-boss v10 버전 호환은 사전 검증했으나 import 형태 미명시로 4단계 default import 실패 누수.
- 상태: 적용 완료 (docs-change-logs/2026-06-29-001)

## PATCH-05: 05-test.md — AUTHORING 산출 spec 파일 사전 `tsc --noEmit` 컴파일
- 대상: `~/.claude/agents/05-test.md` AUTHORING 완료 기준
- 변경: AUTHORING 완료 전 작성 spec 파일을 `tsc --noEmit`로 1회 검증하여 테스트 코드 자체 타입/컴파일 오류 0건 확인. TDD Red는 단언 실패이지 컴파일 실패가 아님.
- 근거: GAP-003 — `order.service.spec.ts` it.each 타입 오류로 스위트 실행 불가.
- 상태: 적용 완료 (docs-change-logs/2026-06-29-001)

---

# context.md / infra.md 갱신 패치 (PATCH-CXT)

## PATCH-CXT-001: context.md — cart/order/payment 실구현·pgboss·19테이블·SEC-002 해소
- 대상: `doa-next/.claude/docs/context.md` §1·§2·§3·§4·§5·§6
- 변경: 8개 실구현(+cart·order·payment)+10 스텁 / PrismaService ALS tx 확장 / infrastructure/pgboss(PgBossModule·OutboxRelay·AutoConfirmJob) / outbox+pg-boss 흐름 / delivered→completed 자동확정 / 19테이블 / 용어(idempotencyKey·VariantSnapshot·PaymentGatewayPort·outbox) / §6 "10개 스텁"·SEC-002 RESOLVED.
- 근거: GAP-002. 코드 검증: Docs가 GAP-002에서 수행.
- 상태: 적용 완료 (docs-change-logs/2026-06-29-001)

## PATCH-CXT-002: infra.md — pg-boss 운영(pgboss 스키마 CREATE 권한·Node/버전 핀·AUTO_CONFIRM_DAYS)
- 대상: `doa-next/.claude/docs/infra.md` §3·§4·§5·§7·§8
- 변경: pg-boss가 동일 DB에 pgboss 스키마 앱 기동 시 자동 생성→CREATE 권한 필요(§7 체크리스트) / pg-boss@^10.4.2 핀(CommonJS·Node≥20, v11/v12 비호환, import=require) §8 / payment_outbox pending 적체·AutoConfirmJob 모니터링 §4 / AUTO_CONFIRM_DAYS=7 운영 임계값.
- 근거: GAP-001. 코드 검증: order.constants AUTO_CONFIRM_DAYS=7, package.json pg-boss@^10.4.2.
- 상태: 적용 완료 (docs-change-logs/2026-06-29-001)
