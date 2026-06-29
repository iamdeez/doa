## [001-openapi-codegen-foundation] 구현 완료

> v1.1.0 은 프론트엔드 릴리즈 사이클의 첫 차수다(v1.0.0 은 백엔드 18도메인 재구축 사이클). 본 항목이
> v1.1.0 CHANGES.md 의 최초 기록이다. base `6c4ddae`(v1.0.0 백엔드 013 완료) → `678ba1c`(001 완료). 변경
> 라인은 `git diff 6c4ddae 678ba1c -- apps/backend packages/shared-types` 로 재생성. **마이그레이션 없음**
> (DB 스키마 변경 0 — 본 차수는 타입 계약 생성·코드젠). FRONTEND-PLAN.md Phase 0(공유 기반).

**변경 파일**:
- `apps/backend/nest-cli.json`: `compilerOptions.plugins` 에 `@nestjs/swagger` CLI 플러그인
  (`introspectComments:true`, `dtoFileNameSuffix:[".dto.ts",".entity.ts"]`) 등록 → `nest build` 컴파일 시
  DTO(class-validator + JSDoc)에서 `@ApiProperty` 메타데이터 자동 주입(수기 데코레이터 0).
- `apps/backend/src/openapi.ts`(신규): OpenAPI 문서 생성기. `NestFactory.create(AppModule, { logger:false
  })`(listen 없이 부팅) → `DocumentBuilder`(title `DOA Market API`·version `1.0.0`·`addBearerAuth({
  type:'http', scheme:'bearer', bearerFormat:'JWT' }, 'access-token')`) → `SwaggerModule.createDocument` →
  `apps/backend/openapi.json` 직렬화 → `app.close` + `process.exit`.
- `apps/backend/package.json`: `openapi:gen = "nest build && node dist/openapi.js"` 스크립트 +
  `@nestjs/swagger ^11.4.4`(NestJS 11 호환) 의존 추가. 플러그인은 빌드 단계에만 적용되므로 ts-node 직접
  실행 아닌 빌드 산출물 실행.
- `apps/backend/openapi.json`(신규 생성물): 산출 OpenAPI 문서(OpenAPI 3.0.0, 70 paths / 32 component
  schemas, 72K). component schemas 32종 = 입력 DTO `*Dto` 31 + `OrderItemInput`. 속성·타입·검증 제약
  (`minLength:8`·`minimum:1`·`format:email`)·enum(`FIXED`/`PERCENTAGE`)·required·JSDoc 한글 설명 자동
  채움. 편의상 레포 커밋(CI 재생성 가능).
- `packages/shared-types/package.json`: `openapi-typescript ^7.13.0`(devDependency) +
  `gen = "openapi-typescript ../../apps/backend/openapi.json -o src/openapi.gen.ts"` 스크립트.
- `packages/shared-types/src/index.ts`: `export type { paths, components, operations } from './openapi.gen'`
  + `Schemas = components['schemas']`·`Schema<K>` 헬퍼 재노출. 기존 수기 타입(001/002 도메인 — `LoginRequest`
  ·`UserProfile`·`Product` 등)은 console 호환 위해 한시 유지(점진 대체).
- `packages/shared-types/src/openapi.gen.ts`(신규 생성물): 자동 생성 타입(3220줄, paths/components/
  operations interface, 84K). 편의상 레포 커밋.

**검증**: `openapi:gen` 성공(paths 70 출력) / `gen` 성공(openapi.gen.ts 3220줄) / `pnpm --filter console
typecheck` 회귀 0 / backend `tsc --noEmit` EXIT 0. 신규 단위 테스트 0(코드젠/인프라 — `git diff 6c4ddae
678ba1c` 에 `*.spec.ts` 변경 0). 생성물 수치 직접 카운트(paths 70·schemas 32·gen 3220줄). 마이그레이션
없음(DB 스키마 변경 0). 신규 의존 2종(`@nestjs/swagger`·`openapi-typescript`)은 AWS/Fly.io 전용 SDK 아님
(P-002 무저촉).

