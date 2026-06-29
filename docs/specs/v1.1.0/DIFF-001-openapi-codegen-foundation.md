---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (retroactive)
---

# Diff: 001-openapi-codegen-foundation

## 목차

- [커밋 메시지용 한 줄 요약](#커밋-메시지용-한-줄-요약)
- [변경 요약](#변경-요약)
- [변경 파일 및 라인 수](#변경-파일-및-라인-수)
- [Diff](#diff)

## 커밋 메시지용 한 줄 요약

- **KO**: 001 프론트 Phase 0 — 백엔드 OpenAPI 자동 생성(@nestjs/swagger CLI 플러그인) + 프론트 코드젠(openapi-typescript)으로 타입 계약 SSOT 확립
- **EN**: 001 frontend Phase 0 — establish type-contract SSOT via backend OpenAPI autogen (@nestjs/swagger CLI plugin) + frontend codegen (openapi-typescript)

## 변경 요약

- **백엔드 OpenAPI 노출(FR-001)**: `apps/backend/src/openapi.ts`(신규) — `NestFactory.create(AppModule,
  { logger:false })` 로 listen 없이 부팅 → `DocumentBuilder`(title `DOA Market API`·version `1.0.0`·
  `addBearerAuth({ type:'http', scheme:'bearer', bearerFormat:'JWT' }, 'access-token')`) →
  `SwaggerModule.createDocument` → `openapi.json` 직렬화 → `app.close` + `exit`.
- **CLI 플러그인 introspect(FR-002·NFR-001)**: `nest-cli.json` 에 `@nestjs/swagger` 플러그인
  (`introspectComments:true`, `dtoFileNameSuffix:[".dto.ts",".entity.ts"]`) 등록 → `nest build` 컴파일 시
  DTO(class-validator + JSDoc)에서 `@ApiProperty` 메타데이터 자동 주입(수기 데코레이터 0).
- **빌드 경유 스크립트(FR-003)**: `apps/backend/package.json` 에 `openapi:gen = "nest build && node
  dist/openapi.js"` + `@nestjs/swagger ^11.4.4` 의존. 플러그인이 빌드 단계에만 적용되므로 ts-node 직접
  실행 아닌 빌드 산출물 실행.
- **프론트 코드젠(FR-004)**: `packages/shared-types/package.json` 에 `openapi-typescript ^7.13.0`(devDep)
  + `gen = "openapi-typescript ../../apps/backend/openapi.json -o src/openapi.gen.ts"`.
- **재노출 + 한시 호환(FR-005·NFR-003)**: `packages/shared-types/src/index.ts` 가
  `export type { paths, components, operations } from './openapi.gen'` + `Schemas`/`Schema<K>` 헬퍼
  재노출. 기존 수기 타입(001/002 도메인)은 console 호환 위해 한시 유지.
- **생성물**: `apps/backend/openapi.json`(OpenAPI 3.0.0, 70 paths·32 component schemas)·
  `packages/shared-types/src/openapi.gen.ts`(3220줄, paths/components/operations interface). 편의상 레포
  커밋(CI 재생성 가능, `dist/` gitignore).
- **검증**: openapi:gen 성공(paths 70 출력)·console typecheck 회귀 0·backend `tsc --noEmit` 0. 신규 단위
  테스트 0(코드젠/인프라 — 생성 성공 + 정적 카운트 + 타입체크로 갈음).
- **해결**: 수기 shared-types 18도메인 동기화 부담 제거(FRONTEND-PLAN Phase 0) — 입력 계약 SSOT 를 백엔드
  코드로 단일화. 응답 스키마 보강·api-client 전환·생성물 CI 검증은 후속(GAP-001-01).

## 변경 파일 및 라인 수

> 범위: `apps/backend` + `packages/shared-types`. base `6c4ddae`(v1.0.0 백엔드 013 완료) → `678ba1c`
> (001 완료). `git diff --numstat 6c4ddae 678ba1c -- apps/backend packages/shared-types` 직접 카운트.

| 파일 | 추가 | 삭제 | 비고 |
|---|---|---|---|
| `apps/backend/openapi.json` | +3128 | -0 | **생성물**(openapi:gen 산출 — git 이 SoT) |
| `packages/shared-types/src/openapi.gen.ts` | +3220 | -0 | **생성물**(gen 산출 — git 이 SoT) |
| `apps/backend/src/openapi.ts` (신규) | +44 | -0 | OpenAPI 생성기 |
| `packages/shared-types/src/index.ts` | +16 | -4 | 생성 타입 재노출 + `Schemas`/`Schema<K>` |
| `apps/backend/nest-cli.json` | +10 | -1 | `@nestjs/swagger` CLI 플러그인 등록 |
| `packages/shared-types/package.json` | +7 | -1 | `openapi-typescript` devDep + `gen` |
| `apps/backend/package.json` | +3 | -1 | `openapi:gen` 스크립트 + `@nestjs/swagger` 의존 |

**합계 (apps/backend + packages/shared-types)**: 7 files changed, 6428 insertions(+), 7 deletions(-).

> **생성물 처리**: `openapi.json`(72K·3128줄 추가)·`openapi.gen.ts`(84K·3220줄 추가)는 자동 생성물이다.
> 라인 단위 diff 를 본 문서에 박제하지 않으며 git 이 형상관리 SoT 다. 재생성 명령:
> `pnpm --filter backend openapi:gen` → `pnpm --filter @doa/shared-types gen`.
>
> 본 001 SDD 문서 세트(`docs/specs/v1.1.0/001-openapi-codegen-foundation/**`) 와 `CHANGES.md` 는 `678ba1c`
> 코드 커밋 **이후** retroactive 로 별도 추가되었다(코드 diff 범위 외). 동일 커밋 `678ba1c` 에는
> `FRONTEND-PLAN.md`·`DESIGN-PLAN.md`·`pnpm-lock.yaml` 변경도 포함되나, 본 표는 spec 코드 범위
> (`apps/backend`·`packages/shared-types`)로 한정한다.

## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 이며 생성물(openapi.json·openapi.gen.ts)
> 전체 캡처는 수천 줄 중복·문서 비대화를 유발한다. 변경 내용은 위 "변경 요약" · "변경 파일 및 라인 수"
> 절로 추적하고, 라인 단위 diff 가 필요하면 아래로 재생성한다:
>
> ```bash
> git diff 6c4ddae 678ba1c -- apps/backend packages/shared-types   # base commit: 6c4ddae
> # 생성물 재생성(소스에서):
> pnpm --filter backend openapi:gen          # → apps/backend/openapi.json
> pnpm --filter @doa/shared-types gen        # → packages/shared-types/src/openapi.gen.ts
> ```
