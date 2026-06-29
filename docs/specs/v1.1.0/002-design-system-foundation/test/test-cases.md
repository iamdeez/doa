---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (retroactive)
---

# Test Cases: 002-design-system-foundation

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
- [케이스 상세](#케이스-상세)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류)](#미커버-항목-사전-분류)

---

## SC × 시나리오 매트릭스

> 본 차수는 토큰·컴포넌트·빌드 설정으로 **단위 테스트 it() 를 추가하지 않는다**. 검증은 토큰 빌드 산출
> ([env:build]) + 정적 코드/생성물 조회·grep([env:static]) + console/storybook build([env:build]) +
> 타입체크([env:typecheck])로 SC 를 판정한다. 산출물 수치는 추측하지 않고 직접 확인한다.

| SC-ID | 수용 기준 | Happy Path | Edge Case | 검증 대상 | env 태그 |
|---|---|---|---|---|---|
| SC-001 | tokens.css 생성(:root+.dark, semantic만) | build → tokens.css 산출·조회 | primitive 노출 시도 → 미존재 | design-tokens build/web/tokens.css | [env:build][env:static] |
| SC-002 | preset.cjs·dart 산출 | build → preset·dart 조회 | — | build/web·build/flutter | [env:build][env:static] |
| SC-003 | @doa/ui 하드코딩 0·API 불변 | grep zinc/red/slate/gray → 0 | — | packages/ui/src/*.tsx·index.ts | [env:static] |
| SC-004 | console build PASS(13 라우트) | `console build` → 성공 | @source 누락 시 스타일 누락 | apps/console | [env:build] |
| SC-005 | storybook build PASS | `build-storybook` → 성공 | — | packages/ui/.storybook | [env:build] |
| SC-006 | Radix 접근성·포커스링·다크 분기 | dialog/button/color.dark 조회 | — | packages/ui/src·color.dark.json | [env:static] |
| SC-007 | console typecheck 회귀 0 | `tsc --noEmit` EXIT 0 | — | apps/console | [env:typecheck] |

---

## 케이스 상세

### SC-001 (토큰 빌드 — tokens.css :root+.dark, semantic만)

- 입력: `pnpm --filter @doa/design-tokens build`(= `node build.mjs`).
- 확인 사실:
  - `wc -l build/web/tokens.css` = **86**.
  - `:root`(line 6~) 에 light 시맨틱 전체 — `--space-gutter`·`--radius-control`·`--border-default`·
    `--text-body`·`--motion-control`·`--bg-surface`·`--fg-default`·`--accent-solid`·`--success-solid` 등.
  - `.dark`(line 55~) 에 **색상만 오버라이드** — `--border-default`·`--bg-canvas`·`--fg-default`·
    `--accent-solid`·status 색상(radius·space·text·motion 미포함).
  - **primitive 미유출**: `--color-brand-*`·`--space-1`(원시 스텝) 등 primitive 변수가 tokens.css 에
    존재하지 않음(filter `isSemantic`/`isSemanticColorDark`).

### SC-002 (산출물 — preset.cjs·dart)

- 확인 사실:
  - `build/web/tailwind-preset.cjs`: `module.exports = { theme: { extend: { colors·borderRadius·spacing·
    fontSize·transitionDuration } } }`, 값은 `var(--…)` 참조(예: `"surface": "var(--bg-surface)"`).
  - `build/flutter/light_tokens.dart`(45줄): `class DoaLightTokens { static const Color bg_surface =
    Color(0xFFFFFFFF); static const double radius_control = 8; … }`.
  - `build/flutter/dark_tokens.dart`(45줄): `class DoaDarkTokens { … }`.

### SC-003 (@doa/ui 하드코딩 0 — 시맨틱 토큰 전환, API 불변)

- 검증 방법: `grep -rnE '(zinc|slate|gray|neutral)-[0-9]|(text|bg)-red-[0-9]' packages/ui/src/*.tsx`
  (stories 제외).
- 확인 사실:
  - 잔여 하드코딩 팔레트 클래스 **0건**. 컴포넌트가 `bg-surface`·`text-foreground`·`border-border`·
    `bg-success-soft`·`text-danger`·`rounded-control/card/pill` 등 시맨틱 토큰 클래스만 사용.
  - `index.ts` export 군: `cn`·`Button`(+`ButtonProps`·`buttonVariants`)·`Card`/`StatCard`·`Input`/`Select`/
    `Textarea`·`Badge`/`EmptyState`/`Loading`/`ErrorText`·`PageHeader`·`Dialog`군 8종. 기존 컴포넌트 export
    불변 + `Dialog`·`cn`·`buttonVariants` 추가(NFR-004).

### SC-004 (console build PASS — 13 라우트)

- 입력: `pnpm --filter console build`.
- 확인 사실: console `globals.css` 의 `@import` tokens.css + 공유 theme.css + `@source '../../../packages/
  ui/src'` 가 컴파일되어 시맨틱 토큰 유틸리티(`bg-surface` 등)가 생성되며, **13 라우트** 빌드 성공. body 에
  토큰(`var(--bg-canvas)`·`var(--fg-default)`) 적용.

### SC-005 (storybook build PASS)

- 입력: `pnpm --filter @doa/ui build-storybook`(= `storybook build`).
- 확인 사실: `main.ts` `viteFinal` 의 `@tailwindcss/vite` 주입 + `preview.ts` → `tailwind.css`(tailwindcss
  + tokens.css + theme.css + `@source '../src'`)로 Tailwind 4 + 토큰이 적용되며, 스토리(Button·Feedback)
  렌더 빌드가 성공한다.

### SC-006 (접근성·다크모드 분기)

- 검증 방법: `dialog.tsx`·`button.tsx`·`field.tsx`·`color.dark.json` 코드 조회.
- 확인 사실:
  - `dialog.tsx`: `import * as DialogPrimitive from '@radix-ui/react-dialog'` — 포커스 트랩·ESC·ARIA 기본
    제공. 닫기 버튼 `aria-label="닫기"` + lucide `X`.
  - `button.tsx`: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` 포커스 링.
  - `field.tsx`: `focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30`.
  - `tokens/semantic/color.dark.json` 존재 → `.dark` 색상 분기(NFR-003).

### SC-007 (타입체크 회귀 0)

- 입력: `pnpm --filter console typecheck`(= `tsc --noEmit`).
- 확인 사실: `@doa/ui` 토큰 전환(API 불변) 후에도 console 화면이 타입체크 통과 — EXIT 0(회귀 0, NFR-004).

---

## 외부 의존성 명시

### 도구 / 스크립트

- `style-dictionary ^4.4.0`(design-tokens devDep): `build.mjs` 의 토큰 빌드.
- `@radix-ui/react-dialog ^1.1.17`·`@radix-ui/react-slot ^1.3.0`: Dialog 접근성·asChild.
- `class-variance-authority ^0.7.1`·`clsx ^2.1.1`·`tailwind-merge ^3.6.0`: cva 변형·className 결합.
- `lucide-react ^1.22.0`: 아이콘(Dialog X).
- `storybook ^10.4.6`·`@storybook/react-vite`·`@storybook/addon-docs`·`@tailwindcss/vite ^4.3.2`·
  `vite ^8.1.0`: Storybook 카탈로그·빌드.

### 환경 변수

- 별도 환경 변수 불필요. 토큰 빌드·console/storybook build 는 정적 산출(서버·DB·네트워크 없음).

### 외부 서비스

- 없음. 검증은 빌드 산출물 조회 + 정적 grep + 타입체크(테스트 서버 기동 아님). a11y 자동 감사(axe)·시각
  회귀(Chromatic) 같은 외부 서비스는 미연동(GAP-002-01).

---

## 미커버 항목 (사전 분류)

| 항목 | 미커버 사유 | 카테고리 | 권장 검증 방법 |
|---|---|---|---|
| a11y 자동 감사(axe) | WCAG AA 는 Radix·포커스 링으로 구조 확보하나 자동 접근성 감사 미구축 | (2) 설계(품질 자동화 한계) | Storybook a11y 애드온 / axe-core CI 게이트 |
| 시각 회귀(visual regression) | 컴포넌트 시각 변화 자동 탐지 부재. Storybook 카탈로그는 수동 검토 | (2) 설계(품질 자동화 한계) | Chromatic / Playwright 스냅샷 |
| 다크모드 토글 UI | `.dark` 분기는 구현하나 런타임 테마 전환 UI 미구현 | (3) 기능 미구현(범위 외) | 테마 토글 컴포넌트 + `.dark` 클래스 토글 |
| `tailwind-preset.cjs` 소비 | 생성하나 Tailwind 4 console·Storybook 은 `@theme` 사용(preset 미연결) | (3) 기능 미구현(참조용) | v3 소비처 추가 시 preset 머지 |
| 풍부한 컴포넌트 인벤토리 | DataTable·Form·AppShell 등은 Phase 1~4 후속 | (3) 기능 미구현(범위 외) | Phase 1~4 에서 컴포넌트 + 스토리 추가 |
| 번들 사이즈 코드 스플릿 | console build 번들 최적화 미적용 | (2) 설계(성능 후속) | 코드 스플릿·동적 import |