**해결**: **수기 shared-types 18도메인 동기화 부담 제거(FRONTEND-PLAN Phase 0 핵심 목표)** — 백엔드
OpenAPI 자동 생성(`@nestjs/swagger` CLI 플러그인 introspect) + 프론트 `openapi-typescript` 코드젠으로
**입력 계약의 SSOT 를 백엔드 코드(DTO + class-validator + JSDoc)로 단일화**. 수기 타입(001/002 도메인만,
11도메인 누락) 대신 70 paths/32 schemas 가 결정적으로 생성되며, 백엔드 변경이 `openapi:gen` → `gen` 2단계
재실행으로 프론트에 전파된다. 응답 스키마 보강·api-client 전환·생성물 CI 검증은 GAP-001-01(Low) 후속.

**후속 작업 시 주의사항**:
- **플러그인 빌드 경유 필수(핵심 함정)**: `@nestjs/swagger` CLI 플러그인은 `nest build` 컴파일 단계에만
  `@ApiProperty` 메타데이터를 주입한다. `ts-node src/openapi.ts` 직접 실행은 플러그인 미적용으로 **빈
  스키마**(속성 0)를 산출한다. `openapi:gen = "nest build && node dist/openapi.js"` 가 빌드 경유를
  강제하므로, 향후 생성 절차를 변경할 때 반드시 빌드 경유를 유지해야 한다.
- **계약 재생성 절차(2단계)**: 백엔드 DTO 변경 시 반드시 `pnpm --filter backend openapi:gen` →
  `pnpm --filter @doa/shared-types gen` 양 단계를 재실행해야 계약이 동기화된다. 한 단계라도 누락하면
  생성물(`openapi.json`·`openapi.gen.ts`)이 최신 DTO 와 불일치(drift)한다. 현재 CI 자동 재생성·diff 검증이
  없으므로(GAP-001-01) 사람이 절차를 지켜야 한다.
- **response 스키마 미주석(GAP-001-01, Low)**: component schemas 32종은 전부 입력(request) DTO 다. 87
  operations 중 typed 2xx response content 는 36건이며 응답 본문은 대부분 타입 미주석이다(컨트롤러가
  엔티티/원시값 반환, `@ApiResponse({ type })` 미부여). 프론트는 응답 타입을 부분적으로만 코드젠에서
  얻는다. 후속에 도메인별 응답 DTO + `@ApiResponse({ type })` 로 점진 보강한다(FRONTEND-PLAN §8 정책).
- **수기 타입 한시 유지 — 점진 대체**: `shared-types/index.ts` 의 수기 타입(001/002 도메인)은 console
  호환을 위해 유지된다. 생성 타입으로의 완전 대체·수기 타입 삭제는 후속 차수다. 향후 console 화면을 생성
  타입(`Schemas['...']`)으로 마이그레이션할 때 수기 타입을 단계적으로 제거하고, `@doa/api-client` 의
  18도메인 메서드도 생성 타입 기반으로 재작성한다(범위 외 — Phase 0 후속).
- **생성물 레포 커밋**: `openapi.json`·`openapi.gen.ts` 는 생성물이나 편의상 레포에 커밋된다(CI 재생성
  가능). `dist/` 는 gitignore. 향후 생성물 drift 방지를 위해 CI 에 `openapi:gen` → `gen` 재실행 후
  `git diff --exit-code` 검증 게이트 추가를 권고한다(GAP-001-01).
- **신규 의존 2종**: `@nestjs/swagger ^11.4.4`(백엔드 dependency)·`openapi-typescript ^7.13.0`
  (shared-types devDependency). 둘 다 AWS/Fly.io 전용 SDK 가 아닌 계약 생성·코드젠 도구로 P-002 무저촉.
  `@nestjs/swagger` 는 NestJS 11 호환 버전이며, NestJS 메이저 업그레이드 시 호환 버전 동반 갱신 필요.
