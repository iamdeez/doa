---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 13:56
상태: 확정 (retroactive)
---

# Plan: 011-backend-cors-dev-logging

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [사전 영향도 분석 결과](#사전-영향도-분석-결과)
- [핵심 설계](#핵심-설계)
- [인터페이스 계약](#인터페이스-계약)
- [테스트 전략](#테스트-전략)
- [기타 고려사항](#기타-고려사항)

> Branch: 011-backend-cors-dev-logging | Date: 2026-06-30 | Spec: ../spec/spec.md
>
> **역문서화 주의**: 이미 적용된 변경(base `1fe3489` → working tree)을 기술한다.

---

## 사전 검증 (Constitution Gates)

> constitution.md 조항 기반. 위반·예외는 아래 명시.

- [x] **P-001 모듈 경계**: CORS·로깅 의존성 추가는 모듈 간 의존을 만들지 않는다. 위반 없음.
- [x] **P-002 인프라 비종속(AWS/Fly.io 무종속)**: `pino-pretty` 는 범용 로깅 포매터로 클라우드 종속이
      아니다. CORS 는 NestJS 표준 기능. 위반 없음.
- [x] **P-003 테스트 원칙**: FR 별 검증 시나리오를 spec.md SC 에 정의(SC-001~005). 단, CORS·의존성
      추가는 단위 테스트 부재(부팅·구성 수준 변경) — 회귀 테스트(SC-005)와 정적 확인으로 갈음.
- [x] **P-004 스펙 범위**: 변경은 CORS 활성화 + pino-pretty 추가에 한정. `.env.example` 보강은 범위 외
      (GAP-011-01).
- [x] **P-005 금전 직렬화**: 해당 없음(금전 필드 무관).

**예외 사항**:
- P-003: CORS 활성화·의존성 추가는 단위 테스트로 검증하기 부적합한 부팅 구성 변경이므로, 정적 검증
  (코드 존재 확인) + 기존 261 테스트 회귀 무발생으로 갈음한다.

---

## 기술 컨텍스트

- **언어 / 런타임**: TypeScript / NestJS 11 (Node.js)
- **주요 의존성**: `nestjs-pino`(기존), 신규 `pino-pretty ^13.1.3`(devDependency)
- **테스트 프레임워크**: Jest (`pnpm --filter backend test`)
- **패키지 매니저**: pnpm (워크스페이스)

---

## 사전 영향도 분석 결과

### 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 |
|---|---|---|
| `apps/backend/src/main.ts` | 수정 | `app.enableCors()` 부팅 단계 추가 |
| `apps/backend/package.json` | 수정 | `devDependencies` 에 `pino-pretty` 추가 |
| `pnpm-lock.yaml` | 수정 | `pino-pretty` + 전이 의존성 트리 lock |

### 기존 코드 사전 분석

- `apps/backend/src/app.module.ts:31-40` — `LoggerModule.forRoot()` 가 이미
  `process.env['NODE_ENV'] !== 'production' ? { target: 'pino-pretty' } : undefined` 로 설정됨.
  본 변경 전까지 `pino-pretty` 가 미설치 상태였으므로 비프로덕션 부팅 시 잠재 결함.
- `apps/backend/src/main.ts` — 부트스트랩에 `useLogger` → `useGlobalPipes` 순서. CORS 는
  `useLogger` 직후, `useGlobalPipes` 직전에 삽입.

---

## 핵심 설계

### CORS 활성화

```ts
// CORS — 콘솔(별도 origin)·로컬 데모 클라이언트 허용.
// CORS_ORIGIN(콤마구분) 미설정 시 전체 허용(로컬/개발). 운영은 환경변수로 화이트리스트.
app.enableCors({
  origin: process.env['CORS_ORIGIN']?.split(',') ?? true,
  credentials: true,
});
```

- `CORS_ORIGIN` 설정 시: 콤마로 분리한 origin 배열을 화이트리스트로 사용.
- 미설정 시: `true` → 모든 origin 허용(로컬/개발 편의).
- `credentials: true`: 쿠키·`Authorization` 헤더 전송 허용.

### pino-pretty 의존성 추가

- `package.json` `devDependencies` 에 `"pino-pretty": "^13.1.3"` 추가.
- 런타임 코드 변경 없음 — `app.module.ts` 의 기존 transport 설정이 이 패키지를 동적으로 로드.

---

## 인터페이스 계약

- **CORS**: 부팅 단계 추가일 뿐 라우트 핸들러 시그니처·반환 타입 불변. 기존 통합 코드에 런타임
  에러를 유발하지 않는다(하위 호환).
- **로깅**: `pino-pretty` 는 비프로덕션 transport 로만 동작. 프로덕션(`NODE_ENV=production`)에서는
  `transport: undefined` 로 기존과 동일하게 raw JSON stdout 로깅 — 동작 변경 없음.

---

## 테스트 전략

| SC 식별자 | 테스트 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|
| SC-001 | 정적 확인 | main.ts 에 enableCors 존재 | `grep enableCors main.ts` | 매칭 |
| SC-002 | 정적 확인 | origin fallback 표현식 | 코드 리뷰 | `?? true` fallback 확인 |
| SC-003 | 정적 확인 | package.json devDeps | `grep pino-pretty package.json` | 매칭 |
| SC-004 | 정적 확인 | pnpm-lock 반영 | `grep pino-pretty@ pnpm-lock.yaml` | 매칭 |
| SC-005 | 회귀 테스트 | 기존 테스트 무회귀 | `pnpm --filter backend test` | 261 PASS |

---

## 기타 고려사항

- **보안**: CORS 전체 허용 기본값은 운영에서 위험할 수 있다. 운영 배포 시 `CORS_ORIGIN` 환경변수로
  허용 origin 을 반드시 명시하도록 운영 체크리스트(infra.md) 보강이 권장된다(GAP-011-01 연계).
- **`.env.example` 미반영**: 신규 환경변수 `CORS_ORIGIN` 이 `.env.example` 에 없어, 환경변수 SSOT 가
  불완전하다. 후속에 `.env.example` 에 주석과 함께 추가 권장.
- **pino-pretty 위치**: dev 전용이므로 `dependencies` 가 아닌 `devDependencies` 가 적절. 프로덕션
  이미지에서는 설치 제외 가능(transport 미사용).
