---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (retroactive — 전 태스크 구현 완료)
---

# Tasks: 001-openapi-codegen-foundation

> Branch: 001-openapi-codegen-foundation | Date: 2026-06-29 | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [Test Authoring Contract](#test-authoring-contract)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목 해소(미결 사항: 없음)
- [x] plan.md Constitution Gates(P-001~P-007) 통과(예외 0건, P-002 신규 의존 정당화 기록)
- [x] CHANGES.md 의 이전 작업 "후속 작업 시 주의사항" 확인(v1.1.0 최초 차수 — 선행 v1.1.0 항목 없음.
      v1.0.0 백엔드 완료 상태를 전제)
- [x] 선택 단계 전부 N(Database Design·Deploy·Security·Performance — selection-phases.md)

> A = 백엔드 OpenAPI 생성(설정·생성기·스크립트·생성물), C = 프론트 코드젠(devDep·스크립트·재노출·생성물),
> D = 검증(생성 성공·정적·타입체크). 레이어 A→C→D 의존 순.

---

## 태스크 목록

> 레이어: A 백엔드 생성 / C 프론트 코드젠 / D 검증(5a/5b).

### Step 1. 백엔드 OpenAPI 노출 (A)

- [x] **T001** — `@nestjs/swagger` 의존 + CLI 플러그인 등록
  - 레이어: A
  - 구현 파일: `apps/backend/package.json`, `apps/backend/nest-cli.json`
  - 관련 요구사항: FR-002, NFR-001
  - 상세: `@nestjs/swagger ^11.4.4`(NestJS 11 호환) 추가. `nest-cli.json` `compilerOptions.plugins` 에
    `@nestjs/swagger`(`introspectComments:true`, `dtoFileNameSuffix:[".dto.ts",".entity.ts"]`) 등록.
  - 완료 기준: `nest build` 컴파일 시 DTO 메타데이터 자동 주입(수기 `@ApiProperty` 0).

- [x] **T002** — OpenAPI 생성기 `openapi.ts` 작성
  - 레이어: A(생성기)
  - 구현 파일: `apps/backend/src/openapi.ts`(신규)
  - 관련 요구사항: FR-001
  - 상세: `NestFactory.create(AppModule, { logger: false })` → `DocumentBuilder`(title `DOA Market API`·
    version `1.0.0`·`addBearerAuth({ type:'http', scheme:'bearer', bearerFormat:'JWT' }, 'access-token')`)
    → `SwaggerModule.createDocument` → `writeFileSync('openapi.json', JSON.stringify(document, null, 2))`
    → `app.close()` → `process.exit`. paths 수 콘솔 로그.
  - 완료 기준: 실행 시 `apps/backend/openapi.json`(OpenAPI 3.0.0) 산출.

- [x] **T003** — `openapi:gen` 스크립트(빌드 경유)
  - 레이어: A
  - 구현 파일: `apps/backend/package.json`
  - 관련 요구사항: FR-003, NFR-002
  - 상세: `"openapi:gen": "nest build && node dist/openapi.js"`. 플러그인이 빌드 단계에만 적용되므로
    `ts-node` 직접 실행이 아닌 빌드 산출물(`dist/openapi.js`) 실행으로 메타데이터 채움.
  - 완료 기준: `pnpm --filter backend openapi:gen` 이 70 paths 문서를 결정적으로 산출.

### Step 2. 프론트 타입 코드젠 (C)

- [x] **T004** — `openapi-typescript` devDep + `gen` 스크립트
  - 레이어: C
  - 구현 파일: `packages/shared-types/package.json`
  - 관련 요구사항: FR-004
  - 상세: `openapi-typescript ^7.13.0`(devDependency) 추가. `"gen": "openapi-typescript
    ../../apps/backend/openapi.json -o src/openapi.gen.ts"`.
  - 완료 기준: `pnpm --filter @doa/shared-types gen` 이 `src/openapi.gen.ts` 생성.

- [x] **T005** — 생성 타입 재노출 + 수기 타입 한시 유지
  - 레이어: C
  - 구현 파일: `packages/shared-types/src/index.ts`, `packages/shared-types/src/openapi.gen.ts`(생성물)
  - 관련 요구사항: FR-005, NFR-003
  - 상세: `export type { paths, components, operations } from './openapi.gen'` +
    `Schemas = components['schemas']`·`Schema<K>` 헬퍼 재노출. 기존 수기 타입(001/002 도메인)은 console
    호환 위해 export 유지(점진 대체).
  - 완료 기준: `Schemas['CreateProductDto']`·`Schema<'CreateCouponDto'>` 형태 사용 가능 + 기존 수기 타입
    참조 불변.

### Step 3. 검증 (D 레이어 — 5a/5b)

> 본 차수는 인프라/코드젠으로 별도 단위 테스트 스위트를 작성하지 않는다(생성물이 결정적 산출).
> D 레이어는 **생성 성공 + 정적 생성물 검증 + 타입체크**로 SC 를 판정한다(5a 는 검증 시나리오 정의,
> 5b 는 실행·확인). test-cases.md / coverage.md 참조.

- [x] **T006** — 생성 성공·정적 생성물 검증 시나리오 정의 (5a Test Agent AUTHORING)
  - 검증 대상: SC-001(70 paths·32 schemas·title·scheme)·SC-002(스키마 속성 자동)·SC-003(gen 3220줄·
    재노출)·SC-004(빌드 경유 결정성)
  - 산출물: test-cases.md(생성 성공·스키마 속성 완비·재노출 시나리오 — 단위 테스트 아닌 생성·정적 기반)
  - 신규 단위 테스트 it() 0건(코드젠 성격)

- [x] **T007** — 게이트 실행·확인 (5b Test Agent EXECUTION)
  - 실행: `pnpm --filter backend openapi:gen`(70 paths 출력) / 생성물 카운트(paths 70·schemas 32·gen
    3220줄) / `pnpm --filter console typecheck`(회귀 0) / backend `tsc --noEmit`(0)
  - 산출물: coverage.md·coverage-gap.md·test-report.md

---

## Test Authoring Contract

> **5a Test Agent(AUTHORING) 입력 contract**. 본 차수는 코드젠/인프라로 단위 테스트 it() 를 추가하지
> 않으며, 검증은 생성 스크립트 실행·생성물 정적 카운트·타입체크로 갈음한다(추측 단언 금지 — 직접 카운트).

### 검증 canonical 대상

| 대상 | canonical 형태 |
|---|---|
| 생성 스크립트(백엔드) | `pnpm --filter backend openapi:gen`(= `nest build && node dist/openapi.js`) |
| 생성 스크립트(프론트) | `pnpm --filter @doa/shared-types gen`(= `openapi-typescript ../../apps/backend/openapi.json -o src/openapi.gen.ts`) |
| 생성물(백엔드) | `apps/backend/openapi.json` — OpenAPI 3.0.0·70 paths·32 schemas·title `DOA Market API` v1.0.0·`access-token`(http bearer JWT) |
| 생성물(프론트) | `packages/shared-types/src/openapi.gen.ts` — 3220줄(paths/components/operations) |
| 재노출 | `packages/shared-types/src/index.ts` — `paths`/`components`/`operations` + `Schemas`/`Schema<K>` |
| 타입체크 | `pnpm --filter console typecheck`·backend `tsc --noEmit` |

### 검증 재현 규약

- **SC-001(생성 성공)**: `openapi:gen` 실행 후 `node -e "Object.keys(require('./openapi.json').paths).length"`
  = 70, `...components.schemas).length` = 32, `info.title/version` = `DOA Market API`/`1.0.0`,
  `components.securitySchemes` 키 = `access-token`.
- **SC-002(스키마 속성)**: `openapi.json` component schemas 의 `RegisterDto`(email format:email·password
  minLength:8·required)·`CreateCouponDto`(type enum [FIXED,PERCENTAGE]·totalQuantity minimum:1·
  discountValue 한글 description·required) 직접 조회.
- **SC-003(코드젠·재노출)**: `wc -l src/openapi.gen.ts` = 3220, `index.ts` grep `export type { paths,
  components, operations }` + `Schemas`/`Schema<K>`.
- **SC-004(결정성)**: `openapi:gen` 재실행 → 동일 70 paths(빌드 경유 — ts-node 직접 실행 아님).

### SC → 검증 매핑

| SC-ID | 수용 기준 | 검증 방법 | 비고 |
|---|---|---|---|
| SC-001 | openapi.json 70 paths/32 schemas 생성 | openapi:gen 실행 + 카운트 | [env:build] |
| SC-002 | 스키마 속성·검증·enum·desc 자동 | openapi.json 스키마 조회 | [env:static] 수기 데코레이터 0 |
| SC-003 | openapi.gen.ts 3220줄·재노출 | gen 실행 + wc -l + grep | [env:static] |
| SC-004 | 빌드 경유 결정적 재생성 | openapi:gen 재실행 | [env:build] |
| SC-005 | console·backend typecheck 회귀 0 | tsc --noEmit | [env:typecheck] |

---

## 구현 완료 기준

- [x] 모든 A·C 태스크 체크박스 완료(4단계), D 검증 시나리오 완료(5a/5b)
- [x] `pnpm --filter backend openapi:gen` 성공 — openapi.json 70 paths/32 schemas 산출 `[TypeScript/NestJS]`
- [x] `pnpm --filter @doa/shared-types gen` 성공 — openapi.gen.ts 3220줄 산출
- [x] `pnpm --filter console typecheck` 회귀 0 + backend `tsc --noEmit` 0 error
- [x] 수기 데코레이터 0 확인(RegisterDto·CreateCouponDto 속성 자동 — 생성물 직접 조회)
- [x] 빌드 경유 결정성 확인(`nest build && node dist/openapi.js` — ts-node 직접 실행 아님)
- [x] 신규 의존 2건(`@nestjs/swagger`·`openapi-typescript`)이 AWS/Fly.io 전용 SDK 아님 확인(P-002)
- [x] git status 의도치 않은 파일 없음(`dist/` gitignore, 생성물 2종만 추가)
