---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (retroactive)
---

# 테스트 실행 결과 — 001-openapi-codegen-foundation

## 목차

- [실행 요약](#실행-요약)
- [실패 목록](#실패-목록)
- [SC 매핑표 검증](#sc-매핑표-검증)
- [설계 문서 정합성](#설계-문서-정합성)
- [회귀 탐지](#회귀-탐지)

---

## 실행 요약

> 본 retroactive 검증은 001 완료 커밋 `678ba1c`(base `6c4ddae`)에서 main session 이 게이트를 직접
> 재실행·생성물 카운트하여 확인했다. 본 차수는 인프라/코드젠으로 별도 단위 테스트 스위트가 없으며,
> 검증은 생성 성공 + 생성물 정적 카운트 + 타입체크로 갈음한다.

| 항목 | 결과 (HEAD `678ba1c`) |
|---|---|
| 실행 일시 | 2026-06-29 22:32 |
| openapi:gen (백엔드) | **성공** — openapi.json(OpenAPI 3.0.0) 산출, 콘솔에 `paths: 70` 출력 |
| openapi.json paths / schemas | **70 / 32** (직접 카운트) |
| openapi.json info | title `DOA Market API` / version `1.0.0` / securityScheme `access-token`(http bearer JWT) |
| gen (프론트) | **성공** — openapi.gen.ts **3220줄** |
| console typecheck | **회귀 0** (PASS) |
| backend `tsc --noEmit` | **EXIT 0** |
| 전체 통과 여부 | **PASS** |
| 신규 단위 테스트 | **0** (코드젠/인프라 — 생성·정적·타입체크 갈음) |
| 마이그레이션 | **없음** (DB 스키마 변경 0) |

### v1.0.0(`6c4ddae`) → 001(`678ba1c`) 델타

| 항목 | base(`6c4ddae`) | 001(`678ba1c`) | 델타 |
|---|---|---|---|
| OpenAPI 문서 | 없음(Swagger 미설치) | openapi.json 70 paths·32 schemas | **신규 생성** |
| shared-types 타입 | 수기(001/002 도메인만) | + openapi.gen.ts 3220줄 + 재노출 | **코드젠 도입(수기 한시 유지)** |
| console typecheck | (기존 통과) | (통과 — 회귀 0) | 변화 없음 |
| 신규 의존 | — | `@nestjs/swagger ^11.4.4`·`openapi-typescript ^7.13.0` | +2(빌드/dev 도구) |

> **신규 단위 0 산정(직접 확인)**: `git diff 6c4ddae 678ba1c -- apps/backend packages/shared-types` 의
> 변경 파일은 nest-cli.json·src/openapi.ts(신규)·package.json 2종·index.ts·생성물 2종(openapi.json·
> openapi.gen.ts)이며 `*.spec.ts` 변경/추가가 0 이다. 코드젠/인프라 성격으로 단위 테스트 스위트 미추가.

### 실행 커맨드

```bash
cd /Users/krystal/workspace/doa/doa-next
pnpm --filter backend openapi:gen          # nest build → node dist/openapi.js → openapi.json (paths: 70)
pnpm --filter @doa/shared-types gen        # openapi.json → openapi.gen.ts (3220줄)
pnpm --filter console typecheck            # tsc --noEmit (회귀 0)
cd apps/backend && npx tsc --noEmit        # EXIT 0
# 생성물 카운트
node -e "const d=require('./apps/backend/openapi.json'); console.log(Object.keys(d.paths).length, Object.keys(d.components.schemas).length)"   # 70 32
wc -l packages/shared-types/src/openapi.gen.ts   # 3220
```

---

## 실패 목록

**실패 없음.** openapi:gen·gen 생성 성공, console typecheck 회귀 0, backend tsc EXIT 0. 생성물 카운트
(paths 70·schemas 32·gen 3220줄)가 spec.md SC-001·003 의 기댓값과 일치.

---

## SC 매핑표 검증

| SC-ID | 관련 검증 | 통과 여부 |
|---|---|---|
| SC-001 | openapi:gen → openapi.json 70 paths/32 schemas/title `DOA Market API` v1.0.0/`access-token` scheme | PASS(build) |
| SC-002 | RegisterDto(email format/password minLength:8/required)·CreateCouponDto(enum FIXED·PERCENTAGE/minimum:1/한글 desc) | VERIFIED(static) |
| SC-003 | gen → openapi.gen.ts 3220줄 + index.ts `paths/components/operations`·`Schemas`/`Schema<K>` 재노출 | VERIFIED(static) |
| SC-004 | openapi:gen = `nest build && node dist/openapi.js`(빌드 경유 — ts-node 직접 실행 아님) 결정적 70 paths | PASS(build)/VERIFIED(static) |
| SC-005 | console typecheck 회귀 0 + backend tsc EXIT 0 | PASS(typecheck) |

---

## 설계 문서 정합성

### plan.md 현행화 점검

- 생성기 — `openapi.ts`(NestFactory logger:false → DocumentBuilder → createDocument → openapi.json →
  app.close) — plan.md §핵심 설계 1·ADR-001·FR-001 과 일치 ✓
- 플러그인 — `nest-cli.json` `@nestjs/swagger`(introspectComments:true·dtoFileNameSuffix) — plan.md §핵심
  설계 2·ADR-002·FR-002·NFR-001 과 일치 ✓
- 스크립트 — `openapi:gen = nest build && node dist/openapi.js`(빌드 경유) — plan.md §핵심 설계 3·ADR-003·
  FR-003·SC-004 와 일치 ✓
- 코드젠 — `gen = openapi-typescript ../../apps/backend/openapi.json -o src/openapi.gen.ts` — plan.md §핵심
  설계 4·ADR-004·FR-004 와 일치 ✓
- 재노출 — `index.ts` `paths/components/operations` + `Schemas`/`Schema<K>` + 수기 타입 한시 유지 —
  plan.md ADR-005·FR-005·NFR-003 과 일치 ✓
- 의존 — `@nestjs/swagger ^11.4.4`·`openapi-typescript ^7.13.0`(AWS 무관) — plan.md Gates P-002·NFR-004 와
  일치 ✓

### 발견된 한계·관찰

- **response 스키마 미주석**: component schemas 32종 전부 입력 DTO. 87 ops 중 typed 2xx content 36건.
  응답 스키마 보강은 후속(GAP-001-01·coverage-gap.md).
- **생성물 CI 재생성 검증 자동화 부재**: DTO 변경 후 재생성 누락 시 drift. CI 자동 diff 검증 권고
  (GAP-001-01).
- **api-client 전환 미완**: shared-types 생성·재노출까지만. api-client 18도메인 메서드 전환은 후속 차수
  (범위 외).

### v1.0.0 회귀 확인

- console 화면: 수기 타입을 한시 유지하므로 생성 타입 도입 후에도 타입체크 회귀 0(NFR-003·SC-005).
- backend: DTO 본문·모듈 코드 불변(플러그인은 빌드 설정·생성기 추가). `tsc --noEmit` 0. 런타임 서버 동작
  영향 0(생성기는 listen 없이 부팅 후 종료).

---

## 회귀 탐지

001 이 추가/변경한 파일 (`git diff 6c4ddae 678ba1c -- apps/backend packages/shared-types` 기준):
- `apps/backend/nest-cli.json`: `@nestjs/swagger` CLI 플러그인 등록 (+10 -1)
- `apps/backend/src/openapi.ts`: OpenAPI 생성기 (신규 +44 -0)
- `apps/backend/package.json`: `openapi:gen` 스크립트 + `@nestjs/swagger` 의존 (+3 -1)
- `apps/backend/openapi.json`: 생성물(OpenAPI 3.0.0, 70 paths·32 schemas) (신규 +3128 -0)
- `packages/shared-types/package.json`: `openapi-typescript` devDep + `gen` 스크립트 (+7 -1)
- `packages/shared-types/src/index.ts`: 생성 타입 재노출 + `Schemas`/`Schema<K>` (+16 -4)
- `packages/shared-types/src/openapi.gen.ts`: 생성물(3220줄) (신규 +3220 -0)

v1.0.0 백엔드 모듈·DTO·console 화면 코드 불변 → 회귀 0(console typecheck 회귀 0, backend tsc 0). 마이그레이션
없음(DB 스키마 변경 0). 생성물 2종(openapi.json·openapi.gen.ts)은 레포 커밋(CI 재생성 가능, `dist/`
gitignore).
