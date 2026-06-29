---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (retroactive)
---

# Coverage Gap: 002-design-system-foundation

## 목차

- [미커버 항목 목록](#미커버-항목-목록)
- [a11y 자동 감사·시각 회귀 부재 (상세)](#a11y-자동-감사시각-회귀-부재-상세)
- [다크모드 토글 UI·tailwind-preset 소비 미연결 (상세)](#다크모드-토글-uitailwind-preset-소비-미연결-상세)
- [컴포넌트 인벤토리·Flutter 소비·번들 코드 스플릿 (상세)](#컴포넌트-인벤토리flutter-소비번들-코드-스플릿-상세)
- [신규 단위 테스트 수 기록](#신규-단위-테스트-수-기록)

---

## 미커버 항목 목록

> spec.md SC 중 SC-001·002·004·005·007 은 빌드/타입체크로 직접 커버(PASS), SC-003·006 은 정적 코드/생성물
> 조회로 확인(VERIFIED). 아래는 본 차수 범위 외이거나 품질·운영 자동화 한계로 검증 대상이 없는 항목이다.

| 항목 | 미커버 시나리오 | 카테고리 | 검증 방법 | 담당 | 비고 |
|---|---|---|---|---|---|
| a11y 자동 감사(axe) | 접근성 자동 검증 부재 | (2) 설계(품질 자동화 한계) | Storybook a11y 애드온 / axe-core CI | 후속 | WCAG AA 는 Radix·포커스 링으로 구조 확보(NFR-002), 자동 감사만 미구축 |
| 시각 회귀(visual regression) | 컴포넌트 시각 변화 자동 탐지 부재 | (2) 설계(품질 자동화 한계) | Chromatic / Playwright 스냅샷 | 후속 | Storybook 카탈로그는 수동 시각 검토 |
| 다크모드 토글 UI | 런타임 테마 전환 UI 미구현 | (3) 기능 미구현(범위 외) | 테마 토글 + `.dark` 클래스 토글 | 후속 | `.dark` 분기·color.dark.json 은 구현됨 |
| `tailwind-preset.cjs` 소비 | 생성하나 Tailwind4 console·Storybook 미연결 | (3) 기능 미구현(참조용) | v3 소비처 추가 시 preset 머지 | 후속 | console·Storybook 은 `@theme` 방식 사용 |
| 풍부한 컴포넌트 인벤토리 | DataTable·Form·AppShell 등 미구현 | (3) 기능 미구현(범위 외) | Phase 1~4 컴포넌트 + 스토리 | Phase 1~4 | 002 는 토대 컴포넌트까지 |
| Flutter app_tokens 소비 | dart 산출하나 ThemeData 구성 미연결 | (3) 기능 미구현(범위 외) | Phase 5 customer_app ThemeData | Phase 5 | `{light,dark}_tokens.dart` 는 생성됨 |
| 번들 사이즈 코드 스플릿 | console 번들 최적화 미적용 | (2) 설계(성능 후속) | 코드 스플릿·동적 import | 후속 | build PASS 까지가 본 차수 검증 대상 |

---

## a11y 자동 감사·시각 회귀 부재 (상세)

**현상**: WCAG 2.1 AA 는 Radix 프리미티브(`Dialog` 의 포커스 트랩·ESC·ARIA·`aria-label`)와 `Button`·
`field` 의 `focus-visible` 포커스 링(`ring-ring`/`border-ring`)으로 **구조적으로 확보**되나, axe 등 자동
접근성 감사와 Chromatic/Playwright 등 시각 회귀(visual regression)는 미구축이다.

**근본 원인 (품질 자동화 단계)**:
- 002 는 디자인 토대(토큰·컴포넌트·Storybook) 확립이 목표이며, 접근성·시각 일관성의 자동 검증 게이트는
  Storybook 카탈로그(수동 시각 검토)로 우선 대체했다. 자동 감사 도구 연동은 컴포넌트 인벤토리가 확장된
  이후가 효율적이다.

**위험도**: 낮음. 핵심 접근성 동작은 Radix 프리미티브로 보장되며, Storybook 이 변형·상태의 수동 시각
검토를 제공한다.

**권장 수정 방향**: 후속에 Storybook a11y 애드온(axe-core) + Chromatic(또는 Playwright 스냅샷) CI 게이트
추가(gaps.md GAP-002-01). DESIGN-PLAN §8(접근성·국제화)·§9(거버넌스·문서화) 정책과 정합.

---

## 다크모드 토글 UI·tailwind-preset 소비 미연결 (상세)

**현상**: (1) 다크모드는 `tokens/semantic/color.dark.json` → `tokens.css` 의 `.dark` 셀렉터 오버라이드로
**분기 구조는 구현**되나, 런타임에 light/dark 를 전환하는 토글 UI(`.dark` 클래스 토글)는 미구현이다.
(2) 빌드가 `tailwind-preset.cjs`(Tailwind v3 스타일 preset)를 **생성**하나, Tailwind 4 console·Storybook
은 `@theme`(공유 `theme.css`) 방식을 사용하므로 preset 의 실제 소비처가 없다.

**근본 원인 (점진 도입 / 버전 정합)**:
- 다크모드 토글은 AppShell(상단 테마 토글 — DESIGN-PLAN §5-3)과 함께 구성하는 것이 자연스러우며, AppShell
  은 Phase 1~4 후속이다. `tailwind-preset.cjs` 는 Style Dictionary 가 양 산출(웹 preset·CSS vars)을 모두
  생성하되, 현 소비처(Tailwind 4)는 `@theme` 만 사용하여 preset 은 참조용으로 남는다.

**위험도**: 낮음. `.dark` 분기·토큰 매핑은 정상 동작하며, 라이트 모드가 기본으로 적용된다. preset 미연결은
산출물 중복일 뿐 기능 결함이 아니다.

**권장 수정 방향**: 후속에 (1) AppShell 의 테마 토글 + `.dark` 클래스 제어 추가, (2) Tailwind v3 소비처가
생기면 `tailwind-preset.cjs` 머지(없으면 산출 유지·문서로 참조용 명시)(gaps.md GAP-002-01).

---

## 컴포넌트 인벤토리·Flutter 소비·번들 코드 스플릿 (상세)

**현상**: 002 는 토대 컴포넌트(Button·Dialog·Card·field·feedback·page-header)까지 다룬다. DESIGN-PLAN
§5-2 의 풍부한 인벤토리(DataTable·Form·MoneyInput·FileUpload·AppShell·CommandPalette 등)와 Flutter
`ThemeData` 소비(`{light,dark}_tokens.dart` 활용), console 번들 코드 스플릿은 포함하지 않는다.

**근본 원인 (범위 분리)**:
- Phase 0 디자인 토대(토큰 SSOT·shadcn 패턴·console 연결·Storybook)와 화면별 컴포넌트 확장을 별도 단계로
  분리했다(DESIGN-PLAN §10 단계별 통합). Flutter 소비는 Phase 5, 컴포넌트 인벤토리는 Phase 1~4.

**위험도**: 낮음(의도된 범위 분리). 토대가 확립되어 후속 컴포넌트는 동일 패턴(cva + 시맨틱 토큰 + Radix)
으로 확장 가능하다.

**권장 수정 방향**: Phase 1~4 에서 인벤토리 확장 + 스토리 추가, Phase 5 에서 Flutter `ThemeData` 구성,
후속에 번들 코드 스플릿(gaps.md GAP-002-01).

---

## 신규 단위 테스트 수 기록

002 신규 단위 테스트는 **0건**이며, 실제 git diff 를 직접 확인하여 확정했다(자가 보고 신뢰하지 않음):

| 파일 유형 | 002 변경 | 신규 it() |
|---|---|---|
| 토큰 JSON(7)·build.mjs·theme.css·@doa/ui src·.storybook·산출물·console globals/package | `*.spec.ts`·`*.test.ts` 변경/추가 0 | **0** |
| `*.stories.tsx`(button·feedback) | 신규 2(Storybook 카탈로그) | **0** (스토리는 단위 테스트 아님) |

> `git diff 3a6dbc9 721cb22 -- packages apps/console` 에 테스트 파일 변경이 없다. 본 차수는 토큰/컴포넌트/
> 빌드 설정 성격으로 단위 테스트 스위트를 추가하지 않으며, 검증은 토큰 빌드 산출 + 정적 grep(하드코딩 0)
> + console/storybook build + console tsc 0 으로 갈음한다. Storybook 스토리 2개는 시각 카탈로그(수동 검토)
> 이며 자동 단위 테스트가 아니다. 본 카운트는 추적 정확성 목적이다.
