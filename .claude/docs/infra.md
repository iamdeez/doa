# Project Infra

> 이 문서는 프로젝트의 **운영 수준 인프라 지식**을 기록하는 참조 문서다.
> 배포·환경 구성에 영향을 주는 spec 설계 전 반드시 읽어 운영 제약을 파악한다.
>
> - **갱신 시점**: 인프라 구성이 변경된 spec 완료 후 갱신한다.
> - **환경변수**: `.env` / `.env.example` 파일로 관리한다. 이 문서에 기재하지 않는다.
> - **보안 원칙**: 실제 인증 정보(비밀번호, 토큰, 키)는 절대 기록하지 않는다.

---

## 1. 환경 구성

| 환경 | 목적 | 구성 방식 |
|---|---|---|
| local | 개발·테스트. Docker Compose로 PostgreSQL 로컬 기동 | `.env.local` |
| dev | 공유 개발 서버. Fly.io dev app | Fly secrets (dev app) |
| prod | 운영. Fly.io prod app | Fly secrets (prod app) |

---

## 2. 인프라 토폴로지

### 구성 개요

```
[고객 Flutter 앱]          [console 웹 (Next.js)]
 iOS App Store/Google Play   Vercel (자동 배포)
        \                     /
         \  HTTPS REST       /
          v                 v
     ┌──────────────────────────────┐
     │   Fly.io — backend app       │
     │   NestJS 모듈러 모놀리스      │
     │   (scale-to-zero, rolling)   │
     └──────────┬───────────────────┘
                │
     ┌──────────┼──────────────────┐
     v          v                  v
[Fly Postgres]  [Cloudflare R2]  [Fly Worker (선택)]
 단일 인스턴스    S3 호환 파일       pg-boss 백그라운드 잡
 (도메인별 스키마) (egress 무료)     (무거운 잡 전용)
```

### 컴포넌트 목록

| 컴포넌트 | 유형 | 역할 | 환경 |
|---|---|---|---|
| backend app | Fly.io app (Docker) | NestJS 모듈러 모놀리스. HTTP API 처리 | dev, prod |
| worker | Fly.io process group (선택) | pg-boss 백그라운드 잡 (이미지 후처리·알림·통계 집계 등) | prod (필요 시) |
| Fly Postgres | Fly.io managed PostgreSQL | 단일 DB 인스턴스 (8개 스키마 분리) | dev, prod |
| Cloudflare R2 | 오브젝트 스토리지 | 파일 업로드·서빙 (egress 무료) | dev, prod |
| Vercel | 정적 호스팅 | console 웹 (Next.js) 자동 배포 | dev(preview), prod |
| GitHub Actions | CI/CD | lint·test·build → Fly 배포 | — |

> **워커 분리 시점**: 백그라운드 잡 부하가 백엔드 API 응답에 영향을 줄 때 분리한다. 초기에는 backend 프로세스 내에서 처리.

---

## 3. 배포 방식

### CI/CD 파이프라인

CI 파일: `.github/workflows/ci.yml`. job 체인 `lint → typecheck → test → docker-build`(각 `needs` 의존 — 앞 단계 실패 시 후속 차단). 트리거: `main` 브랜치 push / PR. Node.js 20, pnpm 9. (flyctl deploy 는 ASM-001 로 범위 외 — 현재 docker build 까지만. 아래 흐름도의 flyctl 단계는 Stage 2+ 예정.)

**흐름**:
```
GitHub push (main)
    ↓
GitHub Actions
    ├─ lint + typecheck + test
    ├─ docker build (멀티스테이지)
    └─ flyctl deploy --remote-only
         ↓
    Fly.io (rolling deploy + healthcheck)

console 웹: Vercel GitHub 연동 → 자동 preview/prod 배포
Flutter: 기존 스토어 배포 파이프라인 유지 (수동)
```

### 배포 절차 [Docker][Fly.io]

1. `apps/backend/prisma/` 마이그레이션을 Fly release command에서 `prisma migrate deploy` 실행.
2. Fly rolling deploy: 헬스체크 통과 후 순차 교체.
3. 롤백: `flyctl releases rollback` 또는 이전 이미지 재배포.

> **DB 마이그레이션 주의**: `prisma migrate deploy`는 배포 release 단계에서 자동 실행된다. 마이그레이션 실패 시 배포 자체가 중단된다. 대규모 스키마 변경은 zero-downtime 마이그레이션 전략(컬럼 추가 후 코드 배포, 이후 이전 컬럼 제거)을 별도 spec으로 설계한다.

### 하드웨어 요구사항 (Fly.io 기준)

| 컴포넌트 | 초기 사양 | 비고 |
|---|---|---|
| backend app | shared-cpu-1x, 256MB | scale-to-zero 허용. 트래픽 증가 시 상향 |
| Fly Postgres | 1GB RAM, shared-cpu-1x | 초기 소형. 프로덕션 데이터 증가 시 상향 |
| worker | shared-cpu-1x, 256MB (선택) | 무거운 잡 발생 시 도입 |

---

## 4. 모니터링·로깅

