## [002-catalog] 구현 완료

**변경 파일**:

### Prisma 스키마 및 마이그레이션

- `apps/backend/prisma/schema.prisma`: users 스키마에 User(name·phone 필드 추가)·Seller·Address·Wishlist·ProductView 모델 추가. products 스키마에 Category·Product·ProductImage·ProductVariant·Inventory·InventoryLog 모델 및 SellerStatus·ProductStatus enum 추가. 총 10개 테이블 신규 정의.
- `apps/backend/prisma/migrations/20260628092954_catalog/migration.sql`: users 스키마 신규 4테이블(sellers·addresses·wishlists·product_views) + products 스키마 8개(categories·products·product_images·options·variants·inventory·inventory_logs·SellerStatus enum) DDL. 카테고리 seed 8개 포함(INSERT … ON CONFLICT DO NOTHING).
- `apps/backend/prisma/migrations/migration_lock.toml`: migration lock 코멘트 문구 수정(i.e.→e.g.)

### user 모듈

- `apps/backend/src/modules/user/user.service.ts`: 프로필 조회·수정, 배송지 CRUD·기본지정, 찜(wishlist) 추가·제거·조회, 최근 본 상품 조회(50개 상한) 구현. `UserEvents.PRODUCT_VIEWED` 이벤트 발행.
- `apps/backend/src/modules/user/user.repository.ts`: users 스키마 전용 Prisma CRUD — User·Address·Wishlist·ProductView 테이블 접근 메서드 구현.
- `apps/backend/src/modules/user/user.controller.ts`: GET /users/me, PATCH /users/me, POST/PATCH/DELETE /users/me/addresses, PATCH /users/me/addresses/:id/default, GET/POST/DELETE /users/me/wishlist/:productId, GET /users/me/product-views 엔드포인트 구현.
- `apps/backend/src/modules/user/user.events.ts`: `UserEventsHandler` — `product.viewed` 이벤트 구독, `recordProductView` 호출로 product_views upsert.
- `apps/backend/src/modules/user/user.module.ts`: UserService·UserRepository·UserEventsHandler 등록 및 InventoryService·SellerService export.
- `apps/backend/src/modules/user/user.constants.ts`: `MAX_PRODUCT_VIEWS = 50` 상수 정의.
- `apps/backend/src/modules/user/dto/`: create-address.dto.ts, update-address.dto.ts, update-profile.dto.ts, add-wishlist.dto.ts
- `apps/backend/src/modules/user/user.service.spec.ts`: UserService unit 테스트 (SC-001~010, SC-012)
- `apps/backend/src/modules/user/user.events.spec.ts`: UserEventsHandler unit 테스트 (SC-011)
- `apps/backend/src/modules/user/user.controller.spec.ts`: UserController guard 테스트 (SC-002)

### seller 모듈

- `apps/backend/src/modules/seller/seller.service.ts`: 판매자 등록(PENDING), 프로필 조회·수정, 심사 상태 조회, 판매자 승인·거부 구현.
- `apps/backend/src/modules/seller/seller.repository.ts`: users.sellers 테이블 접근 메서드 구현.
- `apps/backend/src/modules/seller/seller.controller.ts`: POST /sellers/register, GET /sellers/me, PATCH /sellers/me, GET /sellers/me/status, PATCH /sellers/:id/approve·reject 엔드포인트 구현. **approve·reject 에 AdminGuard 적용(SEC-001 수정)** — ADMIN_USER_IDS 미포함 사용자 403 반환.
- `apps/backend/src/modules/seller/seller.module.ts`: SellerService·SellerRepository 등록 및 export.
- `apps/backend/src/modules/seller/dto/`: register-seller.dto.ts, update-seller.dto.ts, reject-seller.dto.ts
- `apps/backend/src/modules/seller/seller.service.spec.ts`: SellerService unit 테스트 (SC-013~018)
- `apps/backend/.env.example`: ADMIN_USER_IDS 환경변수 추가 (SEC-001 AdminGuard 설정용. 콤마구분 user id 목록. 미설정 시 전원 거부).

### product 모듈

- `apps/backend/src/modules/product/product.service.ts`: 카테고리 목록 조회, 상품 등록(DRAFT)·수정·상태전환(publish/deactivate), variant CRUD, 이미지(최대 10개) 추가·삭제, 상품 목록(cursor 페이지네이션·ACTIVE+OOS 필터), 상품 상세, 판매자 전체 상태 목록 구현. InventoryService·EventEmitter2 의존.
- `apps/backend/src/modules/product/product.repository.ts`: products 스키마 전용 Prisma CRUD — Category·Product·ProductVariant·ProductImage 테이블 접근 메서드 구현.
- `apps/backend/src/modules/product/product.controller.ts`: GET /categories, POST/PATCH /products, PATCH /products/:id/publish·deactivate, POST/PATCH/DELETE /products/:id/variants, POST/DELETE /products/:id/images, GET /products, GET /products/:id, GET /sellers/me/products 엔드포인트 구현.
- `apps/backend/src/modules/product/product.events.ts`: `ProductEventsHandler` — `stock.changed` 이벤트 구독, 전체 variant 재고 합계 기반 자동 OUT_OF_STOCK/ACTIVE 전환 처리.
- `apps/backend/src/modules/product/product.module.ts`: ProductService·ProductRepository·ProductEventsHandler·InventoryModule·SellerModule 등록.
- `apps/backend/src/modules/product/product.constants.ts`: `MAX_PRODUCT_IMAGES = 10` 상수 정의.
- `apps/backend/src/modules/product/dto/`: create-product.dto.ts, update-product.dto.ts, create-variant.dto.ts, update-variant.dto.ts, add-image.dto.ts, list-products.dto.ts
- `apps/backend/src/modules/product/product.service.spec.ts`: ProductService unit 테스트 (SC-019~029, SC-032~040)
- `apps/backend/src/modules/product/product.events.spec.ts`: ProductEventsHandler unit 테스트 (SC-030~031)

