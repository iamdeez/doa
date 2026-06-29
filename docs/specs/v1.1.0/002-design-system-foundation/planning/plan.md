---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (retroactive)
---

# Plan: 002-design-system-foundation

> Branch: 002-design-system-foundation | Date: 2026-06-29 | Spec: [../spec/spec.md](../spec/spec.md)

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [사전 영향도 분석 결과](#사전-영향도-분석-결과)
- [핵심 설계](#핵심-설계)
- [결정 기록 (ADRs)](#결정-기록-adrs)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [보안 노트](#보안-노트)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> `constitution.md`(P-001~P-007) 존재 → 해당 조항을 Gates 로 사용한다(constitution 우선). spec.md NFR
> (NFR-001~005)은 P-006 테스트·P-002 외부 의존을 구체화하며 충돌(완화) 없음. 본 차수의 핵심 검토 조항은
> **P-002(신규 의존 도입 정당화)** 와 **P-007(스펙 범위)** 이다.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: 다른 도메인 모듈의 스키마 테이블을 직접 참조·쿼리하지 않음]
  → PASS(무관). 본 차수는 **클라이언트 디자인 토큰·UI 컴포넌트·빌드 설정**이며 백엔드 도메인 모듈·DB·
    쿼리를 일절 포함하지 않는다. `design-tokens`·`@doa/ui`·console CSS 변경.
- [x] **P-002 AWS 의존 금지 원칙**: [Pass 기준: `@aws-sdk/*` 및 AWS 전용 SDK 신규 추가 0건]
  → PASS(직접 검토 조항). 신규 의존은 전부 클라이언트 UI·빌드 도구 — `style-dictionary ^4.4.0`(토큰 빌드),
    `@radix-ui/react-dialog ^1.1.17`·`@radix-ui/react-slot ^1.3.0`(접근성 프리미티브),
    `class-variance-authority ^0.7.1`·`clsx ^2.1.1`·`tailwind-merge ^3.6.0`(클래스 유틸),
    `lucide-react ^1.22.0`(아이콘), `storybook ^10.4.6`·`@storybook/react-vite`·`@storybook/addon-docs`·
    `@tailwindcss/vite ^4.3.2`·`vite ^8.1.0`(카탈로그·빌드). **어느 것도 AWS/Fly.io 전용 SDK 가 아니며**
    P-002 의 금지 목록(Cognito·SQS·DynamoDB·CloudWatch 등)과 무관(NFR-005).
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 외부 저장소 0건]
  → PASS(무관). 신규 데이터 저장소·캐시·큐 0건. DB 스키마 변경 0(마이그레이션 없음). 산출물은 정적 파일
    (CSS·cjs·dart).
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: Fly.io 전용 API 결합 0건]
  → PASS. 표준 웹 빌드 도구(Style Dictionary·Vite·Tailwind·Storybook)만 사용. 플랫폼 전용 API 0.
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: 금전 상태 변경 outbox·멱등성·Decimal]
  → PASS(무관). 본 차수는 디자인 토큰·UI 토대이며 결제·정산 로직을 포함하지 않는다. 금전 연산 0.
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건]
  → PASS. FR-001·002→SC-001·002, FR-003→SC-003, FR-004→SC-004, FR-005→SC-005, NFR-002→SC-006,
    NFR-004→SC-007. 토큰·컴포넌트·빌드 설정 성격상 단위 테스트 스위트는 없으며 검증은 **토큰 빌드 산출 +
    console/storybook build + 하드코딩 grep 0 + 타입체크**로 갈음한다(모든 FR 이 SC 로 대응 — P-006 충족).
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건]
  → PASS(직접 검토 조항). 변경 범위 = `packages/design-tokens/**`(신규 패키지)·`packages/ui/src/**`(전환)·
    `packages/ui/.storybook/**`(신규)·`packages/ui/package.json`(의존·스크립트)·`apps/console/app/globals.css`
    ·`apps/console/package.json`(design-tokens dep). 전부 FR-001~005 추적 가능. **DataTable·Form·AppShell·
    다크모드 토글·a11y 자동 감사·번들 코드 스플릿은 범위 외**로 분리(Phase 1~4 / 후속).

