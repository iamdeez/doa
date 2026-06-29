---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-28 12:07
상태: 확정
---

# Diff: 001-skeleton-bootstrap

## 커밋 메시지용 한 줄 요약

(이 섹션은 커밋 메시지 작성 시 참고할 수 있도록 제공한다. 실제 커밋 메시지는 프로젝트 컨벤션에 맞춰 자유롭게 조정한다.)

- **KO**: feat: DOA Market v1.0.0 모노레포 골격 구축 — NestJS 백엔드·JWT 인증·Prisma multiSchema·CI 파이프라인
- **EN**: feat: bootstrap DOA Market v1.0.0 monorepo skeleton with NestJS backend, JWT auth, Prisma multiSchema, and CI pipeline

## 변경 요약

- **모노레포 초기화**: Turborepo + pnpm workspace 루트 설정 (turbo.json, pnpm-workspace.yaml, eslint.config.mjs, docker-compose.yml)
- **NestJS 백엔드 앱**: apps/backend 전체 초기화. pino 구조적 로그 통합, ConfigModule, PrismaModule, EventEmitterModule
- **JWT 인증 완전 구현**: POST /auth/register·login·refresh·logout, GET /auth/me 5종 엔드포인트. bcrypt cost 10, Access TTL 900초, Refresh TTL 30일, SHA-256 tokenHash DB 저장(원문 미저장)
- **헬스체크**: GET /health → 200 `{status:"ok"}`. DB 미접근 단순 응답.
- **Prisma multiSchema**: 8개 스키마(users·products·commerce·orders·payments·settlements·admin·files) 선언. users 스키마에 User + RefreshToken 테이블 실체화. 마이그레이션 SQL 생성 완료.
- **18개 도메인 모듈 4계층 골격**: auth 실구현 + 17개 스텁(user·seller·product·inventory·cart·coupon·order·payment·shipping·settlement·review·search·notification·file·banner·stats·admin)
- **멀티스테이지 Dockerfile**: builder(deps·prisma generate·build) → runtime(prod deps + dist) 2단계
- **GitHub Actions CI**: lint → typecheck → test → docker-build 4단계 needs chain 파이프라인
- **테스트 32건 전체 통과**: unit 12 + static 9 + integration e2e 11 = 총 27 SC 전수 커버

## 변경 파일 및 라인 수

> base commit: N/A (신규 프로젝트, git 미초기화)
> 전체 신규 생성. 삭제 파일 없음.

| 파일 | 추가 | 삭제 |
|---|---|---|
| `.gitignore` | +35 | 0 |
| `.npmrc` | +3 | 0 |
| `.dockerignore` | +18 | 0 |
| `.env.example` | +6 | 0 |
| `package.json` (루트) | +28 | 0 |
| `pnpm-workspace.yaml` | +5 | 0 |
| `turbo.json` | +22 | 0 |
| `tsconfig.json` (루트) | +12 | 0 |
| `eslint.config.mjs` | +25 | 0 |
| `docker-compose.yml` | +20 | 0 |
| `.github/workflows/ci.yml` | +67 | 0 |
| `.claude/docs/constitution.md` | +110 | 0 |
| `.claude/docs/context.md` | +200 | 0 |
| `.claude/docs/infra.md` | +191 | 0 |
| `apps/backend/package.json` | +65 | 0 |
| `apps/backend/nest-cli.json` | +8 | 0 |
| `apps/backend/tsconfig.json` | +18 | 0 |
| `apps/backend/tsconfig.build.json` | +9 | 0 |
| `apps/backend/Dockerfile` | +60 | 0 |
| `apps/backend/prisma/schema.prisma` | +42 | 0 |
| `apps/backend/prisma/migrations/20260628000000_init/migration.sql` | +87 | 0 |
| `apps/backend/prisma/migrations/migration_lock.toml` | +3 | 0 |
| `apps/backend/src/main.ts` | +28 | 0 |
| `apps/backend/src/app.module.ts` | +67 | 0 |
| `apps/backend/src/health/health.controller.ts` | +14 | 0 |
| `apps/backend/src/health/health.module.ts` | +10 | 0 |
| `apps/backend/src/modules/auth/auth.service.ts` | +187 | 0 |
| `apps/backend/src/modules/auth/auth.controller.ts` | +52 | 0 |
| `apps/backend/src/modules/auth/auth.repository.ts` | +41 | 0 |
| `apps/backend/src/modules/auth/auth.module.ts` | +17 | 0 |
| `apps/backend/src/modules/auth/auth.events.ts` | +3 | 0 |
| `apps/backend/src/modules/auth/dto/register.dto.ts` | +8 | 0 |
| `apps/backend/src/modules/auth/dto/login.dto.ts` | +8 | 0 |
| `apps/backend/src/modules/auth/dto/refresh.dto.ts` | +6 | 0 |
| `apps/backend/src/modules/auth/auth.service.spec.ts` | +297 | 0 |
| `apps/backend/src/shared/auth/jwt.strategy.ts` | +36 | 0 |
| `apps/backend/src/shared/auth/jwt-auth.guard.ts` | +5 | 0 |
| `apps/backend/src/shared/auth/jwt-auth.guard.spec.ts` | +156 | 0 |
| `apps/backend/src/shared/auth/current-user.decorator.ts` | +10 | 0 |
| `apps/backend/src/shared/auth/auth-shared.module.ts` | +18 | 0 |
| `apps/backend/src/shared/config/jwt.config.ts` | +26 | 0 |
| `apps/backend/src/shared/config/config.module.ts` | +12 | 0 |
| `apps/backend/src/shared/prisma/prisma.service.ts` | +22 | 0 |
| `apps/backend/src/shared/prisma/prisma.module.ts` | +12 | 0 |
| `apps/backend/src/modules/{17 도메인 스텁}/` (각 5파일×17 = 85파일) | +~425 | 0 |
| `apps/backend/test/static/structure.spec.ts` | +180 | 0 |
| `apps/backend/test/static/ci-workflow.spec.ts` | +173 | 0 |
| `apps/backend/test/health.e2e-spec.ts` | +124 | 0 |
| `apps/backend/test/auth.e2e-spec.ts` | +313 | 0 |
| `apps/backend/test/jest-e2e.json` | +14 | 0 |
| `apps/backend/test/setup-env.js` | +3 | 0 |
| `apps/console/package.json` + `README.md` | +15 | 0 |
| `apps/worker/package.json` + `README.md` | +15 | 0 |
| `packages/shared-types/` (package.json + src/index.ts) | +12 | 0 |
| `packages/api-client/` (package.json + src/index.ts) | +12 | 0 |
| `packages/ui/` (package.json + src/index.ts) | +12 | 0 |
| **합계 (신규 파일 약 145개)** | **+~3,400** | **0** |


## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 이며 전체 캡처는 중복·비효율이다.
> 변경 내용은 위 "변경 요약" · "변경 파일 및 라인 수" 절로 추적하고, 라인 단위 diff 가 필요하면 아래로 재생성한다:
>
> ```bash
> git diff N/A (신규 프로젝트, 첫 커밋 86ec400) -- apps   # base commit: N/A (신규 프로젝트, 첫 커밋 86ec400)
> ```
