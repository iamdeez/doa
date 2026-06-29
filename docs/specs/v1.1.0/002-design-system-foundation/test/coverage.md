---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (retroactive)
---

# Coverage: 002-design-system-foundation

## 목차

- [실행 요약](#실행-요약)
- [SC × 시나리오 커버리지 매트릭스](#sc--시나리오-커버리지-매트릭스)
- [커버리지 요약](#커버리지-요약)
- [STALE_SC 경고](#stale_sc-경고)

---

## 실행 요약

> 본 retroactive 검증은 002 완료 커밋 `721cb22`(base `3a6dbc9`) 기준으로 main session 이 게이트를 직접
> 재실행·생성물 카운트하여 확인한 수치다. 본 차수는 토큰·컴포넌트·빌드 설정으로 별도 단위 테스트 스위트가
> 없으며, SC 는 **토큰 빌드 산출 + 정적 코드/생성물 조회 + console/storybook build + 타입체크**로 판정한다.

| 항목 | 본 retroactive 검증 (HEAD `721cb22`) |
|---|---|
| design-tokens build | **성공** — build/web/{tokens.css,tailwind-preset.cjs}·build/flutter/{light,dark}_tokens.dart |
| tokens.css | **86줄** — `:root` light 전체 + `.dark`(line 55) 색상 오버라이드 |
| primitive 노출 | **0** (semantic 만 — filter `isSemantic`/`isSemanticColorDark`) |
| flutter dart | light_tokens.dart **45줄** / dark_tokens.dart **45줄** (Color·double 상수) |
| @doa/ui 잔여 하드코딩 | **0건** (`grep -rnE 'zinc/slate/gray/neutral-[0-9]|red-[0-9]'` — stories 제외) |
| @doa/ui export API | **불변** (기존 + Dialog·cn·buttonVariants 추가) |
| console build | **PASS** (13 라우트 — main 검증) |
| build-storybook | **성공** (Tailwind4 + 토큰 + 스토리 렌더 — main 검증) |
| console typecheck | **회귀 0** (`tsc --noEmit` EXIT 0 — main 검증) |
| 신규 단위 테스트 | **0** (토큰/컴포넌트/빌드 — Storybook 카탈로그가 시각 검증 대체) |
| 마이그레이션 | **없음** (DB 스키마 변경 0) |

> **신규 단위 0 산정 근거(사실 기준)**: 002 git diff(`git diff 3a6dbc9 721cb22 -- packages apps/console`)에
> `*.spec.ts`·`*.test.ts` 변경·추가가 없다(변경 = 토큰 JSON 7·build.mjs·theme.css·@doa/ui src·.storybook·
> 산출물·console globals/package). 신규 추가는 `*.stories.tsx` 2개(Storybook 카탈로그)이며 단위 테스트가
> 아니다. 검증은 빌드 산출 + 정적 grep + console/storybook build + console tsc 0 으로 갈음한다.

### 생성물 직접 카운트 (자가 보고 비신뢰)

| 산출물 | 측정값 | 방법 |
|---|---|---|
| tokens.css 줄수 | 86 | `wc -l packages/design-tokens/build/web/tokens.css` |
| tokens.css `.dark` 위치 | line 55 | `grep -n '\.dark' …/tokens.css` |
| {light,dark}_tokens.dart | 45 / 45 | `wc -l packages/design-tokens/build/flutter/*.dart` |
| @doa/ui 하드코딩 | 0 | `grep -rnE '(zinc|slate|gray|neutral)-[0-9]|(text|bg)-red-[0-9]' packages/ui/src/*.tsx`(stories 제외) |

### 실행 커맨드

```bash
pnpm --filter @doa/design-tokens build       # → build/web·build/flutter (tokens.css 86줄)
grep -rnE '(zinc|slate|gray|neutral)-[0-9]|(text|bg)-red-[0-9]' packages/ui/src/*.tsx   # 하드코딩 0(stories 제외)
pnpm --filter console build                  # 13 라우트 PASS
pnpm --filter @doa/ui build-storybook        # 성공
pnpm --filter console typecheck              # tsc --noEmit EXIT 0
```

---

## SC × 시나리오 커버리지 매트릭스

| SC-ID | 수용 기준 | 케이스 | 상태 |
|---|---|---|---|
| SC-001 | tokens.css 생성(:root+.dark, semantic만) | build + wc -l + grep(primitive 0) | PASS(build)/VERIFIED(static) |
| SC-002 | preset.cjs·dart 산출 | build + 파일 조회 | PASS(build)/VERIFIED(static) |
| SC-003 | @doa/ui 하드코딩 0·API 불변 | grep + index.ts 조회 | VERIFIED(static) |
| SC-004 | console build PASS(13 라우트) | `pnpm --filter console build` | PASS(build) |
| SC-005 | storybook build PASS | `build-storybook` | PASS(build) |
| SC-006 | Radix 접근성·포커스링·다크 분기 | dialog/button/color.dark 조회 | VERIFIED(static) |
| SC-007 | console typecheck 회귀 0 | `tsc --noEmit` | PASS(typecheck) |

---

## 커버리지 요약

| 항목 | 수 |
|---|---|
| 전체 SC | 7 (토큰 빌드 2 + 하드코딩·API 1 + console build 1 + storybook build 1 + 접근성·다크 1 + typecheck 1) |
| PASS (빌드/타입체크 직접) | 5 (SC-001·002·004·005·007) |
| VERIFIED (정적 코드/생성물 조회) | 2 (SC-003·006 — 하드코딩 grep·접근성/다크 코드 조회) |
| GAP | 0 (단, a11y 자동 감사·시각 회귀·다크 토글·preset 소비·번들 코드 스플릿 부재는 coverage-gap.md·GAP-002-01 참조) |

> SC-001·002(토큰 빌드 산출)·SC-004(console build)·SC-005(storybook build)·SC-007(typecheck)는 실행으로
> 직접 PASS, SC-003(하드코딩 0·API 불변)·SC-006(접근성·다크 분기)는 정적 코드/생성물 조회로 확인
> (VERIFIED). 모든 SC 가 충족되며, a11y 자동 감사·시각 회귀·다크모드 토글 UI·`tailwind-preset.cjs` 소비·
> 번들 코드 스플릿 부재는 Low 등급 잔여 권고다(GAP-002-01). Phase 0 디자인 토대 핵심 목표(토큰 SSOT 확립
> + 하드코딩 제거)는 토큰 빌드 산출 + `@doa/ui` 하드코딩 0 + console/storybook build PASS 로 달성.

---

## STALE_SC 경고

STALE_SC 검출 결과: **0건**

검출 대상: 002 git diff(`git diff 3a6dbc9 721cb22 -- packages apps/console`) 변경 파일. 변경 파일에 테스트
SC 번호를 포함한 `*.spec.ts`·`*.test.ts` 가 없고(토큰/컴포넌트/빌드 설정), 신규 추가는 `*.stories.tsx`
2개(Storybook 카탈로그 — 단위 테스트 아님)다. SC 판정은 본 coverage.md·test-cases.md 가 빌드 산출·정적
grep·코드 조회로 담당한다. semantic mismatch 없음.
