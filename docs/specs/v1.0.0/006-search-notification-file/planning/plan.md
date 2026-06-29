---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive)
---

# Plan: 006-search-notification-file

> Branch: 006-search-notification-file | Date: 2026-06-29 | Spec: [../spec/spec.md](../spec/spec.md)

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [사전 영향도 분석 결과](#사전-영향도-분석-결과)
- [핵심 설계](#핵심-설계)
- [결정 기록 (ADRs)](#결정-기록-adrs)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> `constitution.md`(P-001~P-007) 존재 → 해당 조항을 Gates 로 사용한다(constitution 우선). spec.md NFR(NFR-001~005)은 P-001·P-002·P-003·P-004 를 하위 구체화하며 충돌(완화) 없음.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: search/notification/file 모듈이 자기 소유 테이블 외 타 도메인 모델을 직접 참조·쿼리하지 않음 — SC-053 정적 검증]
  → PASS. (1) `search` 모듈은 **자체 소유 테이블이 없다** — 모든 상품 조회는 `ProductService.searchProducts` 공개 메서드 DI 경유 read-only. `SearchRepository` 는 빈 클래스(providers 미등록, 4계층 골격 유지용). (2) `NotificationRepository` 는 `this.prisma.tx.notification`(users.notifications)만, `FileRepository` 는 `this.prisma.tx.fileAsset`(files.files)만 쿼리. (3) cross-schema 참조(`notifications.userId`·`file_assets.ownerId`)는 전부 plain String(FK 미선언). SC-053(cross-schema.spec NotificationRepository(006)·FileRepository(006) 규칙) 정적 검증 대상.
- [x] **P-002 AWS 의존 금지 / 외부 의존 추상화 원칙**: [Pass 기준: `@aws-sdk/*` 및 신규 npm 의존 0건]
  → PASS. 신규 npm 의존 0건. 객체 스토리지(R2) 연동은 `FileStoragePort` 인터페이스 + `StubFileStorage`(무네트워크, 결정적 URL) 추상화. `FILE_STORAGE` DI 토큰으로 바인딩하여 실제 R2 전환 시 구현체만 교체. AWS 전용 SDK·서비스 미사용.
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 외부 저장소 0건]
  → PASS. 신규 2테이블(`users.notifications`·`files.files`)을 기존 PostgreSQL 인스턴스에 추가(신규 `files` 스키마 분리). 외부 저장소·캐시·브로커 0. 파일 바이너리는 R2(stub 추상화)이나 본 spec 의 DB 작업은 메타데이터 레코드뿐.
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: 클라우드 전용 API 결합 0건]
  → PASS. 표준 Prisma + PostgreSQL + `FileStoragePort` 추상화. 클라우드 전용 SDK·API 미사용(stub 은 결정적 문자열만 반환).
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: 금전 수치 Decimal — **본 spec 해당 없음**]
  → **해당 없음(N/A)**. 006 신규 테이블(`notifications`·`file_assets`)에는 **금전 필드가 없다**. 검색의 가격 필터(`minPrice`·`maxPrice`)는 `products.price`(`Prisma.Decimal`)에 대한 read-only 범위 비교일 뿐 정산·결제 상태 변경이 없다. 부동소수점 회피를 위해 `ProductService.searchProducts` 가 가격 입력을 `new Prisma.Decimal(...)` 로 변환하여 비교에 사용한다(읽기 정확성). 금전 *상태 변경* 부재이므로 P-005 의 outbox/멱등키/Decimal 산술 조항은 본 spec 에 직접 적용되지 않는다.
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건]
  → PASS. FR-001~009·NFR-001~005 전부 SC 매핑 존재(spec.md 매트릭스 역방향 검증 완료).
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건]
  → PASS. 변경 범위 = search·notification·file 3개 스텁 실구현 + product 모듈 006 연동 메서드 1종(searchProducts) 추가(전부 FR-001~009 추적 가능). spec.md 범위 외 리팩토링 0.

