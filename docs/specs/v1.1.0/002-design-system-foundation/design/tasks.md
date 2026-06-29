---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (retroactive — 전 태스크 구현 완료)
---

# Tasks: 002-design-system-foundation

> Branch: 002-design-system-foundation | Date: 2026-06-29 | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [Test Authoring Contract](#test-authoring-contract)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목 해소(미결 사항: 없음)
- [x] plan.md Constitution Gates(P-001~P-007) 통과(예외 0건, P-002 신규 의존 11종 정당화 기록)
- [x] CHANGES.md 의 이전 작업(001) "후속 작업 시 주의사항" 확인 — 001 은 타입 계약(shared-types) 차수로
      002(디자인 토큰·UI)와 영향 범위가 분리됨. 충돌 없음
- [x] 선택 단계 전부 N(Database Design·Deploy·Security·Performance — selection-phases.md)

> A = 토큰 정의·빌드(design-tokens), B = 공유 매핑(theme.css), C = @doa/ui shadcn 전환, E = console 연결,
> D = Storybook 카탈로그 + 검증. 레이어 A→B→C→E 의존, D(Storybook)는 C 후, 검증은 전 단계 후.

---

## 태스크 목록

> 레이어: A 토큰 빌드 / B 공유 매핑 / C 컴포넌트 전환 / E console 연결 / D 카탈로그·검증(5a/5b).

### Step 1. 디자인 토큰 SSOT (A)

- [x] **T001** — W3C DTCG 토큰 3계층 정의
  - 레이어: A
  - 구현 파일: `packages/design-tokens/tokens/primitive/{color,dimension,typography,effect}.json`,
    `tokens/semantic/{base,color.light,color.dark}.json`
  - 관련 요구사항: FR-001, NFR-003
  - 상세: primitive(brand·neutral·status 색상, space·radius·border, font, shadow·duration·easing) →
    semantic(base = theme 독립 radius·space·text·motion; color.light/dark = 의미 색상). `$value`/`$type`
    표준. 참조(`{color.neutral.0}`)로 semantic→primitive 연결.
  - 완료 기준: 3계층 토큰 JSON 작성, 다크모드는 color.dark.json 으로 분기.

- [x] **T002** — Style Dictionary v4 programmatic 빌드 스크립트
  - 레이어: A(빌드기)
  - 구현 파일: `packages/design-tokens/build.mjs`, `package.json`(`style-dictionary ^4.4.0` devDep + build)
  - 관련 요구사항: FR-002, NFR-001
  - 상세: `new StyleDictionary(...)` light/dark 인스턴스. 커스텀 포맷 `doa/tailwind-preset`·`doa/dart-light`·
    `doa/dart-dark` 등록. filter `isSemantic`/`isSemanticColorDark`(primitive 미유출). `_root.css`+`_dark.css`
    → `tokens.css` 결합 후 임시 파일 제거.
  - 완료 기준: `pnpm --filter @doa/design-tokens build` → web tokens.css·tailwind-preset.cjs / flutter
    {light,dark}_tokens.dart 산출.

### Step 2. 공유 매핑 SSOT (B)

- [x] **T003** — 시맨틱 토큰 → Tailwind 유틸 공유 매핑
  - 레이어: B
  - 구현 파일: `packages/design-tokens/css/theme.css`
  - 관련 요구사항: FR-004
  - 상세: `@theme inline` 으로 시맨틱 토큰 변수(`--bg-surface`·`--fg-default`·`--border-default`·
    `--border-focus`·`--radius-control` 등)를 Tailwind 유틸리티 토큰(`--color-surface`·`--color-foreground`·
    `--color-border`·`--color-ring`·`--radius-control` 등)에 매핑. console·Storybook 공유.
  - 완료 기준: 시맨틱 토큰 전체가 Tailwind 유틸 토큰으로 매핑(중복 정의 제거).

### Step 3. @doa/ui shadcn 전환 (C)

- [x] **T004** — `cn` 유틸 + Button(cva + asChild) + Dialog(Radix)
  - 레이어: C
  - 구현 파일: `packages/ui/src/cn.ts`, `button.tsx`, `dialog.tsx`(신규), `index.ts`, `package.json`
  - 관련 요구사항: FR-003, NFR-002, NFR-004
  - 상세: `cn = twMerge(clsx(...))`. `Button` = `cva`(variant primary/secondary/ghost/danger/link × size
    sm/md/lg/icon + fullWidth) + `asChild`(Radix Slot) + `focus-visible:ring-ring` 포커스링. `Dialog` =
    Radix Dialog 래핑(Root/Trigger/Close/Content/Header/Title/Description/Footer, 포커스 트랩·ESC·ARIA
    기본, lucide X·`aria-label="닫기"`). 의존: `@radix-ui/react-dialog`·`@radix-ui/react-slot`·`cva`·`clsx`·
    `tailwind-merge`·`lucide-react`.
  - 완료 기준: Button 변형·asChild 동작, Dialog 접근성 내장, index.ts export(API 불변 + Dialog 추가).

- [x] **T005** — Card·field·feedback·page-header 토큰 전환
  - 레이어: C
  - 구현 파일: `packages/ui/src/{card,field,feedback,page-header}.tsx`
  - 관련 요구사항: FR-003, NFR-001, NFR-004
  - 상세: 하드코딩 팔레트(`zinc-*`·`red-*`)를 시맨틱 토큰 클래스(`bg-surface`·`text-foreground`·
    `border-border`·`bg-{success,warning,danger,info}-soft`·`text-danger`·`rounded-card/pill` 등)로 전환.
    Badge tones(neutral/success/warning/danger/info/dark). 외부 props·컴포넌트명 불변.
  - 완료 기준: 잔여 하드코딩 0건(grep), export API 불변.

### Step 4. console 연결 (E)

- [x] **T006** — console globals.css 토큰 import + @source + design-tokens dep
  - 레이어: E
  - 구현 파일: `apps/console/app/globals.css`, `apps/console/package.json`
  - 관련 요구사항: FR-004, NFR-003
  - 상세: `@import 'tailwindcss'` + tokens.css + 공유 theme.css + `@source '../../../packages/ui/src'`.
    body 토큰 적용(`var(--bg-canvas)`·`var(--fg-default)`). `@doa/design-tokens` workspace dep 추가.
  - 완료 기준: `pnpm --filter console build` 성공(13 라우트), 시맨틱 토큰 유틸 컴파일.

### Step 5. Storybook 카탈로그 (D)

- [x] **T007** — Storybook 10 설정 + 스토리
  - 레이어: D
  - 구현 파일: `packages/ui/.storybook/{main,preview}.ts`·`tailwind.css`, `src/{button,feedback}.stories.tsx`,
    `package.json`(storybook 의존·스크립트), `.gitignore`
  - 관련 요구사항: FR-005
  - 상세: `@storybook/react-vite`. `main.ts` `viteFinal` 로 `@tailwindcss/vite` 주입. `preview.ts` →
    `tailwind.css`(tailwindcss + tokens.css + theme.css + `@source '../src'`). 스토리 Button(변형·
    AllVariants)·Feedback(Badge tones·EmptyState). `storybook`/`build-storybook` 스크립트. `storybook-static/`
    gitignore.
  - 완료 기준: `pnpm --filter @doa/ui build-storybook` 성공.

### Step 6. 검증 (D 레이어 — 5a/5b)

> 본 차수는 토큰·컴포넌트·빌드 설정으로 별도 단위 테스트 스위트를 작성하지 않는다(Storybook 카탈로그가
> 시각 검증 대체). D 검증은 **토큰 빌드 산출 + console/storybook build + 하드코딩 grep 0 + 타입체크**로
> SC 를 판정한다(5a 시나리오 정의, 5b 실행·확인). test-cases.md / coverage.md 참조.

- [x] **T008** — 빌드·정적 검증 시나리오 정의 (5a Test Agent AUTHORING)
  - 검증 대상: SC-001(tokens.css :root+.dark·semantic만)·SC-002(preset·dart 산출)·SC-003(하드코딩 0·API
    불변)·SC-006(접근성·다크모드)
  - 산출물: test-cases.md(토큰 빌드·산출물·하드코딩 grep·접근성 시나리오 — 단위 테스트 아닌 빌드/정적 기반)
  - 신규 단위 테스트 it() 0건(토큰/컴포넌트/빌드 성격)

- [x] **T009** — 게이트 실행·확인 (5b Test Agent EXECUTION)
  - 실행: `design-tokens build`(tokens.css·preset·dart 산출) / `grep` 하드코딩 0 / `pnpm --filter console
    build`(13 라우트) / `pnpm --filter @doa/ui build-storybook` / `pnpm --filter console typecheck`(0)
  - 산출물: coverage.md·coverage-gap.md·test-report.md

---

## Test Authoring Contract

> **5a Test Agent(AUTHORING) 입력 contract**. 본 차수는 토큰/컴포넌트/빌드 설정으로 단위 테스트 it() 를
> 추가하지 않으며, 검증은 빌드 산출·정적 grep·타입체크로 갈음한다(추측 단언 금지 — 직접 확인).

### 검증 canonical 대상

| 대상 | canonical 형태 |
|---|---|
| 토큰 빌드 | `pnpm --filter @doa/design-tokens build`(= `node build.mjs`) |
| 토큰 산출물(web) | `build/web/tokens.css`(86줄 — `:root` light 전체 + `.dark` 색상)·`tailwind-preset.cjs`(var() 참조) |
| 토큰 산출물(flutter) | `build/flutter/{light,dark}_tokens.dart`(45줄 각 — `DoaLightTokens`/`DoaDarkTokens` Color·double) |
| 공유 매핑 | `packages/design-tokens/css/theme.css`(@theme inline — 시맨틱 토큰 → Tailwind 유틸) |
| 컴포넌트 전환 | `packages/ui/src/*.tsx` — 시맨틱 토큰 클래스, 잔여 하드코딩 0 |
| console 연결 | `apps/console/app/globals.css`(tokens.css + theme.css + @source) |
| Storybook | `pnpm --filter @doa/ui build-storybook`(= `storybook build`) |
| 타입체크 | `pnpm --filter console typecheck`(= `tsc --noEmit`) |

### 검증 재현 규약

- **SC-001(토큰 빌드·noprimitive)**: `build` 후 `wc -l build/web/tokens.css` = 86, `grep -n '\.dark'` →
  line 55, `grep -E '--color-brand|--space-1\b'` build/web/tokens.css → 미존재(semantic 만).
- **SC-002(산출물)**: `build/web/tailwind-preset.cjs` 에 `theme.extend`·`var(--…)`; `wc -l
  build/flutter/light_tokens.dart` = 45, `grep 'class DoaLightTokens'`/`DoaDarkTokens`.
- **SC-003(하드코딩 0·API)**: `grep -rnE '(zinc|slate|gray|neutral)-[0-9]|(text|bg)-red-[0-9]'
  packages/ui/src/*.tsx`(stories 제외) → 0건; `grep 'export' packages/ui/src/index.ts` → cn·Button·Card·
  field·feedback·PageHeader·Dialog 군.
- **SC-006(접근성·다크)**: `dialog.tsx` grep `@radix-ui/react-dialog`·`aria-label`; `button.tsx` grep
  `focus-visible:ring-ring`; `color.dark.json` 존재.

### SC → 검증 매핑

| SC-ID | 수용 기준 | 검증 방법 | 비고 |
|---|---|---|---|
| SC-001 | tokens.css 생성(:root+.dark, semantic만) | build + wc -l + grep | [env:build][env:static] |
| SC-002 | preset.cjs·dart 산출 | build + 파일 조회 | [env:build][env:static] |
| SC-003 | @doa/ui 하드코딩 0·API 불변 | grep | [env:static] |
| SC-004 | console build PASS(13 라우트) | `pnpm --filter console build` | [env:build] |
| SC-005 | storybook build PASS | `build-storybook` | [env:build] |
| SC-006 | Radix 접근성·포커스링·다크 분기 | 코드 조회 | [env:static] |
| SC-007 | console typecheck 회귀 0 | `tsc --noEmit` | [env:typecheck] |

---

## 구현 완료 기준

- [x] 모든 A·B·C·E 태스크 체크박스 완료(4단계), D 카탈로그·검증 시나리오 완료(5a/5b)
- [x] `pnpm --filter @doa/design-tokens build` 성공 — tokens.css(:root+.dark)·tailwind-preset.cjs·
      {light,dark}_tokens.dart 산출 `[TypeScript/Style Dictionary]`
- [x] `@doa/ui` 잔여 하드코딩 0건(grep) + export API 불변
- [x] `pnpm --filter console build` 성공(13 라우트) + `build-storybook` 성공
- [x] `pnpm --filter console typecheck` 회귀 0
- [x] 접근성(Radix Dialog 트랩·ESC·ARIA + focus-visible 링) + 다크모드(`.dark`/`color.dark.json`) 확인
- [x] 신규 의존 11종 전부 클라이언트 UI·빌드 도구(AWS/Fly.io 전용 SDK 아님 — P-002)
- [x] git status 의도치 않은 파일 없음(`build/`·`storybook-static/` gitignore — 산출물은 재생성, 미커밋)
