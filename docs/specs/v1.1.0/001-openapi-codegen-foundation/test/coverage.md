---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (retroactive)
---

# Coverage: 001-openapi-codegen-foundation

## 목차

- [실행 요약](#실행-요약)
- [SC × 시나리오 커버리지 매트릭스](#sc--시나리오-커버리지-매트릭스)
- [커버리지 요약](#커버리지-요약)
- [STALE_SC 경고](#stale_sc-경고)

---

## 실행 요약

> 본 retroactive 검증은 001 완료 커밋 `678ba1c`(base `6c4ddae`) 기준으로 main session 이 게이트를 직접
> 재실행·생성물 카운트하여 확인한 수치다. 본 차수는 인프라/코드젠으로 별도 단위 테스트 스위트가 없으며,
> SC 는 **생성 성공 + 생성물 정적 카운트/조회 + 타입체크**로 판정한다.

| 항목 | 본 retroactive 검증 (HEAD `678ba1c`) |
|---|---|
| openapi:gen (백엔드 생성) | **성공** — `apps/backend/openapi.json` 산출(OpenAPI 3.0.0) |
| openapi.json paths | **70** (직접 카운트 `Object.keys(d.paths).length`) |
| openapi.json component schemas | **32** (입력 DTO `*Dto` 31 + `OrderItemInput`) |
| openapi.json info | title `DOA Market API` / version `1.0.0` |
| securitySchemes | `access-token` (http bearer JWT) |
| gen (프론트 코드젠) | **성공** — `openapi.gen.ts` **3220줄**(paths/components/operations) |
| index.ts 재노출 | `paths`/`components`/`operations` + `Schemas`/`Schema<K>` (수기 타입 한시 유지) |
| console typecheck | **회귀 0** (`pnpm --filter console typecheck` — main 검증) |
| backend `tsc --noEmit` | **0 error** (main 검증) |
| 신규 단위 테스트 | **0** (코드젠/인프라 — 생성·정적·타입체크로 갈음) |
| 마이그레이션 | **없음** (DB 스키마 변경 0) |

> **신규 단위 0 산정 근거(사실 기준)**: 001 git diff(`git diff 6c4ddae 678ba1c -- apps/backend
> packages/shared-types`)에 `*.spec.ts` 변경·추가가 없다(변경 파일 = nest-cli.json·openapi.ts·
> package.json 2종·index.ts·생성물 2종). 검증은 생성 스크립트 실행 성공 + 생성물 직접 카운트 +
> console/backend tsc 0 으로 갈음한다.

### 생성물 직접 카운트 (자가 보고 비신뢰)

| 산출물 | 측정값 | 방법 |
|---|---|---|
| openapi.json paths | 70 | `node -e "Object.keys(require('./apps/backend/openapi.json').paths).length"` |
| openapi.json schemas | 32 | `node -e "Object.keys(...components.schemas).length"` |
| openapi.gen.ts 줄수 | 3220 | `wc -l packages/shared-types/src/openapi.gen.ts`(awk END{NR} 동일) |

### 실행 커맨드

```bash
pnpm --filter backend openapi:gen        # nest build → node dist/openapi.js → openapi.json (70 paths 출력)
pnpm --filter @doa/shared-types gen      # openapi.json → openapi.gen.ts (3220줄)
pnpm --filter console typecheck          # tsc --noEmit (회귀 0)
cd apps/backend && npx tsc --noEmit      # EXIT 0
```

---

## SC × 시나리오 커버리지 매트릭스

| SC-ID | 수용 기준 | 케이스 | 상태 |
|---|---|---|---|
| SC-001 | openapi.json 70 paths/32 schemas 생성 | openapi:gen 실행 + 카운트 | PASS(build) |
| SC-002 | 스키마 속성·검증·enum·desc 자동 | RegisterDto·CreateCouponDto 조회 | VERIFIED(static) |
| SC-003 | openapi.gen.ts 3220줄·재노출 | gen 실행 + wc -l + index.ts grep | VERIFIED(static) |
| SC-004 | 빌드 경유 결정적 재생성 | openapi:gen(nest build && node dist/openapi.js) | VERIFIED(static)/PASS(build) |
| SC-005 | console·backend typecheck 회귀 0 | tsc --noEmit | PASS(typecheck) |

---

## 커버리지 요약

| 항목 | 수 |
|---|---|
| 전체 SC | 5 (생성 성공 1 + 스키마 속성 1 + 코드젠·재노출 1 + 결정성 1 + 타입체크 1) |
| PASS (생성 성공·타입체크 직접) | 3 (SC-001·004·005) |
| VERIFIED (정적 생성물 검증) | 2 (SC-002·003 — 스키마 속성·gen 줄수/재노출 조회) |
| GAP | 0 (단, response 스키마 보강·생성물 CI 검증 자동화 부재는 coverage-gap.md·GAP-001-01 참조) |

> SC-001(생성 70 paths)·SC-004(빌드 경유 결정성)·SC-005(typecheck 회귀 0)는 실행으로 직접 PASS,
> SC-002(스키마 속성 자동)·SC-003(gen 줄수·재노출)는 생성물 정적 조회로 확인(VERIFIED). 모든 SC 가
> 충족되며, response 스키마 미주석·생성물 CI 검증 자동화 부재는 Low 등급 잔여 권고다(GAP-001-01).
> Phase 0 핵심 목표(수기 shared-types 18도메인 동기화 부담 제거)는 70 paths/32 schemas 자동 생성 +
> console typecheck 회귀 0 으로 달성.

---

## STALE_SC 경고

STALE_SC 검출 결과: **0건**

검출 대상: 001 git diff(`git diff 6c4ddae 678ba1c -- apps/backend packages/shared-types`) 변경 파일.
변경 파일에 테스트 SC 번호를 포함한 `*.spec.ts` 가 없고(코드젠/인프라), SC 판정은 본 coverage.md·
test-cases.md 가 생성물 직접 카운트/조회로 담당한다. semantic mismatch 없음.
