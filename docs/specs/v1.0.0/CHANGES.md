## [001-skeleton-bootstrap] 구현 완료

**변경 파일**:

### 모노레포 루트

- `.gitignore`: Node.js / pnpm / Turborepo / 환경파일 gitignore 규칙
- `.npmrc`: shamefully-hoist=false, strict-peer-dependencies=false 설정
- `.dockerignore`: node_modules·dist·.env·.git 제외 규칙
- `.env.example`: DATABASE_URL / JWT_ACCESS_SECRET / JWT_REFRESH_SECRET 템플릿
- `package.json`: Turborepo 루트 워크스페이스 패키지 정의 (pnpm workspace)
- `pnpm-workspace.yaml`: apps/* / packages/* 워크스페이스 선언
- `turbo.json`: lint·typecheck·build·test 태스크 파이프라인 정의
- `tsconfig.json`: 루트 TypeScript 기본 설정
- `eslint.config.mjs`: ESLint 9 플랫 설정 (NestJS + TypeScript)
- `docker-compose.yml`: 로컬 개발용 PostgreSQL 16 컨테이너 설정

### GitHub Actions CI

- `.github/workflows/ci.yml`: lint → typecheck → test → docker-build 4단계 파이프라인. needs chain으로 단계 실패 시 후속 차단.

### apps/backend — NestJS 앱

- `apps/backend/package.json`: NestJS 11, Prisma, bcrypt, passport-jwt, pino 의존성 정의
- `apps/backend/nest-cli.json`: NestJS CLI 설정
- `apps/backend/tsconfig.json` / `tsconfig.build.json`: TypeScript 컴파일 설정
- `apps/backend/Dockerfile`: 멀티스테이지 빌드 (deps / build / prod). prisma generate 포함.
- `apps/backend/prisma/schema.prisma`: multiSchema(8개: users·products·commerce·orders·payments·settlements·admin·files), User·RefreshToken 모델(users 스키마)
- `apps/backend/prisma/migrations/20260628000000_init/migration.sql`: 8개 CREATE SCHEMA IF NOT EXISTS + users.users + users.refresh_tokens + 인덱스 2개 + FK
- `apps/backend/prisma/migrations/migration_lock.toml`: Prisma 마이그레이션 락 파일

#### 진입점 및 공통

- `apps/backend/src/main.ts`: NestJS 부트스트랩, pino 로거 통합, 3000번 포트 리스닝
- `apps/backend/src/app.module.ts`: ConfigModule·PrismaModule·EventEmitterModule·AuthSharedModule + 18개 도메인 모듈 등록

#### health 모듈

- `apps/backend/src/health/health.controller.ts`: GET /health → 200 `{status:"ok"}`
- `apps/backend/src/health/health.module.ts`: HealthController 등록

#### auth 모듈 (실구현)

- `apps/backend/src/modules/auth/auth.service.ts`: register / login(bcrypt cost 10) / refresh / logout / getProfile 구현. JWT_ACCESS_TTL_SECONDS=900 / JWT_REFRESH_TTL_DAYS=30. refreshToken SHA-256 해시 저장.
- `apps/backend/src/modules/auth/auth.controller.ts`: POST /auth/register·login·refresh·logout, GET /auth/me 엔드포인트. logout에 JwtAuthGuard 미적용(SC-018 수정).
- `apps/backend/src/modules/auth/auth.repository.ts`: Prisma 기반 user·refreshToken CRUD (users 스키마)
- `apps/backend/src/modules/auth/auth.module.ts`: AuthService·AuthRepository·JwtModule 조합
- `apps/backend/src/modules/auth/auth.events.ts`: 도메인 이벤트 스텁
- `apps/backend/src/modules/auth/dto/register.dto.ts` / `login.dto.ts` / `refresh.dto.ts`: 입력 DTO

#### shared 모듈 (공통 인프라)

- `apps/backend/src/shared/auth/jwt.strategy.ts`: PassportStrategy 기반 JWT 검증. jwtConfig 네임스페이스 키 사용.
- `apps/backend/src/shared/auth/jwt-auth.guard.ts`: AuthGuard('jwt') 래퍼
- `apps/backend/src/shared/auth/current-user.decorator.ts`: @CurrentUser() 파라미터 데코레이터
- `apps/backend/src/shared/auth/auth-shared.module.ts`: JwtStrategy·PassportModule 공유 모듈
- `apps/backend/src/shared/config/jwt.config.ts`: jwtConfig registerAs('jwt'). JWT_ACCESS_TTL_SECONDS=900 / JWT_REFRESH_TTL_DAYS=30 상수 정의.
- `apps/backend/src/shared/config/config.module.ts`: ConfigModule 래퍼
- `apps/backend/src/shared/prisma/prisma.service.ts`: PrismaClient 확장, onModuleInit/onModuleDestroy 라이프사이클
- `apps/backend/src/shared/prisma/prisma.module.ts`: PrismaService 전역 제공

#### 도메인 스텁 모듈 17개 (각 5파일)

- `apps/backend/src/modules/{user|seller|product|inventory|cart|coupon|order|payment|shipping|settlement|review|search|notification|file|banner|stats|admin}/`: 각각 controller·service·repository·events·module 빈 스텁 파일

### apps/backend 테스트

- `apps/backend/src/modules/auth/auth.service.spec.ts`: unit 8건. SC-010(중복 이메일 409) / SC-013(잘못된 이메일 401) / SC-014(잘못된 비밀번호 401) / SC-016(만료 refresh 401) / SC-017(revoked refresh 401) + Access Token exp 검증.
- `apps/backend/src/shared/auth/jwt-auth.guard.spec.ts`: unit 4건. SC-020(토큰 부재 401) / SC-021(만료 access 401). ConfigService mock 키 `'jwt.accessSecret'` 로 수정됨(B-1 정정).
- `apps/backend/test/static/structure.spec.ts`: static 4건. SC-001(모노레포 구조) / SC-003(NestJS 앱 골격) / SC-004(schema.prisma) / SC-005(18개 도메인 모듈).
- `apps/backend/test/static/ci-workflow.spec.ts`: static 5건. SC-022~026 CI 워크플로우 needs chain 정적 검증.
- `apps/backend/test/health.e2e-spec.ts`: integration 3건. SC-002(앱 기동) / SC-007(GET /health 200) / SC-008(P95≤200ms).
- `apps/backend/test/auth.e2e-spec.ts`: integration 8건. SC-006/009/011/012/015/018/019/027 전체 검증.
- `apps/backend/test/jest-e2e.json`: e2e 테스트 Jest 설정. setupFiles: setup-env.js.
- `apps/backend/test/setup-env.js`: NODE_ENV=production 강제 설정 (pino-pretty 없이 e2e 실행; B-2 정정).

### apps/console / apps/worker / packages

- `apps/console/package.json` / `README.md`: 플레이스홀더 초기화 (Stage 4 대상)
- `apps/worker/package.json` / `README.md`: 플레이스홀더 초기화 (Stage 2+ 대상)
- `packages/shared-types/`, `packages/api-client/`, `packages/ui/`: 각각 package.json + src/index.ts 플레이스홀더

### .claude (프로젝트 AI 설정)

- `.claude/docs/constitution.md`: 7개 불변 원칙 (성능·호환성·테스트·스펙범위·보안·비용·점진 이전)
- `.claude/docs/context.md`: 프로젝트 구조·도메인 모델·용어사전 초안 (v1.0.0 골격 구축 전 기준)
- `.claude/docs/infra.md`: 인프라 토폴로지·배포 방식·환경 구성 초안

**후속 작업 시 주의사항**:

- `pino-pretty`가 devDependencies에 없다. 로컬 개발 환경에서 pretty 로그를 사용하려면 `pnpm add -D pino-pretty --filter backend` 실행 필요. e2e 테스트는 현재 `NODE_ENV=production`(JSON 로그)으로 우회 중. (test-report.md B-2 참조)
- bcrypt cost가 10으로 확정됨(GAP-003: cost 12에서 P95=859ms 위반). 향후 하드웨어 업그레이드 시 재평가 가능하나 NFR-002(500ms) 기준 준수 필수.
- `auth` 모듈 logout 엔드포인트에 JwtAuthGuard가 없음(의도적). access token 없이 refreshToken만으로 호출 가능. (GAP-002, plan.md 인터페이스 계약 기준)
- 17개 비-auth 도메인 모듈은 빈 스텁 상태. 실구현 시 해당 모듈의 Prisma 스키마 마이그레이션이 선행되어야 함.
- context.md / infra.md가 골격 구축 이전 기획 기준으로 작성됨. 실제 구현 내용으로 갱신 필요 (gaps.md GAP-004·GAP-005 참조).
