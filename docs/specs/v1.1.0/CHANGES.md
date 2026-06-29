## [002-design-system-foundation] 구현 완료

> v1.1.0 프론트엔드 사이클의 두 번째 차수(001 OpenAPI 코드젠 다음). base `3a6dbc9`(001 SDD 문서 커밋) →
> `721cb22`(002 완료). 커밋 3개: `ea7521e`(design-tokens) → `d3dc628`(console 토큰 연결 + @doa/ui shadcn
> 전환) → `721cb22`(Storybook + 공유 theme.css SSOT 분리). 변경 라인은 `git diff 3a6dbc9 721cb22 --
> packages apps/console` 로 재생성(28 files, +779/-74 — 생성물 `build/*` 미포함). **마이그레이션 없음**
> (DB 스키마 변경 0 — 클라이언트 디자인 토큰·UI·빌드 설정). DESIGN-PLAN Phase 0(디자인 토대).

**변경 파일**:
- `packages/design-tokens/tokens/primitive/{color,dimension,typography,effect}.json`(신규): W3C DTCG 원시
  토큰 — brand(50~900)·neutral(0~950)·status(green/amber/red/blue) 색상, space(0~16)·radius(sm~full)·
  border width, font(family sans/mono·size xs~3xl·weight·lineHeight), shadow·duration·easing. 참조 전용.
- `packages/design-tokens/tokens/semantic/{base,color.light,color.dark}.json`(신규): 시맨틱 토큰 —
  `base`(theme 독립 radius control/card/modal/pill·space gutter/section/inset·text body/heading/display·
  motion control/overlay), `color.light`/`color.dark`(의미 색상 bg·fg·border·accent·success·warning·
  danger·info). 다크모드는 `color.dark.json` 만 분기.
- `packages/design-tokens/build.mjs`(신규): Style Dictionary v4 **programmatic** 빌드. light/dark 인스턴스
  2개 + 커스텀 포맷 `doa/tailwind-preset`·`doa/dart-light`·`doa/dart-dark`. filter `isSemantic`/
  `isSemanticColorDark`(primitive 미유출). `_root.css`+`_dark.css` → `tokens.css` 결합 후 임시 파일 제거.
  산출: `build/web/{tokens.css(86줄),tailwind-preset.cjs}`·`build/flutter/{light,dark}_tokens.dart(45줄)`.
- `packages/design-tokens/css/theme.css`(신규): `@theme inline` — 시맨틱 토큰 변수 → Tailwind 유틸리티
  토큰(`--color-surface: var(--bg-surface)`·`--color-foreground`·`--color-border`·`--color-ring`·
  `--radius-control` 등). console·Storybook 공유 SSOT(중복 제거).
- `packages/design-tokens/package.json`·`README.md`(신규): `style-dictionary ^4.4.0` devDep + `build`
  스크립트 + 패키지 문서.
- `packages/ui/src/cn.ts`: `cn = twMerge(clsx(...))`(shadcn 표준).
- `packages/ui/src/button.tsx`: `cva` 변형(variant primary/secondary/ghost/danger/link × size sm/md/lg/
  icon + fullWidth) + `asChild`(Radix Slot) + `focus-visible:ring-ring` 포커스링. 하드코딩 → 시맨틱 토큰.
- `packages/ui/src/dialog.tsx`(신규): Radix Dialog 래핑(Root/Trigger/Close/Content/Header/Title/
  Description/Footer). 포커스 트랩·ESC·ARIA 기본 제공 + lucide `X`·`aria-label="닫기"` + 토큰.
- `packages/ui/src/{card,field,feedback,page-header}.tsx`: 하드코딩 팔레트(`zinc-*`·`red-*`)를 시맨틱 토큰
  클래스(`bg-surface`·`text-foreground`·`border-border`·`bg-{success,warning,danger,info}-soft`·
  `text-danger` 등)로 전환. Badge tones(neutral/success/warning/danger/info/dark). 외부 API 불변.
- `packages/ui/src/index.ts`: `Dialog`군·`cn`·`buttonVariants` export 추가(기존 컴포넌트 export 불변).
- `packages/ui/.storybook/{main,preview}.ts`·`tailwind.css`(신규): Storybook 10 react-vite. `main.ts`
  `viteFinal` 로 `@tailwindcss/vite` 주입, `preview.ts` → `tailwind.css`(tailwindcss + tokens.css +
  theme.css + `@source '../src'`).
- `packages/ui/src/{button,feedback}.stories.tsx`(신규): Button(변형·AllVariants)·Feedback(Badge tones·
  EmptyState) 스토리.
- `packages/ui/package.json`·`.gitignore`: 의존(`@radix-ui/react-dialog`·`@radix-ui/react-slot`·
  `class-variance-authority`·`clsx`·`tailwind-merge`·`lucide-react`·storybook 4종) + `storybook`/
  `build-storybook` 스크립트 + `storybook-static/` gitignore.
- `apps/console/app/globals.css`: `@import 'tailwindcss'` + design-tokens `tokens.css` + 공유 `theme.css`
  + `@source '../../../packages/ui/src'`. html,body 토큰 적용(`var(--bg-canvas)`·`var(--fg-default)`).
- `apps/console/package.json`: `@doa/design-tokens` workspace dep 추가.

