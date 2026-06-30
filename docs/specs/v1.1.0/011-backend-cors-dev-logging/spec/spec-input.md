---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 13:56
상태: 확정 (retroactive)
---

# Spec Input: 011-backend-cors-dev-logging

## 목차

- [요구사항 원문 재구성](#요구사항-원문-재구성)
- [선행 맥락](#선행-맥락)

> **역문서화 주의**: 이 문서는 working tree 의 미커밋 변경(base `1fe3489` → 현재 작업본)에서
> 의도를 역추출한 것이다. 당시 사용자 요청을 있는 그대로 재구성하되, 확인 불가능한 세부 문구는
> 코드에서 추론하였다.

---

## 요구사항 원문 재구성

> **배경**: 010(백엔드 응답 스키마) 완료 후 프론트엔드(콘솔·모바일)에서 백엔드 API 를 직접
> 호출하기 위한 부트스트랩 보강 작업. 두 가지 독립적이지만 모두 "앱 부팅·개발 환경 런타임 구성"에
> 속하는 변경을 하나의 차수로 묶었다.

**요구사항 (재구성)**:

1. 백엔드에 CORS 를 활성화하여 콘솔(별도 origin)·로컬 데모 클라이언트가 API 를 호출할 수 있게 하라.
   운영에서는 환경변수로 허용 origin 을 화이트리스트하고, 미설정 시(로컬/개발) 전체 허용으로 둔다.
2. dev 로깅 transport(`pino-pretty`)가 의존성에 없어 비프로덕션 부팅 시 실패하는 잠재 결함을
   수정하라 — `pino-pretty` 를 devDependency 로 추가한다.

---

## 선행 맥락

| 항목 | 내용 |
|---|---|
| 선행 spec | 010-backend-response-schemas (직전 차수) / 007-backend-foundation (LoggerModule 도입) |
| 트리거 1 (CORS) | 콘솔·모바일이 백엔드와 다른 origin 에서 fetch — 브라우저 CORS 차단 회피 필요 |
| 트리거 2 (pino-pretty) | `app.module.ts` 가 비프로덕션에서 `transport: { target: 'pino-pretty' }` 를 참조하나 패키지 미설치 — 잠재 부팅 결함 |
| 제약 P-002 | AWS/Fly.io 전용 SDK 도입 금지 — `pino-pretty` 는 범용 로깅 포매터로 무저촉 |
| 관련 환경변수 | `CORS_ORIGIN` (콤마 구분 origin 목록), `NODE_ENV` |
