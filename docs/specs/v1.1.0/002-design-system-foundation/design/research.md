---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (retroactive)
---

# Research: 002-design-system-foundation

## 목차

- [분석 우선순위 게이트 결과](#분석-우선순위-게이트-결과)
- [기존 코드베이스 분석](#기존-코드베이스-분석)
  - [공유 패키지 현황](#공유-패키지-현황)
  - [@doa/ui 하드코딩 한계](#doaui-하드코딩-한계)
- [shadcn vs 컴포넌트 라이브러리(Ant/MUI) 비교](#shadcn-vs-컴포넌트-라이브러리antmui-비교)
- [코드-퍼스트 토큰 vs Figma export 비교](#코드-퍼스트-토큰-vs-figma-export-비교)
- [Tailwind 4 @theme vs preset.cjs 비교](#tailwind-4-theme-vs-presetcjs-비교)
- [Style Dictionary v4 programmatic 선택 근거](#style-dictionary-v4-programmatic-선택-근거)
- [다크모드 분기 전략](#다크모드-분기-전략)
- [@theme 중복 → theme.css 분리 근거](#theme-중복--themecss-분리-근거)
- [DESIGN-PLAN 대비 구현 편차](#design-plan-대비-구현-편차)
- [생성물 검증 (직접 카운트)](#생성물-검증-직접-카운트)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 분석 우선순위 게이트 결과

- **변경 대상(plan §핵심 설계)**: `packages/design-tokens`(신규 패키지 — 토큰 JSON·build.mjs·theme.css·
  산출물), `packages/ui/src`(cn·button·dialog·card·field·feedback·page-header·index 전환),
  `packages/ui/.storybook`(신규), `apps/console/app/globals.css`·`package.json`(연결). `apps/backend`·
  `packages/shared-types`·`packages/api-client` **변경 없음**.
- §A·B·C 분석은 design-tokens build.mjs·@doa/ui 컴포넌트·console globals.css 로 한정.
- §D(다단계 병렬 파이프라인): 미해당.
- §E(동일 가드 결정 통합): 미해당(인가 변경 없음).
- 외부 라이브러리 검증(§4): **신규 라이브러리 11종** — `style-dictionary ^4.4.0`, Radix 2종, cva·clsx·
  tailwind-merge, lucide-react, Storybook/Vite 4종. 아래 비교 절에서 선택 근거 분석.
- §F(production 시그니처 변경): **미해당** — 기존 `@doa/ui` 컴포넌트의 외부 export(컴포넌트명·props)는
  불변. 내부 className 만 시맨틱 토큰으로 전환 + `Dialog`·`cn`·`buttonVariants` 추가 export. console 화면
  코드 불변.

---

## 기존 코드베이스 분석

> context.md 의 모노레포 구조를 기준선. 본 절은 변경 대상 한정 정밀 분석.

### 공유 패키지 현황

- **공유 패키지 3종**(FRONTEND-PLAN.md §2-2): `@doa/shared-types`(001 코드젠 도입), `@doa/api-client`,
  `@doa/ui`(기본 컴포넌트). 002 는 `@doa/ui` 전환 + 신규 `@doa/design-tokens` 추가(shared-types·api-client
  불변).
- **OOP 상속/추상 클래스 없음**: 변경 대상은 React 함수 컴포넌트·토큰 JSON·빌드 스크립트(`build.mjs` —
  top-level async)다. 클래스 계층 없음.
- **소비처**: console(Next.js 15·Tailwind 4)이 `@doa/ui` 와 토큰을 소비. Storybook(신규)이 별도 소비처로
  추가.

### @doa/ui 하드코딩 한계

- 002 이전 `@doa/ui` 컴포넌트(`button`·`card`·`field`·`feedback`·`page-header`)는 색상·반경을 Tailwind
  기본 팔레트 리터럴(`zinc-*`·`red-*` 등)로 하드코딩했다(diff 의 삭제 라인 — button -36·feedback -12·
  field -6·card -4·page-header -2). 이로 인해 (a) 색상 결정이 컴포넌트마다 분산, (b) 테마·다크모드 분기
  수단 부재, (c) 디자인 SSOT 부재였다.
- 전환 후 동일 컴포넌트가 시맨틱 토큰 클래스(`bg-surface`·`text-foreground`·`border-border`·
  `bg-success-soft` 등)를 참조하며, 색상 결정은 `design-tokens` 의 `color.light`/`color.dark` JSON 으로
  단일화된다(SSOT — 코드젠 도입 동기와 동형의 구조 개선).

---

## shadcn vs 컴포넌트 라이브러리(Ant/MUI) 비교

| 항목 | Ant Design / MUI(대안) | Radix + shadcn/ui 패턴(002 채택) |
|---|---|---|
| 코드 소유 | 라이브러리 내부(블랙박스 커스터마이징) | **코드 소유**(복붙·완전 커스터마이징) |
| 토큰 정합 | 자체 테마 시스템(토큰 SSOT 와 이중) | Tailwind 시맨틱 토큰 클래스 직접 결합 |
| 접근성 | 컴포넌트별 상이 | Radix 프리미티브 기본 내장(트랩·ARIA·키보드) |
| 번들 | 큰 라이브러리 일괄 도입 | 필요 컴포넌트만 |

> 채택: Radix + shadcn(ADR-001). 접근성 내장 + 코드 소유로 토큰 정합·커스터마이징. DESIGN-PLAN §1 확정.
> 실측: `Button` 이 `@radix-ui/react-slot`(asChild)·`cva` 변형을, `Dialog` 가 `@radix-ui/react-dialog`
> (포커스 트랩·ESC·ARIA·`aria-label="닫기"`)를 사용(코드 직접 확인).

---

## 코드-퍼스트 토큰 vs Figma export 비교

| 항목 | Figma export(대안) | 코드-퍼스트 W3C DTCG JSON(002 채택) |
|---|---|---|
| SSOT | 디자인 파일(개발자 비편집) | **코드(JSON)** — 개발자가 직접 관리·diff |
| 양 플랫폼 생성 | 별도 export 변환 필요 | Style Dictionary 가 웹·Flutter 결정적 생성 |
| 현 단계 적합성 | 전담 디자이너 필요 | 디자이너 미참여 단계에서 실용적 |
| 표준 | 도구 종속 포맷 | W3C DTCG(`$value`/`$type`) 표준 |

> 채택: 코드-퍼스트(ADR-002). `tokens/primitive/*`·`tokens/semantic/*` 가 W3C DTCG(`$value`/`$type`)로
> 작성되며, `build.mjs` 가 단일 소스에서 웹(CSS vars·Tailwind preset)·Flutter(Dart 상수)를 생성한다.

---

## Tailwind 4 @theme vs preset.cjs 비교

| 항목 | `tailwind-preset.cjs`(v3 preset) | Tailwind 4 `@theme inline`(002 채택) |
|---|---|---|
| Tailwind 버전 | v3 `tailwind.config` preset 머지 | **v4 CSS-퍼스트**(`@theme`) |
| console 정합 | console 은 Tailwind 4 — preset 머지 미사용 | console·Storybook 모두 v4 — `@theme` 직접 |
| 매핑 위치 | JS 설정 파일 | CSS(`css/theme.css`) — 토큰 변수 직접 참조 |

> 채택: `@theme inline`(ADR-007). console·Storybook 이 Tailwind 4 이므로 `@theme` 로 시맨틱 토큰 변수를
> Tailwind 유틸리티(`--color-surface: var(--bg-surface)` 등)에 매핑한다. `tailwind-preset.cjs` 는 빌드가
> **생성하나 참조용**(v3 소비처 부재 — GAP-002-01). 이 편차는 토큰 빌드가 양쪽을 모두 산출하되 console
> 은 `@theme` 만 소비함을 의미한다.

---

## Style Dictionary v4 programmatic 선택 근거

- **programmatic(`new StyleDictionary(...)`)**: 선언적 `style-dictionary.config.js` 대신 `build.mjs` 가
  StyleDictionary 인스턴스를 **light/dark 2개** 생성한다(`instance('light')`·`instance('dark')`). 각
  인스턴스가 서로 다른 `source`(light=base+color.light, dark=base+color.dark)와 filter(light=`isSemantic`,
  dark=`isSemanticColorDark`)·selector(`:root`/`.dark`)를 갖기 때문에 선언적 단일 config 로는 표현이
  번거롭다.
- **커스텀 포맷 등록**: `doa/tailwind-preset`(semantic → `theme.extend`, `var(--…)`)·`doa/dart-light`·
  `doa/dart-dark`(semantic 색상→`Color(0xFF…)`, 치수→`double`)을 `registerFormat` 으로 정의. 표준 포맷에
  없는 산출 형태라 programmatic 이 적합.
- **버전**: `style-dictionary ^4.4.0`(design-tokens devDependency). `build.mjs` 는 125줄.
- **CSS 결합**: light 인스턴스가 `_root.css`, dark 가 `_dark.css` 를 생성하면, 스크립트가 두 파일을
  `tokens.css` 로 결합(`/** AUTO-GENERATED … */` 헤더 + root + dark)한 뒤 임시 파일 2개를 `rmSync` 한다.

---

## 다크모드 분기 전략

- **semantic 색상만 분기(ADR-005)**: 다크모드는 `tokens/semantic/color.dark.json` 에서만 정의된다. base
  토큰(radius·space·text·motion)은 theme 독립이므로 light 빌드의 `:root` 에만 출력되고 dark 에는
  포함되지 않는다(dark 인스턴스 filter `isSemanticColorDark` — `color.dark` 파일만).
- **산출 형태**: `tokens.css` 의 `:root`(line 6~) 가 light 시맨틱 전체(radius·space·text·motion·border·
  bg·fg·accent·status 색상)를, `.dark`(line 55~) 가 색상 변수만 오버라이드한다. 컴포넌트는 시맨틱 클래스
  (`bg-surface` 등)만 사용하므로, `.dark` 클래스가 켜지면 동일 클래스가 자동으로 다크 색상으로 해석된다
  (컴포넌트별 `dark:` 클래스 불필요).
- **현 한계**: `.dark` 분기는 구현되나 런타임 토글 UI(테마 스위처)는 미구현(범위 외).

---

## @theme 중복 → theme.css 분리 근거

- console 과 Storybook 은 둘 다 Tailwind 4 이며 동일한 시맨틱 토큰 → Tailwind 유틸리티 매핑(`@theme inline`)
  이 필요하다. 매핑을 각 소비처(`apps/console/app/globals.css`·`packages/ui/.storybook/tailwind.css`)에
  중복 정의하면 토큰 추가·변경 시 양쪽을 동기화해야 하는 drift 부담이 생긴다.
- 따라서 매핑을 `packages/design-tokens/css/theme.css`(46줄) 단일 파일로 분리하고, console `globals.css`
  와 Storybook `tailwind.css` 가 모두 이를 `@import` 한다(공유 SSOT — ADR-006). 토큰 JSON(값) + theme.css
  (매핑)이 디자인 시스템의 두 SSOT 다.

---

## DESIGN-PLAN 대비 구현 편차

> DESIGN-PLAN §3 의 토큰 아키텍처 초안과 실제 구현 간 의도된 편차를 기록한다(설계 의도 추적용).

| 항목 | DESIGN-PLAN §3 초안 | 실제 구현(002) | 사유 |
|---|---|---|---|
| 토큰 계층 | primitive → semantic → **component** → theme | primitive → semantic(base + color.light/dark) | component 레이어는 cva 변형(`button.tsx`)이 흡수 — 별도 토큰 파일 불요(YAGNI). component 토큰은 후속에 필요 시 추가 |
| theme 분기 | `theme/light.json`·`dark.json` | `semantic/color.light.json`·`color.dark.json` | 색상만 분기하므로 semantic 색상 파일로 통합(base 는 theme 독립) |
| 빌드 설정 | `style-dictionary.config.js`(선언적) | `build.mjs`(programmatic) | light/dark 인스턴스·커스텀 포맷 필요(위 §SD 선택 근거) |
| 웹 산출 | `css-vars.css` + `tailwind-preset.js` | `tokens.css` + `tailwind-preset.cjs` | 네이밍·확장자 차이. preset 은 생성하되 console 은 `@theme` 소비(GAP-002-01) |
| Flutter 산출 | `app_tokens.dart`(단일) | `light_tokens.dart`·`dark_tokens.dart` | theme 별 분리 산출. ThemeData 소비는 Phase 5 |

> 편차는 전부 단순화·실용화 방향이며 DESIGN-PLAN 의 핵심 결정(코드-퍼스트·Style Dictionary·시맨틱 분기·
> 양 플랫폼 생성)을 위배하지 않는다. component 토큰 레이어·Flutter 소비는 후속에 확장 가능하다.

---

## 생성물 검증 (직접 카운트)

> 생성물 수치는 추측하지 않고 직접 확인했다(자가 보고 신뢰하지 않음).

| 산출물 | 측정 | 값 | 측정 방법 |
|---|---|---|---|
| `build/web/tokens.css` | 줄수 | **86** | `wc -l` |
| | `.dark` 셀렉터 시작 | line **55** | `grep -n '\.dark'` |
| | primitive 노출 | **0**(semantic만) | `grep '--color-brand'` 등 → 미존재 |
| `build/web/tailwind-preset.cjs` | 형태 | `theme.extend`(colors·borderRadius·spacing·fontSize·transitionDuration → `var(--…)`) | 파일 조회 |
| `build/flutter/light_tokens.dart` | 줄수 | **45**(`DoaLightTokens` Color/double 상수) | `wc -l` |
| `build/flutter/dark_tokens.dart` | 줄수 | **45**(`DoaDarkTokens`) | `wc -l` |
| `build.mjs` | 줄수 | **125** | `git diff --numstat` |
| `css/theme.css` | 줄수 | **46** | `git diff --numstat` |
| `@doa/ui` 잔여 하드코딩 | `zinc/slate/gray/red-[0-9]` 클래스 | **0건**(stories 제외) | `grep -rnE … packages/ui/src/*.tsx` |

- 토큰 구성: primitive 색상(brand 10단계·neutral 12단계·green/amber/red/blue status 각 4단계) + dimension
  (space 11·radius 5·border width 2) + typography(font.family 2·size 7·weight 4·lineHeight 3) +
  effect(shadow 3·duration 3·easing 2). semantic base(radius 4·space 3·text 3·motion 2) + color.light/dark
  (bg 5·fg 5·border 4·accent 4·success/warning/danger/info 각 3).

---

## 엣지 케이스 및 한계

- **primitive 미유출**: 빌드 filter(`isSemantic`/`isSemanticColorDark`)로 semantic 만 CSS 변수로 출력.
  primitive(`color.brand.*` 등)는 참조 전용으로 노출되지 않는다(NFR-001 — 직접 grep 확인).
- **`@source` 누락 시 스타일 누락**: Tailwind 4 는 워크스페이스 `node_modules` 를 기본 미스캔. console·
  Storybook 이 `@source` 로 `@doa/ui` 의 시맨틱 토큰 클래스를 명시 스캔하지 않으면 최종 CSS 에서 누락.
- **`tailwind-preset.cjs` 미연결**: 생성되나 Tailwind 4 소비처(console·Storybook)는 `@theme` 사용. preset
  의 실제 소비처 부재(참조용 — GAP-002-01).
- **다크모드 토글 부재**: `.dark` 분기·`color.dark.json` 구현하나 런타임 토글 UI 미구현(후속).
- **a11y 자동 감사·시각 회귀 부재**: WCAG AA 는 Radix·포커스 링으로 구조 확보하나 axe 자동 감사·Chromatic
  시각 회귀 미구축(GAP-002-01). Storybook 카탈로그가 수동 시각 검토 대체.
- **컴포넌트 인벤토리 부분**: 002 는 토대 컴포넌트(Button·Dialog·Card·field·feedback·page-header)까지.
  DataTable·Form·AppShell 등 DESIGN-PLAN §5-2 전체 인벤토리는 Phase 1~4 후속.

가정-실제 불일치 현재 미발견(산출물 수치·하드코딩 0 을 직접 카운트·grep 으로 확인).
