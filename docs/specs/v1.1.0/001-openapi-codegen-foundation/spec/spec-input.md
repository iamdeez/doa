---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (retroactive)
---

# Spec Input: 001-openapi-codegen-foundation

> 수집 일시: 2026-06-29 | 맥락: 백엔드 18도메인 실구현 완료(v1.0.0) → 프론트엔드 착수 + Phase 0 OpenAPI
> 코드젠 결정 → 정식 SDD 문서화

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

사용자 지시: **프론트엔드 착수 + OpenAPI 코드젠 기반 확립**. 백엔드 18개 도메인(30테이블) 실구현이
완료된 시점(v1.0.0)에서 프론트엔드(판매자·관리자 콘솔 웹 + 고객 Flutter 앱) 구축을 시작하며, 그 선행
필수 단계인 Phase 0(공유 기반)으로 백엔드 OpenAPI 자동 생성 + 프론트 타입 코드젠 파이프라인을
구축했다. 수기 `shared-types`(001/002 도메인만 작성, 11개 도메인 누락)의 18도메인 수동 동기화 부담을
제거하고 계약 SSOT 를 백엔드로 단일화하는 것이 목표다. 본 문서는 그 구현(커밋 `678ba1c`)을 정식 SDD
포맷으로 보강하기 위한 입력 재구성이다(FRONTEND-PLAN.md §4 / DESIGN-PLAN.md 의 확정 결정 반영).

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션·근거 | 채택 결과 |
|---|---|---|---|
| Q-A | 타입 공유 방식 | A:수기 shared-types 유지·보강 / B:백엔드 OpenAPI → 코드젠 | **B 채택**(18도메인 수기 동기화 부담 구조적 제거. 계약 SSOT=백엔드 코드. FRONTEND-PLAN 확정) |
| Q-B | OpenAPI 메타데이터 주입 | A:DTO 마다 수기 `@ApiProperty` / B:`@nestjs/swagger` CLI 플러그인 introspect | **B 채택**(`introspectComments:true` 로 class-validator + JSDoc 에서 자동 주입 — 수기 데코레이터 0. 도입 변경량 최소) |
| Q-C | 생성기 실행 방식 | A:`ts-node` 직접 실행 / B:`nest build` 후 `node dist/openapi.js` | **B 채택**(플러그인은 빌드 컴파일 단계에만 적용 — ts-node 직접 실행 시 빈 스키마 산출. 빌드 경유 필수) |
| Q-D | 프론트 코드젠 도구 | A:수기 변환 / B:`openapi-typescript` | **B 채택**(`openapi.json` → TS interface 결정적 생성. console=openapi-typescript, Flutter=openapi-generator(dart) Phase 5) |
| Q-E | 수기 타입 처리 | A:즉시 제거·전면 전환 / B:한시 유지·점진 대체 | **B 채택**(기존 console 화면 호환 — 회귀 0 우선. 생성 타입 alias 매핑으로 단계 전환) |
| Q-F | 생성물 레포 관리 | A:gitignore(CI 재생성) / B:레포에 커밋 | **B 채택**(편의상 커밋 — CI 재생성 가능. `dist/` 는 gitignore. 생성물 CI 검증 자동화는 후속 — GAP-001-01) |

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

Q1. 왜 만드는가?
- 프론트엔드 착수의 선행 필수 단계(Phase 0). 백엔드-프론트 타입 계약 SSOT 를 백엔드 OpenAPI 자동
  생성 + 프론트 코드젠으로 확립하여, 수기 `shared-types` 의 18도메인 수동 동기화 부담을 제거.

Q2. 현재 어떻게? (001 이전)
- `packages/shared-types` 는 `auth`·`user`·`product`·`inventory`·`seller`(001/002 도메인)만 수기 작성.
  commerce 이후 11개 도메인 타입 누락. 백엔드에 OpenAPI/Swagger 미설치. 백엔드 DTO 변경 시 사람이 직접
  타입 동기화.

