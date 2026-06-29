---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (retroactive)
---

# Diff: 002-design-system-foundation

## 목차

- [커밋 메시지용 한 줄 요약](#커밋-메시지용-한-줄-요약)
- [변경 요약](#변경-요약)
- [변경 파일 및 라인 수](#변경-파일-및-라인-수)
- [Diff](#diff)

## 커밋 메시지용 한 줄 요약

- **KO**: 002 디자인 시스템 기반 — 코드-퍼스트 W3C 토큰(Style Dictionary→웹·Flutter) + @doa/ui Radix/shadcn 전환 + console 토큰 연결 + Storybook 카탈로그
- **EN**: 002 design-system foundation — code-first W3C tokens (Style Dictionary → web·Flutter) + @doa/ui Radix/shadcn migration + console token wiring + Storybook catalog

## 변경 요약

> base `3a6dbc9` → `721cb22`. 커밋 3개로 구성: `ea7521e`(@doa/design-tokens 패키지) → `d3dc628`(console
> 토큰 연결 + @doa/ui shadcn 전환) → `721cb22`(@doa/ui Storybook + 공유 theme.css SSOT 분리).

- **디자인 토큰 SSOT(FR-001)**: `packages/design-tokens`(신규) — W3C DTCG 토큰 JSON 3계층. primitive
  (`color` brand·neutral·status / `dimension` space·radius·border / `typography` font / `effect`
  shadow·duration·easing) → semantic(`base` = theme 독립 radius·space·text·motion; `color.light`/
  `color.dark` = 의미 색상 bg·fg·border·accent·success·warning·danger·info). primitive 는 참조 전용.
- **빌드 자동 생성(FR-002·NFR-001·003)**: `build.mjs`(Style Dictionary v4 programmatic, 커스텀 포맷
  `doa/tailwind-preset`·`doa/dart-light`·`doa/dart-dark`) → `build/web/tokens.css`(`:root` light 전체 +
  `.dark` 색상 오버라이드 — **semantic 만 노출**, primitive 미유출) + `build/web/tailwind-preset.cjs`
  (`var(--…)` 참조) + `build/flutter/{light,dark}_tokens.dart`(`Color`·`double` 상수). 재생성
  `pnpm --filter @doa/design-tokens build`.
- **@doa/ui shadcn 전환(FR-003·NFR-002·004)**: `cn`(clsx + tailwind-merge), `Button`(cva 변형
  primary/secondary/ghost/danger/link × sm/md/lg/icon + `asChild` Radix Slot + `focus-visible:ring-ring`),
  `Dialog`(신규 — Radix Dialog 래핑, 포커스 트랩·ESC·ARIA 기본 + lucide X·`aria-label="닫기"`).
  `Card`·`field`·`feedback`(Badge tones·EmptyState·Loading·ErrorText)·`page-header` 의 하드코딩 팔레트
  (`zinc-*`·`red-*`)를 시맨틱 토큰 클래스로 전환(잔여 하드코딩 0, export API 불변).
- **console 토큰 연결 + 공유 SSOT(FR-004)**: `apps/console/app/globals.css` 가 `@import 'tailwindcss'` +
  design-tokens `tokens.css` + 공유 `css/theme.css`(`@theme inline` — 시맨틱 토큰 → Tailwind 유틸
  `bg-surface`·`text-foreground`·`border-border`·`rounded-control` 등) + `@source`(@doa/ui 스캔)를 import.
  `@theme` 매핑을 console·Storybook 공유 `theme.css` 로 분리(중복 제거). console `package.json` 에
  `@doa/design-tokens` workspace dep 추가.
- **Storybook 카탈로그(FR-005)**: `packages/ui/.storybook/`(신규) — Storybook 10 react-vite. `main.ts`
  `viteFinal` 로 `@tailwindcss/vite` 주입, `preview.ts` → `tailwind.css`(tailwindcss + tokens.css +
  theme.css + `@source`). 스토리 Button(변형·AllVariants)·Feedback(Badge tones·EmptyState).
  `storybook`/`build-storybook` 스크립트.
- **생성물(미커밋)**: `build/web/*`·`build/flutter/*` 는 `build/` gitignore 로 **레포 미커밋**(재생성
  산출물 — 본 diff 28파일에 미포함). `storybook-static/` 도 gitignore.
- **검증**: design-tokens build 성공(tokens.css 86줄·preset·dart 산출)·@doa/ui 하드코딩 0·console build
  13 라우트 PASS·build-storybook 성공·console typecheck 0. 신규 단위 테스트 0(토큰/컴포넌트/빌드 —
  Storybook 카탈로그가 시각 검증 대체).
- **해결**: `@doa/ui` 하드코딩·토큰/다크모드/SSOT 부재 제거(DESIGN-PLAN Phase 0 디자인 토대) — 디자인
  결정 SSOT 를 토큰 JSON 으로 단일화 + shadcn 토대 + 다크모드 분기 구조 확보. 풍부한 인벤토리·a11y
  자동화·다크 토글·Flutter 소비는 후속(GAP-002-01 / Phase 1~5).

## 변경 파일 및 라인 수

> 범위: `packages` + `apps/console`. base `3a6dbc9` → `721cb22`. `git diff --numstat 3a6dbc9 721cb22 --
> packages apps/console` 직접 카운트. **생성물 `build/*` 은 `build/` gitignore 로 추적 대상이 아니며 본
> 표(diff)에 포함되지 않는다.**

| 파일 | 추가 | 삭제 | 비고 |
|---|---|---|---|
| `packages/design-tokens/build.mjs` (신규) | +125 | -0 | Style Dictionary v4 programmatic 빌드 |
| `packages/ui/src/dialog.tsx` (신규) | +81 | -0 | Radix Dialog 래핑 + 토큰 |
| `packages/design-tokens/tokens/primitive/color.json` (신규) | +54 | -0 | brand·neutral·status 색상 |
| `packages/design-tokens/README.md` (신규) | +50 | -0 | 패키지 문서 |
| `packages/design-tokens/tokens/semantic/color.dark.json` (신규) | +48 | -0 | 다크 의미 색상 |
| `packages/design-tokens/tokens/semantic/color.light.json` (신규) | +48 | -0 | 라이트 의미 색상 |
| `packages/design-tokens/css/theme.css` (신규) | +46 | -0 | 시맨틱 토큰 → Tailwind 유틸(@theme, 공유 SSOT) |
| `packages/ui/src/button.tsx` | +44 | -36 | cva 변형 + asChild Slot + 포커스링 + 토큰 |
| `packages/ui/src/button.stories.tsx` (신규) | +32 | -0 | Button 스토리(변형·AllVariants) |
| `packages/design-tokens/tokens/primitive/dimension.json` (신규) | +28 | -0 | space·radius·border |
| `packages/design-tokens/tokens/primitive/typography.json` (신규) | +28 | -0 | font family·size·weight·lineHeight |
| `packages/ui/src/feedback.stories.tsx` (신규) | +27 | -0 | Badge tones·EmptyState 스토리 |
| `packages/design-tokens/tokens/semantic/base.json` (신규) | +22 | -0 | theme 독립 radius·space·text·motion |
| `packages/ui/package.json` | +20 | -1 | Radix·cva·lucide·storybook 의존 + 스크립트 |
| `packages/design-tokens/tokens/primitive/effect.json` (신규) | +16 | -0 | shadow·duration·easing |
| `packages/ui/src/feedback.tsx` | +15 | -12 | Badge tones·EmptyState 등 토큰 전환 |
| `packages/design-tokens/package.json` (신규) | +14 | -0 | style-dictionary devDep + build 스크립트 |
| `packages/ui/.storybook/main.ts` (신규) | +14 | -0 | react-vite + viteFinal Tailwind 주입 |
| `packages/ui/src/index.ts` | +11 | -0 | Dialog·cn·buttonVariants export 추가 |
| `packages/ui/.storybook/preview.ts` (신규) | +11 | -0 | tailwind.css import |
| `apps/console/app/globals.css` | +10 | -9 | tokens.css + theme.css import + @source |
| `packages/ui/.storybook/tailwind.css` (신규) | +10 | -0 | tailwindcss + tokens.css + theme.css + @source |
| `packages/ui/src/field.tsx` | +8 | -6 | Input/Select/Textarea 토큰 전환 |
| `packages/ui/src/card.tsx` | +6 | -4 | Card/StatCard 토큰 전환 |
| `packages/ui/src/cn.ts` | +6 | -3 | clsx + tailwind-merge 결합 |
| `apps/console/package.json` | +2 | -1 | `@doa/design-tokens` workspace dep |
| `packages/ui/src/page-header.tsx` | +2 | -2 | PageHeader 토큰 전환 |
| `packages/ui/.gitignore` (신규) | +1 | -0 | `storybook-static/` |

**합계 (packages + apps/console)**: 28 files changed, 779 insertions(+), 74 deletions(-).

> **생성물 처리**: `packages/design-tokens/build/web/{tokens.css,tailwind-preset.cjs}`·`build/flutter/
> {light,dark}_tokens.dart` 는 자동 생성물이며 `build/`(root `.gitignore`) 로 추적되지 않는다(미커밋).
> Storybook 빌드 산출 `storybook-static/` 도 gitignore. 라인 단위 diff 를 본 문서에 박제하지 않으며
> git 이 형상관리 SoT 다. 산출물 재생성: `pnpm --filter @doa/design-tokens build`(토큰) /
> `pnpm --filter @doa/ui build-storybook`(카탈로그).
>
> 본 002 SDD 문서 세트(`docs/specs/v1.1.0/002-design-system-foundation/**`) 와 `CHANGES.md` 갱신은
> `721cb22` 코드 커밋 **이후** retroactive 로 별도 추가되었다(코드 diff 범위 외). 본 표는 spec 코드 범위
> (`packages`·`apps/console`)로 한정한다.

## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 다. 변경 내용은 위 "변경 요약" ·
> "변경 파일 및 라인 수" 절로 추적하고, 라인 단위 diff 가 필요하면 아래로 재생성한다:
>
> ```bash
> git diff 3a6dbc9 721cb22 -- packages apps/console   # base commit: 3a6dbc9
> # 생성물 재생성(소스에서 — build/ 는 gitignore):
> pnpm --filter @doa/design-tokens build      # → build/web·build/flutter
> pnpm --filter @doa/ui build-storybook        # → storybook-static (gitignore)
> ```