> **예외 사항**: 없음. P-001~P-007 전부 통과(예외 0건). 다수 신규 의존(11종)은 전부 클라이언트 UI·빌드
> 도구로 P-002 의 AWS 금지와 무관함을 NFR-005 로 명시 정당화.

> **Gates 판정**: P-001~P-007 전부 통과(예외 0건). 선택 단계는 Database Design=N·Deploy=N·Security=N·
> Performance=N(selection-phases.md). Design Agent(3단계) → Development(4) + Test AUTHORING(5a) 진입 가능.

---

## 기술 컨텍스트

> v1.0.0(백엔드)·001(코드젠) 확정 스택을 재확정. 002 고유 변경만 명시.

- **언어 / 런타임**: TypeScript 5.x / Node.js ≥20. pnpm `9.0.0` + Turborepo. 모노레포(packages/* + apps/*).
- **토큰 빌드**: `style-dictionary ^4.4.0`(devDep). `build.mjs` 가 **programmatic**(선언적 config 아님)으로
  `new StyleDictionary(...)` 인스턴스를 light/dark 2개 생성하고, 커스텀 포맷 `doa/tailwind-preset`·
  `doa/dart-light`·`doa/dart-dark` 를 등록하여 web/flutter 산출물 생성. CSS 는 `_root.css`(light) +
  `_dark.css`(dark) 를 생성 후 `tokens.css` 로 결합(임시 파일 제거).
- **컴포넌트 파운데이션**: Radix(`@radix-ui/react-dialog`·`@radix-ui/react-slot`) + shadcn 패턴
  (`cn` = clsx + tailwind-merge, `cva` 변형) + Tailwind 4 시맨틱 토큰 클래스. 아이콘 `lucide-react`.
- **Tailwind 4 매핑**: console·Storybook 은 `@theme inline`(공유 `css/theme.css`)으로 시맨틱 토큰 →
  유틸리티 매핑. `@source` 로 `@doa/ui` 클래스 스캔(node_modules 기본 미스캔 회피).
- **Storybook**: Storybook 10(`@storybook/react-vite`). `main.ts` `viteFinal` 이 `@tailwindcss/vite` 주입,
  `preview.ts` 가 `tailwind.css` import.
- **테스트 프레임워크**: 본 차수 별도 단위 테스트 없음(토큰·컴포넌트·빌드 설정). 검증 = 토큰 빌드 산출
  ([env:build]) + console/storybook build([env:build]) + 하드코딩 grep 0·산출물 조회([env:static]) +
  `tsc --noEmit`([env:typecheck], console).
- **환경변수**: 신규 0. **신규 의존성**: 11종(design-tokens 1 + ui dep 6 + ui devDep storybook 4 +
  vite/types 보조). 상세 §Constitution Gates P-002.

---

## 사전 영향도 분석 결과

> 상세는 [../design/research.md](../design/research.md) 참조. 본 절은 영향 파일 요약.

### 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 | 레이어 |
|---|---|---|---|
| `packages/design-tokens/tokens/primitive/*.json` (4) | 신규 | 원시 토큰(color·dimension·typography·effect) | A(토큰 정의) |
| `packages/design-tokens/tokens/semantic/*.json` (3) | 신규 | 시맨틱 토큰(base·color.light·color.dark) | A |
| `packages/design-tokens/build.mjs` | 신규 | SD v4 programmatic 빌드(커스텀 포맷) | B(빌드기) |
| `packages/design-tokens/css/theme.css` | 신규 | 시맨틱 토큰 → Tailwind 유틸 공유 매핑(@theme inline) | B(공유 SSOT) |
| `packages/design-tokens/package.json`·`README.md` | 신규 | 패키지 설정·문서 + `build/*` 산출물 | A·산출물 |
| `packages/ui/src/cn.ts` | 수정 | clsx + tailwind-merge 결합 | C(유틸) |
| `packages/ui/src/button.tsx` | 수정 | cva 변형 + asChild Slot + 포커스링 + 토큰 | C(컴포넌트) |
| `packages/ui/src/dialog.tsx` | 신규 | Radix Dialog 래핑 + 토큰 | C |
| `packages/ui/src/{card,field,feedback,page-header}.tsx` | 수정 | 하드코딩 → 시맨틱 토큰 클래스 | C |
| `packages/ui/src/index.ts` | 수정 | Dialog·cn·buttonVariants export 추가 | C(배럴) |
| `packages/ui/.storybook/*` + `*.stories.tsx` | 신규 | Storybook 설정 + 스토리 2종 | D(카탈로그) |
| `packages/ui/package.json`·`.gitignore` | 수정 | Radix·cva·lucide·storybook 의존 + 스크립트 | A |
| `apps/console/app/globals.css` | 수정 | tokens.css + theme.css import + @source | E(연결) |
| `apps/console/package.json` | 수정 | `@doa/design-tokens` workspace dep | E |

> `apps/backend/**`·`packages/shared-types/**`·`packages/api-client/**` 변경 0건. `@doa/ui` 외부 export
> API 불변(컴포넌트명·props 동일 — 시맨틱 클래스만 내부 전환). console 페이지 코드 불변(globals.css·
> package.json 만 변경, 전환된 `@doa/ui` 를 그대로 소비 — NFR-004).

---

## 핵심 설계

### 1. 3계층 토큰 정의 (FR-001 — SSOT)

```
primitive  color(brand 50~900·neutral 0~950·green/amber/red/blue 100·500·600·900)
           dimension(space 0~16·radius sm~full·border width thin/thick)
           typography(font.family sans/mono·size xs~3xl·weight·lineHeight)
           effect(shadow sm/md/lg·duration fast/base/slow·easing)
   ↓ 참조({color.neutral.0} 등)
semantic   base(theme 독립: radius control/card/modal/pill·space gutter/section/inset·
                text body/heading/display·motion control/overlay)
           color.light / color.dark(bg·fg·border·accent·success·warning·danger·info)
   ↓
theme      build.mjs 가 light/dark 인스턴스로 분기 빌드
```

- primitive 는 참조 전용(노출 안 함). 다크모드는 `color.dark.json` 만 분기(base 는 불변).

### 2. Style Dictionary v4 programmatic 빌드 (FR-002·NFR-001·003)

```js
// build.mjs (요지)
StyleDictionary.registerFormat({ name: 'doa/tailwind-preset', format: ... });   // semantic → theme.extend(var())
StyleDictionary.registerFormat({ name: 'doa/dart-light', format: dartFormat('DoaLightTokens') });
StyleDictionary.registerFormat({ name: 'doa/dart-dark',  format: dartFormat('DoaDarkTokens') });
// light 인스턴스: _root.css(:root, filter=isSemantic) + tailwind-preset.cjs + light_tokens.dart
// dark  인스턴스: _dark.css(.dark, filter=isSemanticColorDark) + dark_tokens.dart
// 결합: tokens.css = _root.css + _dark.css → 임시 파일 rm
```

- web `tokens.css`(86줄): `:root` light 시맨틱 전체 + `.dark` 색상만 오버라이드. **semantic 만 노출**
  (filter `isSemantic`/`isSemanticColorDark` — primitive 미유출, NFR-001). 다크모드 색상 분기(NFR-003).
- `tailwind-preset.cjs`(v3 스타일 preset, `var(--…)` 참조) + flutter `{light,dark}_tokens.dart`
  (`Color`·`double` 상수).

### 3. shadcn 컴포넌트 전환 (FR-003·NFR-002·004)

```ts
// cn.ts — shadcn 표준
export const cn = (...i) => twMerge(clsx(i));

// button.tsx — cva 변형 + asChild Slot + 포커스링
const buttonVariants = cva('… rounded-control … focus-visible:ring-2 focus-visible:ring-ring …', {
  variants: { variant: { primary:'bg-accent text-on-accent …', secondary, ghost, danger, link },
              size: { sm, md, lg, icon }, fullWidth: { true: 'w-full' } },
  defaultVariants: { variant: 'primary', size: 'md' } });
// asChild=true → Radix Slot(링크 등 래핑)

// dialog.tsx — Radix Dialog 래핑(포커스 트랩·ESC·ARIA 기본) + 토큰. lucide X 아이콘. aria-label="닫기"
```

- `Card`·`field`(Input/Select/Textarea)·`feedback`(Badge tones·EmptyState·Loading·ErrorText)·`page-header`
  의 하드코딩 팔레트(`zinc-*`·`red-*`)를 시맨틱 토큰 클래스(`bg-surface`·`text-foreground`·`border-border`·
  `text-danger` 등)로 전환. 외부 export API 불변(NFR-004).

### 4. console 토큰 연결 + 공유 매핑 SSOT (FR-004)

```css
/* apps/console/app/globals.css */
@import 'tailwindcss';
@import '../../../packages/design-tokens/build/web/tokens.css';   /* :root + .dark 변수 */
@import '../../../packages/design-tokens/css/theme.css';          /* @theme inline 매핑(공유 SSOT) */
@source '../../../packages/ui/src';                               /* @doa/ui 클래스 스캔 */

/* css/theme.css (공유) */
@theme inline {
  --color-surface: var(--bg-surface);  --color-foreground: var(--fg-default);
  --color-border: var(--border-default);  --color-ring: var(--border-focus);
  --radius-control: var(--radius-control);  /* … 시맨틱 토큰 → Tailwind 유틸 */
}
```

- `@theme` 매핑은 console·Storybook 이 공유하는 단일 SSOT(`theme.css`)로 분리하여 중복 제거(ADR-006).

### 5. Storybook 카탈로그 (FR-005)

```ts
// .storybook/main.ts — viteFinal 로 @tailwindcss/vite 주입
viteFinal: async (cfg) => { cfg.plugins = [...(cfg.plugins ?? []), tailwindcss()]; return cfg; }
// .storybook/preview.ts → import './tailwind.css'
// .storybook/tailwind.css = @import 'tailwindcss' + tokens.css + theme.css + @source '../src'
```

- 스토리: Button(Primary/Secondary/Danger/Ghost/AllVariants)·Feedback(Badge Tones/Empty). 스크립트
  `storybook`(dev -p 6006)·`build-storybook`.

---

## 결정 기록 (ADRs)

| ADR-ID | 결정 항목 | 채택안 | 대안(검토했으나 미채택) | 근거(spec FR/NFR) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | 컴포넌트 파운데이션 | Radix 프리미티브 + shadcn/ui 패턴(코드 소유) | Ant Design / MUI 라이브러리 | FR-003, NFR-002(접근성 내장·커스터마이징) | @doa/ui |
| ADR-002 | 토큰 소스 | 코드-퍼스트 W3C DTCG JSON → Style Dictionary | Figma export | FR-001(코드 SSOT — 웹·Flutter 결정적) | design-tokens |
| ADR-003 | SD 사용 방식 | `build.mjs` programmatic(커스텀 포맷) | `style-dictionary.config.js` 선언적 | FR-002(light/dark 인스턴스·커스텀 포맷 필요) | build.mjs |
| ADR-004 | 토큰 노출 범위 | semantic 만 CSS 변수로 노출 | primitive 포함 노출 | NFR-001(원시 하드코딩 금지 — 의미값만) | tokens.css |
| ADR-005 | 다크모드 분기 | semantic 색상 토큰만 분기(`color.dark` → `.dark`) | 컴포넌트별 `dark:` 클래스 | NFR-003(theme 레이어 분기·비색상 불변) | color.dark.json·tokens.css |
| ADR-006 | @theme 매핑 위치 | 공유 `css/theme.css`(console·Storybook SSOT) | console·Storybook 각각 정의 | FR-004(중복 제거) | theme.css |
| ADR-007 | 웹 토큰→Tailwind 적용 | Tailwind 4 `@theme inline` 매핑 | `tailwind-preset.cjs`(v3 preset) 소비 | FR-004(console=Tailwind4. preset 은 참조용 — GAP-002-01) | globals.css·theme.css |

---

## 인터페이스 계약

### 002 신규/변경 인터페이스

```ts
// @doa/ui export (packages/ui/src/index.ts) — 외부 API
export { cn } from './cn';
export { Button, type ButtonProps, buttonVariants } from './button';   // cva 변형 + asChild
export { Card, StatCard } from './card';
export { Input, Select, Textarea, type InputProps, type SelectProps, type TextareaProps } from './field';
export { Badge, EmptyState, Loading, ErrorText } from './feedback';
export { PageHeader } from './page-header';
export { Dialog, DialogTrigger, DialogClose, DialogContent,
         DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog';   // 신규

// 시맨틱 토큰 유틸 네이밍(css/theme.css @theme → Tailwind 클래스)
// bg-canvas/surface/raised/muted/inverse · text-foreground/muted-foreground/subtle-foreground/on-accent
// border-border/border-subtle/border-strong · ring-ring · bg-accent/accent-hover/accent-soft
// bg-{success,warning,danger,info}-soft · text-{…}-foreground · rounded-control/card/modal/pill

// 재생성 명령
// pnpm --filter @doa/design-tokens build   → build/web·build/flutter
```

### 하위 호환성 / 방어 코드

- **`@doa/ui` API 불변(비파괴)**: 토큰 전환은 컴포넌트의 내부 className 만 시맨틱 토큰으로 교체하며,
  외부 export(컴포넌트명·props 시그니처)는 변경하지 않는다(`Dialog`·`cn`·`buttonVariants` 는 **추가**
  export). 기존 console 화면은 동일 컴포넌트를 그대로 소비하므로 빌드·타입체크 회귀 0(NFR-004·SC-007).
- **primitive 미유출**: 빌드 filter(`isSemantic`/`isSemanticColorDark`)로 semantic 토큰만 CSS 변수로
  출력하여, 컴포넌트가 원시값에 결합되지 않도록 강제(NFR-001).
- **`@source` 명시 스캔**: Tailwind 4 는 `node_modules`(워크스페이스 패키지 포함)를 기본 미스캔하므로,
  `@doa/ui` 의 시맨틱 토큰 클래스가 console·Storybook 빌드에서 누락되지 않도록 `@source` 로 명시.

---

## 데이터 모델

DB 스키마 변경 없음(마이그레이션 0). 신규 테이블·컬럼·enum·인덱스·제약 0건. 본 차수의 "데이터"는 런타임
데이터가 아닌 **디자인 토큰 정의(W3C DTCG JSON)와 빌드 산출물**(`tokens.css`·`tailwind-preset.cjs`·
`{light,dark}_tokens.dart`)이다. Database Design Agent 비활성(selection-phases.md).

---

## 테스트 전략

### SC↔검증 매핑 (요약)

| SC 식별자 | 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | build/static | 토큰 빌드·산출 | design-tokens build → tokens.css | `pnpm --filter @doa/design-tokens build` | tokens.css(:root light 전체 + .dark 색상 오버라이드)·semantic만 노출(primitive 미유출) |
| SC-002 | build/static | 산출물 검증 | preset.cjs·dart 산출 | 동일 build | tailwind-preset.cjs(var() 참조)·{light,dark}_tokens.dart(Color/double 상수) |
| SC-003 | static | 하드코딩 0·API 불변 | @doa/ui 토큰 전환 grep | `grep zinc/red/slate/gray packages/ui/src/*.tsx` | 잔여 하드코딩 0건 + index.ts export 불변 |
| SC-004 | build | console 빌드 | 토큰 유틸 컴파일 | `pnpm --filter console build` | 성공(13 라우트) |
| SC-005 | build | storybook 빌드 | Tailwind4+토큰+스토리 렌더 | `pnpm --filter @doa/ui build-storybook` | 성공 |
| SC-006 | static | 접근성·다크모드 | Radix·포커스링·다크 분기 코드 조회 | dialog.tsx·button.tsx·color.dark.json | Radix Dialog(트랩·ESC·ARIA)·focus-visible ring·`.dark` 분기 존재 |
| SC-007 | typecheck | 회귀 0 | console 타입체크 | `pnpm --filter console typecheck` | EXIT 0(회귀 0) |

### smoke_tests

- 필요 여부: N(별도 부팅 스모크 불필요). 본 차수는 토큰·컴포넌트·빌드 설정으로, 검증은 **토큰 빌드 산출
  (tokens.css·preset·dart) + console build(13 라우트) + build-storybook + 하드코딩 grep 0 + console
  typecheck 0** 로 갈음한다. 별도 단위 테스트 스위트는 작성하지 않으며(컴포넌트 렌더 테스트는 Storybook
  카탈로그가 시각 검증을 대체), 기존 console 빌드·타입체크는 회귀 0 으로 유지된다.

---

## 보안 노트

> Security Agent: N(selection-phases.md). 본 절로 보안 영향 분석을 갈음한다.

- **노출 표면**: 본 차수는 **클라이언트 디자인 토큰·UI 컴포넌트·빌드 설정**이며 서버 엔드포인트·인증·인가·
  입력 검증·접근 제어를 일절 변경하지 않는다. 새 HTTP 라우트·데이터 처리 경로 추가 0.
- **민감정보 노출**: 산출물(CSS 변수·Tailwind preset·Dart 상수)은 색상·치수·타이포 값만 담으며 비밀키·
  토큰·실제 데이터를 포함하지 않는다. 토큰 JSON 도 디자인 값만 정의.
- **접근성(보안 인접 품질)**: a11y 는 보안이 아닌 품질 속성이나, Radix 프리미티브의 포커스 트랩·ARIA·
  키보드 지원이 WCAG AA 를 구조적으로 확보한다(NFR-002). a11y 자동 감사(axe)는 후속(GAP-002-01).
- **결론**: OWASP Top 10 관점의 신규 공격 표면 없음 — 클라이언트 입력 처리·인증·서버 로직을 변경하지
  않는 순수 UI/토큰 변경. 보안 감사 대상 부재.

---

## 기타 고려사항

- **primitive 미유출(핵심 원칙)**: web 산출은 빌드 filter 로 semantic 토큰만 CSS 변수로 노출한다. 컴포넌트가
  `color.brand.600` 같은 원시값이 아닌 `accent-solid` 같은 의미값에만 결합되도록 하여, 브랜드·팔레트 교체
  시 semantic 매핑만 바꾸면 전파되게 한다(NFR-001·ADR-004). 향후 primitive 를 노출하지 않도록 유지해야 한다.
- **`@source` 누락 함정**: Tailwind 4 는 워크스페이스 패키지의 `node_modules` 경로를 기본 미스캔한다.
  `@source '../../../packages/ui/src'`(console)·`@source '../src'`(Storybook)가 없으면 `@doa/ui` 의
  시맨틱 토큰 클래스가 최종 CSS 에서 누락되어 스타일이 적용되지 않는다. 새 소비처 추가 시 `@source` 필수.
- **`tailwind-preset.cjs` 미연결(현황)**: 산출된 `tailwind-preset.cjs`(Tailwind v3 스타일 preset)는 참조용
  이며, Tailwind 4 console·Storybook 은 `@theme` 방식(`theme.css`)을 사용한다. preset 의 실제 소비는
  미연결이다(GAP-002-01). 향후 Tailwind v3 소비처가 생기면 활용 가능.
- **다크모드 토글 UI 부재**: `.dark` 셀렉터 분기·`color.dark.json` 은 구현하나 런타임에 테마를 전환하는
  토글 UI(`.dark` 클래스 토글)는 본 차수 범위 외(후속). 현재 라이트 모드가 기본으로 적용된다.
- **a11y 자동 감사·시각 회귀 부재**: WCAG AA 는 Radix·포커스 링으로 구조적으로 확보하나, axe 등 자동
  접근성 감사와 Chromatic 등 시각 회귀(visual regression)는 미구축이다(GAP-002-01). Storybook 카탈로그가
  수동 시각 검토를 제공한다.
- **번들 사이즈**: console build 의 번들 최적화(코드 스플릿)는 후속 권고다(GAP-002-01). 본 차수는 토큰
  유틸리티 컴파일·build PASS 까지를 검증 대상으로 한다.
