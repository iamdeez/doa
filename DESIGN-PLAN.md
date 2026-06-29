# DOA Market 디자인 시스템 계획 (DESIGN-PLAN)

> 엔터프라이즈급 프론트엔드(판매자·관리자 콘솔 웹 + 고객 Flutter 앱)의 **디자인 시스템·UI 아키텍처**를 정의한다.
> 실행 로드맵은 `FRONTEND-PLAN.md`, 본 문서는 그 디자인 토대(토큰·컴포넌트·패턴·접근성·거버넌스).

## 목차

- [1. 확정 결정](#1-확정-결정)
- [2. 디자인 원칙 (엔터프라이즈)](#2-디자인-원칙-엔터프라이즈)
- [3. 토큰 아키텍처 (SSOT)](#3-토큰-아키텍처-ssot)
- [4. 파운데이션](#4-파운데이션)
- [5. 웹 디자인 시스템 (console)](#5-웹-디자인-시스템-console)
- [6. Flutter 디자인 시스템 (customer_app)](#6-flutter-디자인-시스템-customer_app)
- [7. 핵심 UI 패턴](#7-핵심-ui-패턴)
- [8. 접근성·국제화](#8-접근성국제화)
- [9. 거버넌스·문서화](#9-거버넌스문서화)
- [10. 단계별 통합](#10-단계별-통합)

---

## 1. 확정 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 웹 컴포넌트 파운데이션 | **Radix UI 프리미티브 + shadcn/ui 패턴 + Tailwind 4** | 접근성 내장, 코드 소유(복붙)로 완전 커스터마이징, 기존 스택 정합. 데이터 테이블은 **TanStack Table**. |
| 디자인 토큰 | **코드-퍼스트 W3C 토큰(JSON) → Style Dictionary** | 단일 소스에서 웹(CSS vars/Tailwind theme)·Flutter(Dart ThemeData) 자동 생성. |
| 아이콘 | **Lucide**(웹) / 동등 아이콘 세트(Flutter) | 일관 스트로크, 트리셰이킹. |
| 컴포넌트 문서 | **Storybook**(웹) | 컴포넌트 카탈로그·상태(states) 시각화·시각 회귀 기반. |
| 다크 모드 | 토큰 기반 light/dark 듀얼 테마 | 시맨틱 토큰 분기. |
| 접근성 기준 | **WCAG 2.1 AA** | 엔터프라이즈 필수. |

---

## 2. 디자인 원칙 (엔터프라이즈)

1. **명료성 우선(Clarity over decoration)**: 운영 도구는 장식보다 정보 전달. 위계·대비·여백으로 스캔 가능성 확보.
2. **밀도 적응(Adaptive density)**: console(데이터 밀집 — 테이블·폼)과 app(소비자 — 여유 레이아웃)에 서로 다른 밀도 토큰.
3. **일관성(Consistency)**: 동일 동작은 동일 컴포넌트·문구·단축키. 토큰·컴포넌트 재사용으로 강제.
4. **상태 완전성(Stateful completeness)**: 모든 데이터 뷰는 loading·empty·error·success·partial 5상태를 설계.
5. **접근성 내재(Accessible by default)**: 키보드 내비게이션·포커스 링·ARIA·대비비 4.5:1을 컴포넌트 기본값으로.
6. **성능 예산(Performance budget)**: 초기 번들·LCP·INP 목표를 컴포넌트 설계에 반영(가상 스크롤·코드 스플릿).
7. **신뢰 신호(Trust signals)**: 금전·권한·파괴적 동작은 확인 단계·시각적 강조(예: 정산·승인·삭제).

---

## 3. 토큰 아키텍처 (SSOT)

3계층 토큰 — **primitive → semantic → component**. 단일 JSON 소스에서 양 플랫폼 생성.

```
packages/design-tokens/           ← 신규 패키지 (토큰 SSOT)
├── tokens/
│   ├── primitive/                원시값: color.blue.500, size.4, font.size.14 …
│   ├── semantic/                 의미값: color.bg.surface, color.fg.muted, radius.control …
│   ├── component/                컴포넌트: button.primary.bg, table.row.hover …
│   └── theme/                    light.json · dark.json (semantic 분기)
├── style-dictionary.config.js
└── build/
    ├── web/  → css-vars.css + tailwind-preset.js   (console·@doa/ui 소비)
    └── flutter/ → app_tokens.dart (ThemeData 생성)
```

- **primitive**: 브랜드 팔레트·타입스케일·spacing 스텝 등 raw 값(의미 없음).
- **semantic**: `bg.surface`/`fg.default`/`border.subtle`/`accent.solid`/`danger.fg` 등 — 컴포넌트가 참조.
- **component**: 컴포넌트별 토큰(가능한 semantic 합성). 다크모드는 theme 레이어에서만 분기.
- **빌드**: Style Dictionary가 web/flutter 산출물 생성. console·Flutter는 생성물만 소비(원시 하드코딩 금지).

---

## 4. 파운데이션

| 항목 | 정의 |
|---|---|
| **컬러** | 브랜드 1 + 중립 스케일(0~1000) + 시맨틱(success·warning·danger·info). light/dark 듀얼. 대비 AA 보장. |
| **타이포그래피** | 한글 우선 폰트(Pretendard 권장) + 숫자 tabular(금전 정렬). 스케일: display/h1~h4/body/sm/caption + weight 토큰. |
| **Spacing/그리드** | 4px 베이스 스텝(0·1·2·3·4·6·8·12·16·24…). console 12컬럼 그리드, app 4/8pt. |
| **Radius** | control/card/modal/pill 단계. |
| **Elevation/Shadow** | surface/raised/overlay/popover 단계(다크모드는 보더+은은한 섀도우). |
| **Motion** | duration(fast 120 / base 200 / slow 320) + easing 토큰. prefers-reduced-motion 존중. |
| **Iconography** | Lucide(웹), 24px 그리드·1.5 스트로크. |
| **Breakpoints** | sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536. console는 lg+ 최적화, app은 모바일 퍼스트. |

---

## 5. 웹 디자인 시스템 (console)

### 5-1. 구성
- `@doa/ui` 를 shadcn/ui 패턴으로 확장(Radix 프리미티브 래핑 + 토큰 기반 Tailwind 클래스). 컴포넌트는 코드 소유.
- 토큰: `packages/design-tokens/build/web` 의 CSS vars + Tailwind preset 적용.

### 5-2. 컴포넌트 인벤토리 (우선순위)
- **기본**: Button, Input, Textarea, Select, Checkbox, Radio, Switch, Label, Badge, Avatar, Tooltip, Separator.
- **레이아웃**: AppShell(사이드바+탑바), PageHeader, Card, Tabs, Breadcrumb, ScrollArea.
- **피드백**: Toast(sonner), Dialog/AlertDialog, Drawer/Sheet, Skeleton, EmptyState, ErrorState, Spinner.
- **데이터**: **DataTable**(TanStack Table — 정렬·필터·페이지네이션·컬럼 visibility·행 선택), Pagination, Stat/MetricCard, DescriptionList.
- **폼**: Form(react-hook-form + zod), FormField, DatePicker, Combobox, FileUpload(presign/confirm 연동), MoneyInput(Decimal·tabular).
- **고급**: CommandPalette(⌘K), DropdownMenu, Popover, ContextMenu.

### 5-3. AppShell(운영 콘솔 셸)
- 좌측 역할 기반 내비게이션(판매자/관리자 섹션 분기), 상단 사용자·알림·테마 토글, 콘텐츠 영역(브레드크럼+PageHeader+본문).
- 반응형: lg 미만 사이드바 → Sheet 드로어.

---

## 6. Flutter 디자인 시스템 (customer_app)

- **Material 3** 기반 + `packages/design-tokens/build/flutter/app_tokens.dart` 로 `ThemeData`(ColorScheme·TextTheme·shape·elevation) 구성.
- 컴포넌트 패리티: 웹 시맨틱 토큰과 동일 명칭의 Flutter 위젯 테마(Button·Card·Input·Sheet·Badge·EmptyState 등).
- 소비자 UX 강조: 부드러운 모션·이미지 우선 레이아웃·하단 탭 내비게이션·풀투리프레시.
- 다크모드: 동일 토큰 theme 레이어 분기.

---

## 7. 핵심 UI 패턴

| 패턴 | 정의 |
|---|---|
| **데이터 테이블** | 서버 페이지네이션(cursor)·정렬·필터바·일괄선택·행 액션·컬럼 토글. 빈/로딩/에러 5상태. |
| **폼+검증** | react-hook-form + zod(웹) — 백엔드 검증과 메시지 정합(예: 쿠폰 discountValue>0[010], 파일 MIME[011]). 인라인 에러·제출 상태. |
| **금전 표시** | Decimal 문자열 그대로 포맷(부동소수점 금지), tabular 숫자, 통화 단위 일관. |
| **파괴적/금전 동작** | 승인·삭제·정산 생성은 AlertDialog 확인 + 결과 토스트. |
| **알림** | 인앱 알림 목록(009 연동) — 미읽음 뱃지·읽음 처리. |
| **파일 업로드** | presign→PUT→confirm 3단계(011) 진행률·실패 재시도 UX. |
| **빈/에러 상태** | 일관된 EmptyState/ErrorState(재시도 액션 포함). |

---

## 8. 접근성·국제화

- **접근성**: WCAG 2.1 AA — 키보드 전체 조작, 가시 포커스, ARIA 역할/라벨, 대비 4.5:1, 모션 감소 존중, 폼 라벨·에러 연결. Radix가 상당 부분 기본 제공.
- **국제화**: **한국어 1순위**. 문구는 메시지 카탈로그로 분리(향후 i18n 확장 여지). 숫자·날짜·통화 로케일 포맷.

---

## 9. 거버넌스·문서화

- **토큰 변경**: `packages/design-tokens` 만 수정 → 빌드 → 양 플랫폼 반영. 컴포넌트·앱은 원시값 하드코딩 금지(린트 규칙으로 강제 검토).
- **컴포넌트 추가**: `@doa/ui` 에 추가 + Storybook 스토리(states 포함) 필수.
- **시각 회귀**: Storybook 스냅샷(선택: Chromatic 류) 또는 Playwright 스크린샷.
- **디자인-코드 동기화**: 코드-퍼스트가 SSOT. 필요 시 Figma는 토큰 export 대상(역방향 아님).

---

## 10. 단계별 통합

`FRONTEND-PLAN.md` Phase와 정렬:

| FRONTEND Phase | DESIGN 작업 |
|---|---|
| **Phase 0** (OpenAPI 기반) | `packages/design-tokens` 신설 + Style Dictionary 빌드 파이프라인 + 웹 preset/CSS vars 1차. `@doa/ui` shadcn 패턴 전환 착수(기본 컴포넌트). Storybook 셋업. |
| **Phase 1~2** (판매자) | DataTable·Form·MoneyInput·FileUpload·AppShell 완성. 데이터 밀집 패턴 정립. |
| **Phase 3** (관리자) | 대시보드 차트(통계)·감사 로그 테이블·배너 관리(이미지) 컴포넌트. |
| **Phase 4** (공통) | 알림·CommandPalette·다크모드·a11y 감사·시각 회귀. |
| **Phase 5~8** (Flutter) | `app_tokens.dart` 생성 + Material3 테마 + 위젯 패리티. 소비자 UX 완성. |

> **원칙**: 디자인 시스템은 Phase 0에서 토대를 깔고, 각 기능 Phase에서 필요한 컴포넌트를 점진 확장한다(빅뱅 금지).
