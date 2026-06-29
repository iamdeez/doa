---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (구현 완료 — retroactive 문서화)
---

# Spec: 002-design-system-foundation

> Branch: 002-design-system-foundation | Date: 2026-06-29 | Version: v1.1.0
>
> 본 문서는 이미 구현·검증이 완료된 코드(커밋 `721cb22`, base `3a6dbc9`)를 근거로 정식 SDD 포맷으로
> retroactive 작성되었다. 모든 요구사항·수용 기준은 실제 구현된 디자인 토큰 패키지
> (`packages/design-tokens/` — W3C DTCG 토큰 JSON·`build.mjs`·산출물), shadcn 전환된 공유 UI
> (`packages/ui/src/` — `cn`·`button`·`dialog`·`card`·`field`·`feedback`·`page-header`), console 토큰 연결
> (`apps/console/app/globals.css`·공유 `css/theme.css`), Storybook 설정(`packages/ui/.storybook/`)에서 확인한
> 사실을 기준으로 한다. v1.1.0 프론트엔드 릴리즈 사이클에서 001(OpenAPI 코드젠) 다음 차수이며,
> **DESIGN-PLAN Phase 0 — 디자인 시스템 기반(토큰·컴포넌트 토대·Storybook)** 에 해당한다.

## 목차

