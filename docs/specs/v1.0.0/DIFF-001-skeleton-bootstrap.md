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

> 신규 프로젝트 (git 미초기화). git diff 기반 diff 대신 핵심 파일 전문을 수록한다.
> 전체 신규 파일 목록은 위 표 참조. 17개 스텁 모듈은 반복 패턴이므로 user 모듈을 대표 예시로 수록.

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
new file mode 100644
--- /dev/null
+++ b/.github/workflows/ci.yml
@@ -0,0 +1,67 @@
+name: CI
+
+on:
+  push:
+    branches:
+      - main
+  pull_request:
+    branches:
+      - main
+
+jobs:
+  lint:
+    name: Lint
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v4
+        with:
+          version: 9
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '20'
+          cache: 'pnpm'
+      - run: pnpm install --frozen-lockfile
+      - run: pnpm turbo run lint --filter=backend
+
+  typecheck:
+    name: Typecheck
+    runs-on: ubuntu-latest
+    needs: lint
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v4
+        with:
+          version: 9
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '20'
+          cache: 'pnpm'
+      - run: pnpm install --frozen-lockfile
+      - run: pnpm turbo run typecheck --filter=backend
+
+  test:
+    name: Test
+    runs-on: ubuntu-latest
+    needs: typecheck
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v4
+        with:
+          version: 9
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '20'
+          cache: 'pnpm'
+      - run: pnpm install --frozen-lockfile
+      - run: pnpm turbo run test --filter=backend
+
+  docker-build:
+    name: Docker Build
+    runs-on: ubuntu-latest
+    needs: test
+    steps:
+      - uses: actions/checkout@v4
+      - uses: docker/setup-buildx-action@v3
+      - name: Build Docker image
+        run: docker build -f apps/backend/Dockerfile .

diff --git a/apps/backend/prisma/schema.prisma b/apps/backend/prisma/schema.prisma
new file mode 100644
--- /dev/null
+++ b/apps/backend/prisma/schema.prisma
@@ -0,0 +1,42 @@
+// Prisma multiSchema — GA in Prisma 6.7+. No previewFeatures flag needed.
+
+generator client {
+  provider = "prisma-client-js"
+}
+
+datasource db {
+  provider = "postgresql"
+  url      = env("DATABASE_URL")
+  schemas  = ["users", "products", "commerce", "orders", "payments", "settlements", "admin", "files"]
+}
+
+/// 사용자 기본 정보. password 는 bcrypt 해시값만 저장 (NFR-005).
+model User {
+  id           String         @id @default(cuid())
+  email        String         @unique
+  password     String
+  createdAt    DateTime       @default(now())
+  refreshTokens RefreshToken[]
+
+  @@map("users")
+  @@schema("users")
+}
+
+/// JWT Refresh Token. 원문 JWT 는 클라이언트에만 발급, DB 에는 SHA-256 해시만 저장 (ADR-003).
+model RefreshToken {
+  id        String   @id @default(cuid())
+  userId    String
+  tokenHash String   @unique
+  expiresAt DateTime
+  revoked   Boolean  @default(false)
+  createdAt DateTime @default(now())
+  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
+
+  @@map("refresh_tokens")
+  @@schema("users")
+}

diff --git a/apps/backend/src/modules/auth/auth.service.ts b/apps/backend/src/modules/auth/auth.service.ts
new file mode 100644
--- /dev/null
+++ b/apps/backend/src/modules/auth/auth.service.ts
@@ -0,0 +1,187 @@
+import {
+  ConflictException,
+  Injectable,
+  UnauthorizedException,
+} from '@nestjs/common';
+import { ConfigService } from '@nestjs/config';
+import { JwtService } from '@nestjs/jwt';
+import * as bcrypt from 'bcrypt';
+import { createHash, randomUUID } from 'node:crypto';
+import {
+  JWT_ACCESS_TTL_SECONDS,
+  JWT_REFRESH_TTL_DAYS,
+} from '../../shared/config/jwt.config';
+import { AuthRepository } from './auth.repository';
+
+// 비밀번호 bcrypt cost factor (ADR-001: cost 10~12)
+// cost 10 선택 이유: cost 12 에서 P95 859ms → NFR-002(500ms) 초과.
+// cost 10 은 ADR-001 허용 범위 내이며 P95 목표 충족.
+const BCRYPT_SALT_ROUNDS = 10;
+
+// ... (register / login / refresh / logout / getProfile 구현)
+// 전체 내용: apps/backend/src/modules/auth/auth.service.ts 참조