**스코프 추적 (P-007 — product 산출물 cross-cutting 변경의 FR 근거)**:

| 변경 대상 | 변경 성격 | 근거 FR | 비파괴성 |
|---|---|---|---|
| `modules/product/product.service.ts` 신규 `searchProducts` | 가격 입력 → `Prisma.Decimal` 변환 후 repository 위임 | FR-001·002 | additive 공개 메서드 — 기존 조회 경로 불변 |
| `modules/product/product.repository.ts` 신규 `searchProducts` | products 스키마 검색 질의(상태·필터·정렬·offset·images include) | FR-002 | additive — products 자기 스키마 조회 |

> **예외 사항**: 없음. P-001~P-007 전부 통과(P-005 는 금전 필드 부재로 해당 없음). 정산·결제 류 금전 상태 변경이 없어 별도 멱등성/Decimal 산술 게이트 비적용.

> **Gates 판정**: P-001~P-007 전부 통과(예외 0건). Design Agent(3단계) 진입 가능.

---

## 기술 컨텍스트

> 002~005 의 확정 스택을 재확정. 006 고유 신규 결정만 명시.

- **언어 / 런타임**: TypeScript 5.4 / Node.js 20.x. pnpm + Turborepo.
- **백엔드 프레임워크**: NestJS 11.x. 4계층(controller·service·repository·events). search 는 자체 테이블이 없어 repository 가 빈 클래스.
- **ORM / DB**: Prisma `^6.19.0` multiSchema + PostgreSQL 16. 신규 `files` 스키마 추가, 알림 테이블은 기존 `users` 스키마에 배치.
- **인증/인가**: 기존 `shared/auth` 재사용 — `JwtAuthGuard`·`@CurrentUser()`·`AuthenticatedUser`. notification·file 엔드포인트는 `JwtAuthGuard`. search 는 공개(가드 없음). 자원 소유권은 service 레이어에서 `userId`/`ownerId` 비교(별도 가드 없음).
- **트랜잭션 전파**: 003 ALS 인프라 `PrismaService`(`tx` getter) 재사용. notification/file repository 는 `this.prisma.tx` 로 쿼리(도메인 이벤트 트랜잭션 내부 호출 전파 지원 — notification.create 가 향후 주문 tx 내 호출 가능). 단 006 자체 흐름은 단일 쿼리·단일 mutation 위주로 명시적 다단계 트랜잭션은 사용하지 않는다.
- **객체 스토리지 추상화**: `FileStoragePort` 인터페이스(`getPresignedUploadUrl(key, contentType)`·`getPublicUrl(key)`) + `StubFileStorage`(무네트워크, `https://r2.stub.local/{key}`). `FILE_STORAGE` 문자열 DI 토큰으로 `useClass: StubFileStorage` 바인딩(P-002).
- **검색 데이터 접근**: search 모듈은 자체 테이블 없음 → `ProductService.searchProducts`(006 신규 공개) DI 경유. ProductRepository 가 `ACTIVE`·`OUT_OF_STOCK` 필터·정렬·offset·images include 처리.
- **입력 검증**: `class-validator` + 전역 `ValidationPipe`(whitelist·forbidNonWhitelisted·transform). `SearchProductsDto`(q·categoryId `@IsString`, minPrice·maxPrice `@IsNumberString`, sort `@IsIn(SEARCH_SORTS)`, page·size `@Type(Number) @IsInt @Min(1)`), `ListNotificationsDto`(page·size), `PresignDto`(purpose `@IsEnum(FilePurpose)`, contentType `@IsString`).
- **테스트 프레임워크**: Jest(`*.spec.ts`, src rootDir) + 정적/통합(`test/`, jest-e2e.json rootDir). 단위([env:unit]) + 통합 부팅([env:integration] — SC-011) + 정적([env:static] — SC-053).
- **환경변수**: 기존 `DATABASE_URL`·`JWT_*` 재사용. 신규 env 0.
- **신규 의존성**: 0건. 신규 npm 패키지 없음.

