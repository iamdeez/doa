---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (retroactive)
---

# 테스트 실행 결과 — 002-design-system-foundation

## 목차

- [실행 요약](#실행-요약)
- [실패 목록](#실패-목록)
- [SC 매핑표 검증](#sc-매핑표-검증)
- [설계 문서 정합성](#설계-문서-정합성)
- [회귀 탐지](#회귀-탐지)

---

## 실행 요약

> 본 retroactive 검증은 002 완료 커밋 `721cb22`(base `3a6dbc9`)에서 main session 이 게이트를 직접
> 재실행·생성물 카운트하여 확인했다. 본 차수는 토큰·컴포넌트·빌드 설정으로 별도 단위 테스트 스위트가
> 없으며, 검증은 토큰 빌드 산출 + 정적 조회 + console/storybook build + 타입체크로 갈음한다.

| 항목 | 결과 (HEAD `721cb22`) |
|---|---|
| 실행 일시 | 2026-06-29 23:41 |
| design-tokens build | **성공** — build/web/{tokens.css,tailwind-preset.cjs}·build/flutter/{light,dark}_tokens.dart |
| tokens.css | **86줄** (:root light 전체 + `.dark` line 55 색상 오버라이드, primitive 미유출) |
| flutter dart | light/dark_tokens.dart **45 / 45줄** (Color·double 상수) |
| @doa/ui 하드코딩 | **0건** (grep — stories 제외) / export API 불변(+ Dialog·cn·buttonVariants) |
| console build | **PASS** (13 라우트) |
| build-storybook | **성공** (Tailwind4 + 토큰 + 스토리 렌더) |
| console typecheck | **회귀 0** (`tsc --noEmit` EXIT 0) |
| 전체 통과 여부 | **PASS** |
| 신규 단위 테스트 | **0** (토큰/컴포넌트/빌드 — Storybook 카탈로그가 시각 검증 대체) |
| 마이그레이션 | **없음** (DB 스키마 변경 0) |

### base(`3a6dbc9`) → 002(`721cb22`) 델타

| 항목 | base(`3a6dbc9`) | 002(`721cb22`) | 델타 |
|---|---|---|---|
| 디자인 토큰 | 없음(토큰 패키지 부재) | design-tokens(3계층 JSON + build.mjs + 산출물) | **신규 패키지** |
| @doa/ui | 하드코딩 팔레트(`zinc-*`·`red-*`) | shadcn 전환(cva·Radix·시맨틱 토큰, 하드코딩 0) | **토큰화 + Dialog 추가** |
| console 스타일 | Tailwind 기본 팔레트 | tokens.css + 공유 theme.css(@theme) + @source | **토큰 연결** |
| Storybook | 없음 | Storybook 10 react-vite + 스토리 2 | **신규 카탈로그** |
| 신규 의존 | — | style-dictionary·Radix 2·cva·clsx·tailwind-merge·lucide·storybook 4 | +11(UI/빌드 도구) |

> **신규 단위 0 산정(직접 확인)**: `git diff 3a6dbc9 721cb22 -- packages apps/console` 의 변경 파일은
> 토큰 JSON 7·build.mjs·theme.css·design-tokens package/README·@doa/ui src(cn·button·dialog·card·field·
> feedback·page-header·index)·.storybook 3·stories 2·ui package/.gitignore·console globals/package 이며
> `*.spec.ts`·`*.test.ts` 변경/추가가 0 이다. 토큰/컴포넌트/빌드 성격으로 단위 테스트 스위트 미추가.

### 실행 커맨드

```bash
cd /Users/krystal/workspace/doa/doa-next
pnpm --filter @doa/design-tokens build       # → build/web·build/flutter
pnpm --filter console build                  # 13 라우트 PASS
pnpm --filter @doa/ui build-storybook        # 성공
pnpm --filter console typecheck              # tsc --noEmit EXIT 0
# 생성물·하드코딩 카운트
wc -l packages/design-tokens/build/web/tokens.css                  # 86
grep -n '\.dark' packages/design-tokens/build/web/tokens.css        # 55
wc -l packages/design-tokens/build/flutter/*.dart                  # 45 / 45
grep -rnE '(zinc|slate|gray|neutral)-[0-9]|(text|bg)-red-[0-9]' packages/ui/src/*.tsx   # 0(stories 제외)
```

---

## 실패 목록

**실패 없음.** design-tokens build 성공(tokens.css 86줄·preset·dart 산출), @doa/ui 하드코딩 0, console
build 13 라우트 PASS, build-storybook 성공, console typecheck EXIT 0. 생성물·하드코딩 카운트가 spec.md
SC-001·002·003 의 기댓값과 일치.

---

## SC 매핑표 검증

| SC-ID | 관련 검증 | 통과 여부 |
|---|---|---|
| SC-001 | design-tokens build → tokens.css(:root+.dark, semantic만, primitive 미유출) | PASS(build)/VERIFIED(static) |
| SC-002 | tailwind-preset.cjs(var() 참조)·{light,dark}_tokens.dart(Color/double) | PASS(build)/VERIFIED(static) |
| SC-003 | @doa/ui 하드코딩 grep 0 + index.ts export 불변(+Dialog) | VERIFIED(static) |
| SC-004 | console build PASS(13 라우트 — 토큰 유틸 컴파일) | PASS(build) |
| SC-005 | build-storybook 성공(Tailwind4 + 토큰 + 스토리) | PASS(build) |
| SC-006 | dialog Radix(트랩·ESC·ARIA·aria-label)·button focus-visible ring·color.dark.json 분기 | VERIFIED(static) |
| SC-007 | console typecheck EXIT 0(회귀 0) | PASS(typecheck) |

---

## 설계 문서 정합성

### plan.md 현행화 점검

- 토큰 3계층 — primitive→semantic(base+color.light/dark) — plan.md §핵심 설계 1·ADR-002·FR-001 과 일치 ✓
- 빌드 — `build.mjs`(SD v4 programmatic, 커스텀 포맷 doa/tailwind-preset·dart-*, filter isSemantic) —
  plan.md §핵심 설계 2·ADR-003·004·FR-002·NFR-001 과 일치 ✓
- 컴포넌트 — `cn`·`Button`(cva+asChild)·`Dialog`(Radix)·Card·field·feedback·page-header 토큰 전환 —
  plan.md §핵심 설계 3·ADR-001·FR-003·NFR-002·004 와 일치 ✓
- console 연결 — globals.css tokens.css + 공유 theme.css(@theme) + @source — plan.md §핵심 설계 4·
  ADR-006·007·FR-004 와 일치 ✓
- Storybook — main.ts viteFinal Tailwind 주입 + preview tailwind.css + 스토리 — plan.md §핵심 설계 5·
  FR-005 와 일치 ✓
- 다크모드 — `color.dark.json` → `.dark` 색상 분기(base 불변) — plan.md ADR-005·NFR-003 과 일치 ✓

### 발견된 한계·관찰

- **a11y 자동 감사·시각 회귀 부재**: WCAG AA 는 Radix·포커스 링 구조 확보, 자동 감사·시각 회귀 미구축
  (GAP-002-01·coverage-gap.md).
- **다크모드 토글 UI 부재**: `.dark` 분기는 구현, 런타임 토글 UI 미구현(AppShell 후속).
- **`tailwind-preset.cjs` 미연결**: 생성하나 Tailwind4 는 `@theme` 사용(참조용 — GAP-002-01).
- **컴포넌트 인벤토리·Flutter 소비·번들 코드 스플릿**: Phase 1~4 / Phase 5 / 후속(범위 외).

### DESIGN-PLAN 대비 편차 정합

- DESIGN-PLAN §3 초안(primitive→semantic→component→theme, style-dictionary.config.js, css-vars.css·
  app_tokens.dart)과 실제 구현(primitive→semantic, build.mjs programmatic, tokens.css·{light,dark}_tokens.
  dart) 간 편차는 research.md §DESIGN-PLAN 대비 구현 편차에 기록됨. 핵심 결정(코드-퍼스트·SD·시맨틱 분기·
  양 플랫폼 생성) 위배 없음(단순화·실용화). component 토큰은 cva 변형이 흡수.

### 회귀 확인

- console 화면: `@doa/ui` 외부 API 불변(시맨틱 클래스만 내부 전환)이므로 console build·typecheck 회귀 0
  (NFR-004·SC-007). 시각 변화는 있으나(토큰 색상 적용) 빌드·타입 계약 불변.
- backend·shared-types·api-client: 변경 0(순수 클라이언트 디자인 토대 변경).

---

## 회귀 탐지

002 가 추가/변경한 파일 (`git diff 3a6dbc9 721cb22 -- packages apps/console` 기준 — numstat):
- `packages/design-tokens/**`(신규): 토큰 JSON 7(color +54·dimension +28·effect +16·typography +28·
  base +22·color.dark +48·color.light +48)·build.mjs(+125)·css/theme.css(+46)·package.json(+14)·
  README.md(+50). 산출물(build/*)은 `build/` gitignore 로 **미커밋**(재생성 — diff 28파일에 미포함).
- `packages/ui/src/`: button.tsx(+44 -36)·dialog.tsx(신규 +81)·cn.ts(+6 -3)·card.tsx(+6 -4)·
  field.tsx(+8 -6)·feedback.tsx(+15 -12)·page-header.tsx(+2 -2)·index.ts(+11)·button.stories.tsx(신규 +32)·
  feedback.stories.tsx(신규 +27).
- `packages/ui/.storybook/`: main.ts(+14)·preview.ts(+11)·tailwind.css(+10). package.json(+20 -1)·
  .gitignore(+1).
- `apps/console/app/globals.css`(+10 -9)·`apps/console/package.json`(+2 -1).

> 합계(packages + apps/console): **28 files changed, +779 / -74**(생성물 build/* 제외 — 재생성 명령
> DIFF 문서 참조). base `3a6dbc9`(001 SDD 문서 커밋) → `721cb22`(002 storybook+theme.css). 마이그레이션
> 없음(DB 스키마 변경 0). 산출물(build/web·build/flutter·storybook-static)은 재생성 가능
> (`build/`·`storybook-static/` gitignore — build/* 산출물은 미커밋, 재생성).
