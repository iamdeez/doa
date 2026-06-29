---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive)
---

# Research: 006-search-notification-file

## 목차

- [분석 우선순위 게이트 결과](#분석-우선순위-게이트-결과)
- [기존 코드베이스 분석](#기존-코드베이스-분석)
  - [클래스·모듈 계층 구조](#클래스모듈-계층-구조)
  - [영향 범위 분석 (호출 측 전수 목록)](#영향-범위-분석-호출-측-전수-목록)
  - [공유 상태·동시성 분석](#공유-상태동시성-분석)
- [영향 파일 목록](#영향-파일-목록)
- [외부 라이브러리 API 실제 동작 확인](#외부-라이브러리-api-실제-동작-확인)
- [기술 선택 조사](#기술-선택-조사)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 분석 우선순위 게이트 결과

- **변경 대상 모듈(plan §핵심 설계)**: `search`(빈 스텁 실구현, 자체 테이블 없음), `notification`(빈 스텁 실구현), `file`(빈 스텁 실구현 + FileStoragePort/Stub), `product`(searchProducts 신규 공개 + repository.searchProducts), `prisma`(ALS 재사용, 변경 0), `schema.prisma`(users 1테이블 + files 1테이블 + 3 enum — Database Design Agent 소유).
- §A·B·C 분석은 위 모듈로 한정.
- §D(다단계 병렬 파이프라인): 미해당.
- §E(동일 가드 결정 통합): notification markRead·file delete 의 자원 소유권 검증(`userId`/`ownerId` 비교)에 적용 — 본문 [엣지 케이스](#엣지-케이스-및-한계) 참조.
- 외부 라이브러리 검증(§4): **신규 라이브러리 0건**. 기존 `node:crypto` `randomUUID`·`Prisma.Decimal`(가격 필터)·`Prisma.DecimalFilter` 만 신규 사용 — 아래 검증.
- §F(production 시그니처 변경): **해당 없음** — product 모듈은 신규 공개 메서드 추가(additive)이며 기존 메서드 시그니처 변경 없음. 기존 호출 측 영향 0.

---

## 기존 코드베이스 분석

> context.md §2 핵심 모듈 목록을 기준선. 본 절은 변경 대상 한정 정밀 분석.

### 클래스·모듈 계층 구조

- **OOP 상속/추상 클래스 없음**: 변경 대상은 전부 NestJS `@Injectable()` concrete 클래스. 신규 클래스(SearchService·NotificationService·FileService·StubFileStorage 등)는 상속 없이 직접 인스턴스화(NestJS DI). `StubFileStorage` 는 `FileStoragePort` **인터페이스**를 `implements` 한다(추상 클래스 아님).
- **모듈 DI 토폴로지(실측)**:
  - `SearchService` 생성자(실측 `search.service.ts`): `ProductService`. `SearchModule.imports`: `ProductModule`, providers `[SearchService]`(SearchRepository 미등록 — 빈 클래스), exports 없음.
  - `NotificationService` 생성자(실측 `notification.service.ts`): `NotificationRepository`. `NotificationModule.imports`: `AuthSharedModule`, providers `[NotificationService, NotificationRepository]`, exports `[NotificationService]`.
  - `FileService` 생성자(실측 `file.service.ts`): `FileRepository`, `@Inject(FILE_STORAGE) FileStoragePort`. `FileModule.imports`: `AuthSharedModule`, providers `[FileService, FileRepository, {provide: FILE_STORAGE, useClass: StubFileStorage}]`, exports `[FileService]`.
  - `ProductModule`(실측): exports `ProductService`(이미 존재 — search DI 소비 가능).

- **순환 DI 점검(신규 의존 관계)**:
  | 관계 | 방향 | 순환? |
  |---|---|---|
  | search → product | SearchModule imports ProductModule, SearchService uses ProductService | product 는 search 미import → **순환 없음** |
  | notification → (없음) | AuthSharedModule 만 import | 순환 없음 |
  | file → (없음) | AuthSharedModule 만 import + FILE_STORAGE 토큰 | 순환 없음 |
  - 결론: **forwardRef 신규 도입 불필요**. search → product 는 단방향. notification·file 은 타 도메인 서비스 DI 없음.

### 영향 범위 분석 (호출 측 전수 목록)

- **`ProductService.searchProducts`(신규 공개)**: 신규 추가이므로 기존 호출 측 0. search 모듈만 호출(신규). 기존 ProductService 메서드 시그니처 불변 → 002~005 product 테스트 회귀 0.
- **`ProductRepository.searchProducts`**: 신규. ProductService.searchProducts 만 호출. 기존 repository 메서드 불변.
- **`NotificationService.create`(export)**: 공개 진입점으로 export 되었으나 **현재 호출 측 0**(주문·배송·정산·리뷰 이벤트 핸들러 미연동 — GAP-006-01). notification 모듈 내부 테스트만 호출.
- **`FileService`(export)**: file 모듈 컨트롤러만 호출. 타 도메인 소비 현재 0.
- **search/notification/file 모듈**: 002~005 시점 빈 스텁(골격만) → 실구현. 기존 호출 측 0.
- **AppModule 와이어링**: SearchModule·NotificationModule·FileModule 이 AppModule imports 에 등록(부팅 시 DI 해석). `search-notification-file.e2e-spec.ts` 로 부팅 검증.

### 공유 상태·동시성 분석

- **공유 자원**: `users.notifications`(알림 — notification 모듈 단독 소유), `files.files`(파일 메타 — file 모듈 단독 소유), `products`(검색 read-only — product 모듈 소유).
- **Check-Then-Act 분석**:
  | 자원 | 위험 | 현재 안전망 | 근거 |
  |---|---|---|---|
  | notifications.isRead (markRead) | 동일 알림 동시 읽음 처리 2건 | idempotent — `isRead=true` 재설정은 무해(멱등). 소유권 검증 후 update | FR-005. 결과 동일 |
  | notifications (markAllRead) | 동시 markAllRead | `updateMany where isRead:false` — 멱등(이미 읽음은 미대상). count 만 달라질 수 있음 | FR-006 |
  | file_assets (delete) | 동시 삭제 2건 | 두 번째 `delete` 가 Prisma P2025(레코드 없음) 가능 — 단 본 spec 은 별도 처리 없음(404 흐름 아님, delete 직접) | FR-009. 운영상 드묾 |
  | file_assets.key (presign) | 동일 key 충돌 | `key = {purpose}/{userId}/{randomUUID()}` + `@unique` — uuid 충돌 확률 무시 | FR-007 |
- **Lock 범위**: 별도 비관 락 미사용. 알림 읽음·파일 삭제는 단일 update/delete. Lock 내 네트워크/파일 I/O 없음.
- **트랜잭션 전파 주의**: notification/file repository 가 `this.prisma.tx` 사용 — 향후 `notification.create` 가 주문 생성 tx 내부에서 호출될 때 동일 트랜잭션 참여(현재는 미연동). 006 자체 흐름은 단일 mutation 위주.
- **캐싱 컴포넌트 없음**: in-memory 캐시 도입 없음 → 캐시 생명주기 검토 비해당. StubFileStorage 도 무상태(stateless, 결정적 문자열 반환).

---

## 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 | 레이어 |
|---|---|---|---|
| `prisma/schema.prisma` | 수정(DB Design 소유) | NotificationType·FilePurpose·FileStatus enum + Notification·FileAsset 2모델 | A |
| `prisma/migrations/20260629081946_006_search_notification_file/migration.sql` | 신규 | 006 테이블·enum·인덱스·제약 | A |
| `src/modules/search/search.constants.ts` | 신규 | DEFAULT/MAX_SEARCH_SIZE·SEARCH_SORTS | B |
| `src/modules/search/search.service.ts` | 신규 구현 | page/size 정규화·ProductService DI 위임 | B |
| `src/modules/search/search.repository.ts` | 신규(빈 클래스) | 자체 테이블 없음(providers 미등록) | A |
| `src/modules/search/search.controller.ts` | 신규 구현 | GET /search/products(공개) | C |
| `src/modules/search/dto/search-products.dto.ts` | 신규 | 검색 쿼리 검증 dto | C |
| `src/modules/search/search.module.ts` | 수정 | imports(ProductModule)·providers | C |
| `src/modules/notification/notification.constants.ts` | 신규 | DEFAULT/MAX_NOTIFICATION_SIZE | B |
| `src/modules/notification/notification.repository.ts` | 신규 구현 | create·findById·listByUser·markRead·markAllRead | A |
| `src/modules/notification/notification.service.ts` | 신규 구현 | create·list·markRead·markAllRead | B |
| `src/modules/notification/notification.controller.ts` | 신규 구현 | GET·PATCH /read-all·PATCH /:id/read | C |
| `src/modules/notification/dto/list-notifications.dto.ts` | 신규 | 목록 쿼리 dto | C |
| `src/modules/notification/notification.module.ts` | 수정 | imports·exports(NotificationService) | C |
| `src/modules/file/file-storage.port.ts` | 신규 | FileStoragePort + FILE_STORAGE 토큰 | B |
| `src/modules/file/stub-file-storage.ts` | 신규 | 결정적 URL stub 구현체 | B |
| `src/modules/file/file.repository.ts` | 신규 구현 | create·findById·delete | A |
| `src/modules/file/file.service.ts` | 신규 구현 | presign·getById·delete | B |
| `src/modules/file/file.controller.ts` | 신규 구현 | POST /presign·GET /:id·DELETE /:id | C |
| `src/modules/file/dto/presign.dto.ts` | 신규 | presign body dto | C |
| `src/modules/file/file.module.ts` | 수정 | imports·FILE_STORAGE 바인딩·exports | C |
| `src/modules/product/product.service.ts` | 수정(additive) | searchProducts 신규 공개(Decimal 변환) | B |
| `src/modules/product/product.repository.ts` | 수정(additive) | searchProducts 신규(products 검색 질의) | A |
| `test/static/cross-schema.spec.ts` | 수정(확장) | NotificationRepository·FileRepository 규칙(SC-053) | D |
| `test/search-notification-file.e2e-spec.ts` | 신규 | AppModule 부팅·라우트 검증(SC-011) | D |

> `package.json` 변경 0건(신규 npm 의존 없음 — NFR-002 자동 충족).

---

## 외부 라이브러리 API 실제 동작 확인

- **신규 외부 라이브러리: 없음 — 해당 없음**. selection-phases.md 자가 점검 결과 신규 npm 0건.
- **`node:crypto` `randomUUID()`**: 표준 라이브러리. presign 의 객체 키 uuid 생성(`{purpose}/{userId}/{randomUUID()}`). RFC 4122 v4 UUID — `[0-9a-f-]{36}` 형식(file.service.spec 가 정규식 단언). 두 번 호출 시 서로 다른 값(키 유일성).
- **`Prisma.Decimal`(decimal.js) — 가격 필터 read-only**: `ProductService.searchProducts` 가 `minPrice`/`maxPrice`(문자열·숫자)를 `new Prisma.Decimal(params.minPrice)` 로 변환하여 `ProductRepository` 에 전달. repository 가 `Prisma.DecimalFilter`(`.gte`/`.lte`)로 조립. **금전 산술(add/mul/minus) 없음** — 범위 비교만. 부동소수점 회피를 위해 DTO 에서 `@IsNumberString` 문자열 입력.
- **`findMany` include/orderBy/count**: products 검색은 `findMany({where, orderBy, skip, take, include:{images:{orderBy:{displayOrder:asc}}}})` + `count({where})` 를 `Promise.all` 동시 실행. 알림 목록은 `findMany({where:{userId}, orderBy:[{isRead:asc},{createdAt:desc},{id:desc}], skip, take})` + `count`. Prisma 표준.
- **`updateMany`(markAllRead)**: `updateMany({where:{userId, isRead:false}, data:{isRead:true}})` → `result.count` 반환. Prisma 공식.

가정-실제 불일치 현재 미발견.

---

## 기술 선택 조사

| 결정 | 채택 | 근거 |
|---|---|---|
| 검색 데이터 소유 | search 자체 테이블 없음 — `ProductService.searchProducts` DI read-only. SearchRepository 빈 클래스 | P-001 모듈 경계(ADR-001). 검색 전용 색인 테이블 대비 데이터 중복·동기화 비용 회피. SC-053 정적 검사로 notification/file 격리 보장(search 는 Prisma 직접 접근 자체가 없어 검사 무관) |
| 알림 테이블 스키마 | 기존 `users` 스키마, 논리 소유 notification 모듈 | 사용자 도메인 인접(ADR-002). userId 는 plain String |
| 파일 테이블 스키마 | 신규 `files` 스키마 | 도메인 경계 명확화(ADR-003). ownerId 는 plain String |
| 객체 스토리지 연동 | `FileStoragePort` + `StubFileStorage`(무네트워크) + `FILE_STORAGE` 토큰 | P-002 외부 의존 추상화(ADR-004). 실제 R2 SDK 직접 의존 회피, 테스트 결정성(`https://r2.stub.local/{key}`) |
| 파일 업로드 모델 | presigned URL 클라이언트 직접 PUT, 서버 메타만 | 서버 프록시 대용량 트래픽 회피(ADR-005) |
| 알림 생성 트리거 | `create()` 공개 진입점만 export | 이벤트 핸들러 연동은 범위 확대(ADR-006). **한계: 실제 생성 경로 부재(GAP-006-01)** |
| 검색 페이지네이션 | offset(page/size) + size 클램핑(20/100) | 정렬 다양성으로 cursor 복잡(ADR-007) |
| 알림 정렬 | 미읽음 우선 → 최신순 → id desc | 미읽음 가시성(ADR-008) |
| 파일 상태 | presign 시 PENDING, UPLOADED confirm 부재 | 범위 단순화(ADR-009). **한계: 고아 PENDING 누적(GAP-006-02)** |

---

## 엣지 케이스 및 한계

- **§E 동일 가드 조건 통합(자원 소유권)**: `notification.markRead` 와 `file.delete` 는 동일 패턴 — `findById`(없으면 404) → 소유자(`userId`/`ownerId`) 비교(불일치 403) → mutation. 두 경로 모두 403/404 케이스에서 mutation repository 호출이 발생하지 않음(테스트가 `not.toHaveBeenCalled()` 단언).
- **search size/page 비정상 입력**: `size = min(max(size ?? 20, 1), 100)`, `page = max(page ?? 1, 1)` 로 음수·0·초과 입력을 방어. size 9999 → 100 클램핑(테스트 단언).
- **검색 노출 상태**: `ProductRepository.searchProducts` 가 `status: { in: [ACTIVE, OUT_OF_STOCK] }` 로 한정 → DRAFT·SUSPENDED 등 미노출. 모든 정렬 tiebreaker `id desc`(결정적 순서).
- **알림 라우팅 충돌 회피**: `PATCH /notifications/read-all`(정적) 이 `PATCH /notifications/:id/read`(파라미터) 보다 컨트롤러 상에서 먼저 선언되어 `read-all` 이 `:id` 로 오인 매칭되지 않음.
- **presign 키 유일성**: `randomUUID()` 로 충돌 방지(`file_assets.key @unique`). 동일 purpose·동일 사용자 2회 presign 시 키 상이(테스트 `when_presign_twice_then_keys_are_unique`).
- **`GET /files/:id` 소유권 미검증(한계)**: 임의 인증 사용자에게 파일 메타 노출(SEC-FIND-006-01). 현재 public URL 모델과 정합하나 비공개 purpose 시 스코핑 필요.
- **presign 입력 무검증(한계)**: contentType allowlist·크기 상한 부재(size=0)(SEC-FIND-006-02). stub 모델 한정 허용.
- **알림 이벤트 미연동(한계)**: `create()` 진입점만 — 실제 알림 생성 경로·통합 시나리오 미검증(GAP-006-01).
- **파일 confirm 부재(한계)**: PENDING→UPLOADED 전이 엔드포인트 없음 → 고아 PENDING 누적 가능(GAP-006-02).
- **search.events·notification.events·file.events 스캐폴드**: 세 `*.events.ts` 는 빈 스캐폴드 주석 파일(이벤트 미발행).
