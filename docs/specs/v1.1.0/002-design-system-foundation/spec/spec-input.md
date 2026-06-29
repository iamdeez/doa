---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (retroactive)
---

# Spec Input: 002-design-system-foundation

> 수집 일시: 2026-06-29 | 맥락: 001 OpenAPI 코드젠 완료 → console·Flutter 화면 구현 착수를 위한 디자인
> 시스템 기반(토큰·컴포넌트 토대·Storybook) 구축 → 정식 SDD 문서화

## 목차

- [수집 진행 상태](#수집-진행-상태)
- [원 요청 맥락](#원-요청-맥락)
- [질문 분석 근거](#질문-분석-근거-question-analysis-basis)
- [카테고리별 수집 내용](#카테고리별-수집-내용)

## 수집 진행 상태

| 카테고리 | 상태 | 답변 완료 항목 |
|---|---|---|
| 1. 배경 및 목적 | 완료 | [Q1, Q2, Q3] |
| 2. 사용자 & 이해관계자 | 완료 | [Q4] |
| 3. 핵심 기능 | 완료 | [Q-A~E] |
| 4. 데이터 & 입출력 | 완료 | [Q-F] |
| 5. 제약조건 | 완료 | [Q5] |
| 6. 예외 & 실패 시나리오 | 완료 | [Q6] |

## 원 요청 맥락

사용자 지시: **디자인 시스템 기반 구축 — design-tokens 부터 시작하여 다음 단계 모두**. 사용자는
"design-tokens 부터 구축하고, 그 다음 단계(@doa/ui shadcn 전환·console 토큰 연결·Storybook)까지 이어서
진행"을 요청했다. DESIGN-PLAN 의 확정 결정(Radix+shadcn/ui+Tailwind4, 코드-퍼스트 W3C 토큰 → Style
Dictionary → 웹·Flutter, Lucide, Storybook, WCAG 2.1 AA, 다크모드 토큰 분기)에 따라, 디자인 결정의
SSOT 를 토큰 JSON 으로 단일화하고 `@doa/ui` 의 하드코딩 팔레트를 시맨틱 토큰 클래스로 전환했다. 본
문서는 그 구현(커밋 `ea7521e`·`d3dc628`·`721cb22`)을 정식 SDD 포맷으로 보강하기 위한 입력 재구성이다
(DESIGN-PLAN §1·§3·§5 / FRONTEND-PLAN 의 Phase 단계 반영).

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션·근거 | 채택 결과 |
|---|---|---|---|
| Q-A | 컴포넌트 파운데이션 | A:Ant Design/MUI 컴포넌트 라이브러리 / B:Radix 프리미티브 + shadcn/ui 패턴(코드 소유) | **B 채택**(접근성 내장 + 코드 소유로 완전 커스터마이징·토큰 정합. DESIGN-PLAN §1 확정) |
| Q-B | 토큰 소스 | A:Figma 디자인 → export / B:코드-퍼스트 W3C DTCG JSON → Style Dictionary | **B 채택**(코드가 SSOT — 웹·Flutter 결정적 생성. 디자이너 미참여 단계에서 코드-퍼스트가 실용적) |
| Q-C | 웹 토큰→Tailwind 적용 | A:`tailwind-preset.cjs`(v3 preset) / B:Tailwind 4 `@theme inline` 매핑 | **B 채택**(console·Storybook 은 Tailwind 4 — `@theme` 방식. preset.cjs 는 생성하되 참조용. GAP-002-01) |
| Q-D | Style Dictionary 사용 방식 | A:`style-dictionary.config.js`(선언적) / B:`build.mjs`(programmatic, 커스텀 포맷) | **B 채택**(SD v4 programmatic — light/dark 인스턴스 2개·커스텀 포맷 doa/tailwind-preset·doa/dart-* 필요) |
| Q-E | 다크모드 분기 | A:컴포넌트별 dark: 클래스 / B:semantic 색상 토큰만 분기(`color.dark.json` → `.dark` 오버라이드) | **B 채택**(theme 레이어에서만 분기 — radius·space 등 비색상 토큰은 불변. 컴포넌트는 시맨틱 클래스만) |
| Q-F | @theme 매핑 위치 | A:console·Storybook 각각 정의(중복) / B:공유 `css/theme.css` 분리(SSOT) | **B 채택**(중복 제거 — 시맨틱→유틸 매핑을 단일 파일로. console·Storybook 양쪽 import) |

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

Q1. 왜 만드는가?
- console·Flutter 화면 구현 착수의 디자인 토대(Phase 0). 색상·치수·타이포의 SSOT 를 코드-퍼스트 토큰으로
  단일화하고, Radix+shadcn 컴포넌트 토대 + 시맨틱 토큰 클래스로 다크모드·일관성·접근성을 구조화.

Q2. 현재 어떻게? (002 이전)
- `@doa/ui` 컴포넌트가 Tailwind 팔레트 리터럴(`zinc-*`·`red-*` 등)을 하드코딩. 테마·다크모드 분기 수단
  부재. 디자인 결정 SSOT 부재. console 은 Tailwind 기본 팔레트 의존. 코드-퍼스트 토큰 파이프라인 없음.

Q3. 성공 판단 기준
- `design-tokens` build 가 `tokens.css`(:root + .dark, semantic만)·`tailwind-preset.cjs`·flutter dart
  산출. `@doa/ui` 하드코딩 0. console build PASS. build-storybook 성공. console typecheck 0.

### [카테고리 2] 사용자 & 이해관계자

Q4. 사용자 역할
- 프론트엔드 개발자(console·Flutter): 시맨틱 토큰·shadcn 컴포넌트 소비자.
- 디자인 시스템 관리자: 토큰 JSON 관리자(SSOT) + Storybook 카탈로그 검토자.
- 빌드: `design-tokens build` → console/storybook build 재생성 주체.

### [카테고리 3] 핵심 기능

**Must:**
- `packages/design-tokens`: W3C DTCG 토큰 JSON 3계층(primitive→semantic→theme) + `build.mjs`(SD v4
  programmatic, 커스텀 포맷) → web tokens.css·tailwind-preset.cjs / flutter {light,dark}_tokens.dart.
- `packages/ui/src`: `cn`(clsx+tailwind-merge), `Button`(cva+asChild Slot+포커스링), `Dialog`(Radix),
  `Card`·`field`·`feedback`·`page-header` 시맨틱 토큰 전환. lucide-react 아이콘.
- `apps/console/app/globals.css`: tokens.css + 공유 theme.css(@theme inline) + @source.
- `packages/design-tokens/css/theme.css`: 시맨틱 토큰 → Tailwind 유틸 공유 매핑 SSOT.
- `packages/ui/.storybook`: Storybook 10 react-vite(viteFinal Tailwind 주입) + 스토리.

**제외(Out of Scope):**
- DataTable·Form·MoneyInput·FileUpload·AppShell·CommandPalette 등 풍부한 인벤토리(Phase 1~4), 다크모드
  토글 UI, a11y 자동 감사(axe)·시각 회귀(Chromatic), `tailwind-preset.cjs` console 소비, Flutter
  app_tokens 소비(Phase 5), 번들 코드 스플릿, console 페이지 재설계.

### [카테고리 4] 데이터 & 입출력

- 토큰 소스(SSOT): `tokens/primitive/*.json`(color·dimension·typography·effect), `tokens/semantic/`
  (base·color.light·color.dark).
- 산출물(생성물): `build/web/tokens.css`(86줄 — :root light 전체 + .dark 색상 오버라이드),
  `build/web/tailwind-preset.cjs`(var() 참조), `build/flutter/{light,dark}_tokens.dart`(45줄 각,
  Color·double 상수). `build/` 는 gitignore — 재생성 산출물(미커밋).
- 공유 매핑: `css/theme.css`(@theme inline — 시맨틱 토큰 → Tailwind 유틸). console·Storybook 공유.

### [카테고리 5] 제약조건

Q5. 기술 스택 제약
- Tailwind 4(console·Storybook) — `@theme` 방식. `style-dictionary ^4.4.0`(devDep). Radix·cva·clsx·
  tailwind-merge·lucide-react. Storybook 10 react-vite + `@tailwindcss/vite`.
- P-002: 신규 의존 전부 클라이언트 UI·빌드 도구로 AWS/클라우드 SDK 아님(NFR-005). 도입 정당화 필요.
- `@doa/ui` 외부 API 불변(console 호환 — 회귀 0).

### [카테고리 6] 예외 & 실패 시나리오

Q6. 엣지 케이스
- primitive 유출 → semantic 만 CSS 변수로 노출. primitive 는 참조 전용(빌드 filter `isSemantic`).
- @theme 중복 정의 → console·Storybook 각각 정의 시 drift. 공유 `theme.css` 로 분리(SSOT).
- node_modules 미스캔 → Tailwind 가 `@doa/ui` 클래스 미생성. `@source` 로 명시 스캔.
- tailwind-preset.cjs 미사용 → 생성하나 Tailwind 4 console 미연결(참조용 — GAP-002-01).
- 다크모드 토글 부재 → `.dark` 분기는 존재하나 런타임 토글 UI 미구현(후속).