### inventory 모듈

- `apps/backend/src/modules/inventory/inventory.service.ts`: 재고 초기화(initStock), 입고(stockIn·stock 증가+inventory_logs append), 재고 조회(getStock), checkAvailability(boolean), decreaseStock(CAS 원자적 차감+log append) 구현. stock.changed 이벤트 발행.
- `apps/backend/src/modules/inventory/inventory.repository.ts`: products.inventory·inventory_logs 테이블 접근. appendLog(delta 필드) append-only. update/delete 메서드 없음(SC-043).
- `apps/backend/src/modules/inventory/inventory.controller.ts`: POST /inventory/:variantId/stock-in, GET /inventory/:variantId/stock 엔드포인트 구현.
- `apps/backend/src/modules/inventory/inventory.events.ts`: 이벤트 상수 정의 스텁.
- `apps/backend/src/modules/inventory/inventory.module.ts`: InventoryService·InventoryRepository export.
- `apps/backend/src/modules/inventory/inventory.exception.ts`: `InsufficientStockException` (BadRequestException 서브클래스) 정의.
- `apps/backend/src/modules/inventory/dto/stock-in.dto.ts`: 입고 수량 DTO (@Min(1) 검증)
- `apps/backend/src/modules/inventory/inventory.service.spec.ts`: InventoryService unit 테스트 (SC-041~042, SC-046)

### shared 모듈

- `apps/backend/src/shared/auth/admin.guard.ts`: **SEC-001 수정** — `ADMIN_USER_IDS` 환경변수(콤마구분 user id 목록) 기반 AdminGuard. 미설정 시 전원 거부(fail-closed).
- `apps/backend/src/shared/auth/admin.guard.spec.ts`: AdminGuard SEC-001 회귀 방지 테스트 3건 (비admin→403, admin→pass, ADMIN_USER_IDS 미설정→전원403).
- `apps/backend/src/shared/auth/auth-shared.module.ts`: OptionalJwtAuthGuard 내보내기 추가 (비인증 허용 엔드포인트용).
- `apps/backend/src/shared/auth/optional-jwt-auth.guard.ts`: 토큰 없어도 통과, 있으면 검증 후 user 주입하는 guard 구현.

### 정적 테스트 및 integration 테스트

- `apps/backend/test/static/inventory-log-append-only.spec.ts`: SC-043 — InventoryRepository에 log update/delete 메서드 없음 정적 검증
- `apps/backend/test/static/inventory-service-signature.spec.ts`: SC-044~045 — checkAvailability·decreaseStock 시그니처 정적 검증
- `apps/backend/test/static/auth-required-guards.spec.ts`: SC-048 — 인증 필수 엔드포인트 JwtAuthGuard 메타데이터 정적 검증
- `apps/backend/test/static/cross-schema.spec.ts`: SC-049 — 모듈별 타 스키마 Prisma 모델 직접 참조 금지 정적 검증
- `apps/backend/test/static/schema-decimal.spec.ts`: SC-050 — schema.prisma price 필드 Decimal 타입 정적 검증
- `apps/backend/test/static/package-no-aws.spec.ts`: SC-051 — @aws-sdk/* 신규 의존 없음 정적 검증
- `apps/backend/test/products.e2e-spec.ts`: SC-047 — GET /products P95≤500ms integration 검증 (실측 P95=3ms)

**후속 작업 시 주의사항**:

- `InventoryService.decreaseStock`은 호출자의 트랜잭션 컨텍스트 내에서 실행됨을 전제로 설계됨(FR-034). 003-commerce에서 order 생성 트랜잭션 내에서 호출해야 원자성이 보장됨.
- `ProductEventsHandler.handleStockChanged({productId, totalStock})` 이벤트 페이로드 형식은 inventory 모듈이 발행, product 모듈이 구독. 003에서 재고 차감 후 동일 이벤트를 발행해야 OUT_OF_STOCK 자동 전환이 작동함.
- `OptionalJwtAuthGuard`: 비인증 사용자도 허용하는 엔드포인트(GET /products, GET /products/:id, GET /categories)에 사용. product.viewed 이벤트는 인증된 사용자에 한해 발행됨(service 내 user 존재 여부 체크).
- **SEC-001 수정 완료**: seller 승인/거부 API에 `AdminGuard` 적용. `ADMIN_USER_IDS` 환경변수(콤마구분 user id) 기반 fail-closed 제어. 프로덕션 배포 전 `apps/backend/.env.example` 를 참고하여 ADMIN_USER_IDS 설정 필수. 미설정 시 승인/거부 전면 차단.
- context.md / infra.md 갱신 필요 (gaps.md GAP-002·GAP-003 참조 — Retrospective Agent 처리 위임).

---

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
