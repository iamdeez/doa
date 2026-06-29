---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (retroactive)
---

# Coverage Gap: 001-openapi-codegen-foundation

## 목차

- [미커버 항목 목록](#미커버-항목-목록)
- [response 스키마(응답 DTO) 미주석 (상세)](#response-스키마응답-dto-미주석-상세)
- [생성물 CI 재생성 검증 자동화 부재 (상세)](#생성물-ci-재생성-검증-자동화-부재-상세)
- [api-client 생성 타입 전환 미완 (상세)](#api-client-생성-타입-전환-미완-상세)
- [신규 단위 테스트 수 기록](#신규-단위-테스트-수-기록)

---

## 미커버 항목 목록

> spec.md SC 중 SC-001·004·005 는 생성 성공·타입체크로 직접 커버(PASS), SC-002·003 은 생성물 정적
> 조회로 확인(VERIFIED). 아래는 본 차수 범위 외이거나 운영 자동화 한계로 검증 대상이 없는 항목이다.

| 항목 | 미커버 시나리오 | 카테고리 | 검증 방법 | 담당 | 비고 |
|---|---|---|---|---|---|
| response 스키마 보강 | 응답 본문 타입이 OpenAPI 에 대부분 미주석(87 ops 중 typed 2xx content 36) | (3) 기능 미구현(범위 외) | 컨트롤러 응답 DTO + `@ApiResponse({ type })` 후속 | 후속 차수 | component schemas 32종 전부 입력 DTO. 프론트는 응답 타입을 부분만 코드젠에서 획득 |
| 생성물 CI 재생성 검증 자동화 | DTO 변경 후 재생성 누락 시 생성물 drift | (2) 설계(운영 자동화 한계) | CI 에서 openapi:gen → gen 재실행 후 git diff 0 검증 | 후속 차수 | 현재 사람이 절차 준수(NFR-002 한계) |
| api-client 생성 타입 전환 | api-client 18도메인 메서드의 생성 타입 전환 미완 | (3) 기능 미구현(범위 외) | Phase 0 후속 차수에서 typed 메서드 재작성 | 후속 차수 | 001 은 shared-types 생성·재노출까지만 |

---

## response 스키마(응답 DTO) 미주석 (상세)

**현상**: 생성된 `openapi.json` 의 component schemas 32종은 전부 **입력(request) DTO**
(`*Dto` 31 + `OrderItemInput`)이다. 87 operations 중 typed 2xx response content 를 가진 것은 **36건**이며,
나머지 응답 본문은 타입 미주석이다(컨트롤러가 엔티티/원시값을 반환하나 `@ApiResponse({ type })`·응답
DTO 가 부여되지 않음).

**근본 원인 (CLI 플러그인 범위)**:
- `@nestjs/swagger` CLI 플러그인은 핸들러 시그니처·DTO(`@Body` 파라미터)에서 **입력** 스키마를 자동
  도출하나, 반환 타입이 엔티티·원시값·`Promise<void>` 인 경우 응답 스키마를 component 로 등록하지 못한다.
  응답 형태를 OpenAPI 에 노출하려면 별도 응답 DTO + `@ApiResponse({ type })` 가 필요하다.

**위험도**: 낮음. Phase 0 핵심 목표는 입력 계약(요청 DTO·검증 제약·enum)의 SSOT 확립이며, 이는 32 schemas
자동 생성으로 달성된다. 프론트는 요청 타입을 완전 코드젠에서 얻고, 응답 타입은 부분적으로만 얻는다.

**권장 수정 방향**: 후속 차수에서 도메인별 응답 DTO 를 정의하고 `@ApiResponse({ type })` 로 응답 스키마를
보강한다(gaps.md GAP-001-01). FRONTEND-PLAN.md §8 의 "OpenAPI 데코레이터 보강 범위 — 점진 보강" 정책과
정합.

---

## 생성물 CI 재생성 검증 자동화 부재 (상세)

**현상**: `openapi.json`·`openapi.gen.ts` 는 생성물이나 편의상 레포에 커밋된다. 백엔드 DTO 변경 후
`pnpm --filter backend openapi:gen` → `pnpm --filter @doa/shared-types gen` 양 단계를 재실행하지 않으면
생성물이 최신 DTO 와 불일치(drift)한다.

**근본 원인 (운영 절차 의존)**:
- 현재 이 재생성·diff 검증을 CI 에서 자동 수행하지 않는다. 생성물이 최신 DTO 를 반영하는지 사람이 절차를
  지켜야 보장된다(NFR-002 — 재생성 결정성은 보장되나 재생성 *수행* 은 수동).

**위험도**: 낮음. 생성은 결정적이며 재생성 자체는 2개 명령으로 단순하다. drift 는 PR 리뷰·로컬 재생성으로
탐지 가능하나 자동화되지 않았다.

**권장 수정 방향**: CI 파이프라인에 `openapi:gen` → `gen` 재실행 후 `git diff --exit-code` 로 생성물이
커밋본과 일치하는지 검증하는 게이트 추가(gaps.md GAP-001-01).

---

## api-client 생성 타입 전환 미완 (상세)

**현상**: 001 은 `@doa/shared-types` 의 타입 생성·재노출까지만 다룬다. `@doa/api-client` 의 HttpClient
도메인 메서드(18도메인)를 생성 타입 기반으로 재작성하는 작업은 포함하지 않는다.

**근본 원인 (범위 분리)**:
- Phase 0 을 단계적으로 진행하기 위해 타입 SSOT 확립(001)과 api-client 전환을 별도 차수로 분리했다
  (spec.md 범위 외). 수기 타입은 한시 유지되어 기존 console 화면 호환을 보장한다(NFR-003).

**위험도**: 낮음(의도된 범위 분리). 기존 화면은 수기 타입·기존 api-client 로 정상 동작하며 회귀 0.

**권장 수정 방향**: Phase 0 후속 차수에서 `@doa/api-client` 를 생성 타입(`Schemas['...']`) 기반 typed
메서드로 재작성하고 18도메인 커버리지를 정비(FRONTEND-PLAN.md §0-2 후속).

---

## 신규 단위 테스트 수 기록

001 신규 단위 테스트는 **0건**이며, 실제 git diff 를 직접 확인하여 확정했다(자가 보고 신뢰하지 않음):

| 파일 | 001 변경 | 신규 it() |
|---|---|---|
| (변경 파일 전체) | nest-cli.json·openapi.ts·package.json 2종·index.ts·생성물 2종 — `*.spec.ts` 변경/추가 0 | **0** |

> `git diff 6c4ddae 678ba1c -- apps/backend packages/shared-types` 에 테스트 파일 변경이 없다. 본 차수는
> 코드젠/인프라 성격으로 단위 테스트 스위트를 추가하지 않으며, 검증은 생성 스크립트 실행 성공 + 생성물
> 직접 카운트(paths 70·schemas 32·gen 3220줄) + console/backend tsc 0 으로 갈음한다. 본 카운트는 추적
> 정확성 목적이다.
