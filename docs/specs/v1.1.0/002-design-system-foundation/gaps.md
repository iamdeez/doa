---
작성: Design Agent → Docs Agent 누적
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (retroactive)
---

# Gaps — 002-design-system-foundation

> 기획/설계 공백 누적 기록. 3단계 이후 모든 Agent 가 누적.

## 목차

- [신규 GAP](#신규-gap)
- [해결한 선행 설계 공백](#해결한-선행-설계-공백)

---

## 신규 GAP

### GAP-002-01

- **출처**: Design Agent / Test Agent (research·coverage-gap) / Docs Agent
- **유형**: 디자인 시스템 완성도·품질 자동화 한계 (Low — 권고) — `tailwind-preset.cjs` 미사용 중복 +
  번들 사이즈 경고 + a11y 자동 검증·시각 회귀 부재 + 다크모드 토글 UI 부재
- **컨텍스트**: `packages/design-tokens/build/web/tailwind-preset.cjs`(생성하나 Tailwind4 미연결),
  console build 번들, `@doa/ui` 접근성(Radix 구조 확보, 자동 감사 부재), `tokens/semantic/color.dark.json`
  (`.dark` 분기 구현, 런타임 토글 UI 부재)
- **내용**: (1) **`tailwind-preset.cjs` 미사용 중복** — Style Dictionary 가 웹 preset(v3 스타일)을
  생성하나 console·Storybook 은 Tailwind 4 `@theme`(공유 `theme.css`)를 사용하여 preset 의 실제 소비처가
  없다(산출물 중복). (2) **번들 사이즈 경고** — console build 의 번들 최적화(코드 스플릿)가 미적용이며
  build 는 PASS 하나 번들 사이즈 개선은 후속이다. (3) **a11y 자동 검증·시각 회귀 부재** — WCAG AA 는
  Radix 프리미티브·포커스 링으로 구조 확보되나 axe 자동 감사·Chromatic 시각 회귀가 미구축이다(Storybook
  카탈로그는 수동 검토). (4) **다크모드 토글 UI 부재** — `.dark` 셀렉터·`color.dark.json` 분기는 구현되나
  런타임 테마 전환 UI 가 미구현이다(AppShell 후속).
- **수정 방향**: (1) Tailwind v3 소비처가 생기면 `tailwind-preset.cjs` 머지, 없으면 산출 유지·문서로
  참조용 명시. (2) 후속에 console 번들 코드 스플릿·동적 import 적용. (3) Storybook a11y 애드온(axe-core)
  + Chromatic/Playwright 시각 회귀 CI 게이트 추가(DESIGN-PLAN §8·§9 정책). (4) AppShell(DESIGN-PLAN
  §5-3)의 상단 테마 토글 + `.dark` 클래스 제어 추가.
- **영향**: 낮음 — Phase 0 디자인 토대 핵심 목표(토큰 SSOT·하드코딩 제거·shadcn 토대·console 연결·
  Storybook)는 토큰 빌드 산출(tokens.css 86줄·preset·dart) + `@doa/ui` 하드코딩 0 + console/storybook
  build PASS + console typecheck 0 으로 달성. preset 중복·번들·a11y 자동화·다크 토글은 점진 보강 대상이며
  현재 라이트 모드 기본·Radix 접근성·수동 카탈로그로 기능에 결함 없음.
- **상태**: OPEN — `tailwind-preset.cjs` 처리·번들 코드 스플릿·a11y 자동 감사·시각 회귀·다크모드 토글 UI 는
  Phase 1~4 / 후속 차수 위임(Low 권고). coverage-gap.md 와 동일 사안.

---

## 해결한 선행 설계 공백

| 식별자 | 선행 맥락 | 등급 | 002 해결 | 상태 |
|---|---|---|---|---|
| (@doa/ui 하드코딩·토큰/다크모드 부재) | FRONTEND-PLAN §2-2 / DESIGN-PLAN §1·§3 | 구조적 부담 | 코드-퍼스트 W3C 토큰 SSOT(design-tokens 3계층 + build.mjs) → 웹(tokens.css·preset)·Flutter(dart) 자동 생성. `@doa/ui` 를 Radix+shadcn+시맨틱 토큰 클래스로 전환(하드코딩 0). console 토큰 연결 + 공유 @theme SSOT(theme.css). Storybook 카탈로그. 디자인 결정 SSOT 를 토큰 JSON 으로 단일화 + 다크모드 분기 구조 확보 | **RESOLVED (002, 커밋 721cb22 — 토대 한정. 풍부한 인벤토리·a11y 자동화·다크 토글·Flutter 소비는 GAP-002-01 / Phase 1~5 후속)** |

> 본 항목은 정식 식별된 선행 GAP-XXX 가 아닌 DESIGN-PLAN 의 구조적 한계(하드코딩·토큰/다크모드/SSOT
> 부재)이며, 002(Phase 0 디자인 토대)가 토큰 SSOT·shadcn 전환·console 연결·Storybook 범위에서 해소한다.
> 컴포넌트 인벤토리 확장·a11y 자동 감사·시각 회귀·다크모드 토글 UI·Flutter app_tokens 소비는 GAP-002-01
> 및 Phase 1~5 로 후속 위임.
