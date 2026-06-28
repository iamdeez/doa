# DOA Market (doa-next)

## 목차

- [프로젝트 개요](#프로젝트-개요)
- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [Quick Start](#quick-start)
- [설치 방법](#설치-방법)
- [로컬 개발 환경](#로컬-개발-환경)
- [테스트](#테스트)
- [프로젝트 구조](#프로젝트-구조)

---

## 프로젝트 개요

기존 AWS 기반 MSA 18개 서비스 오픈마켓을 **Fly.io + NestJS 모듈러 모놀리스**로 재구축하는 프로젝트.

- AWS 의존 완전 제거
- 월 고정비 1/10 절감 (Fly.io)
- 단일 배포 단위로 운영 단순화
- 18개 도메인 기능 보존

## 주요 기능

- **JWT 인증**: 회원가입(register) / 로그인(login) / 토큰 갱신(refresh) / 로그아웃(logout) / 내 정보(me)
- **헬스체크**: `GET /health` → 운영 헬스체크 엔드포인트
- **18개 도메인 모듈 골격**: auth 실구현 + user·seller·product 등 17개 스텁 (Stage 2~3에서 실구현)
- **Prisma multiSchema**: 8개 PostgreSQL 스키마 분리 (users·products·commerce·orders·payments·settlements·admin·files)
- **GitHub Actions CI**: lint → typecheck → test → docker build 4단계 자동화

## 기술 스택

| 영역 | 기술 |
|---|---|
| 백엔드 | NestJS 11 (TypeScript) |
| ORM | Prisma 6.x (multiSchema) |
| 데이터베이스 | PostgreSQL 16 |
| 인증 | JWT (access 15분 / refresh 30일), bcrypt |
| 로그 | pino (구조적 JSON 로그) |
| 모노레포 | Turborepo + pnpm workspace |
| 배포 | Fly.io (Docker 멀티스테이지) |
| CI | GitHub Actions |

## Quick Start

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 에서 DATABASE_URL / JWT_ACCESS_SECRET / JWT_REFRESH_SECRET 설정

# 3. PostgreSQL 로컬 기동 (Docker 필요)
docker compose up -d postgres

# 4. DB 마이그레이션
pnpm --filter backend exec prisma migrate deploy

# 5. 개발 서버 기동
pnpm --filter backend dev

# 6. 헬스체크 확인
curl http://localhost:3000/health
# → {"status":"ok"}
```

## 설치 방법

**필수 요구사항**:
- Node.js 20+
- pnpm 9+
- Docker Desktop (로컬 PostgreSQL)

```bash
# 레포 클론 후
pnpm install

# 환경 변수 복사 및 편집
cp .env.example .env
```

`.env` 필수 항목:

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | PostgreSQL 연결 문자열 (`postgresql://user:pass@localhost:5432/doa_next`) |
| `JWT_ACCESS_SECRET` | Access Token 서명 비밀 키 |
| `JWT_REFRESH_SECRET` | Refresh Token 서명 비밀 키 |

## 로컬 개발 환경

```bash
# PostgreSQL 기동
docker compose up -d postgres

# DB 마이그레이션 적용
pnpm --filter backend exec prisma migrate deploy

# 백엔드 개발 서버 (핫 리로드)
pnpm --filter backend dev

# Prisma Studio (DB GUI)
pnpm --filter backend exec prisma studio
```

## 테스트

```bash
# 단위 테스트 + 정적 검증 (PostgreSQL 불필요)
pnpm --filter backend test

# E2E 통합 테스트 (PostgreSQL + .env 필요)
pnpm --filter backend test:e2e
```

**테스트 커버리지**: 27 SC 전수 커버 (unit 12 + static 9 + integration e2e 11)

## 프로젝트 구조

```
doa-next/                         Turborepo 모노레포 루트
├── apps/
│   ├── backend/                  NestJS 모듈러 모놀리스 (메인 백엔드)
│   │   ├── src/
│   │   │   ├── health/           GET /health 헬스체크
│   │   │   ├── modules/          18개 도메인 모듈 (auth 실구현 + 17개 스텁)
│   │   │   └── shared/           공통 인프라 (JWT 가드·Prisma·Config)
│   │   ├── prisma/               schema.prisma + migrations
│   │   ├── test/                 e2e + 정적 테스트
│   │   └── Dockerfile            멀티스테이지 빌드
│   ├── console/                  Next.js 판매자·관리자 웹 (Stage 4 대상)
│   └── worker/                   pg-boss 백그라운드 잡 (Stage 2+ 대상)
├── packages/
│   ├── shared-types/             OpenAPI 기반 공유 타입
│   ├── api-client/               웹 공통 API 클라이언트
│   └── ui/                       공유 UI 컴포넌트
├── .github/workflows/ci.yml      GitHub Actions CI 파이프라인
├── docker-compose.yml            로컬 PostgreSQL 개발 환경
└── turbo.json                    Turborepo 태스크 정의
```

### auth API 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|---|---|---|---|
| `POST` | `/auth/register` | 회원가입 | 불필요 |
| `POST` | `/auth/login` | 로그인 (JWT 발급) | 불필요 |
| `POST` | `/auth/refresh` | Access Token 갱신 | 불필요 (refreshToken 본문) |
| `POST` | `/auth/logout` | 로그아웃 (refreshToken 무효화) | 불필요 (refreshToken 본문) |
| `GET` | `/auth/me` | 내 정보 조회 | Bearer Access Token |
| `GET` | `/health` | 헬스체크 | 불필요 |