**검증**: `design-tokens build` 성공(tokens.css 86줄 — :root light 전체 + .dark 색상 오버라이드, primitive
미유출) / `@doa/ui` 잔여 하드코딩 0건(grep, stories 제외) + export API 불변 / `pnpm --filter console build`
13 라우트 PASS / `build-storybook` 성공 / `pnpm --filter console typecheck` EXIT 0(회귀 0). 신규 단위
테스트 0(토큰/컴포넌트/빌드 — Storybook 카탈로그가 시각 검증 대체, `git diff 3a6dbc9 721cb22` 에 `*.spec.ts`
변경 0). 마이그레이션 없음(DB 스키마 변경 0). 신규 의존 11종 전부 클라이언트 UI·빌드 도구(AWS/Fly.io 전용
SDK 아님 — P-002 무저촉).

**해결**: **`@doa/ui` 하드코딩·토큰/다크모드/SSOT 부재 제거(DESIGN-PLAN Phase 0 디자인 토대 핵심 목표)** —
코드-퍼스트 W3C 디자인 토큰(3계층 primitive→semantic→theme) → Style Dictionary → 웹(tokens.css·preset)·
Flutter(dart) 자동 생성으로 **디자인 결정의 SSOT 를 토큰 JSON 으로 단일화**. `@doa/ui` 를 Radix+shadcn
패턴 + 시맨틱 토큰 클래스로 전환(하드코딩 0·접근성 내장·다크모드 분기 구조), console 연결 + 공유 @theme
SSOT, Storybook 카탈로그 확립. 풍부한 인벤토리·a11y 자동화·다크 토글·Flutter 소비는 GAP-002-01(Low) /
Phase 1~5 후속.

**후속 작업 시 주의사항**:
- **primitive 미유출 원칙(핵심)**: web 산출은 빌드 filter(`isSemantic`/`isSemanticColorDark`)로 **semantic
  토큰만** CSS 변수로 노출한다. 컴포넌트는 `color.brand.600` 같은 원시값이 아닌 `accent-solid` 같은 의미값
  에만 결합해야 하며, 팔레트 교체는 `color.light`/`color.dark` 의 semantic 매핑만 수정한다. 향후 primitive
  를 CSS 변수로 노출하지 않도록 유지해야 한다.
- **`@source` 누락 함정**: Tailwind 4 는 워크스페이스 패키지의 `node_modules` 경로를 기본 미스캔한다.
  console `globals.css`·Storybook `tailwind.css` 의 `@source`(`@doa/ui` src)가 없으면 시맨틱 토큰 클래스가
  최종 CSS 에서 누락되어 스타일이 적용되지 않는다. 새 소비처 추가 시 `@source` 필수.
- **토큰 재생성·미커밋 산출물**: `build/` 는 root `.gitignore` 로 **추적되지 않는다**(001 의 openapi.json
  과 달리 미커밋). 토큰 JSON 변경 후 `pnpm --filter @doa/design-tokens build` 로 재생성해야 소비처에
  반영된다. CI/로컬 빌드 시 `design-tokens build` 가 console·Storybook build 선행으로 필요할 수 있다.
- **`tailwind-preset.cjs` 미연결(GAP-002-01, Low)**: 빌드가 `tailwind-preset.cjs`(Tailwind v3 스타일
  preset)를 생성하나, Tailwind 4 console·Storybook 은 `@theme`(공유 `theme.css`)를 사용하여 preset 의
  소비처가 없다(참조용). v3 소비처가 생기지 않는 한 preset 은 산출물로만 남는다.
- **다크모드 토글 UI 부재**: `.dark` 셀렉터·`color.dark.json` 분기는 구현되나 런타임 테마 전환 UI(`.dark`
  클래스 토글)는 미구현이다. 라이트 모드가 기본 적용된다. AppShell(DESIGN-PLAN §5-3)의 상단 테마 토글과
  함께 후속 구성한다.
- **a11y 자동 감사·시각 회귀 부재(GAP-002-01, Low)**: WCAG AA 는 Radix 프리미티브(트랩·ARIA)·포커스 링
  으로 구조 확보하나, axe 자동 접근성 감사·Chromatic 시각 회귀는 미구축이다(Storybook 카탈로그는 수동
  검토). 인벤토리 확장 후 a11y 애드온 + 시각 회귀 CI 게이트 추가를 권고한다.
- **컴포넌트 인벤토리·Flutter 소비 후속**: 002 는 토대 컴포넌트(Button·Dialog·Card·field·feedback·
  page-header)까지다. DataTable(TanStack Table)·Form(rhf+zod)·MoneyInput·FileUpload·AppShell·CommandPalette
  등은 Phase 1~4, Flutter `{light,dark}_tokens.dart` 의 `ThemeData` 소비는 Phase 5. 후속 컴포넌트는 동일
  패턴(cva + 시맨틱 토큰 + Radix)으로 확장한다.
- **@doa/ui API 하위호환**: 토큰 전환은 컴포넌트 외부 export(컴포넌트명·props)를 변경하지 않았다(시각
  변화는 있으나 빌드·타입 계약 불변). 향후 컴포넌트 props 변경 시 console 소비처 영향을 사전 점검한다.

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