- [배경 및 목적](#배경-및-목적)
- [사용자 스토리](#사용자-스토리)
- [기능 요구사항](#기능-요구사항)
- [비기능 요구사항](#비기능-요구사항)
- [수용 기준](#수용-기준)
- [요구사항 구조화 매트릭스](#요구사항-구조화-매트릭스)
- [범위 외](#범위-외)
- [미결 사항](#미결-사항)

---

## 배경 및 목적

001(OpenAPI 코드젠)로 프론트-백엔드 타입 계약 SSOT 가 확립된 시점에서, console·Flutter 의 화면 구현에
착수하기 위한 **디자인 시스템 기반**을 마련한다(DESIGN-PLAN). 그 토대는 (1) 색상·치수·타이포·모션을
단일 소스에서 관리하는 **디자인 토큰 SSOT**, (2) 접근성을 내장한 **컴포넌트 파운데이션**, (3) 두 소비처
(console·Storybook)가 공유하는 토큰→Tailwind 매핑이다.

- **기존 한계 (하드코딩·테마/다크모드/토큰 부재)**: `@doa/ui` 의 기존 컴포넌트는 색상·반경을 Tailwind
  팔레트 리터럴(`zinc-*`·`red-*` 등)로 **하드코딩**하고 있어, (a) 색상 결정이 컴포넌트마다 분산되어 일관성·
  변경 추적이 어렵고, (b) **테마·다크모드 분기 수단이 없으며**, (c) 디자인 결정의 SSOT 가 부재했다. console
  도 Tailwind 기본 팔레트에 의존했고, 웹·Flutter 양 플랫폼에 동일한 디자인 결정을 전파할 코드-퍼스트
  토큰 파이프라인이 없었다.

002 는 이 공백을 **코드-퍼스트 W3C 디자인 토큰(JSON) → Style Dictionary → 웹·Flutter 산출물 자동
생성** 파이프라인과 **Radix + shadcn/ui 패턴 + Tailwind 4 시맨틱 토큰 클래스** 컴포넌트 전환으로
해소한다. 디자인 결정의 SSOT 가 `packages/design-tokens` 의 토큰 JSON 으로 단일화되고, 컴포넌트는 원시
색상 대신 시맨틱 토큰 유틸리티(`bg-surface`·`text-foreground`·`border-border`·`rounded-control` 등)를
참조하여 다크모드 분기·일관성·접근성을 구조적으로 확보한다.

> 설계 결정(DESIGN-PLAN 확정): 웹 파운데이션 Radix UI 프리미티브 + shadcn/ui 패턴 + Tailwind 4(데이터
> 테이블은 TanStack Table — 후속), 코드-퍼스트 W3C 토큰 → Style Dictionary → 웹(CSS vars/Tailwind)·
> Flutter(Dart ThemeData), 아이콘 Lucide, 컴포넌트 문서 Storybook, 접근성 WCAG 2.1 AA, 다크모드 토큰
> 분기. 002 는 그중 **토큰 SSOT + 컴포넌트 토대(shadcn 전환) + console 연결 + Storybook 카탈로그** 까지를
> 범위로 한다(DataTable·Form·AppShell 등 풍부한 인벤토리는 Phase 1~4 후속).

---

## 사용자 스토리

- **US-001**: 프론트엔드 개발자로서, 색상·반경·간격을 컴포넌트마다 하드코딩하지 않고 단일 토큰 소스에서
  관리하여, 디자인 변경이 한 곳 수정으로 웹·Flutter 양 플랫폼에 일관되게 전파되기를 원한다.
- **US-002**: console 개발자로서, 접근성(포커스 트랩·키보드·ARIA·포커스 링)이 내장된 Radix+shadcn 기반
  컴포넌트와 시맨틱 토큰 유틸리티(`bg-surface`·`text-foreground` 등)를 사용하여, 다크모드 분기와 WCAG AA
  를 구조적으로 보장받으며 화면을 구축하기를 원한다.
- **US-003**: 디자인 시스템 관리자로서, 컴포넌트의 변형·상태를 Storybook 카탈로그로 시각화하여 일관성을
  검토하고, 토큰 변경이 컴포넌트에 어떻게 반영되는지 확인하기를 원한다.

---

## 기능 요구사항

- **FR-001** (코드-퍼스트 토큰 SSOT): 신규 패키지 `packages/design-tokens` 가 W3C DTCG 토큰 JSON 을
  **3계층**(primitive → semantic → theme)으로 정의한다. primitive(`color`·`dimension`·`typography`·`effect`
  — brand·neutral·status 색상, space·radius·border, font family/size/weight/lineHeight, shadow·duration·
  easing)은 원시값(참조 전용), semantic(`base.json` = theme 독립 radius·space·text·motion; `color.light`/
  `color.dark` = 의미 색상 bg·fg·border·accent·success·warning·danger·info)은 컴포넌트가 참조하는 의미값이다.

- **FR-002** (웹/Flutter 산출물 자동 생성): `build.mjs`(Style Dictionary v4 programmatic, 커스텀 포맷
  `doa/tailwind-preset`·`doa/dart-light`·`doa/dart-dark`)가 토큰 JSON 에서 (a) `build/web/tokens.css`
  (`:root` light 전체 + `.dark` 색상 오버라이드 — **semantic 만 노출**, primitive 미유출), (b)
  `build/web/tailwind-preset.cjs`(Tailwind `theme.extend`, `var(--…)` 참조), (c) `build/flutter/
  {light,dark}_tokens.dart`(`Color`·`double` 상수)를 생성한다. 재생성은 `pnpm --filter @doa/design-tokens
  build`.

- **FR-003** (shadcn 컴포넌트 토대): `@doa/ui` 를 shadcn/ui 패턴으로 전환한다. `cn`(clsx + tailwind-merge),
  `Button`(cva 변형 primary/secondary/ghost/danger/link × sm/md/lg/icon + `asChild` Radix Slot + 포커스
  링), `Dialog`(Radix Dialog 래핑 — 포커스 트랩·ESC·ARIA 기본 제공 + 토큰)을 추가하고, `Card`·`field`
  (Input/Select/Textarea)·`feedback`(Badge tones·EmptyState·Loading·ErrorText)·`page-header` 의 하드코딩
  팔레트를 시맨틱 토큰 클래스로 전환한다. 아이콘은 `lucide-react`.

- **FR-004** (console 토큰 연결 + 공유 매핑 SSOT): `apps/console/app/globals.css` 가 `@import 'tailwindcss'`
  + design-tokens `tokens.css` + 공유 `design-tokens/css/theme.css`(`@theme inline` 매핑: 시맨틱 토큰 →
  Tailwind 유틸리티 `bg-surface`·`text-foreground`·`border-border`·`text-muted-foreground`·`rounded-control`
  등) + `@source`(`@doa/ui` 스캔)를 import 한다. `@theme` 매핑은 console·Storybook 이 공유하는 단일
  SSOT(`theme.css`)로 분리하여 중복을 제거한다.

- **FR-005** (Storybook 카탈로그): `packages/ui/.storybook/` 에 Storybook 10(react-vite) 을 구성한다.
  `main.ts` 의 `viteFinal` 이 `@tailwindcss/vite` 를 주입하고, `preview.ts` 가 `tailwind.css`(tailwindcss
  + tokens.css + theme.css + `@source`)를 import 한다. 스토리는 Button(변형·AllVariants)·Feedback(Badge
  tones·EmptyState)이며, `storybook`·`build-storybook` 스크립트를 제공한다.

---

## 비기능 요구사항

- **NFR-001** (토큰 단일 소스 — 원시 하드코딩 금지): 디자인 결정의 SSOT 는 `design-tokens` 토큰 JSON 이다.
  웹 산출물은 **semantic 토큰만** CSS 변수로 노출하며 primitive 는 유출하지 않는다. `@doa/ui` 컴포넌트의
  잔여 하드코딩 팔레트 클래스(`zinc-*`·`red-*`·`slate-*` 등)는 **0건**이다.

- **NFR-002** (WCAG 2.1 AA 접근성): 인터랙티브 컴포넌트는 접근성을 내장한다 — `Dialog` 는 Radix 프리미티브
  로 포커스 트랩·ESC·ARIA·`aria-label` 을 기본 제공하고, `Button`·`field` 는 `focus-visible` 포커스 링
  (`ring-ring` / `border-ring`)을 갖는다.

- **NFR-003** (다크모드 토큰 분기): 다크모드는 `semantic/color.dark.json` 에서만 분기하며, 산출물
  `tokens.css` 가 `.dark` 셀렉터로 색상 변수를 오버라이드한다. theme 독립 토큰(radius·space·text·motion)
  은 분기하지 않는다.

- **NFR-004** (`@doa/ui` API 하위호환): 토큰 전환은 컴포넌트의 외부 export API(컴포넌트명·props)를 변경하지
  않는다. 기존 console 화면은 전환된 `@doa/ui` 를 그대로 소비하며(시각 변화는 있으나) 빌드·타입체크가
  통과한다.

- **NFR-005** (신규 의존성 정당화): 신규 의존성은 전부 클라이언트 UI·빌드 도구(`style-dictionary`·
  `@radix-ui/*`·`class-variance-authority`·`clsx`·`tailwind-merge`·`lucide-react`·`storybook`·
  `@storybook/*`·`@tailwindcss/vite`·`vite`)이며, `@aws-sdk/*`·클라우드 전용 SDK 가 아니므로 P-002(AWS
  의존 금지)에 저촉되지 않는다.

---

## 수용 기준

> **환경 태그 규약**:
> | 태그 | 의미 |
> |---|---|
> | `[env:build]` | 빌드/생성 스크립트 실행(토큰 빌드·console build·storybook build) 성공으로 판정 |
> | `[env:static]` | 정적 코드/생성물 검증(코드 리뷰·grep·산출물 조회)으로 판정 |
> | `[env:typecheck]` | TypeScript 타입체크(`tsc --noEmit`) 통과로 판정 |

- **SC-001** (`FR-001`·`FR-002`·`NFR-001`·`NFR-003` 관련): `pnpm --filter @doa/design-tokens build` 가
  `build/web/tokens.css` 를 생성하며, `:root` 에 light 시맨틱 전체(radius·space·text·motion·border·bg·fg·
  accent·status 색상)가, `.dark` 셀렉터에 색상만 오버라이드되어 출력된다. **semantic 만 노출**되고
  primitive(`color.brand.*` 등)는 CSS 변수로 유출되지 않는다. [env:build][env:static]

- **SC-002** (`FR-002` 관련): 동일 빌드가 `build/web/tailwind-preset.cjs`(`theme.extend` colors·
  borderRadius·spacing·fontSize·transitionDuration → `var(--…)` 참조)와 `build/flutter/light_tokens.dart`·
  `dark_tokens.dart`(`DoaLightTokens`·`DoaDarkTokens` — `Color`·`double` 상수)를 산출한다. [env:build][env:static]

- **SC-003** (`FR-003`·`NFR-001`·`NFR-004` 관련): `@doa/ui` 의 `cn`·`Button`(cva+asChild)·`Dialog`(Radix)·
  `Card`·`field`·`feedback`·`page-header` 가 시맨틱 토큰 클래스를 사용하며, 잔여 하드코딩 팔레트 클래스
  (`zinc-*`·`red-*`·`slate-*`·`gray-*`)가 **0건**이다(`index.ts` export API 불변). [env:static]

- **SC-004** (`FR-004`·`NFR-003` 관련): `pnpm --filter console build` 가 성공한다(13 라우트). console
  `globals.css` 의 토큰 import + `@theme` 매핑이 컴파일되어 시맨틱 토큰 유틸리티가 적용된다. [env:build]

- **SC-005** (`FR-005` 관련): `pnpm --filter @doa/ui build-storybook` 가 성공한다(Tailwind 4 + tokens.css +
  theme.css + 스토리 렌더 빌드). [env:build]

- **SC-006** (`NFR-002` 관련): `Dialog` 가 Radix 프리미티브(포커스 트랩·ESC·ARIA·`aria-label="닫기"`)를
  사용하고, `Button`·`field` 가 `focus-visible` 포커스 링(`ring-ring`/`border-ring`)을 가지며, 다크모드
  색상 분기(`.dark` / `color.dark.json`)가 존재한다. [env:static]

- **SC-007** (`NFR-004` 관련): `pnpm --filter console typecheck`(`tsc --noEmit`)가 EXIT 0(회귀 0)이다.
  [env:typecheck]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건.
> MoSCoW: Must / Should / Could / Won't

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-001 | FR-001 | NFR-001·003 | SC-001 | build/static | Must |
| US-001 | FR-002 | NFR-001 | SC-001·002 | build/static | Must |
| US-002 | FR-003 | NFR-001·004 | SC-003 | static | Must |
| US-002 | FR-004 | NFR-003 | SC-004 | build | Must |
| US-002 | — | NFR-002 | SC-006 | static | Must |
| US-003 | FR-005 | — | SC-005 | build | Must |
| US-002 | — | NFR-004 | SC-007 | typecheck | Must |

> 모든 FR(FR-001~005)이 SC 로 대응되며(FR-001·002 는 SC-001 공유, FR-002 는 SC-002 추가), 매핑 누락
> 0건이다. SC-001·002·004·005 는 빌드/생성 실행으로, SC-003·006 은 정적 코드/생성물 검증으로, SC-007 은
> 타입체크로 판정된다. 본 차수는 토큰·컴포넌트·빌드 설정 성격이라 별도 단위 테스트 스위트가 없으며, 검증은
> **토큰 빌드 산출 + console/storybook build + 하드코딩 grep 0 + 타입체크**로 갈음한다(plan.md 테스트
> 전략 참조). NFR-005(신규 의존성 정당화)는 P-002 Gates 충족 근거로 plan.md 에 기록되며 별도 SC 없음
> (도입 사실은 SC-004·005 의 build 성공으로 간접 검증).

---

## 범위 외

- **풍부한 컴포넌트 인벤토리**: `DataTable`(TanStack Table)·`Form`(react-hook-form + zod)·`MoneyInput`·
  `FileUpload`·`AppShell`·`CommandPalette`·`Tabs`·`Toast`·`DropdownMenu` 등 DESIGN-PLAN §5-2 의 전체
  인벤토리는 Phase 1~4 에서 확장한다. 002 는 토큰 + 토대 컴포넌트(Button·Dialog·Card·field·feedback·
  page-header)까지만 다룬다.
- **다크모드 토글 UI**: 토큰·`.dark` 분기는 구현하나, 런타임에 light/dark 를 전환하는 토글 UI(테마 스위처)는
  본 차수 범위 외(후속).
- **a11y 자동 감사·시각 회귀**: axe 등 접근성 자동 감사, Chromatic 등 시각 회귀(visual regression)는 후속
  (gaps.md GAP-002-01).
- **`tailwind-preset.cjs` 의 console 소비**: 산출된 `tailwind-preset.cjs`(Tailwind v3 스타일 preset)는
  참조용이며, Tailwind 4 console 은 `@theme` 방식(`theme.css`)을 사용한다. preset 의 실제 소비는 미연결
  (gaps.md GAP-002-01).
- **Flutter `app_tokens` 소비**: `{light,dark}_tokens.dart` 는 생성하나, 고객 앱(`mobile/customer_app`)의
  `ThemeData` 구성 소비는 Phase 5 범위다.
- **번들 사이즈 코드 스플릿**: console build 의 번들 최적화(코드 스플릿)는 후속(gaps.md GAP-002-01).
- **console 기존 페이지 재설계**: 기존 console 페이지는 토큰 전환된 `@doa/ui` 를 그대로 사용한다. 시각
  변화는 있으나 API 불변·build PASS 이며, 페이지 단위 재설계는 본 차수 범위 외.

---

## 미결 사항

없음 — 본 spec 은 구현 완료 코드를 기준으로 retroactive 작성되었으며, 모든 요구사항·수용 기준이 실제
구현(토큰 정의·`build.mjs`·산출물·shadcn 전환·console 연결·Storybook)과 대조 확인되었다. 다크모드 토글 UI·
a11y 자동 감사·시각 회귀·`tailwind-preset.cjs` console 소비·번들 코드 스플릿은 Low 등급 잔여 권고로
남기되(GAP-002-01), 디자인 토큰 SSOT 확립 + 하드코딩 제거(Phase 0 디자인 토대 핵심 목표)는 토큰 빌드
산출 + `@doa/ui` 하드코딩 0 + console/storybook build PASS 로 달성되었다.