| 항목 | 도구·위치 | 주의 조건 |
|---|---|---|
| 애플리케이션 오류 | Sentry | 프로덕션 오류율 급증 시 알림 |
| 구조적 로그 | pino → Fly 로그 스트림 | `flyctl logs` 또는 외부 로그 수집기 연동 가능 |
| 인프라 메트릭 | Fly metrics (CPU·메모리·응답시간) | Fly 대시보드 |
| 헬스체크 | `GET /health` | Fly 배포 헬스체크 엔드포인트. 응답 지연 시 배포 중단 |

---

## 5. 연결 실패 재시도 동작

| 대상 | 재시도 방식 | 동작 영향 |
|---|---|---|
| PostgreSQL (Prisma) | Prisma connection pool 자동 재시도 | 일시적 연결 실패 시 요청 대기 후 재시도 |
| Cloudflare R2 | S3 SDK 기본 재시도 (3회) | 파일 업로드 실패 시 오류 반환 |
| pg-boss 잡 | pg-boss 내장 재시도 (잡별 설정) | 잡 실패 시 지수 백오프 재시도 |
| PG사 결제 API | 멱등성 키 기반 수동 재시도 | 결제 API 호출 측에서 멱등성 키로 중복 방지 |

---

## 6. 로컬 개발 환경

### 의존성 설치

```bash
# Turborepo 의존성 설치 (루트)
pnpm install

# PostgreSQL 로컬 기동 (Docker Compose)
docker compose up -d postgres

# 마이그레이션 적용 (8스키마 + users 2테이블)
pnpm --filter backend exec prisma migrate deploy
```

### 실행

```bash
# 백엔드 개발 서버
pnpm --filter backend dev

# 콘솔 웹 개발 서버
pnpm --filter console dev
```

### 테스트

```bash
# 백엔드 단위 테스트
pnpm --filter backend test

# 백엔드 e2e 테스트 (PostgreSQL + apps/backend/.env 필요, NODE_ENV=production 강제 — pino-pretty 우회)
pnpm --filter backend test:e2e
```

### 의존성 구조 (확정)

| 패키지 | 역할 | 앱 |
|---|---|---|
| NestJS | 백엔드 프레임워크. 모듈/DI | `apps/backend` |
| Prisma | ORM. multiSchema, 마이그레이션 | `apps/backend` |
| pg-boss | PostgreSQL 기반 잡 큐 | `apps/backend`, `apps/worker` |
| pino | 구조적 로그 | `apps/backend` |
| @nestjs/event-emitter | 인-프로세스 도메인 이벤트 버스 | `apps/backend` |
| @aws-sdk/client-s3 | S3 호환 클라이언트 (R2 엔드포인트) | `apps/backend` |
| @nestjs/jwt · @nestjs/passport · passport-jwt | JWT 발급·검증·인증 전략·가드 | `apps/backend` |
| bcrypt | 비밀번호 단방향 해싱 (cost 10) | `apps/backend` |
| class-validator · class-transformer | DTO 입력 검증·변환 | `apps/backend` |
| nestjs-pino | NestJS pino 로깅 통합 | `apps/backend` |
| Next.js | 콘솔 웹 프레임워크 | `apps/console` |
| Turborepo | 모노레포 빌드 오케스트레이터 | 루트 |

---

## 7. 배포 전 확인 체크리스트

- [ ] Fly secrets에 필수 환경변수 설정 확인 (DATABASE_URL, R2_* 등)
- [ ] `prisma migrate status` 미적용 마이그레이션 없음 확인
- [ ] `GET /health` 헬스체크 엔드포인트 응답 확인
- [ ] Sentry DSN 설정 확인 (prod)
- [ ] Cloudflare R2 버킷 접근 권한 확인
- [ ] Fly Postgres 백업 설정 확인 (prod)
- [ ] GitHub Actions CI 전체 통과 확인

---

## 8. 알려진 인프라 제약

| 항목 | 내용 | 영향 범위 | 관련 spec |
|---|---|---|---|
| Fly Postgres 단일 장애점 | HA 미설정 시 DB 장애 = 전체 서비스 다운. HA 옵션($) 또는 자동 백업+PITR으로 완화 필요 | 전체 | 로드맵 6단계(컷오버) 이전 결정 |
| scale-to-zero 콜드 스타트 | Fly app이 0으로 축소된 경우 첫 요청에 수 초 지연 발생 | backend | 최소 1인스턴스 유지 설정 고려 |
| Fly.io 리전 제약 | 단일 리전 배포(초기). 글로벌 레이턴시 최적화 미적용 | 전체 | 트래픽 분석 후 멀티 리전 검토 |
| R2 서빙 도메인 | R2 공개 접근 시 Cloudflare 커스텀 도메인 설정 또는 R2.dev 서브도메인 사용 필요 | `file` 모듈 | 로드맵 1단계 파일 업로드 spec |
| Vercel 무료 플랜 한계 | 빌드 시간·대역폭·팀 멤버 제한. 트래픽 증가 시 유료 전환 | console 웹 | — |
