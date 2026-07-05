---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 13:56
상태: 확정 (retroactive)
---

# Research: 011-backend-cors-dev-logging

## 목차

- [기존 코드베이스 분석](#기존-코드베이스-분석)
- [기술 선택 조사](#기술-선택-조사)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 기존 코드베이스 분석

### main.ts 부트스트랩 흐름

```
NestFactory.create(AppModule, { bufferLogs: true })
  → app.useLogger(app.get(Logger))        // nestjs-pino
  → [신규] app.enableCors({ origin, credentials })
  → app.useGlobalPipes(new ValidationPipe({ whitelist, forbidNonWhitelisted }))
  → app.listen(PORT)
```

CORS 삽입 지점은 `useLogger` 직후, `useGlobalPipes` 직전. 미들웨어 순서상 검증 파이프 이전에
CORS 가 적용되어 preflight(OPTIONS) 요청이 검증 단계를 거치지 않는다.

### LoggerModule transport 설정 (app.module.ts:31-40)

```ts
LoggerModule.forRoot({
  pinoHttp: {
    transport:
      process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty' }   // ← 이 패키지가 미설치였음
        : undefined,
  },
}),
```

- 이 설정은 본 차수 이전부터 커밋되어 있었다(HEAD `1fe3489` 시점에 존재).
- `pino-pretty` 가 `package.json` 에 없어, 비프로덕션 부팅 시 transport 동적 로드 실패 위험.
- 010 의 FR-005(`openapi:gen` 에 `NODE_ENV=production` 강제)는 이 문제를 **회피**한 것이고,
  본 차수는 의존성을 추가해 **근본 해소**한다.

### 영향 범위

- CORS: 모든 HTTP 라우트에 영향(전역 설정)이나 핸들러 로직 불변.
- pino-pretty: 비프로덕션 로깅 출력 포맷에만 영향. 프로덕션 무영향.

---

## 기술 선택 조사

| 항목 | 선택 | 근거 |
|---|---|---|
| CORS 구현 | NestJS 내장 `app.enableCors()` | 별도 라이브러리 불필요. Express `cors` 미들웨어를 NestJS 가 래핑. |
| origin 설정 방식 | 환경변수 `CORS_ORIGIN`(콤마 구분) + `true` fallback | 운영 화이트리스트 가능 + 로컬 편의 양립. |
| 로그 포매터 | `pino-pretty ^13.1.3` | `nestjs-pino`/`pino` 생태계 표준 dev 포매터. P-002 무저촉(클라우드 비종속). |
| 의존성 분류 | `devDependencies` | 비프로덕션 전용 transport. 프로덕션 번들 제외 가능. |

---

## 엣지 케이스 및 한계

- **CORS 전체 허용 기본값**: `CORS_ORIGIN` 미설정 시 모든 origin 허용 + `credentials: true` 조합은
  운영에서 보안 위험(CSRF 유사 노출). 운영은 반드시 `CORS_ORIGIN` 화이트리스트 설정 필요.
  (브라우저 표준상 `origin: true` 는 요청 origin 을 반사 — `credentials: true` 와 함께 동작.)
- **`.env.example` 누락**: `CORS_ORIGIN` 이 `.env.example` 에 없어 신규 개발자가 변수 존재를
  인지하기 어렵다(GAP-011-01).
- **pino-pretty 전이 의존성**: `colorette`·`dateformat`·`fast-copy`·`help-me`·`joycon`·`pump`·
  `secure-json-parse`·`sonic-boom`·`split2`·`strip-json-comments` 등이 lock 에 추가됨.
  모두 dev 전용 트리.