---

## 사전 영향도 분석 결과

> 상세는 [../design/research.md](../design/research.md) 참조. 본 절은 영향 파일 요약.

### 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 | 레이어 |
|---|---|---|---|
| `prisma/schema.prisma` | 수정(DB Design 소유) | `NotificationType`(users)·`FilePurpose`·`FileStatus`(files) enum + `Notification`(users)·`FileAsset`(files) 2모델 | A |
| `prisma/migrations/20260629081946_006_search_notification_file/migration.sql` | 신규 | 006 테이블·enum·인덱스·제약 | A |
| `src/modules/search/search.constants.ts` | 신규 | DEFAULT/MAX_SEARCH_SIZE·SEARCH_SORTS | B |
| `src/modules/search/search.service.ts` | 신규 구현 | page/size 정규화·정렬 기본값·ProductService DI 위임 | B |
| `src/modules/search/search.repository.ts` | 신규(빈 클래스) | 자체 테이블 없음 — providers 미등록 | A |
| `src/modules/search/search.controller.ts` | 신규 구현 | GET /search/products (공개) | C |
| `src/modules/search/dto/search-products.dto.ts` | 신규 | 검색 쿼리 검증 dto | C |
| `src/modules/search/search.module.ts` | 수정 | imports(ProductModule)·providers(SearchService) | C |
| `src/modules/notification/notification.constants.ts` | 신규 | DEFAULT/MAX_NOTIFICATION_SIZE | B |
| `src/modules/notification/notification.repository.ts` | 신규 구현 | create·findById·listByUser·markRead·markAllRead | A |
| `src/modules/notification/notification.service.ts` | 신규 구현 | create(공개)·list·markRead(소유권)·markAllRead | B |
| `src/modules/notification/notification.controller.ts` | 신규 구현 | GET /·PATCH /read-all·PATCH /:id/read | C |
| `src/modules/notification/dto/list-notifications.dto.ts` | 신규 | 목록 쿼리 dto | C |
| `src/modules/notification/notification.module.ts` | 수정 | imports(AuthShared)·exports(NotificationService) | C |
| `src/modules/file/file-storage.port.ts` | 신규 | FileStoragePort 인터페이스 + FILE_STORAGE 토큰 | B |
| `src/modules/file/stub-file-storage.ts` | 신규 | 결정적 URL stub 구현체 | B |
| `src/modules/file/file.repository.ts` | 신규 구현 | create·findById·delete | A |
| `src/modules/file/file.service.ts` | 신규 구현 | presign(key·PENDING)·getById·delete(소유권) | B |
| `src/modules/file/file.controller.ts` | 신규 구현 | POST /presign·GET /:id·DELETE /:id | C |
| `src/modules/file/dto/presign.dto.ts` | 신규 | presign body dto | C |
| `src/modules/file/file.module.ts` | 수정 | imports(AuthShared)·FILE_STORAGE 바인딩·exports(FileService) | C |
| `src/modules/product/product.service.ts` | 수정(additive) | searchProducts 신규 공개(Decimal 변환) | B |
| `src/modules/product/product.repository.ts` | 수정(additive) | searchProducts 신규(products 검색 질의) | A |
| `test/static/cross-schema.spec.ts` | 수정(확장) | NotificationRepository·FileRepository 규칙 추가(SC-053) | D |
| `test/search-notification-file.e2e-spec.ts` | 신규 | AppModule 부팅 + 라우트 검증(SC-011) | D |

> `package.json` 변경 0건(신규 npm 의존 없음 — NFR-002 자동 충족). ProductModule 은 이미 `exports`에 ProductService 포함 → search 가 DI 소비 가능, forwardRef 불요.

---

## 핵심 설계

