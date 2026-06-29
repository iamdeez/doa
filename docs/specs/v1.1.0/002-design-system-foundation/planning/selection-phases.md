---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-29 23:41
상태: 확정 (retroactive)
---

# selection-phases.md

## 목차

- [선택 단계 활성화 결정](#선택-단계-활성화-결정)
- [신규 PyPI/npm 의존성 자가 점검](#신규-pypinpm-의존성-자가-점검)
- [활성화된 단계 실행 순서](#활성화된-단계-실행-순서)
- [security 폴더 생략 사유](#security-폴더-생략-사유)
- [결정 일시 및 결정자](#결정-일시-및-결정자)

## 선택 단계 활성화 결정

> 활성화 기준: spec.md FR/NFR 에 **명시적 요구사항**이 존재할 때만 활성화(암묵적 연관 금지).

- **Database Design Agent**: **N**
  - 근거: DB 스키마 변경 0(마이그레이션 없음). 신규 테이블·컬럼·enum·인덱스·제약 0건. 본 차수의 산출은
    런타임 데이터가 아닌 정적 디자인 토큰 정의(W3C DTCG JSON)와 빌드 산출물(CSS·cjs·dart)이다.

- **Deploy Agent**: **N**
  - 근거: FR/NFR 에 배포 환경 구성·컨테이너화·CI/CD 변경 명시 없음. `Dockerfile`·`docker-compose`·`env`
    변경 0. 신규 의존(style-dictionary·Radix·cva·storybook 등)은 클라이언트 빌드·dev 도구로 런타임 배포
    구성에 영향 없음(`storybook-static/` gitignore). 토큰 산출물은 정적 파일.

- **Security Agent**: **N**
  - 근거: 본 차수는 **클라이언트 디자인 토큰 + UI 컴포넌트 + 빌드 설정**이며, 인증·인가·입력 검증·접근
    제어·서버 로직을 일절 변경하지 않는다. 새 HTTP 라우트·데이터 처리 경로 추가 0. 산출물(CSS 변수·
    Tailwind preset·Dart 상수)은 색상·치수·타이포 값만 담으며 민감정보(키·토큰·실데이터) 노출 0. 접근성
    (a11y)은 보안이 아닌 **품질** 속성이며 Radix·포커스 링으로 확보(NFR-002). OWASP Top 10 관점의 신규
    공격 표면 부재(plan.md §보안 노트로 갈음).

- **Performance Agent**: **N**
  - 근거: NFR 에 성능 목표 수치(P95·처리량·번들 예산) 명시 없음. 본 차수는 토큰·컴포넌트 토대로 런타임
    핫패스·알고리즘·쿼리 변경 0. console build 번들 사이즈 경고는 후속 코드 스플릿 권고(GAP-002-01)이며
    본 차수의 성능 목표 SC 가 아니다.

## 신규 PyPI/npm 의존성 자가 점검

```
자가 점검: 본 spec 에 신규 의존성 추가가 있는가? (package.json dependencies 변경)
  → 있음. 11종(전부 클라이언트 UI·빌드 도구):
     [design-tokens devDep]
     - style-dictionary ^4.4.0        (W3C 토큰 → 웹/Flutter 빌드)
     [ui dependencies]
     - @radix-ui/react-dialog ^1.1.17  (접근성 Dialog 프리미티브)
     - @radix-ui/react-slot ^1.3.0     (asChild 합성)
     - class-variance-authority ^0.7.1 (cva 변형)
     - clsx ^2.1.1                     (조건부 className)
     - tailwind-merge ^3.6.0           (Tailwind 충돌 머지)
     - lucide-react ^1.22.0            (아이콘)
     [ui devDependencies — Storybook/빌드]
     - storybook ^10.4.6 / @storybook/react-vite ^10.4.6 / @storybook/addon-docs ^10.4.6
     - @tailwindcss/vite ^4.3.2 / vite ^8.1.0
  → 전부 AWS/Fly.io 전용 SDK 아님(P-002 무저촉, NFR-005). 클라이언트 빌드·dev·UI 도구이며 런타임 배포
    구성·환경변수 변경 0. Deploy Agent 활성 불요. plan.md Constitution Gates P-002 에 도입 정당화 기록.
```

## 활성화된 단계 실행 순서

- 활성 선택 단계 **없음**(Database Design·Deploy·Security·Performance 전부 N).
- 필수 단계만 진행: Design(3) → Development(4) + Test AUTHORING(5a, PPG-1 병렬) → Test EXECUTION(5b) →
  Docs(6) → Retrospective(7).

> 캐스케이딩 블로킹: 선택 단계 전무로 해당 없음. Design 산출(research·tasks) 후 PPG-1 진입.

## security 폴더 생략 사유

본 spec 폴더에는 `security/` 디렉토리를 생성하지 않는다. Security Agent: N(위 결정 근거 참조 — 클라이언트
디자인 토큰·UI 컴포넌트·빌드 설정은 인증·인가·입력 검증·접근 제어·서버 로직을 변경하지 않으며, 산출물에
민감정보 노출이 없고, 접근성은 보안이 아닌 품질 속성이다). 보안 영향 분석은 본 selection-phases.md 의
Security Agent 결정 근거 + plan.md §보안 노트(노출 표면·민감정보·접근성·OWASP 결론)로 갈음한다.

## 결정 일시 및 결정자

- 결정 일시: 2026-06-29 23:41
- 결정자: Planning Agent (2단계, retroactive)
