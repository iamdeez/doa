---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 13:56
상태: 확정 (retroactive)
---

# Spec: 011-backend-cors-dev-logging

## 목차

- [배경 및 목적](#배경-및-목적)
- [사용자 스토리](#사용자-스토리)
- [기능 요구사항](#기능-요구사항-fr)
- [비기능 요구사항](#비기능-요구사항-nfr)
- [수용 기준](#수용-기준-sc)
- [범위 외](#범위-외)
- [구조화 매트릭스](#구조화-매트릭스)

> Branch: 011-backend-cors-dev-logging | Date: 2026-06-30 | Version: v1.1.0
>
> **역문서화 주의**: 이 문서는 working tree 의 미커밋 변경(base `1fe3489`)을 기준으로 작성하였다.
> 설계 결정은 코드에서 추출한 사실 기반이며, 미래 계획이 아닌 이미 적용된 변경을 기술한다.

---

## 배경 및 목적

010(백엔드 응답 스키마) 완료 후 프론트엔드(콘솔·모바일)가 백엔드 API 를 직접 호출하기 위한
부트스트랩 보강이다. 두 가지 변경을 묶는다.

1. **CORS 미활성화**: 백엔드 부트스트랩(`main.ts`)에 `app.enableCors()` 가 없어, 별도 origin 에서
   동작하는 콘솔·로컬 데모 클라이언트의 브라우저 요청이 CORS 정책으로 차단되었다.

2. **`pino-pretty` 의존성 누락(잠재 결함)**: `app.module.ts` 의 `LoggerModule.forRoot()` 가
   비프로덕션 환경에서 `transport: { target: 'pino-pretty' }` 를 사용하도록 이미 설정되어 있으나,
   `pino-pretty` 가 `package.json` 의존성에 없었다. 비프로덕션(`NODE_ENV !== 'production'`)으로
   부팅 시 transport 모듈 로드에 실패하는 잠재 결함이 존재했다. (010 FR-005 가 `openapi:gen` 에
   `NODE_ENV=production` 을 강제해 회피한 것과 동일 뿌리의 문제로, 이번엔 의존성 자체를 추가해 근본
   해소한다.)

본 스펙은 두 변경을 적용해 (1) 교차 출처 클라이언트의 API 접근을 허용하고, (2) dev 로깅 transport 의
잠재 부팅 결함을 제거한다.

---

## 사용자 스토리

- **US-001**: 콘솔/모바일 프론트엔드 개발자로서, 별도 origin 에서 백엔드 API 를 호출했을 때
  브라우저 CORS 차단 없이 응답을 받고 싶다.
- **US-002**: 백엔드 개발자로서, 로컬(비프로덕션)에서 앱을 부팅했을 때 `pino-pretty` 로 가독성 있는
  컬러 로그를 보고 싶고, 의존성 누락으로 부팅이 실패하지 않기를 바란다.

---

## 기능 요구사항 (FR)

- **FR-001**: `apps/backend/src/main.ts` 의 부트스트랩에 `app.enableCors()` 를 추가한다.
  허용 origin 은 `CORS_ORIGIN` 환경변수(콤마 구분)에서 읽으며, 미설정 시 `true`(전체 허용)로
  fallback 한다. `credentials: true` 로 쿠키·인증 헤더 전송을 허용한다.
- **FR-002**: `apps/backend/package.json` 의 `devDependencies` 에 `pino-pretty`(`^13.1.3`)를 추가하여
  `app.module.ts` 가 비프로덕션에서 사용하는 dev 로깅 transport 의 의존성 누락을 해소한다.
- **FR-003**: `pnpm-lock.yaml` 에 `pino-pretty` 및 전이 의존성 트리를 반영한다.
- **FR-004**: 신규 환경변수 `CORS_ORIGIN` 을 `apps/backend/.env.example`(환경변수 SSOT)에 fail-open
  주의 주석과 함께 추가하고, 프로젝트 `infra.md` §7 배포 체크리스트·§8 알려진 제약에 운영 화이트리스트
  필수 사항을 등재한다(GAP-011-01 해소).

---

## 비기능 요구사항 (NFR)

- **NFR-001**: CORS 기본값은 개발 편의를 위해 전체 허용(`true`)이되, 운영에서는 `CORS_ORIGIN`
  환경변수로 화이트리스트를 강제할 수 있어야 한다(보안 구성 가능성).
- **NFR-002**: 기존 백엔드 테스트 261개 전량 PASS 유지(회귀 없음).
- **NFR-003**: `pino-pretty` 는 AWS/Fly.io 전용 SDK 가 아닌 범용 로깅 포매터로 P-002(인프라 비종속)에
  저촉하지 않는다.
- **NFR-004**: 프로덕션 런타임 동작 변경 없음 — `pino-pretty` transport 는 비프로덕션에서만 활성화되며
  CORS 활성화는 신규 부팅 단계 추가일 뿐 기존 라우트 핸들러 로직을 바꾸지 않는다.

---

## 수용 기준 (SC)

- **SC-001** (`FR-001` 관련): `apps/backend/src/main.ts` 에 `app.enableCors({ origin: …CORS_ORIGIN…, credentials: true })`
  호출이 존재한다.
- **SC-002** (`FR-001` 관련): origin 값이 `process.env['CORS_ORIGIN']?.split(',') ?? true` 형태로,
  환경변수 미설정 시 전체 허용으로 fallback 한다.
- **SC-003** (`FR-002` 관련): `apps/backend/package.json` 의 `devDependencies` 에 `pino-pretty` 가 포함되어 있다.
- **SC-004** (`FR-003` 관련): `pnpm-lock.yaml` 에 `pino-pretty@13.1.3` 항목과 전이 의존성이 반영되어 있다.
- **SC-005** (`NFR-002` 관련): `pnpm --filter backend test` 실행 결과 261개 테스트 전량 PASS.
- **SC-006** (`FR-004` 관련): `apps/backend/.env.example` 에 `CORS_ORIGIN` 항목이 존재하고,
  `infra.md` §7 체크리스트에 `CORS_ORIGIN` 설정 항목이 등재되어 있다.

---

## 범위 외

- **CORS preflight 세부 옵션**: `methods`·`allowedHeaders`·`maxAge` 등 세밀한 CORS 옵션 튜닝은
  이 스펙 범위 외다(기본값 사용).
- **운영 origin 화이트리스트 값 확정**: 운영 환경의 실제 허용 origin 목록 결정은 배포 구성
  작업이며 이 스펙 범위 외다.
- **로깅 포맷·레벨 정책 변경**: `pino-pretty` 출력 포맷·로그 레벨 조정은 다루지 않는다(의존성 추가만).

---

## 구조화 매트릭스

| FR | SC | NFR | 비고 |
|---|---|---|---|
| FR-001 | SC-001, SC-002 | NFR-001, NFR-004 | CORS 활성화 + 환경변수 화이트리스트 |
| FR-002 | SC-003 | NFR-003, NFR-004 | pino-pretty devDependency 추가 |
| FR-003 | SC-004 | — | pnpm-lock 반영 |
| FR-004 | SC-006 | NFR-001 | CORS_ORIGIN 문서화 — .env.example + infra.md (GAP-011-01 해소) |
| — | SC-005 | NFR-002 | 회귀 검증 |