> 작성 깊이: Design Agent 가 tasks.md 분해 가능한 수준. 변경 대상 모듈·인터페이스 시그니처·핵심 분기 로직 포함.

### 0. 모듈 간 통신 토폴로지 (P-001 / NFR-001 핵심)

```
[search 모듈] 자체 소유 테이블 없음 (SearchRepository = 빈 클래스, providers 미등록)
   │   ProductService.searchProducts({q, categoryId, minPrice, maxPrice, sort, skip, take})  (DI, read-only)
[product 모듈] products 스키마 소유 ── 신규 공개 1종 (searchProducts)
   │   ProductRepository.searchProducts(...): {items, total}  (ACTIVE·OUT_OF_STOCK, 정렬, offset, images)

[notification 모듈] users 스키마 소유(notifications)
   │   NotificationService.create(userId, type, title, body)  (export — 타 도메인 DI 소비, 현재 미연동)

[file 모듈] files 스키마 소유(file_assets)
   │   FileStoragePort(getPresignedUploadUrl/getPublicUrl)  (DI — FILE_STORAGE 토큰 → StubFileStorage)
```

**규약**:
- search 의 상품 데이터 획득은 직접 Prisma 쿼리 절대 금지, `ProductService` 공개 DI 만(P-001, NFR-001).
- **순환 DI 회피**: search → product(DI 단방향). product 는 search 를 import 하지 않음. notification·file 은 타 도메인 서비스 DI 없음(AuthSharedModule 만). 순환 없음 → forwardRef 불요.

### 1. search 모듈 (소유 테이블 없음) — FR-001·002

변경 대상: `modules/search/{search.controller,search.service,search.constants}.ts` + `search.repository.ts`(빈 클래스) + `search.module.ts` + dto.

**컨트롤러 라우팅**(`@Controller('search')`, 가드 없음 — 공개):

| 엔드포인트 | 인가 | 동작 | FR/SC |
|---|---|---|---|
| `GET /search/products` | 없음(공개) | query → page/size 정규화 → ProductService DI → `{items, total, page, size}` | FR-001·002 / SC-001·002·003·011 |

**핵심 분기 로직(FR-001)**:
```
page = max(params.page ?? 1, 1)
size = min(max(params.size ?? DEFAULT_SEARCH_SIZE, 1), MAX_SEARCH_SIZE)   // 20, 클램핑 1~100
sort = params.sort ?? 'latest'
{ items, total } = productService.searchProducts({ q, categoryId, minPrice, maxPrice, sort,
                                                   skip: (page-1)*size, take: size })
return { items, total, page, size }
```

**ProductRepository.searchProducts 질의(FR-002)**:
```
where = { status: { in: [ACTIVE, OUT_OF_STOCK] },
          q ? title: { contains: q, mode: insensitive } : {},
          categoryId ? categoryId : {},
          (min|max) ? price: { gte?, lte? } : {} }     // Prisma.DecimalFilter
orderBy = price_asc ? [{price:asc},{id:desc}] : price_desc ? [{price:desc},{id:desc}] : [{createdAt:desc},{id:desc}]
[items, total] = Promise.all([findMany({where, orderBy, skip, take, include:{images:{orderBy:{displayOrder:asc}}}}), count({where})])
```

### 2. notification 모듈 (users 스키마 소유) — FR-003~006

변경 대상: `modules/notification/{notification.controller,notification.service,notification.repository,notification.constants}.ts` + `notification.module.ts` + dto.

**컨트롤러 라우팅**(`@Controller('notifications')` `@UseGuards(JwtAuthGuard)`):

| 엔드포인트 | 인가 | 동작 | FR/SC |
|---|---|---|---|
| `GET /notifications` | JWT | `list(user.userId, page, size)` 미읽음 우선·최신순 | FR-004 / SC-005 |
| `PATCH /notifications/read-all` | JWT | `markAllRead(user.userId)` → `{updated}` | FR-006 / SC-007 |
| `PATCH /notifications/:id/read` | JWT | `markRead(user.userId, id)`(404/403) | FR-005 / SC-006 |