diff --git a/apps/backend/src/modules/auth/auth.controller.ts b/apps/backend/src/modules/auth/auth.controller.ts
new file mode 100644
--- /dev/null
+++ b/apps/backend/src/modules/auth/auth.controller.ts
@@ -0,0 +1,52 @@
+@Controller('auth')
+export class AuthController {
+  @Post('register') async register(...)  // 201
+  @Post('login')    async login(...)     // 200
+  @Post('refresh')  async refresh(...)   // 200
+  @Post('logout')
+  @HttpCode(HttpStatus.NO_CONTENT)
+  async logout(@Body() dto: RefreshDto) {
+    // JWT 가드 불필요 — 제출된 refreshToken 해싱 대조로 revoked 처리
+    // (만료된 access token 보유 사용자도 logout 가능해야 함, plan.md FR-011)
+    await this.authService.logout(dto);
+  }
+  @Get('me') @UseGuards(JwtAuthGuard) async me(...) // 200
+}

diff --git a/apps/backend/src/shared/config/jwt.config.ts b/apps/backend/src/shared/config/jwt.config.ts
new file mode 100644
--- /dev/null
+++ b/apps/backend/src/shared/config/jwt.config.ts
@@ -0,0 +1,26 @@
+/** NFR-003: Access Token 유효 기간 15분(900초) */
+export const JWT_ACCESS_TTL_SECONDS = 900;
+
+/** NFR-004: Refresh Token 유효 기간 30일 */
+export const JWT_REFRESH_TTL_DAYS = 30;
+
+export const jwtConfig = registerAs('jwt', () => ({
+  accessSecret: process.env['JWT_ACCESS_SECRET'],
+  refreshSecret: process.env['JWT_REFRESH_SECRET'],
+  accessTtlSeconds: JWT_ACCESS_TTL_SECONDS,
+  refreshTtlDays: JWT_REFRESH_TTL_DAYS,
+}));

diff --git a/apps/backend/Dockerfile b/apps/backend/Dockerfile
new file mode 100644
--- /dev/null
+++ b/apps/backend/Dockerfile
@@ -0,0 +1,60 @@
+# Stage 1: builder — install deps, generate prisma client, build
+FROM node:20-alpine AS builder
+RUN npm install -g pnpm@9
+WORKDIR /app
+# ... (deps 복사, pnpm install, prisma generate, pnpm build)
+
+# Stage 2: runtime — production-only deps + built artifacts
+FROM node:20-alpine AS runtime
+# ... (prod deps 복사, dist 복사)
+ENV NODE_ENV=production
+ENV PORT=3000
+EXPOSE 3000
+CMD ["node", "apps/backend/dist/main.js"]

diff --git a/apps/backend/src/modules/user/user.controller.ts b/apps/backend/src/modules/user/user.controller.ts
new file mode 100644
--- /dev/null
+++ b/apps/backend/src/modules/user/user.controller.ts
@@ -0,0 +1,4 @@
+import { Controller } from '@nestjs/common';
+
+@Controller('user')
+export class UserController {}

+# 동일 패턴: seller / product / inventory / cart / coupon / order / payment /
+# shipping / settlement / review / search / notification / file / banner / stats / admin
+# 총 17개 도메인 × {controller, service, repository, events, module} = 85개 스텁 파일

diff --git a/apps/backend/test/auth.e2e-spec.ts b/apps/backend/test/auth.e2e-spec.ts
new file mode 100644
--- /dev/null
+++ b/apps/backend/test/auth.e2e-spec.ts
@@ -0,0 +1,313 @@
+// integration e2e 테스트 8건
+// SC-006 (8스키마 2테이블 마이그레이션)
+// SC-009 (register 201)
+// SC-011 (DB 비밀번호 bcrypt 해시 확인)
+// SC-012 (login 200 accessToken+refreshToken)
+// SC-015 (refresh 200 새 accessToken)
+// SC-018 (logout → 동일 refresh 401)
+// SC-019 (GET /auth/me 200 프로파일)
+// SC-027 (POST /auth/login 50회 P95≤500ms — P95≈139ms)

diff --git a/apps/backend/test/setup-env.js b/apps/backend/test/setup-env.js
new file mode 100644
--- /dev/null
+++ b/apps/backend/test/setup-env.js
@@ -0,0 +1,3 @@
+// B-2 정정: pino-pretty 미설치 환경에서 e2e 테스트 실행 가능하도록 NODE_ENV 강제 설정
+process.env.NODE_ENV = 'production';
```