Q3. 성공 판단 기준
- 백엔드 `openapi:gen` 으로 70 paths/32 schemas OpenAPI 문서 자동 생성. 프론트 `gen` 으로
  `openapi.gen.ts` 생성. console typecheck 회귀 0. 수기 데코레이터 0(플러그인 introspect).

### [카테고리 2] 사용자 & 이해관계자

Q4. 사용자 역할
- 프론트엔드 개발자(console·Flutter): 생성 타입 소비자 — 계약 SSOT 의 직접 수혜자.
- 백엔드 개발자: DTO(class-validator + JSDoc) 작성자 — 수기 데코레이터 없이 OpenAPI 자동 반영.
- 빌드/CI: `openapi:gen` → `gen` 두 단계 재생성 절차 실행 주체(현재 수동, CI 자동화는 후속).

### [카테고리 3] 핵심 기능

**Must:**
- `apps/backend/src/openapi.ts`: AppModule 부팅(logger:false) → DocumentBuilder(title·version·
  addBearerAuth) → SwaggerModule.createDocument → `openapi.json` 출력 → app.close + exit.
- `nest-cli.json`: `@nestjs/swagger` CLI 플러그인(`introspectComments:true`,
  `dtoFileNameSuffix:[".dto.ts",".entity.ts"]`).
- `apps/backend/package.json`: `openapi:gen = "nest build && node dist/openapi.js"`, `@nestjs/swagger ^11.4.4`.
- `packages/shared-types`: `openapi-typescript ^7.13.0`(devDep) + `gen` 스크립트 → `openapi.gen.ts`.
- `packages/shared-types/src/index.ts`: `paths`/`components`/`operations` 재노출 + `Schemas`/`Schema<K>`
  헬퍼 + 수기 타입 한시 유지.

**제외(Out of Scope):**
- api-client 생성 타입 전환·18도메인 메서드 정비, 수기 타입 제거, Flutter dart 클라이언트, design-tokens·
  @doa/ui shadcn 전환·Storybook, response 스키마 보강, 생성물 CI 재생성 검증 자동화.

### [카테고리 4] 데이터 & 입출력

- 생성물 1: `apps/backend/openapi.json`(OpenAPI 3.0.0, 70 paths, 32 component schemas, 72K) — 백엔드
  생성물(레포 커밋, CI 재생성 가능).
- 생성물 2: `packages/shared-types/src/openapi.gen.ts`(paths/components/operations interface, 3220줄,
  84K) — 프론트 생성물.
- component schemas: 입력(request) DTO 32종 — `RegisterDto`·`CreateCouponDto`·`CreateProductDto` 등.
  속성·타입·검증 제약(`minLength:8`·`minimum:1`·`format:email`)·enum(`FIXED`/`PERCENTAGE`)·required·
  JSDoc 한글 설명 자동 채움.
- securityScheme: `access-token`(http bearer JWT).

### [카테고리 5] 제약조건

Q5. 기술 스택 제약
- NestJS 11.x 호환 `@nestjs/swagger ^11.4.4`. 플러그인은 빌드 컴파일 단계에만 동작(ts-node 직접 실행
  금지 — 빈 스키마).
- P-002: 신규 의존(`@nestjs/swagger`·`openapi-typescript`)은 AWS/클라우드 전용 SDK 아님(계약 생성·코드젠
  도구). 도입 정당화 필요.
- console typecheck 회귀 0(수기 타입 한시 유지로 점진 전환).

### [카테고리 6] 예외 & 실패 시나리오

Q6. 엣지 케이스
- 플러그인 빌드 경유 누락 → `ts-node` 직접 실행 시 빈 스키마 산출(빌드 경유 필수 — FR-003·SC-004).
- response 스키마 미주석 → 87 operations 중 typed 2xx content 36건. 입력 DTO 만 component 등록. 응답
  보강은 후속(GAP-001-01).
- 생성물 drift → 백엔드 DTO 변경 후 양 단계 재실행 누락 시 생성물이 최신 DTO 와 불일치. CI 자동 검증
  부재(GAP-001-01).