> 라우팅 주의: `read-all` 정적 경로가 `:id/read` 파라미터 경로보다 **먼저** 선언되어 매칭 충돌 회피.

**핵심 분기 로직**:
- **create(FR-003)**: `repository.create({userId, type, title, body})` 위임(공개 진입점).
- **list(FR-004)**: page/size 정규화(기본 20·최대 100) → `listByUser(userId, skip, size)` → `{items, total, page, size}`. repository orderBy `[{isRead:asc},{createdAt:desc},{id:desc}]`.
- **markRead(FR-005)**: `findById(id)`(없으면 404) → `notification.userId !== userId` 면 403 → `markRead(id)`(isRead:true).
- **markAllRead(FR-006)**: `markAllRead(userId)`(updateMany where userId+isRead:false) → `{updated: count}`.

### 3. file 모듈 (files 스키마 소유) — FR-007~009

변경 대상: `modules/file/{file.controller,file.service,file.repository,file-storage.port,stub-file-storage}.ts` + `file.module.ts` + dto.

**컨트롤러 라우팅**(`@Controller('files')` `@UseGuards(JwtAuthGuard)`):

| 엔드포인트 | 인가 | 동작 | FR/SC |
|---|---|---|---|
| `POST /files/presign` | JWT | `presign(user.userId, {purpose, contentType})` → 201 `{id,key,uploadUrl,url}` | FR-007 / SC-008 |
| `GET /files/:id` | JWT | `getById(id)`(404) — **소유권 미검증(SEC-FIND-006-01)** | FR-008 / SC-009 |
| `DELETE /files/:id` | JWT | `delete(user.userId, id)`(404/403) → 204 | FR-009 / SC-010 |

**핵심 분기 로직**:
- **presign(FR-007)**: `key = {purpose}/{userId}/{randomUUID()}` → `storage.getPresignedUploadUrl(key, contentType)` → `repository.create({ownerId:userId, purpose, key, url:publicUrl, contentType, size:0, status:PENDING})` → `{id, key, uploadUrl, url}`.
- **getById(FR-008)**: `findById(id)`(없으면 404) → 메타 반환(소유권 검증 없음).
- **delete(FR-009)**: `findById(id)`(없으면 404) → `file.ownerId !== userId` 면 403 → `delete(id)`.

### 4. product 모듈 신규 공개 메서드 — FR-001·002 (search DI contract)

```ts
// ProductService (additive 공개 메서드)
async searchProducts(params: {
  q?: string; categoryId?: string; minPrice?: number | string; maxPrice?: number | string;
  sort: 'latest' | 'price_asc' | 'price_desc'; skip: number; take: number;
}): Promise<{ items: unknown[]; total: number }>;
//  가격 입력을 new Prisma.Decimal(...) 로 변환 후 ProductRepository.searchProducts 위임
```

---

## 결정 기록 (ADRs)

