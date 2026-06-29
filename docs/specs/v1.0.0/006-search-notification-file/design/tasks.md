---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive — 전 태스크 구현 완료)
---

# Tasks: 006-search-notification-file

> Branch: 006-search-notification-file | Date: 2026-06-29 | Plan: [../planning/plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
- [Test Authoring Contract](#test-authoring-contract)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목 해소(미결 사항: 없음)
- [x] plan.md Constitution Gates(P-001~P-007) 통과(예외 0건, P-005 는 금전 필드 부재로 해당 없음)
- [x] CHANGES.md 의 이전 작업(005-shipping-settlement) "후속 작업 시 주의사항" 확인
- [x] **Database Design Agent** 가 `data-model.md` + 마이그레이션(users 1테이블 `notifications` + files 1테이블 `file_assets` + 3 enum + 조회 인덱스 + `key @unique`)을 확정하고 Prisma client 생성 완료

> A·B·C 레이어 = **4단계 Development Agent**. D 레이어 = **5a Test Agent(AUTHORING)**. 레이어 A→B→C 의존 순, `[P]` 는 병렬 가능.

---

## 태스크 목록

> 레이어: A 데이터(repository·schema 연동) / B 도메인(service·constants·port·stub) / C 인터페이스(controller·dto·module wiring) / D 테스트(5a).

### Step 1. product 모듈 — 006 연동 메서드 (additive, A·B)

- [x] **T001** — product.repository.searchProducts
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/product/product.repository.ts`
  - 관련 요구사항: FR-002
  - 상세: `searchProducts({q?, categoryId?, minPrice?: Prisma.Decimal, maxPrice?: Prisma.Decimal, sort, skip, take}): Promise<{items: (Product & {images: ProductImage[]})[]; total}>` — where `status:{in:[ACTIVE, OUT_OF_STOCK]}` + q(`title contains insensitive`) + categoryId + price(`DecimalFilter gte/lte`). orderBy price_asc/desc → `[{price},{id:desc}]`, latest → `[{createdAt:desc},{id:desc}]`. `Promise.all([findMany(include images displayOrder asc), count])`.
  - 완료 기준: products 스키마만 접근. 상태 필터·정렬 tiebreaker id desc·Decimal 가격 비교 정확.

- [x] **T002** — product.service.searchProducts
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/product/product.service.ts`
  - 관련 요구사항: FR-001·002
  - 상세: `searchProducts({q?, categoryId?, minPrice?: number|string, maxPrice?: number|string, sort, skip, take}): Promise<{items; total}>` — 가격 입력을 `new Prisma.Decimal(...)`(undefined 면 미전달)로 변환 후 `productRepository.searchProducts` 위임.
  - 완료 기준: additive 공개. 기존 ProductService 메서드 시그니처 불변(002~005 회귀 0). 가격 Decimal 변환.

### Step 2. search 모듈 (소유 테이블 없음)

- [x] **T010** — search.constants
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/search/search.constants.ts`
  - 관련 요구사항: FR-001
  - 상세: `DEFAULT_SEARCH_SIZE=20`, `MAX_SEARCH_SIZE=100`, `SEARCH_SORTS=['latest','price_asc','price_desc'] as const`, `type SearchSort`.
  - 완료 기준: 상수·정렬 union 타입.

- [x] **T011** — search.service
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/search/search.service.ts`
  - 관련 요구사항: FR-001·002
  - 상세: `searchProducts(params): Promise<{items, total, page, size}>` — `page = max(page ?? 1, 1)`, `size = min(max(size ?? DEFAULT, 1), MAX)`, `sort = sort ?? 'latest'` → `productService.searchProducts({...filters, sort, skip:(page-1)*size, take:size})` → `{items, total, page, size}`.
  - 완료 기준: ProductService DI 만(P-001 — 자체 테이블 없음). 클램핑·기본값 정확.

- [x] **T012** `[P]` — search.repository (빈 클래스)
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/search/search.repository.ts`
  - 관련 요구사항: FR-002(P-001)
  - 상세: `@Injectable() class SearchRepository {}` — 자체 테이블 없음. 4계층 골격 유지용 클래스만 보존, `SearchModule` providers 미등록.
  - 완료 기준: 직접 Prisma 접근 0(빈 클래스).

- [x] **T013** `[P]` — search dto + controller + module wiring
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/search/dto/search-products.dto.ts`, `search.controller.ts`, `search.module.ts`
  - 관련 요구사항: FR-001
  - 상세: `SearchProductsDto`(q·categoryId `@IsString`, minPrice·maxPrice `@IsNumberString`, sort `@IsIn(SEARCH_SORTS)`, page·size `@Type(Number) @IsInt @Min(1)`, 전부 `@IsOptional`). `SearchController` `@Controller('search')`(가드 없음): GET `/products`. `SearchModule`: imports `[ProductModule]`, controllers `[SearchController]`, providers `[SearchService]`.
  - 완료 기준: 공개 라우트(가드 없음). 잘못된 sort → 400(ValidationPipe). DI 순환 0.

### Step 3. notification 모듈 (users 스키마 소유)

- [x] **T020** — notification.constants
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/notification/notification.constants.ts`
  - 관련 요구사항: FR-004
  - 상세: `DEFAULT_NOTIFICATION_SIZE=20`, `MAX_NOTIFICATION_SIZE=100`.
  - 완료 기준: 상수.

- [x] **T021** — notification.repository
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/notification/notification.repository.ts`
  - 관련 요구사항: FR-003·004·005·006
  - 상세: `this.prisma.tx.notification` 로 — `create(data)`, `findById(id)`, `listByUser(userId, skip, take)`(orderBy `[{isRead:asc},{createdAt:desc},{id:desc}]`, `Promise.all([findMany, count])`), `markRead(id)`(isRead:true), `markAllRead(userId)`(updateMany where isRead:false → count).
  - 완료 기준: notification 모델만 접근 — user/seller 등 직접 참조 0(SC-053). tx-aware.

- [x] **T022** — notification.service
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/notification/notification.service.ts`
  - 관련 요구사항: FR-003·004·005·006
  - 상세:
    - `create(userId, type, title, body)` — `repository.create({userId, type, title, body})` 위임(공개 진입점).
    - `list(userId, page?, size?)` — page/size 정규화 → `listByUser(userId, (page-1)*size, size)` → `{items, total, page, size}`.
    - `markRead(userId, id)` — `findById`(없으면 404) → `userId` 불일치 403 → `markRead(id)`.
    - `markAllRead(userId)` — `markAllRead(userId)` → `{updated}`.
  - 완료 기준: 소유권 검증 정확(404/403). P-001 — notifications 만.

- [x] **T023** `[P]` — notification dto + controller + module wiring
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/notification/dto/list-notifications.dto.ts`, `notification.controller.ts`, `notification.module.ts`
  - 관련 요구사항: FR-004·005·006, SC-011(401)
  - 상세: `ListNotificationsDto`(page·size `@Type(Number) @IsInt @Min(1) @IsOptional`). `NotificationController` `@Controller('notifications')` `@UseGuards(JwtAuthGuard)`: GET `/`(list) · PATCH `/read-all`(markAllRead) · PATCH `/:id/read`(markRead). `NotificationModule`: imports `[AuthSharedModule]`, providers `[NotificationService, NotificationRepository]`, exports `[NotificationService]`.
  - 완료 기준: 비인증 401(JwtAuthGuard). `read-all` 정적 경로가 `:id/read` 보다 먼저. exports NotificationService.

### Step 4. file 모듈 (files 스키마 소유)

- [x] **T030** — file-storage.port + stub-file-storage
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/file/file-storage.port.ts`, `stub-file-storage.ts`
  - 관련 요구사항: FR-007, NFR-002
  - 상세: `interface FileStoragePort { getPresignedUploadUrl(key, contentType): Promise<{uploadUrl, publicUrl}>; getPublicUrl(key): string }`, `const FILE_STORAGE='FILE_STORAGE'`. `StubFileStorage implements FileStoragePort` — `STUB_BASE_URL='https://r2.stub.local'`, `getPublicUrl(key)=>{base}/{key}`, `getPresignedUploadUrl=>{ uploadUrl:{base}/{key}?presigned=upload, publicUrl:getPublicUrl(key) }`(무네트워크, Logger 로깅).
  - 완료 기준: 외부 네트워크 호출 0. 결정적 URL. FILE_STORAGE 토큰.

- [x] **T031** — file.repository
  - 레이어: A
  - 구현 파일: `apps/backend/src/modules/file/file.repository.ts`
  - 관련 요구사항: FR-007·008·009
  - 상세: `this.prisma.tx.fileAsset` 로 — `create(data)`, `findById(id)`, `delete(id)`.
  - 완료 기준: fileAsset 모델만 접근 — user 등 직접 참조 0(SC-053).

- [x] **T032** — file.service
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/file/file.service.ts`
  - 관련 요구사항: FR-007·008·009
  - 상세:
    - `presign(userId, {purpose, contentType})` — `key={purpose}/{userId}/{randomUUID()}` → `storage.getPresignedUploadUrl(key, contentType)` → `repository.create({ownerId:userId, purpose, key, url:publicUrl, contentType, size:0, status:PENDING})` → `{id, key, uploadUrl, url}`.
    - `getById(id)` — `findById`(없으면 404).
    - `delete(userId, id)` — `findById`(없으면 404) → `ownerId` 불일치 403 → `delete(id)`.
  - 완료 기준: 키 형식·PENDING 레코드·소유권(404/403) 정확. FILE_STORAGE DI.

- [x] **T033** `[P]` — file dto + controller + module wiring
  - 레이어: C
  - 구현 파일: `apps/backend/src/modules/file/dto/presign.dto.ts`, `file.controller.ts`, `file.module.ts`
  - 관련 요구사항: FR-007·008·009, SC-011(401)
  - 상세: `PresignDto`(purpose `@IsEnum(FilePurpose)`, contentType `@IsString`). `FileController` `@Controller('files')` `@UseGuards(JwtAuthGuard)`: POST `/presign`(`@HttpCode(201)`) · GET `/:id` · DELETE `/:id`(`@HttpCode(204)`). `FileModule`: imports `[AuthSharedModule]`, providers `[FileService, FileRepository, {provide:FILE_STORAGE, useClass:StubFileStorage}]`, exports `[FileService]`.
  - 완료 기준: 비인증 401. presign 201·delete 204. exports FileService.

### Step 5. 테스트 (D 레이어 — 5a Test Agent AUTHORING)

> 본 Step 은 **5a Test Agent(AUTHORING)** 가 작성(TDD Red). 아래 [Test Authoring Contract](#test-authoring-contract) 가 입력.

- [x] **T040** — search 단위 테스트 (`search.service.spec.ts`) — SC-001·002 (5 케이스)
- [x] **T041** — notification 단위 테스트 (`notification.service.spec.ts`) — SC-004·005·006·007 (8 케이스)
- [x] **T042** — file 단위 테스트 (`file.service.spec.ts`) — SC-008·009·010 (7 케이스)
- [x] **T043** `[P]` — 통합 부팅 테스트 (`search-notification-file.e2e-spec.ts`) — SC-011 (4 케이스)
- [x] **T044** `[P]` — 정적 테스트 확장 — `cross-schema.spec.ts`(NotificationRepository·FileRepository 규칙, SC-053)

---

## Test Authoring Contract

> **5a Test Agent(AUTHORING) 입력 contract**. production canonical 심볼 명시(추측 단언 금지).

### Production canonical 심볼

| 심볼 | canonical 형태 |
|---|---|
| `SearchService` | `searchProducts(params: {q?, categoryId?, minPrice?, maxPrice?, sort?, page?, size?}): Promise<{items, total, page, size}>` |
| `ProductService`(006 신규, mock) | `searchProducts({q?, categoryId?, minPrice?, maxPrice?, sort, skip, take}): Promise<{items, total}>` |
| `NotificationService` | `create(userId, type: NotificationType, title, body)`·`list(userId, page?, size?)`·`markRead(userId, id)`·`markAllRead(userId): {updated}` |
| `NotificationRepository`(mock) | `create`·`findById`·`listByUser`·`markRead`·`markAllRead` |
| `FileService` | `presign(userId, {purpose: FilePurpose, contentType})`·`getById(id)`·`delete(userId, id)` |
| `FileRepository`(mock) | `create`·`findById`·`delete` |
| `FileStoragePort` | `StubFileStorage`(실제 클래스 — useClass) — `getPresignedUploadUrl`·`getPublicUrl` |
| 상수 | `DEFAULT_SEARCH_SIZE=20`·`MAX_SEARCH_SIZE=100`·`DEFAULT_NOTIFICATION_SIZE=20`·`MAX_NOTIFICATION_SIZE=100` |
| enum 리터럴 | `NotificationType.ORDER_PLACED` 등·`FilePurpose.PRODUCT_IMAGE/PROFILE`·`FileStatus.PENDING` |
| 예외 리터럴 | `ForbiddenException`(403, 타인 소유)·`NotFoundException`(404, 미존재) |
| stub URL 단언 | `uploadUrl='https://r2.stub.local/{key}?presigned=upload'`·`url='https://r2.stub.local/{key}'`, key 정규식 `^{purpose}/{userId}/[0-9a-f-]{36}$` |

### mock 재현 규약

- **search.service.spec**: `mockProductService.searchProducts.mockResolvedValue({items:[], total:0})`. `{}` → `objectContaining({sort:'latest', skip:0, take:20})`. `{page:3,size:10}` → `skip:20`. `{size:9999}` → `take:MAX_SEARCH_SIZE`. filters → 그대로 전달 + skip/take. 결과 → `{items, total, page, size}` wrap.
- **notification.service.spec**: `mockRepo`. create → `repository.create({userId, type, title, body})`. list `{}` → `listByUser(USER, 0, 20)`·`{page:1,size:20,total:0}`; `{2,10}` → `(USER,10,10)`; `{1,9999}` → `(USER,0,100)`. markRead → `findById=null`→NotFound(markRead 미호출); `userId=OTHER`→Forbidden(미호출); 본인→`markRead(id)`·`isRead:true`. markAllRead → `{updated:3}`.
- **file.service.spec**: `mockRepo` + `{provide:FILE_STORAGE, useClass:StubFileStorage}`. presign → `create.key` 정규식·`{ownerId, purpose, contentType, size:0, status:PENDING}`·stub URL. presign×2 → 키 상이. getById → `null`→NotFound; 존재→반환. delete → `null`→NotFound(delete 미호출); `ownerId=OTHER`→Forbidden(미호출); 본인→`delete(id)`.
- **search-notification-file.e2e-spec**: `Test.createTestingModule({imports:[AppModule]})` + ValidationPipe(whitelist·forbidNonWhitelisted·transform). `GET /search/products?size=5` → 200·`{items:array, total, page:1, size:5}`; `?sort=not_a_sort` → 400; `GET /notifications`(no token) → 401; `POST /files/presign`(no token) → 401.

### SC → 테스트 매핑

| SC-ID | 수용 기준 | 테스트 파일·describe | 비고 |
|---|---|---|---|
| SC-001 | 검색 page/size 정규화·클램핑·sort 기본 | search.service.spec.ts (3: defaults·skip·clamp) | [env:unit] |
| SC-002 | 필터 passthrough + 메타 wrap | search.service.spec.ts (2: filters·wrap) | [env:unit] |
| SC-003 | ACTIVE·OUT_OF_STOCK·tiebreaker·Decimal | ProductRepository.searchProducts 코드 구조 | [env:static] |
| SC-004 | create 위임 | notification.service.spec.ts::create (1) | [env:unit] |
| SC-005 | list 정규화·메타 | notification.service.spec.ts::list (3) | [env:unit] |
| SC-006 | markRead 404/403/owner | notification.service.spec.ts::markRead (3) | [env:unit] |
| SC-007 | markAllRead count | notification.service.spec.ts::markAllRead (1) | [env:unit] |
| SC-008 | presign key·PENDING·URL·uniqueness | file.service.spec.ts::presign (2) | [env:unit] |
| SC-009 | getById 404/found | file.service.spec.ts::getById (2) | [env:unit] |
| SC-010 | delete 404/403/owner | file.service.spec.ts::delete (3) | [env:unit] |
| SC-011 | AppModule 부팅·라우트 | search-notification-file.e2e-spec.ts (4) | [env:integration] |
| SC-053 | notification/file repo cross-schema 0 | cross-schema.spec.ts NotificationRepository(006)·FileRepository(006) | [env:static] |

---

## 구현 완료 기준

- [x] 모든 A·B·C 태스크 체크박스 완료(4단계), D 태스크 완료(5a)
- [x] `pnpm --filter backend test` 전체 PASSED — 002~005 회귀 0 + 006 신규 SC `[TypeScript/NestJS]`
- [x] `tsc --noEmit` 0 error — NestJS DI 순환(search→product 단방향, notification/file 독립) 미발생
- [x] cross-schema(SC-053) 정적 PASS
- [x] AppModule 부팅 PASS — SearchModule·NotificationModule·FileModule DI 정상(SC-011)
- [x] `package.json` 신규 의존 0(NFR-002). R2 SDK 0
- [x] git status 의도치 않은 파일 없음