| ADR-ID | 결정 항목 | 채택안 | 대안(검토했으나 미채택) | 근거(spec FR/NFR) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | 검색 모듈 데이터 소유 | search 자체 테이블 없음 — `ProductService.searchProducts` DI read-only. `SearchRepository` 빈 클래스(providers 미등록) | search 전용 검색 인덱스 테이블/색인(중복 데이터·동기화 비용) | P-001, NFR-001 | search.service, product.service/repository |
| ADR-002 | 알림 테이블 스키마 위치 | 기존 `users` 스키마에 `notifications` 배치(논리 소유 notification 모듈) | 별도 `notifications` 스키마 신설(추가 스키마 관리 비용) | P-001, P-003 | schema.prisma, NotificationRepository |
| ADR-003 | 파일 테이블 스키마 위치 | 신규 `files` 스키마 신설 | users/products 스키마에 합류(도메인 경계 모호) | P-001, P-003 | schema.prisma, FileRepository |
| ADR-004 | 객체 스토리지 연동 | `FileStoragePort` 인터페이스 + `StubFileStorage`(무네트워크, 결정적 URL) + `FILE_STORAGE` DI 토큰 | 실제 R2 SDK 직접 의존(P-002 위반, 테스트 네트워크 결합) | P-002, NFR-002 | file.service, file-storage.port, stub-file-storage |
| ADR-005 | 파일 업로드 모델 | presigned URL — 클라이언트 직접 PUT, 서버는 메타(PENDING)만 | 서버 프록시 업로드(대용량 트래픽 서버 경유) | FR-007 | file.service.presign |
| ADR-006 | 알림 생성 트리거 | `create()` 공개 진입점만 export(이벤트 핸들러 연동 미구현) | 주문·배송·정산·리뷰 이벤트 핸들러까지 연동(범위 확대) | FR-003 | notification.service. **한계: GAP-006-01** |
| ADR-007 | 검색 페이지네이션 | offset(page/size) + size 클램핑(20/100) | cursor 페이지네이션(검색 정렬 다양성으로 cursor 복잡) | FR-001 | search.service, product.repository |
| ADR-008 | 알림 정렬 | 미읽음 우선(`isRead asc`) → 최신순(`createdAt desc`) → `id desc` tiebreaker | 단순 최신순(미읽음 가시성 저하) | FR-004 | notification.repository.listByUser |
| ADR-009 | 파일 상태 모델 | presign 시 `PENDING` 생성, `UPLOADED` confirm 엔드포인트 부재 | 업로드 콜백·confirm 엔드포인트(범위 확대) | FR-007 | file.service. **한계: GAP-006-02** |

> **PATCH-003 (NFR 성능 직결 파라미터)**: 본 spec 은 P95 수치 NFR 없음. 검색·알림 조회는 인덱스 설계(DB Design 담당)로 충족 — `notifications(userId, isRead, createdAt desc)`·`file_assets(ownerId, createdAt desc)` 복합 인덱스. 상품 검색은 002 의 기존 products 인덱스 활용.

---

## 인터페이스 계약

### 권한 엔드포인트 인가 3축

> 상세는 spec.md [권한 평가 결과](../spec/spec.md#권한-평가-결과-patch-001) 참조.

| 엔드포인트 | (a) 호출자 신원 | (b) 자원 소유권 | (c) 역할 |
|---|---|---|---|
| `GET /search/products` | 없음(공개) | — (read-only) | — |
| `GET /notifications` | JWT | `user.userId` 본인 목록 | — |
| `PATCH /notifications/:id/read` | JWT | `notification.userId === me` | — |
| `PATCH /notifications/read-all` | JWT | `where userId=me` 본인만 | — |
| `POST /files/presign` | JWT | key·ownerId 에 me 바인딩 | — |
| `GET /files/:id` | JWT | **미검증(SEC-FIND-006-01)** | — |
| `DELETE /files/:id` | JWT | `file.ownerId === me` | — |

### 006 이 소비하는 002 공개 인터페이스 (DI)

```ts
// modules/product/product.service.ts — 002 실재 + 006 신규 공개
class ProductService {
  // 006 신규 (search DI contract)
  searchProducts(params: { q?; categoryId?; minPrice?; maxPrice?; sort; skip; take }):
    Promise<{ items: unknown[]; total: number }>;
}
```

### 006 신규 공개 인터페이스 (모듈 간 DI)

```ts
class NotificationService {  // exports
  create(userId: string, type: NotificationType, title: string, body: string): Promise<Notification>;
  list(userId: string, page?: number, size?: number): Promise<NotificationListResult>;
  markRead(userId: string, id: string): Promise<Notification>;
  markAllRead(userId: string): Promise<{ updated: number }>;
}
class FileService {  // exports
  presign(userId: string, data: { purpose: FilePurpose; contentType: string }): Promise<PresignResult>;
  getById(id: string): Promise<FileAsset>;
  delete(userId: string, id: string): Promise<void>;
}
// modules/file/file-storage.port.ts
interface FileStoragePort {
  getPresignedUploadUrl(key: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string }>;
  getPublicUrl(key: string): string;
}
const FILE_STORAGE = 'FILE_STORAGE';   // DI 토큰 → useClass StubFileStorage
```

### 하위 호환성 / 방어 코드

- product 모듈 신규 메서드는 additive 공개 → 002~005 기존 동작 불변.
- `notification.markRead`·`file.delete` 는 `findById` null → `NotFoundException`(404), 소유권 불일치 → `ForbiddenException`(403) 방어.
- search 의 size 입력 클램핑(`min(max(size, 1), MAX)`)·page 하한(`max(page, 1)`)으로 비정상 입력 방어.
- presign 의 key 는 `randomUUID()` 로 충돌 방지(`file_assets.key @unique`).

---

## 데이터 모델

> 상세 컬럼·타입·인덱스·제약·마이그레이션은 **Database Design Agent**(selection-phases.md: Y)가 [../db-design/data-model.md](../db-design/data-model.md) 로 확정. 본 절은 plan 수준 목표 구조.

### users 스키마 (알림 신규 1테이블)

| 테이블 | 핵심 필드 | 제약·인덱스 | 모듈 |
|---|---|---|---|
| `users.notifications` | `id`, `userId`(plain String — users.users.id, FK 미선언), `type`(NotificationType), `title`, `body`, `isRead`(default false), `createdAt` | index(userId, isRead, createdAt desc) — FR-004 조회 | notification |

### files 스키마 (파일 신규 1테이블)

| 테이블 | 핵심 필드 | 제약·인덱스 | 모듈 |
|---|---|---|---|
| `files.files`(`FileAsset`) | `id`, `ownerId`(plain String — users.users.id), `purpose`(FilePurpose), `key`(@unique), `url`, `contentType`, `size`(Int default 0), `status`(FileStatus default PENDING), `createdAt` | key @unique, index(ownerId, createdAt desc) — FR-009 조회 | file |

### 스키마 enum 신규

| enum | 스키마 | 값 | 근거 |
|---|---|---|---|
| `NotificationType` | users | ORDER_PLACED, ORDER_SHIPPED, SETTLEMENT_CREATED, REVIEW_RECEIVED | 도메인 이벤트 종류(향후 create 호출 지점) |
| `FilePurpose` | files | PRODUCT_IMAGE, REVIEW_IMAGE, PROFILE | presign key prefix·접근 정책 분기 |
| `FileStatus` | files | PENDING, UPLOADED | PENDING(presign·업로드 대기), UPLOADED(확정 — confirm 후속) |

> **P-001/NFR-001 핵심**: `notifications.userId`·`file_assets.ownerId` 는 cross-schema 경계 → **Prisma `@relation` 미선언 plain String**(003 패턴 승계). 본 spec 의 2테이블에는 동일 스키마 FK 도 없다(단일 테이블).
>
> **금전 필드 없음**: 두 테이블 모두 `Decimal` 금전 필드를 갖지 않는다(P-005 해당 없음). `file_assets.size` 는 바이트 크기(`Int`)일 뿐 금전이 아니다.

---

## 테스트 전략

> 테스트 수준: 단위/통합 부팅/정적. 단위(SC-001·002·004·005·006·007·008·009·010), 통합 부팅(SC-011), 정적(SC-003 코드 구조·SC-053 cross-schema).

### SC↔테스트 매핑 (요약)

| SC 식별자 | 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | 단위 | Happy/Edge | 검색 page/size 정규화·클램핑 | searchProducts({}/{page,size}/{size:9999}) | skip/take·sort latest |
| SC-002 | 단위 | Happy | 필터 passthrough + 메타 wrap | searchProducts(filters) | ProductService 전달·{items,total,page,size} |
| SC-003 | 정적 | — | ACTIVE·OUT_OF_STOCK·tiebreaker·Decimal | ProductRepository.searchProducts 코드 | 상태 필터·id desc·DecimalFilter |
| SC-004 | 단위 | Happy | create 위임 | create(...) | repository.create 호출·반환 |
| SC-005 | 단위 | Happy/Edge | list 정규화·메타 | list({}/{page2,size10}/{size9999}) | skip/take·page/size 메타 |
| SC-006 | 단위 | Happy/Error | markRead 404/403/owner | findById null/타인/본인 | 404/403/isRead:true |
| SC-007 | 단위 | Happy | markAllRead count | markAllRead | {updated:n} |
| SC-008 | 단위 | Happy | presign key·PENDING·URL·uniqueness | presign(purpose, contentType) | key 형식·PENDING·결정적 URL·키 유일 |
| SC-009 | 단위 | Happy/Error | getById 404/found | findById null/존재 | 404/메타 |
| SC-010 | 단위 | Happy/Error | delete 404/403/owner | findById null/타인/본인 | 404/403/delete 호출 |
| SC-011 | 통합 | Happy/Error | AppModule 부팅·라우트 | GET /search·/notifications·/files/presign | 200/401/400 |
| SC-053 | 정적 | — | notification/file repo cross-schema 0 | grep repository | 타 도메인 모델 미참조 |

### smoke_tests

- 필요 여부: Y (통합 부팅)
- 근거: 006 은 3개 신규 모듈을 AppModule 에 등록한다. `search-notification-file.e2e-spec.ts` 가 AppModule 부팅(SearchModule·NotificationModule·FileModule DI 해석)을 검증하고 공개/인증 라우트(200/401/400)를 확인(SC-011). DB 의존 e2e 이므로 PostgreSQL 기동 전제.

---

## 기타 고려사항

- **알림 이벤트 미연동(GAP-006-01)**: `NotificationService.create()` 가 export 되었으나 주문·배송·정산·리뷰 이벤트 핸들러에서 호출하는 연동이 미구현이다. 따라서 현재 알림이 실제로 생성되는 경로는 없으며(공개 진입점만 제공) 통합 시나리오(이벤트→알림→조회)는 미검증이다. 후속 spec 에서 도메인 이벤트 핸들러 연동.
- **파일 confirm 부재(GAP-006-02)**: `FileStatus.PENDING → UPLOADED` 확정 엔드포인트가 없어, 클라이언트가 presigned URL 로 업로드한 후 상태·size 를 갱신할 경로가 없다. 고아 PENDING 레코드가 누적될 수 있다. 후속 spec.
- **`GET /files/:id` 소유권 미검증(SEC-FIND-006-01)**: 파일 메타가 임의 인증 사용자에게 노출된다. 현재 public URL 모델과 정합하나, 비공개 purpose 도입 시 ownerId 검증 또는 공개/비공개 구분 필요.
- **presign 입력 무검증(SEC-FIND-006-02)**: contentType allowlist·파일 크기 상한 부재(size=0 placeholder). stub 모델에서는 표면 제한적이나 실제 R2 전환 시 content-type 바인딩·크기 제한 필요.
- **search 빈 Repository**: `SearchRepository` 는 4계층 골격 유지를 위해 클래스만 보존하며 `SearchModule` providers 에 등록하지 않는다(자체 테이블 없음 — P-001). 이를 등록·확장하려면 검색 전용 데이터 소유가 정당화되어야 한다.
- **검색 가격 입력 Decimal 변환**: 부동소수점 오차 방지를 위해 `minPrice`/`maxPrice` 는 DTO 에서 `@IsNumberString` 문자열로 받고 `ProductService.searchProducts` 가 `new Prisma.Decimal(...)` 로 변환하여 `Prisma.DecimalFilter` 비교에 사용한다(읽기 정확성, P-005 금전 *상태 변경* 은 아님).
